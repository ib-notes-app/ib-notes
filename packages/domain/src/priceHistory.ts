// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { parseCsvRows, type HistoricalIbCohort } from './index';
import type { StudyTemplate } from './instruments';
import { historicalContentHash } from './studyPack';

export const PRICE_PACK_MAX_BYTES = 20 * 1024 * 1024;
export const PRICE_PACK_FORMAT = 'ib-notes-price-history-pack';
export type PriceHours = { overnight_start: string; rth_open: string; fifteen_end: string; a_end: string; ib_end: string; rth_close: string };
export type PriceSessionInfo = { date: string; contract: string; sourceId: string; calendarStatus: 'REGULAR' | 'SHORTENED'; rthClose?: string };
export type PricePackInfo = {
  id: string; title: string; version: string; instrument: string; cohort: HistoricalIbCohort;
  tickSize: number; timeZone: string; resolution: 'TRADES' | 'OHLC_1M'; hours: PriceHours;
  source: string; notes: string[]; calendarBasis: string;
  sources: { id: string; file: string; contract: string; sha256: string }[];
  processorSha256: string; jobSha256: string; sessions: PriceSessionInfo[];
};
export type PriceHistoryPack = { format: typeof PRICE_PACK_FORMAT; formatVersion: 1; info: PricePackInfo;
  minutesCsv: string; eventsCsv: string; minutesSha256: string; eventsSha256: string };
export type HistoryMinute = { at: string; open: number | null; high: number | null; low: number | null;
  close: number | null; volume: number | null; trades: number | null; firstTradeAt: string | null; lastTradeAt: string | null };
export type HistoryPriceEvent = { kind: 'BREAK_OBSERVED' | 'RETURN_OBSERVED' | 'OUTSIDE_IN_BAR' | 'RANGE_OVERLAP_IN_BAR';
  edge: 'IBH' | 'IBL' | ''; at: string | null; knownAt: string; minuteAt: string; price: number | null;
  precision: string; continuity: string; sourceLine: number };
export type PriceDaySummary = PriceSessionInfo & { start: string; openAt: string; fifteenAt: string; aAt: string;
  lockAt: string; end: string; observedMinutes: number; emptyMinutes: number; formationMissing: number; rthMissing: number;
  ibHigh: number | null; ibLow: number | null; eventCount: number };
export type PriceHistoryDay = { summary: PriceDaySummary; minutes: HistoryMinute[]; events: HistoryPriceEvent[] };
export type ParsedPriceHistory = { pack: PriceHistoryPack; contentSha256: string; days: PriceHistoryDay[] };
export type PriceHistoryBatch = { id: string; journalId: string; importedAt: string; sourceFileName: string;
  contentSha256: string; info: PricePackInfo; days: PriceDaySummary[] };

