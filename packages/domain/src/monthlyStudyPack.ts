// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { HistoricalIbImportPreview, StudyTemplate } from './index';
import { historicalContentHash, parseHistoricalStudyFile, studyPackCompatibility } from './studyPack';
import { parsePriceHistoryPack, priceHistoryCompatibility, type ParsedPriceHistory } from './priceHistory';
import { parseFbdPack, fbdCompatibility, type ParsedFbdPack, type HistoricalLow } from './fbdHistory';
import { parseContextPack, contextCompatibility, type ParsedContextPack } from './contextHistory';
import { parseLevelReferencePack, levelReferenceCompatibility, type ParsedLevelReferences } from './levelReferencePack';

export const MONTHLY_PACK_FORMAT = 'ib-notes-monthly-study-pack';
export const MONTHLY_PACK_MAX_BYTES = 32 * 1024 * 1024;
export type MonthlyPackKind = 'daily' | 'price' | 'fbd' | 'context' | 'levels';
export type MonthlyPackManifest = {
  id: string; instrument: string; month: string; version: string; preparedOn: string; notes: string[];
};
export type MonthlyPackPart = { fileName: string; pack: Record<string, unknown> };
export type MonthlyStudyPack = { format: typeof MONTHLY_PACK_FORMAT; formatVersion: 1;
  manifest: MonthlyPackManifest; parts: MonthlyPackPart[]; contentSha256: string };
export type ParsedMonthlyPart =
  | { kind: 'daily'; fileName: string; parsed: HistoricalIbImportPreview }
  | { kind: 'price'; fileName: string; parsed: ParsedPriceHistory }
  | { kind: 'fbd'; fileName: string; parsed: ParsedFbdPack }
  | { kind: 'context'; fileName: string; parsed: ParsedContextPack }
  | { kind: 'levels'; fileName: string; parsed: ParsedLevelReferences };
