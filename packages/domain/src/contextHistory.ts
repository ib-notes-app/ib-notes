// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { HistoricalIbCohort, StudyTemplate, JournalSession } from './index';
import { historicalContentHash } from './studyPack';
import { EVENT_WINDOW, eventFamily } from './eventWindows';
import { holidayDayStart, validateHolidayContext, type HolidayContext } from './holidays';

export const CONTEXT_PACK_FORMAT = 'ib-notes-context-pack';
export const CONTEXT_PACK_MAX_BYTES = 10 * 1024 * 1024;
export type ContextResult = { measure: string; actual: number; units: string; sourceUrl: string; availableAt: string };
export type ContextPriceWindow = { period: 'BEFORE_60' | 'AFTER_15' | 'AFTER_60'; observedMinutes: number; expectedMinutes: number; change: number | null };
export type ContextEvent = {
  id: string; name: string; eventAt: string; sessionDate: string; referencePeriod: string;
  sourceUrl: string; retrievedOn: string; results: ContextResult[];
  holiday?: HolidayContext;
  prices: { contract: string; baseline: number | null; baselineAgeSeconds: number | null; windows: ContextPriceWindow[] } | null;
};
export type ContextInfo = { title: string; version: string; instrument: string; cohort: HistoricalIbCohort; timeZone: string;
  source: string; sourceFile: string; sourceSha256: string };
export type ContextPack = { format: typeof CONTEXT_PACK_FORMAT; formatVersion: 1 | 2; info: ContextInfo; data: string; dataSha256: string };
export type ParsedContextPack = { pack: ContextPack; events: ContextEvent[]; contentSha256: string };
export type ContextBatch = { id: string; journalId: string; importedAt: string; sourceFileName: string; contentSha256: string; info: ContextInfo; events: ContextEvent[] };
export type ContextMatch = { event: ContextEvent; batch: ContextBatch };