function obj(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid price-history pack.');
  return value as Record<string, unknown>;
}
function str(value: unknown, name: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error('The price pack has too many records or invalid details.');
  return value;
}
function hash(value: unknown): string {
  const result = str(value, 'checksum');
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error('Invalid price pack checksum.');
  return result;
}
function numeric(value: unknown, name: string): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) throw new Error(`Invalid ${name}.`);
  return Number(value);
}
function clock(value: unknown): string {
  const result = str(value, 'study time');
  if (!/^\d{2}:\d{2}$/.test(result)) throw new Error('Study times must use HH:MM.');
  Temporal.PlainTime.from(result);
  return result;
}
function instant(value: string): string {
  if (!value.endsWith('Z')) throw new Error('Price times must include UTC (Z).');
  return Temporal.Instant.from(value).toString({ fractionalSecondDigits: 6 });
}
export function priceTime(value: string): number { return Temporal.Instant.from(value).epochMilliseconds; }
function compareTime(a: string, b: string): number { return Temporal.Instant.compare(a, b); }
export function priceSessionBounds(session: PriceSessionInfo, hours: PriceHours, timeZone: string) {
  const day = Temporal.PlainDate.from(session.date);
  const at = (date: Temporal.PlainDate, time: string) => date.toPlainDateTime(time).toZonedDateTime(timeZone, { disambiguation: 'reject' }).toInstant().toString({ fractionalSecondDigits: 6 });
  const bounds = { start: at(day.subtract({ days: 1 }), hours.overnight_start), openAt: at(day, hours.rth_open),
    fifteenAt: at(day, hours.fifteen_end), aAt: at(day, hours.a_end), lockAt: at(day, hours.ib_end), end: at(day, session.rthClose ?? hours.rth_close) };
  const points = Object.values(bounds).map(priceTime);
  if (points.some((p, i) => i > 0 && p <= points[i - 1]) || points[5] - points[0] > 26 * 3600000) throw new Error('Price pack study hours are not supported.');
  return bounds;
}
function readInfo(value: unknown): PricePackInfo {
  const v = obj(value), rawHours = obj(v.hours);
  const hours = Object.fromEntries(['overnight_start', 'rth_open', 'fifteen_end', 'a_end', 'ib_end', 'rth_close'].map(k => [k, clock(rawHours[k])])) as PriceHours;
  const instrument = str(v.instrument, 'instrument', 20), id = str(v.id, 'pack ID', 100), version = str(v.version, 'version', 40);
  if (!/^[A-Z0-9][A-Z0-9./-]*$/.test(instrument) || !/^[a-z0-9][a-z0-9._-]*$/.test(id) || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid price pack identity.');
  if (v.cohort !== 'REFERENCE' && v.cohort !== 'FORWARD_OBSERVATION') throw new Error('Declare the price pack study group.');
  if (v.resolution !== 'TRADES' && v.resolution !== 'OHLC_1M') throw new Error('Unsupported price source resolution.');
  const tickSize = numeric(v.tickSize, 'tick size');
  if (tickSize <= 0 || tickSize > 1000000) throw new Error('Invalid tick size.');
  const sources = list(v.sources, 64).map(value => { const s = obj(value); return { id: str(s.id, 'source ID'), file: str(s.file, 'source filename', 240), contract: str(s.contract, 'contract', 80), sha256: hash(s.sha256) }; });
  if (new Set(sources.map(s => s.id)).size !== sources.length) throw new Error('Duplicate price source IDs.');
  const sessions = list(v.sessions, 31).map(value => {
    const s = obj(value), date = str(s.date, 'session date', 10), contract = str(s.contract, 'contract', 80), sourceId = str(s.sourceId, 'source ID');
    if (Temporal.PlainDate.from(date).toString() !== date) throw new Error('Invalid session date.');
    if (!sources.some(source => source.id === sourceId && source.contract === contract)) throw new Error('Session source contract does not match.');
    if (s.calendarStatus !== 'REGULAR' && s.calendarStatus !== 'SHORTENED') throw new Error('Only declared open study days can have price history.');
    const rthClose = s.rthClose === undefined ? undefined : clock(s.rthClose);
    if ((s.calendarStatus === 'SHORTENED' && !rthClose) || (rthClose && (s.calendarStatus !== 'SHORTENED' || rthClose >= hours.rth_close))) throw new Error('Check the shortened study close.');
    return { date, contract, sourceId, calendarStatus: s.calendarStatus, ...(rthClose ? { rthClose } : {}) } as PriceSessionInfo;
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!sessions.length || new Set(sessions.map(s => s.date)).size !== sessions.length) throw new Error('Price pack dates must be present and unique (31-day limit).');
  return { id, title: str(v.title, 'title'), version, instrument, cohort: v.cohort, tickSize,
    timeZone: str(v.timeZone, 'study timezone', 80), resolution: v.resolution, hours,
    source: str(v.source, 'source description', 800), notes: list(v.notes, 20).map(n => str(n, 'note', 800)),
    calendarBasis: str(v.calendarBasis, 'calendar source', 800), sources,
    processorSha256: hash(v.processorSha256), jobSha256: hash(v.jobSha256), sessions };
}
function csv(text: string, required: string[], max: number): Record<string, string>[] {
  const [header, ...rows] = parseCsvRows(text);
  if (!header || rows.length > max || new Set(header).size !== header.length || required.some(key => !header.includes(key))) throw new Error('Price CSV columns or row count are invalid.');
  return rows.map(row => {
    if (row.length !== header.length) throw new Error('A price CSV row has missing columns.');
    return Object.fromEntries(header.map((key, i) => [key, row[i]]));
  });
}

export async function parsePriceHistoryPack(text: string): Promise<ParsedPriceHistory> {
  if (new TextEncoder().encode(text).length > PRICE_PACK_MAX_BYTES) throw new Error('Price packs must be 20 MB or smaller. Split the delivery into smaller date groups.');
  const input = obj(JSON.parse(text));
  if (input.format !== PRICE_PACK_FORMAT || input.formatVersion !== 1) throw new Error('Choose an IB Notes price-history pack. Raw research files need to be packaged first.');
  const info = readInfo(input.info);
  if (typeof input.minutesCsv !== 'string' || typeof input.eventsCsv !== 'string') throw new Error('The price pack is missing its CSV data.');
  const [minutesSha256, eventsSha256] = await Promise.all([historicalContentHash(input.minutesCsv), historicalContentHash(input.eventsCsv)]);
  if (minutesSha256 !== hash(input.minutesSha256) || eventsSha256 !== hash(input.eventsSha256)) throw new Error('Price data does not match its pack checksum.');
  const pack: PriceHistoryPack = { format: PRICE_PACK_FORMAT, formatVersion: 1, info, minutesCsv: input.minutesCsv, eventsCsv: input.eventsCsv, minutesSha256, eventsSha256 };
  const days: PriceHistoryDay[] = info.sessions.map(session => ({ summary: { ...session, ...priceSessionBounds(session, info.hours, info.timeZone),
    observedMinutes: 0, emptyMinutes: 0, formationMissing: 0, rthMissing: 0, ibHigh: null, ibLow: null, eventCount: 0 }, minutes: [], events: [] }));
  const byDate = new Map(days.map(day => [day.summary.date, day]));
  const identity = (r: Record<string, string>) => {
    const day = byDate.get(r.rth_date);
    if (!day || r.instrument !== info.instrument || r.contract !== day.summary.contract || r.source_id !== day.summary.sourceId || r.cohort !== info.cohort) throw new Error('A price row belongs to a different date, instrument or study group.');
    return day;
  };
  const price = (v: string) => { const n = numeric(v, 'price'); if (Math.abs(n / info.tickSize - Math.round(n / info.tickSize)) > 1e-6 || Math.abs(n) > 1e10) throw new Error('A price does not match the instrument tick size.'); return n; };
  for (const r of csv(pack.minutesCsv, ['instrument','contract','rth_date','source_id','cohort','minute_start','minute_end','known_at','coverage','source_resolution','open','high','low','close','volume','recorded_trades','first_trade_at','last_trade_at'], 50000)) {
    const day = identity(r), s = day.summary;
    const at = instant(r.minute_start), t = priceTime(at), expected = priceTime(s.start) + day.minutes.length * 60000;
    if (t !== expected || t >= priceTime(s.end) || priceTime(instant(r.minute_end)) !== t + 60000 || instant(r.known_at) !== instant(r.minute_end)) throw new Error('Minute intervals must be ordered, consecutive and known only when complete.');
    if (r.source_resolution !== info.resolution || !['OBSERVED','NO_OBSERVATIONS'].includes(r.coverage)) throw new Error('Invalid minute coverage or source resolution.');
    const observed = r.coverage === 'OBSERVED';
    if (!observed && ['open','high','low','close','volume','recorded_trades','first_trade_at','last_trade_at'].some(k => r[k] !== '')) throw new Error('Missing minutes must have blank observations.');
    const m: HistoryMinute = { at, open: observed ? price(r.open) : null, high: observed ? price(r.high) : null, low: observed ? price(r.low) : null, close: observed ? price(r.close) : null,
      volume: observed ? numeric(r.volume, 'volume') : null, trades: r.recorded_trades === '' ? null : numeric(r.recorded_trades, 'trade count'),
      firstTradeAt: r.first_trade_at ? instant(r.first_trade_at) : null, lastTradeAt: r.last_trade_at ? instant(r.last_trade_at) : null };
    if (observed && (m.high! < Math.max(m.open!, m.close!) || m.low! > Math.min(m.open!, m.close!) || m.volume! < 0 || (m.trades !== null && (!Number.isSafeInteger(m.trades) || m.trades < 0)))) throw new Error('Invalid minute OHLC or trade count.');
    if (observed && info.resolution === 'TRADES') {
      if (!m.firstTradeAt || !m.lastTradeAt || !m.trades || compareTime(m.firstTradeAt, at) < 0 || compareTime(m.lastTradeAt, r.minute_end) >= 0 || compareTime(m.firstTradeAt, m.lastTradeAt) > 0) throw new Error('Trade times must stay inside their minute.');
    } else if (info.resolution === 'OHLC_1M' && (m.firstTradeAt || m.lastTradeAt)) throw new Error('Bar data cannot supply exact trade times.');
    observed ? s.observedMinutes++ : s.emptyMinutes++;
    if (t >= priceTime(s.openAt)) {
      if (!observed) s.rthMissing++;
      if (t < priceTime(s.lockAt)) {
        if (!observed) s.formationMissing++;
        else { s.ibHigh = Math.max(s.ibHigh ?? m.high!, m.high!); s.ibLow = Math.min(s.ibLow ?? m.low!, m.low!); }
      }
    }
    day.minutes.push(m);
  }
  for (const day of days) {
    if (day.minutes.length * 60000 !== priceTime(day.summary.end) - priceTime(day.summary.start)) throw new Error('Price history is missing minute slots; include explicit empty intervals.');
    if (day.summary.formationMissing) { day.summary.ibHigh = null; day.summary.ibLow = null; }
  }
  for (const r of csv(pack.eventsCsv, ['instrument','contract','rth_date','source_id','cohort','event','edge','observed_at','known_at','minute_start','minute_end','price','time_precision','continuity','source_line','locked_ibh','locked_ibl'], 100000)) {
    const day = identity(r), s = day.summary, minuteAt = instant(r.minute_start), t = priceTime(minuteAt);
    const minute = day.minutes[(t - priceTime(s.start)) / 60000];
    const trade = info.resolution === 'TRADES', kinds = trade ? ['BREAK_OBSERVED','RETURN_OBSERVED'] : ['OUTSIDE_IN_BAR','RANGE_OVERLAP_IN_BAR'];
    if (!kinds.includes(r.event) || !minute || minute.close === null || t < priceTime(s.lockAt) || s.ibHigh === null || s.ibLow === null || price(r.locked_ibh) !== s.ibHigh || price(r.locked_ibl) !== s.ibLow) throw new Error('An event does not match the observed locked IB.');
    const at = r.observed_at ? instant(r.observed_at) : null, knownAt = instant(r.known_at), eventPrice = r.price ? price(r.price) : null;
    if (priceTime(instant(r.minute_end)) !== t + 60000 || (trade ? !at || compareTime(at, minuteAt) < 0 || compareTime(at, r.minute_end) >= 0 || knownAt !== at : at !== null || priceTime(knownAt) !== t + 60000)) throw new Error('Event timing or precision is invalid.');
    if (!['IBH','IBL'].includes(r.edge) && !(r.event === 'RANGE_OVERLAP_IN_BAR' && r.edge === '')) throw new Error('Invalid event edge.');
    if (trade && (eventPrice === null || eventPrice < minute.low! || eventPrice > minute.high!)) throw new Error('Event price falls outside its observed minute.');
    if (r.event === 'BREAK_OBSERVED' && !(r.edge === 'IBH' ? eventPrice! > s.ibHigh : eventPrice! < s.ibLow)) throw new Error('An IB break must exceed its edge.');
    if (r.event === 'RETURN_OBSERVED' && (eventPrice! < s.ibLow || eventPrice! > s.ibHigh)) throw new Error('An IB return must be inside or on its boundary.');
    if (!trade && (eventPrice !== null || (r.event === 'OUTSIDE_IN_BAR' && !(r.edge === 'IBH' ? minute.high! > s.ibHigh : minute.low! < s.ibLow)))) throw new Error('Invalid unordered bar event.');
    const precision = str(r.time_precision, 'event precision'), allowed = trade ? ['SOURCE_TIMESTAMP','SOURCE_TIMESTAMP_TIED_FILE_ORDER_ONLY'] : ['ONE_MINUTE_UNORDERED'];
    if (!allowed.includes(precision)) throw new Error('Event precision does not match its source.');
    const sourceLine = numeric(r.source_line, 'source line');
    const previous = day.events.at(-1);
    if (!Number.isSafeInteger(sourceLine) || sourceLine < 2 || (previous && (compareTime(knownAt, previous.knownAt) < 0 || sourceLine < previous.sourceLine || (trade && sourceLine === previous.sourceLine)))) throw new Error('Events must retain chronological source order.');
    day.events.push({ kind: r.event as HistoryPriceEvent['kind'], edge: r.edge as HistoryPriceEvent['edge'], at, knownAt, minuteAt, price: eventPrice,
      precision, continuity: str(r.continuity, 'continuity'), sourceLine });
    s.eventCount++;
  }
  const contentSha256 = await historicalContentHash(JSON.stringify([info.instrument, info.cohort, info.tickSize, info.timeZone, info.hours, info.sessions, minutesSha256, eventsSha256]));
  return { pack, days, contentSha256 };
}

export function priceHistoryCompatibility(info: PricePackInfo, template: StudyTemplate): { error: string | null; comparison: boolean } {
  const comparison = info.instrument !== template.instrument && [info.instrument, template.instrument].every(s => ['ES','MES'].includes(s));
  if (info.instrument !== template.instrument && !comparison) return { error: `This pack belongs to ${info.instrument}. Open a matching instrument journal first.`, comparison: false };
  const h = info.hours, c = template.checkpoints;
  if (info.tickSize !== template.tickSize || info.timeZone !== template.canonicalTimeZone ||
    [h.overnight_start,h.rth_open,h.fifteen_end,h.a_end,h.ib_end,h.rth_close].some((v,i) => v !== [template.overnightStart,c.overnightLock,c.fifteenMinuteLock,c.aLock,c.ibLock,c.studyClose][i].slice(0,5))) {
    return { error: 'This price pack uses different study hours, timezone or tick size from this journal.', comparison };
  }
  return { error: null, comparison };
}

export async function createPriceHistoryPack(info: PricePackInfo, minutesCsv: string, eventsCsv: string): Promise<PriceHistoryPack> {
  const candidate: PriceHistoryPack = { format: PRICE_PACK_FORMAT, formatVersion: 1, info, minutesCsv, eventsCsv,
    minutesSha256: await historicalContentHash(minutesCsv), eventsSha256: await historicalContentHash(eventsCsv) };
  return (await parsePriceHistoryPack(JSON.stringify(candidate))).pack;
}

export function developingPriceRanges(day: PriceHistoryDay): { high: number | null; low: number | null; missing: boolean }[] {
  let high: number | null = null, low: number | null = null, missing = false;
  return day.minutes.map(m => {
    if (compareTime(m.at, day.summary.openAt) >= 0 && compareTime(m.at, day.summary.lockAt) < 0) {
      if (m.high === null) missing = true;
      else { high = Math.max(high ?? m.high, m.high); low = Math.min(low ?? m.low!, m.low!); }
    }
    return { high, low, missing };
  });
}