export type MonthlyPackContents = { ibDays: number; priceDays: number; lows: number; events: number; holidays: number; levels?: number };
export type MonthlyLevelFilter = { levelIds: string[]; lowBatchIds: string[] };
export type ParsedMonthlyStudyPack = { pack: MonthlyStudyPack; parts: ParsedMonthlyPart[]; contents: MonthlyPackContents };
export type MonthlyPackLink = { kind: MonthlyPackKind; batchIds: string[] };
export type MonthlyPackBatch = { id: string; journalId: string; importedAt: string; sourceFileName: string;
  manifest: MonthlyPackManifest; contentSha256: string; contents: MonthlyPackContents; links: MonthlyPackLink[];
  managedBatchIds: string[] };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid monthly Study Pack.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max = 240): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value))
    throw new Error(`Invalid Study Pack ${label}.`);
  return value;
}
export function monthlyPackId(instrument: string, month: string): string {
  return `${instrument.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${month}`;
}
export function monthlyPackTitle(manifest: Pick<MonthlyPackManifest, 'instrument' | 'month'>): string {
  const date = new Date(`${manifest.month}-01T12:00:00Z`);
  return `${manifest.instrument} · ${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)}`;
}
export function comparePackVersions(a: string, b: string): number {
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i]! - right[i]!);
  return 0;
}
function readManifest(value: unknown): MonthlyPackManifest {
  const v = object(value), instrument = text(v.instrument, 'instrument', 20), month = text(v.month, 'month', 7);
  if (!/^[A-Z0-9][A-Z0-9./-]*$/.test(instrument) || !/^\d{4}-\d{2}$/.test(month)) throw new Error('Invalid Study Pack instrument or month.');
  Temporal.PlainYearMonth.from(month);
  const id = text(v.id, 'ID', 100), version = text(v.version, 'version', 40), preparedOn = text(v.preparedOn, 'preparation date', 10);
  if (id !== monthlyPackId(instrument, month) || !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(version)) throw new Error('Invalid monthly Study Pack identity.');
  if (Temporal.PlainDate.from(preparedOn).toString() !== preparedOn) throw new Error('Invalid Study Pack preparation date.');
  if (!Array.isArray(v.notes) || v.notes.length > 20) throw new Error('Invalid Study Pack notes.');
  return { id, instrument, month, version, preparedOn, notes: v.notes.map(n => text(n, 'note', 1000)) };
}
export async function createMonthlyStudyPack(manifest: MonthlyPackManifest, parts: MonthlyPackPart[]): Promise<MonthlyStudyPack> {
  const payload = { manifest, parts };
  const pack: MonthlyStudyPack = { format: MONTHLY_PACK_FORMAT, formatVersion: 1, ...payload,
    contentSha256: await historicalContentHash(JSON.stringify(payload)) };
  return (await parseMonthlyStudyPack(JSON.stringify(pack))).pack;
}
export async function parseMonthlyStudyPack(rawText: string, importedAt = '1970-01-01T00:00:00Z'): Promise<ParsedMonthlyStudyPack> {
  if (new TextEncoder().encode(rawText).byteLength > MONTHLY_PACK_MAX_BYTES) throw new Error('Monthly Study Packs have a 32 MB limit.');
  const v = object(JSON.parse(rawText));
  if (v.format !== MONTHLY_PACK_FORMAT || v.formatVersion !== 1) throw new Error('Unsupported monthly Study Pack format.');
  const manifest = readManifest(v.manifest);
  if (!Array.isArray(v.parts) || !v.parts.length || v.parts.length > 8) throw new Error('A Study Pack needs 1–8 supported contents.');
  const parts = v.parts.map(value => {
    const p = object(value), fileName = text(p.fileName, 'filename');
    if (/[/\\]/.test(fileName) || !fileName.endsWith('.json')) throw new Error('Use a pack filename without a directory.');
    return { fileName, pack: object(p.pack) };
  });
  if (new Set(parts.map(p => p.fileName)).size !== parts.length) throw new Error('Duplicate component filename in Study Pack.');
  const contentSha256 = await historicalContentHash(JSON.stringify({ manifest, parts }));
  if (v.contentSha256 !== contentSha256) throw new Error('Study Pack contents do not match its checksum. Choose an intact copy.');
  const parsedParts: ParsedMonthlyPart[] = [], seen = new Set<string>();
  const contents: MonthlyPackContents = { ibDays: 0, priceDays: 0, lows: 0, events: 0, holidays: 0 };
  const withinMonth = (dates: string[]) => {
    if (dates.some(d => !d.startsWith(`${manifest.month}-`))) throw new Error('IB days, price days and events must belong to the named month.');
  };
  for (const part of parts) {
    const text = JSON.stringify(part.pack), info = object(part.pack.info ?? part.pack.manifest);
    if (info.instrument !== manifest.instrument) throw new Error('All contents must retain the monthly pack’s source instrument.');
    let parsed: ParsedMonthlyPart;
    if (part.pack.format === 'ib-notes-study-pack') {
      if (info.cohort !== 'REFERENCE' && info.cohort !== 'FORWARD_OBSERVATION') throw new Error('Missing IB data-use setting.');
      const preview = await parseHistoricalStudyFile(text, part.fileName, importedAt, info.cohort);
      if (preview.blockingErrors.length) throw new Error(preview.blockingErrors.slice(0, 3).join(' '));
      withinMonth(preview.sessions.map(s => s.rthDate)); contents.ibDays += preview.rowCount;
      parsed = { kind: 'daily', fileName: part.fileName, parsed: preview };
    } else if (part.pack.format === 'ib-notes-price-history-pack') {
      const prices = await parsePriceHistoryPack(text); withinMonth(prices.days.map(d => d.summary.date));
      contents.priceDays += prices.days.length; parsed = { kind: 'price', fileName: part.fileName, parsed: prices };
    } else if (part.pack.format === 'ib-notes-fbd-history-pack') {
      // Supporting low libraries may include older origins and later dated evidence.
      // Existing readers enforce their knowledge-time and exact-contract boundaries.
      const lows = await parseFbdPack(text); contents.lows += lows.lows.length;
      parsed = { kind: 'fbd', fileName: part.fileName, parsed: lows };
    } else if (part.pack.format === 'ib-notes-context-pack') {
      const context = await parseContextPack(text); withinMonth(context.events.map(e => e.sessionDate));
      contents.holidays += context.events.filter(e => e.holiday).length;
      contents.events += context.events.filter(e => !e.holiday).length;
      parsed = { kind: 'context', fileName: part.fileName, parsed: context };
    } else if (part.pack.format === 'ib-notes-level-reference-pack') {
      const levels = await parseLevelReferencePack(text); contents.levels = levels.levels.length;
      parsed = { kind: 'levels', fileName: part.fileName, parsed: levels };
    } else throw new Error('Unsupported Study Pack contents. Use IB, price, level or event material.');
    const key = `${parsed.kind}:${info.cohort}${parsed.kind === 'fbd' ? `:${info.definition}` : ''}`;
    if (seen.has(key)) throw new Error('Duplicate content type and data-use setting in Study Pack.');
    seen.add(key); parsedParts.push(parsed);
  }
  return { pack: { format: MONTHLY_PACK_FORMAT, formatVersion: 1, manifest, parts, contentSha256 }, parts: parsedParts, contents };
}
export function monthlyPackCompatibility(parsed: ParsedMonthlyStudyPack, template: StudyTemplate): string | null {
  for (const part of parsed.parts) {
    if (part.kind === 'levels') {
      const error = levelReferenceCompatibility(part.parsed.pack.info, template);
      if (error) return error;
      continue;
    }
    const check = part.kind === 'daily' ? studyPackCompatibility(part.parsed.studyPack!, template)
      : part.kind === 'price' ? priceHistoryCompatibility(part.parsed.pack.info, template)
      : part.kind === 'fbd' ? fbdCompatibility(part.parsed.pack.info, template)
      : contextCompatibility(part.parsed.pack.info, template);
    if (check.error) return check.error;
  }
  return null;
}
export function monthlyPackImportIssue(parsed: ParsedMonthlyStudyPack, installed: MonthlyPackBatch[], availableBatchIds?: Set<string>): string | null {
  const existing = installed.find(b => b.manifest.id === parsed.pack.manifest.id);
  if (!existing) return null;
  const comparison = comparePackVersions(parsed.pack.manifest.version, existing.manifest.version);
  if (comparison < 0) return 'A newer version of this month is already installed.';
  if (comparison === 0 && parsed.pack.contentSha256 !== existing.contentSha256) return 'Changed contents need a newer pack version.';
  if (comparison === 0 && (!availableBatchIds || existing.links.every(l => l.batchIds.every(id => availableBatchIds.has(id)))))
    return 'This Study Pack is already installed.';
  return null;
}