function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid Context Pack record.');
  return v as Record<string, unknown>;
}
function str(v: unknown, field: string, max = 300): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`Invalid Context Pack ${field}.`);
  return v;
}
function num(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`Invalid Context Pack ${field}.`);
  return v;
}
function nullable(v: unknown, field: string): number | null { return v === null ? null : num(v, field); }
function date(v: unknown): string {
  const s = str(v, 'date', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Temporal.PlainDate.from(s).toString() !== s) throw new Error('Invalid Context Pack date.');
  return s;
}
function instant(v: unknown): string { return Temporal.Instant.from(str(v, 'timestamp', 40)).toString(); }
function url(v: unknown): string {
  const s = str(v, 'source link', 2000), u = new URL(s);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Context Pack source links must use HTTPS.');
  return s;
}
function hash(v: unknown): string {
  const s = str(v, 'checksum', 64);
  if (!/^[a-f0-9]{64}$/.test(s)) throw new Error('Invalid Context Pack checksum.');
  return s;
}
function eventRecord(value: unknown): ContextEvent {
  const v = object(value), eventAt = instant(v.eventAt);
  const sessionDate = date(v.sessionDate);
  const holiday = v.holiday === undefined ? undefined : validateHolidayContext(v.holiday, sessionDate);
  if (holiday && (eventAt !== holidayDayStart(sessionDate, holiday.timeZone) ||
    !Array.isArray(v.results) || v.results.length || v.prices !== null)) {
    throw new Error('An all-day holiday needs a day-start anchor and no release results or price windows.');
  }
  if (!Array.isArray(v.results) || v.results.length > 20) throw new Error('Invalid Context Pack results.');
  const measures = new Set<string>();
  const results = v.results.map(row => {
    const r = object(row), measure = str(r.measure, 'measure'), availableAt = instant(r.availableAt);
    if (measures.has(measure) || Temporal.Instant.compare(availableAt, eventAt) < 0) throw new Error('Duplicate measure or result available before release.');
    measures.add(measure);
    return { measure, availableAt, actual: num(r.actual, 'actual result'), units: str(r.units, 'units', 40), sourceUrl: url(r.sourceUrl) };
  });
  let prices: ContextEvent['prices'] = null;
  if (v.prices !== null) {
    const p = object(v.prices), baseline = nullable(p.baseline, 'baseline'), baselineAgeSeconds = nullable(p.baselineAgeSeconds, 'baseline age');
    if ((baseline === null) !== (baselineAgeSeconds === null) || baselineAgeSeconds !== null && baselineAgeSeconds < 0) throw new Error('Invalid release baseline.');
    if (!Array.isArray(p.windows) || p.windows.length !== 3) throw new Error('Expected three price windows.');
    const periods = new Set<string>();
    const windows: ContextPriceWindow[] = p.windows.map(row => {
      const w = object(row), period = str(w.period, 'window') as ContextPriceWindow['period'];
      if (!['BEFORE_60', 'AFTER_15', 'AFTER_60'].includes(period) || periods.has(period)) throw new Error('Invalid or duplicate price window.');
      periods.add(period);
      const expectedMinutes = period === 'AFTER_15' ? 15 : 60, observedMinutes = num(w.observedMinutes, 'observed minutes');
      const change = nullable(w.change, 'price change');
      if (w.expectedMinutes !== expectedMinutes || !Number.isInteger(observedMinutes) || observedMinutes < 0 || observedMinutes > expectedMinutes) throw new Error('Invalid minute coverage.');
      if (change !== null && (observedMinutes !== expectedMinutes || period !== 'BEFORE_60' && (baselineAgeSeconds === null || baselineAgeSeconds > 60))) throw new Error('A price change needs complete minute coverage and a recent baseline.');
      return { period, expectedMinutes, observedMinutes, change };
    });
    prices = { contract: str(p.contract, 'contract', 80), baseline, baselineAgeSeconds, windows };
  }
  return { id: str(v.id, 'event ID'), name: str(v.name, 'event name', 120), eventAt, sessionDate, ...(holiday ? { holiday } : {}),
    referencePeriod: str(v.referencePeriod, 'reference period', 120), sourceUrl: url(v.sourceUrl), retrievedOn: date(v.retrievedOn), results, prices };
}
const eventKey = (e: ContextEvent) => `${e.holiday ? 'holiday:' : ''}${e.name.trim().toLowerCase().replace(/\s+/g, ' ')}:${e.eventAt}`;
export async function parseContextPack(text: string): Promise<ParsedContextPack> {
  if (new TextEncoder().encode(text).byteLength > CONTEXT_PACK_MAX_BYTES) throw new Error('Context Packs have a 10 MB limit.');
  const v = object(JSON.parse(text));
  if (v.format !== CONTEXT_PACK_FORMAT || ![1, 2].includes(v.formatVersion as number)) throw new Error('Unsupported Context Pack format.');
  const raw = object(v.info), cohort = raw.cohort;
  if (cohort !== 'REFERENCE' && cohort !== 'FORWARD_OBSERVATION') throw new Error('Invalid Context Pack data group.');
  const timeZone = str(raw.timeZone, 'timezone', 80);
  Temporal.Instant.from('2024-01-01T00:00:00Z').toZonedDateTimeISO(timeZone);
  const info: ContextInfo = { title: str(raw.title, 'title'), version: str(raw.version, 'version', 40), instrument: str(raw.instrument, 'instrument', 40),
    cohort, timeZone, source: str(raw.source, 'source', 3000), sourceFile: str(raw.sourceFile, 'source file'), sourceSha256: hash(raw.sourceSha256) };
  const data = str(v.data, 'event data', CONTEXT_PACK_MAX_BYTES), dataSha256 = hash(v.dataSha256);
  if (await historicalContentHash(data) !== dataSha256) throw new Error('Context data does not match its pack checksum.');
  const rows = JSON.parse(data);
  if (!Array.isArray(rows) || !rows.length || rows.length > 2000) throw new Error('Context Packs must contain 1–2,000 events.');
  const events = rows.map(eventRecord), ids = new Set<string>(), keys = new Set<string>();
  if (v.formatVersion === 1 && events.some(e => e.holiday)) throw new Error('All-day holidays require Context Pack format version 2.');
  for (const e of events) {
    if (e.holiday && e.holiday.timeZone !== info.timeZone) throw new Error('Holiday dates must use the Context Pack study timezone.');
    if (ids.has(e.id) || keys.has(eventKey(e))) throw new Error('Duplicate event in Context Pack.');
    ids.add(e.id); keys.add(eventKey(e));
  }
  events.sort((a, b) => Temporal.Instant.compare(a.eventAt, b.eventAt) || a.id.localeCompare(b.id));
  return { pack: { format: CONTEXT_PACK_FORMAT, formatVersion: v.formatVersion as 1 | 2, info, data, dataSha256 }, events,
    contentSha256: await historicalContentHash(JSON.stringify({ info, dataSha256 })) };
}
export function contextCompatibility(info: ContextInfo, template: StudyTemplate): { error: string | null; comparison: boolean } {
  const paired = ['ES', 'MES'].includes(info.instrument) && ['ES', 'MES'].includes(template.instrument);
  const comparison = paired && info.instrument !== template.instrument;
  return { comparison, error: info.instrument !== template.instrument && !paired ? 'This Context Pack is for a different instrument.'
    : info.timeZone !== template.canonicalTimeZone ? 'This Context Pack uses a different study timezone.' : null };
}
export function contextImportConflict(parsed: ParsedContextPack, batches: ContextBatch[]): string | null {
  const same = batches.filter(b => b.info.cohort === parsed.pack.info.cohort);
  if (same.some(b => b.contentSha256 === parsed.contentSha256)) return 'This Context Pack is already imported.';
  const ids = new Set(same.flatMap(b => b.events.map(e => e.id))), keys = new Set(same.flatMap(b => b.events.map(eventKey)));
  return parsed.events.some(e => ids.has(e.id) || keys.has(eventKey(e))) ? 'These events overlap an installed Context Pack. Remove that pack before replacing it.' : null;
}
export function contextEventsAt(batches: ContextBatch[], at: string, scope: { instrument: string; cohort: HistoricalIbCohort }, until?: string): ContextMatch[] {
  const start = Temporal.Instant.from(at).epochNanoseconds, end = until ? Temporal.Instant.from(until).epochNanoseconds : start;
  return batches.filter(b => b.info.instrument === scope.instrument && b.info.cohort === scope.cohort).flatMap(batch => batch.events
    .filter(e => { const release = Temporal.Instant.from(e.eventAt).epochNanoseconds;
      if (e.holiday) {
        const nextDay = Temporal.PlainDate.from(e.sessionDate).add({ days: 1 }).toString();
        const dayEnd = Temporal.Instant.from(holidayDayStart(nextDay, e.holiday.timeZone)).epochNanoseconds;
        return start < dayEnd && (until ? end > release : start >= release);
      }
      return start <= release + BigInt(EVENT_WINDOW.afterMinutes) * 60_000_000_000n &&
      (until ? end > release - BigInt(EVENT_WINDOW.beforeMinutes) * 60_000_000_000n : start >= release - BigInt(EVENT_WINDOW.beforeMinutes) * 60_000_000_000n); })
    .map(event => ({ event, batch })));
}

