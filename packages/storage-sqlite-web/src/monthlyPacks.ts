// SPDX-License-Identifier: MPL-2.0
import type { Database } from '@sqlite.org/sqlite-wasm';
import { installBacktestLevels } from './backtestLevels';
import { installReferenceLevels } from './referenceLevels';
import { historicalIbBatchFromPreview, normalizeHistoricalIbSession, fbdSummary, lowHistoryCovers,
  monthlyPackImportIssue, monthlyPackCompatibility, type MonthlyPackBatch, type ParsedMonthlyStudyPack,
  type MonthlyPackKind, type HistoricalIbImportBatch, type HistoricalIbSession, type PriceHistoryBatch,
  type PriceHistoryDay, type FbdBatch, type HistoricalLow, type ContextBatch, type StudyTemplate } from '@ib-field-notes/domain';

const prefix = 'monthly-study-pack:';
function read<T>(db: Database, sql: string, bind: string[] = []): T[] {
  return (db.exec({ sql, bind, rowMode: 'object', returnValue: 'resultRows' }) as Array<{ payload: string }>)
    .map(r => JSON.parse(r.payload) as T);
}
export function listMonthlyPacks(db: Database, owner?: string): MonthlyPackBatch[] {
  const packs = read<MonthlyPackBatch>(db, "SELECT value AS payload FROM journal_setting WHERE name LIKE 'monthly-study-pack:%' ORDER BY name");
  return packs.filter(p => !owner || p.journalId === owner).sort((a, b) => b.manifest.month.localeCompare(a.manifest.month));
}
function writePack(db: Database, pack: MonthlyPackBatch): void {
  db.exec({ sql: 'INSERT INTO journal_setting (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value',
    bind: [`${prefix}${pack.journalId}:${pack.manifest.id}`, JSON.stringify(pack)] });
}
const tables = { daily: 'historical_ib_import_batch', price: 'price_history_batch', fbd: 'fbd_history_batch', context: 'context_history_batch' } as const;
function deleteBatch(db: Database, owner: string, kind: MonthlyPackKind, id: string): void {
  if (kind === 'levels') return; // Carried levels belong to the journal, including after pack removal.
  const child = kind === 'daily' ? 'historical_ib_session' : kind === 'price' ? 'price_history_day' : kind === 'fbd' ? 'fbd_history_low' : null;
  if (child) db.exec({ sql: `DELETE FROM ${child} WHERE batch_id = ? AND journal_id = ?`, bind: [id, owner] });
  db.exec({ sql: `DELETE FROM ${tables[kind]} WHERE id = ? AND journal_id = ?`, bind: [id, owner] });
}
function batches<T>(db: Database, owner: string, kind: MonthlyPackKind): T[] {
  if (kind === 'levels') return [];
  return read<T>(db, `SELECT payload FROM ${tables[kind]} WHERE journal_id = ?`, [owner]);
}
function availableIds(db: Database, owner: string): Set<string> {
  return new Set([...Object.keys(tables).flatMap(kind => batches<{ id: string }>(db, owner, kind as MonthlyPackKind).map(b => b.id)),
    ...read<{ id: string }>(db, 'SELECT payload FROM significant_level WHERE journal_id = ?', [owner]).map(l => l.id)]);
}
function dailyValue(row: HistoricalIbSession): string {
  const { id, batchId, journalId, sourceFileName, sourceRowNumber, importedAt, ...facts } = normalizeHistoricalIbSession(row);
  return JSON.stringify(facts);
}
function priceValue(day: PriceHistoryDay): string {
  const { sourceId, ...summary } = day.summary;
  return JSON.stringify({ summary, minutes: day.minutes, events: day.events.map(({ sourceLine, ...event }) => event) });
}
function insertPayload(db: Database, table: string, columns: string[], values: (string | number)[]): void {
  db.exec({ sql: `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, bind: values });
}

/** Atomic library import, with additive backtest levels. Existing journal entries are never rewritten. */
export function installMonthlyPack(db: Database, owner: string, template: StudyTemplate,
  parsed: ParsedMonthlyStudyPack, fileName: string, importedAt: string): void {
  const compatibility = monthlyPackCompatibility(parsed, template);
  if (compatibility) throw new Error(compatibility);
  const installed = listMonthlyPacks(db, owner), previous = installed.find(p => p.manifest.id === parsed.pack.manifest.id);
  const issue = monthlyPackImportIssue(parsed, installed, availableIds(db, owner));
  if (issue) throw new Error(issue);
  const managed = new Set(installed.flatMap(p => p.managedBatchIds));
  const otherPacks = installed.filter(p => p !== previous);
  const otherReferences = new Set(otherPacks.flatMap(p => p.links.flatMap(l => l.batchIds)));
  const pack: MonthlyPackBatch = { id: `${owner}:monthly:${parsed.pack.manifest.id}`, journalId: owner, importedAt,
    sourceFileName: fileName.slice(0, 240), manifest: parsed.pack.manifest, contentSha256: parsed.pack.contentSha256,
    contents: parsed.contents, links: [], managedBatchIds: [] };
  const remapped = new Map<string, string>();
  db.exec('BEGIN IMMEDIATE');
  try {
    // Changed components owned only by this month can be replaced directly.
    // Shared and legacy records remain until an equivalent or extending source is established.
    for (const link of previous?.links ?? []) for (const id of link.batchIds) {
      if (link.kind === 'levels') continue;
      if (!previous!.managedBatchIds.includes(id) || otherReferences.has(id)) continue;
      const stored = batches<{ id: string; contentSha256: string }>(db, owner, link.kind).find(b => b.id === id);
      if (!stored || parsed.parts.some(p => p.kind === link.kind && p.parsed.contentSha256 === stored.contentSha256)) continue;
      deleteBatch(db, owner, link.kind, id);
    }
    for (const part of parsed.parts) {
      if (part.kind === 'levels') {
        pack.links.push({ kind: 'levels', batchIds: installReferenceLevels(db, owner, template, part.parsed, pack.id, importedAt) });
        continue;
      }
      const cohort = part.kind === 'daily' ? part.parsed.cohort : part.parsed.pack.info.cohort;
      const hash = part.parsed.contentSha256;
      const existing = batches<{ id: string; contentSha256: string; cohort?: string; info?: { cohort: string } }>(db, owner, part.kind);
      const identical = existing.find(b => b.contentSha256 === hash && (b.cohort ?? b.info?.cohort) === cohort);
      const linked = new Set<string>();
      const id = part.kind === 'daily' ? `${owner}:${historicalIbBatchFromPreview(part.parsed, importedAt).id}` : `${owner}:${part.kind === 'price' ? 'price' : part.kind === 'fbd' ? 'fbd' : 'context'}:${cohort}:${hash}`;
      let created = false;
      if (identical) linked.add(identical.id);
      else if (part.kind === 'daily') {
        const current = read<HistoricalIbSession>(db, 'SELECT payload FROM historical_ib_session WHERE journal_id = ? AND cohort = ?', [owner, cohort]);
        const added: HistoricalIbSession[] = [];
        for (const incoming of part.parsed.sessions) {
          const old = current.find(r => r.rthDate === incoming.rthDate);
          if (old) {
            if (dailyValue(old) !== dailyValue(incoming)) throw new Error(`${incoming.rthDate} has different IB history already installed. Existing history was kept.`);
            linked.add(old.batchId);
          } else added.push({ ...incoming, id: `${id}:${incoming.rthDate}`, batchId: id, journalId: owner, importedAt });
        }
        if (added.length) {
          const batch: HistoricalIbImportBatch = { ...historicalIbBatchFromPreview(part.parsed, importedAt), id, journalId: owner, importedAt,
            rowCount: added.length, completeRowCount: added.filter(r => r.status === 'OK').length,
            missingRowCount: added.filter(r => r.status !== 'OK').length, years: [...new Set(added.map(r => r.sourceYear))].sort() };
          insertPayload(db, tables.daily, ['id','cohort','source_file_name','imported_at','payload','journal_id'], [id, cohort, part.fileName, importedAt, JSON.stringify(batch), owner]);
          for (const row of added) insertPayload(db, 'historical_ib_session', ['id','batch_id','cohort','rth_date','source_year','payload','journal_id'],
            [row.id, id, cohort, row.rthDate, row.sourceYear, JSON.stringify(row), owner]);
          created = true;
        }
      } else if (part.kind === 'price') {
        const added: PriceHistoryDay[] = [];
        for (const day of part.parsed.days) {
          const rows = db.exec({ sql: 'SELECT batch_id, payload FROM price_history_day WHERE journal_id = ? AND cohort = ? AND rth_date = ?',
            bind: [owner, cohort, day.summary.date], rowMode: 'object', returnValue: 'resultRows' }) as Array<{ batch_id: string; payload: string }>;
          if (rows.length) {
            if (priceValue(JSON.parse(rows[0]!.payload)) !== priceValue(day)) throw new Error(`${day.summary.date} has different price history already installed. Existing history was kept.`);
            linked.add(rows[0]!.batch_id);
          } else added.push(day);
        }
        if (added.length) {
          const batch: PriceHistoryBatch = { id, journalId: owner, importedAt, sourceFileName: part.fileName, contentSha256: hash,
            info: part.parsed.pack.info, days: added.map(d => d.summary) };
          insertPayload(db, tables.price, ['id','journal_id','cohort','content_sha256','imported_at','payload'], [id, owner, cohort, hash, importedAt, JSON.stringify(batch)]);
          for (const day of added) insertPayload(db, 'price_history_day', ['batch_id','journal_id','cohort','rth_date','payload'], [id, owner, cohort, day.summary.date, JSON.stringify(day)]);
          created = true;
        }
      } else if (part.kind === 'context') {
        const current = batches<ContextBatch>(db, owner, 'context').filter(b => b.info.cohort === cohort);
        const added = part.parsed.events.filter(event => {
          const old = current.flatMap(batch => batch.events.map(e => ({ batch, event: e }))).find(e => e.event.id === event.id ||
            e.event.name.toLowerCase() === event.name.toLowerCase() && e.event.eventAt === event.eventAt);
          if (!old) return true;
          if (JSON.stringify(old.event) !== JSON.stringify(event)) throw new Error(`${event.name} has different event history already installed. Existing history was kept.`);
          linked.add(old.batch.id); return false;
        });
        if (added.length) {
          const batch: ContextBatch = { id, journalId: owner, importedAt, sourceFileName: part.fileName, contentSha256: hash, info: part.parsed.pack.info, events: added };
          insertPayload(db, tables.context, ['id','journal_id','cohort','content_sha256','imported_at','payload'], [id, owner, cohort, hash, importedAt, JSON.stringify(batch)]);
          created = true;
        }
      } else {
        const incoming = part.parsed;
        const current = batches<FbdBatch>(db, owner, 'fbd').filter(b => b.info.cohort === cohort);
        const lowCache = new Map<string, HistoricalLow[]>();
        const oldLows = (batch: FbdBatch) => {
          if (!lowCache.has(batch.id)) lowCache.set(batch.id, read<HistoricalLow>(db,
            'SELECT payload FROM fbd_history_low WHERE journal_id = ? AND batch_id = ?', [owner, batch.id]));
          return lowCache.get(batch.id)!;
        };
        const sameDefinition = (batch: FbdBatch) => ['instrument','cohort','tickSize','timeZone','qualificationPoints','definition'].every(k =>
          batch.info[k as keyof FbdBatch['info']] === incoming.pack.info[k as keyof FbdBatch['info']]);
        const covers = current.find(b => sameDefinition(b) && incoming.lows.every(l => oldLows(b).some(old => lowHistoryCovers(old, l))));
        if (covers) linked.add(covers.id);
        else {
          const overlapping = current.filter(b => b.info.definition === incoming.pack.info.definition && b.windows.some(w => incoming.windows.some(n => w.contract === n.contract && w.firstOriginAt <= n.cutoffAt && n.firstOriginAt <= w.cutoffAt)));
          for (const old of overlapping) {
            if (!managed.has(old.id) || !sameDefinition(old) || !oldLows(old).every(l => incoming.lows.some(n => lowHistoryCovers(n, l))))
              throw new Error('These lows conflict with an existing library. Existing history was kept.');
            // Extend a shared monthly level library once, and retain every month’s link.
            deleteBatch(db, owner, 'fbd', old.id); remapped.set(old.id, id);
          }
          const batch: FbdBatch = { id, journalId: owner, importedAt, sourceFileName: part.fileName, contentSha256: hash,
            info: incoming.pack.info, ...fbdSummary(incoming) };
          insertPayload(db, tables.fbd, ['id','journal_id','cohort','imported_at','payload'], [id, owner, cohort, importedAt, JSON.stringify(batch)]);
          for (const low of incoming.lows) insertPayload(db, 'fbd_history_low', ['batch_id','journal_id','low_id','payload'], [id, owner, low.id, JSON.stringify(low)]);
          created = true;
        }
      }
      if (created) { linked.add(id); managed.add(id); }
      if (part.kind === 'fbd') installBacktestLevels(db, owner, template, part.parsed.lows, [...linked][0]!, importedAt);
      pack.links.push({ kind: part.kind, batchIds: [...linked].sort() });
    }
    for (const other of otherPacks) {
      if (!other.links.some(l => l.batchIds.some(id => remapped.has(id)))) continue;
      const links = other.links.map(l => ({ ...l, batchIds: [...new Set(l.batchIds.map(id => remapped.get(id) ?? id))] }));
      writePack(db, { ...other, links, managedBatchIds: [...new Set(other.managedBatchIds.map(id => remapped.get(id) ?? id))] });
    }
    pack.managedBatchIds = [...new Set(pack.links.flatMap(l => l.batchIds).filter(id => managed.has(id)))];
    writePack(db, pack);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function removeMonthlyPack(db: Database, owner: string, packId: string): void {
  const installed = listMonthlyPacks(db, owner), pack = installed.find(p => p.id === packId);
  if (!pack) throw new Error('This Study Pack is not in the selected journal.');
  const keep = new Set(installed.filter(p => p !== pack).flatMap(p => p.links.flatMap(l => l.batchIds)));
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const link of pack.links) for (const id of link.batchIds) if (pack.managedBatchIds.includes(id) && !keep.has(id)) deleteBatch(db, owner, link.kind, id);
    db.exec({ sql: 'DELETE FROM journal_setting WHERE name = ?', bind: [`${prefix}${owner}:${pack.manifest.id}`] });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