/** A later cutoff may add observations, but cannot silently change an earlier known fact. */
export function lowHistoryCovers(cover: HistoricalLow, prior: HistoricalLow): boolean {
  const same = (keys: (keyof HistoricalLow)[]) => keys.every(k => cover[k] === prior[k]);
  if (!same(['id', 'contract', 'price', 'originAt', 'pivotKnownAt', 'qualifiedAt', 'confirmationPrice']) ||
    Temporal.Instant.compare(cover.cutoffAt, prior.cutoffAt) < 0) return false;
  if (!!cover.breakoutBacktest !== !!prior.breakoutBacktest) return false;
  if (prior.breakoutBacktest && cover.breakoutBacktest) {
    const { continuousThrough: a, coverageHasGaps: _a, ...formation } = cover.breakoutBacktest;
    const { continuousThrough: b, coverageHasGaps: _b, ...oldFormation } = prior.breakoutBacktest;
    if (JSON.stringify(formation) !== JSON.stringify(oldFormation) || Temporal.Instant.compare(a, b) < 0) return false;
  }
  const known = (at: string | null) => at !== null && Temporal.Instant.compare(at, prior.cutoffAt) <= 0;
  if ((known(cover.threeHourKnownAt) ? cover.threeHourKnownAt : null) !== prior.threeHourKnownAt ||
      (known(cover.flushAt) ? cover.flushAt : null) !== prior.flushAt) return false;
  if (!prior.flushAt) return true;
  if (prior.breakoutBacktest && !prior.episode && !cover.episode) return cover.firstPriceBelow === prior.firstPriceBelow;
  if (cover.firstPriceBelow !== prior.firstPriceBelow || !cover.episode || !prior.episode) return false;
  const current = cover.episode, old = prior.episode;
  if ((known(current.reclaimAt) ? current.reclaimAt : null) !== old.reclaimAt ||
      (known(current.lowBrokenAt) ? current.lowBrokenAt : null) !== old.lowBrokenAt) return false;
  // A final flushing low becomes knowable on reclaim, rather than at its eventual origin.
  return !old.reclaimAt || current.low === old.low && current.lowAt === old.lowAt && current.reclaimPrice === old.reclaimPrice &&
    (!old.replacementId || current.replacementId === old.replacementId);
}