/** Daily context uses the journal's study date, independently of its display timezone. */
export function contextPacksForSession(batches: ContextBatch[], session: JournalSession): ContextBatch[] {
  return batches.filter(batch => batch.journalId === session.journalId && !contextCompatibility(batch.info, session.market).error);
}
export function contextEventsForSession(batches: ContextBatch[], session: JournalSession): ContextMatch[] {
  return contextPacksForSession(batches, session).flatMap(batch => batch.events
    .filter(event => event.sessionDate === session.rthDate).map(event => ({ event, batch })))
    .sort((a, b) => Temporal.Instant.compare(a.event.eventAt, b.event.eventAt) || a.batch.id.localeCompare(b.batch.id));
}
export function contextPackEventState(session: JournalSession, { event, batch }: ContextMatch): 'new' | 'saved' | 'removed' {
  const sameSource = (item: JournalSession['marketContextItems'][number] | null) =>
    item?.contextPack?.eventId === event.id && item.contextPack.instrument === batch.info.instrument &&
      item.contextPack.cohort === batch.info.cohort;
  if (session.marketContextItems.some(item => sameSource(item) ||
    Boolean(item.holiday) === Boolean(event.holiday) && Date.parse(item.eventAt) === Date.parse(event.eventAt) && eventFamily(item.name) === eventFamily(event.name))) return 'saved';
  if (session.marketContextHistory.some(entry => sameSource(entry.prior))) return 'removed';
  return 'new';
}
/** Explicitly selected event identities enter the journal; results and price outcomes never do. */
export function withContextPackEvents(session: JournalSession, matches: ContextMatch[], recordedAt: string): JournalSession {
  Temporal.Instant.from(recordedAt);
  const items = [...session.marketContextItems];
  for (const match of matches) {
    const { event, batch } = match;
    if (batch.journalId !== session.journalId || event.sessionDate !== session.rthDate || contextCompatibility(batch.info, session.market).error) continue;
    if (contextPackEventState({ ...session, marketContextItems: items }, match) !== 'new') continue;
    items.push({ id: `pack-context:${batch.id}:${event.id}`, name: event.name,
      eventDate: event.holiday ? event.sessionDate : Temporal.Instant.from(event.eventAt).toZonedDateTimeISO(session.displayTimeZone).toPlainDate().toString(),
      ...(event.holiday ? { holiday: event.holiday } : {}),
      eventAt: event.eventAt, source: 'manual', note: null, recordedAt,
      contextPack: { batchId: batch.id, eventId: event.id, title: batch.info.title, instrument: batch.info.instrument,
        cohort: batch.info.cohort, referencePeriod: event.referencePeriod, sourceUrl: event.sourceUrl } });
  }
  if (items.length === session.marketContextItems.length) return session;
  return { ...session, marketContextItems: items.sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt)),
    forecastCoverage: { ...session.forecastCoverage, news: 'reviewed' }, updatedAt: recordedAt };
}
