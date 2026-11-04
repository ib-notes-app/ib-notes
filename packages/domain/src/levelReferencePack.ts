// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { historicalContentHash, studyPackCompatibility } from './studyPack';
import type { SignificantLevel, SignificantLevelTimeframe, StudyTemplate } from './index';
import type { ParsedPriceHistory } from './priceHistory';

export const LEVEL_REFERENCE_PACK_FORMAT = 'ib-notes-level-reference-pack';
export type LevelReference = {
  id: string; sourceId: string; contract: string; levelType: 'high';
  shape: 'single_price' | 'price_zone'; price: number | null; zoneLow: number | null; zoneHigh: number | null;
  originAt: string; knownAt: string; sourceTimeframe: SignificantLevelTimeframe; label: string;
  kind: 'DAILY_HIGH' | 'RANGE_HIGH' | 'RESISTANCE_SHELF';
  evidence: { dates: string[]; low: number; high: number };
};
export type LevelReferenceInfo = {
  id: string; title: string; version: string; instrument: string; tickSize: number; timeZone: string;
  preparedOn: string; notes: string[];
  sources: Array<{ id: string; file: string; contract: string; sha256: string }>;
};
export type LevelReferencePack = { format: typeof LEVEL_REFERENCE_PACK_FORMAT; formatVersion: 1;
  info: LevelReferenceInfo; data: string; dataSha256: string };
export type ParsedLevelReferences = { pack: LevelReferencePack; levels: LevelReference[]; contentSha256: string };
const check = (ok: unknown, message: string): void => { if (!ok) throw new Error(message); };
const plain = (v: unknown, max = 240): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u001f]/.test(v);
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const at = (v: string) => Temporal.Instant.from(v).epochMilliseconds;

/** Monthly contents only: normal journal references, never a new forecast training cohort. */
export async function parseLevelReferencePack(text: string): Promise<ParsedLevelReferences> {
  check(new TextEncoder().encode(text).length <= 2 * 1024 * 1024, 'Level reference contents have a 2 MB limit.');
  const pack = JSON.parse(text) as LevelReferencePack, info = pack.info;
  check(pack.format === LEVEL_REFERENCE_PACK_FORMAT && pack.formatVersion === 1, 'Unsupported level reference contents.');
  check(info && plain(info.id, 100) && plain(info.title, 200) && plain(info.instrument, 20) &&
    /^\d+\.\d+\.\d+$/.test(info.version) && Number.isFinite(info.tickSize) && info.tickSize > 0, 'Invalid level reference identity.');
  check(Temporal.PlainDate.from(info.preparedOn).toString() === info.preparedOn, 'Invalid level preparation date.');
  Temporal.PlainDate.from(info.preparedOn).toZonedDateTime(info.timeZone);
  check(Array.isArray(info.notes) && info.notes.length <= 20 && info.notes.every(n => plain(n, 1000)), 'Invalid level reference notes.');
  check(Array.isArray(info.sources) && info.sources.length > 0 && info.sources.length <= 40 &&
    info.sources.every(s => plain(s.id, 100) && plain(s.file) && !/[/\\]/.test(s.file) && plain(s.contract, 40) && hash(s.sha256)) &&
    new Set(info.sources.map(s => s.id)).size === info.sources.length, 'Invalid level reference sources.');
  check(typeof pack.data === 'string' && hash(pack.dataSha256) && await historicalContentHash(pack.data) === pack.dataSha256,
    'Level references do not match their checksum.');
  const levels = JSON.parse(pack.data) as LevelReference[];
  check(Array.isArray(levels) && levels.length > 0 && levels.length <= 2000 && new Set(levels.map(l => l.id)).size === levels.length,
    'Invalid or duplicate level references.');
  const tick = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n / info.tickSize - Math.round(n / info.tickSize)) < 1e-6;
  for (const l of levels) {
    const source = info.sources.find(s => s.id === l.sourceId);
    check(plain(l.id, 180) && source?.contract === l.contract && l.levelType === 'high' &&
      ['DAILY_HIGH','RANGE_HIGH','RESISTANCE_SHELF'].includes(l.kind) && plain(l.label, 120) &&
      ['session','1h','3h','1h+3h','4h','daily','other'].includes(l.sourceTimeframe), 'Invalid resistance reference.');
    check(l.shape === 'single_price' ? tick(l.price) && l.zoneLow === null && l.zoneHigh === null :
      l.shape === 'price_zone' && l.price === null && tick(l.zoneLow) && tick(l.zoneHigh) && l.zoneLow < l.zoneHigh,
      'Invalid resistance price or zone.');
    check(plain(l.originAt) && plain(l.knownAt) && at(l.originAt) <= at(l.knownAt) &&
      Temporal.Instant.from(l.knownAt).toZonedDateTimeISO(info.timeZone).toPlainDate().toString() <= info.preparedOn,
      'Resistance knowledge time must follow its origin and precede preparation.');
    check(l.evidence && Array.isArray(l.evidence.dates) && l.evidence.dates.length > 0 && l.evidence.dates.length <= 30 &&
      l.evidence.dates.every(d => Temporal.PlainDate.from(d).toString() === d &&
        d <= Temporal.Instant.from(l.knownAt).toZonedDateTimeISO(info.timeZone).toPlainDate().toString()) &&
      tick(l.evidence.low) && tick(l.evidence.high) && l.evidence.low <= (l.price ?? l.zoneLow!) &&
      (l.price ?? l.zoneHigh!) <= l.evidence.high, 'Invalid resistance anchors.');
    if (l.kind === 'DAILY_HIGH') {
      const day = Temporal.Instant.from(l.originAt).toZonedDateTimeISO(info.timeZone).toPlainDate().toString();
      check(l.sourceTimeframe === 'daily' && l.shape === 'single_price' && l.price === l.evidence.high &&
        l.evidence.dates.length === 1 && l.evidence.dates[0] === day &&
        Temporal.Instant.from(l.knownAt).toZonedDateTimeISO(info.timeZone).toPlainDate().toString() === day,
        'A daily high must retain its session date and upper anchor.');
    }
  }
  const canonical = levels.map(l => ({ id:l.id, sourceId:l.sourceId, contract:l.contract, levelType:l.levelType,
    shape:l.shape, price:l.price, zoneLow:l.zoneLow, zoneHigh:l.zoneHigh, originAt:l.originAt, knownAt:l.knownAt,
    sourceTimeframe:l.sourceTimeframe, label:l.label, kind:l.kind,
    evidence:{ dates:[...l.evidence.dates], low:l.evidence.low, high:l.evidence.high } }));
  return { pack, levels:canonical, contentSha256: await historicalContentHash(text) };
}

/** Reuse checked minute history. A completed daily high is knowable at the session close;
 * incomplete sessions are omitted, and a minute identifies an approximate formation time. */
export function dailyHighReferences(prices: ParsedPriceHistory): LevelReference[] {
  return prices.days.flatMap(day => {
    const s = day.summary, minutes = day.minutes.filter(m => at(m.at) >= at(s.openAt) && at(m.at) < at(s.end));
    if (s.rthMissing || minutes.length !== (at(s.end) - at(s.openAt)) / 60_000 ||
      minutes.some(m => m.high === null || m.low === null)) return [];
    const high = Math.max(...minutes.map(m => m.high!)), low = Math.min(...minutes.map(m => m.low!));
    const peak = minutes.find(m => m.high === high)!;
    return [{ id: `${s.contract}:rth-high:${s.date}`, sourceId: s.sourceId, contract: s.contract,
      levelType: 'high' as const, shape: 'single_price' as const, price: high, zoneLow: null, zoneHigh: null,
      originAt: peak.at, knownAt: s.end, sourceTimeframe: 'daily' as const, label: `${s.date} Daily High`,
      kind: 'DAILY_HIGH' as const, evidence: { dates: [s.date], low, high } }];
  });
}
export async function createLevelReferencePack(info: LevelReferenceInfo, levels: LevelReference[]): Promise<LevelReferencePack> {
  const data = JSON.stringify(levels), pack: LevelReferencePack = { format: LEVEL_REFERENCE_PACK_FORMAT, formatVersion: 1,
    info, data, dataSha256: await historicalContentHash(data) };
  return (await parseLevelReferencePack(JSON.stringify(pack))).pack;
}
export function levelReferenceCompatibility(info: LevelReferenceInfo, template: StudyTemplate): string | null {
  return studyPackCompatibility(info, template).error ?? (info.tickSize !== template.tickSize || info.timeZone !== template.canonicalTimeZone
    ? 'These levels use different tick or session-clock settings.' : null);
}
export function referenceJournalLevel(reference: LevelReference, info: LevelReferenceInfo, template: StudyTemplate,
  owner: string, packId: string, importedAt: string): SignificantLevel {
  const date = Temporal.Instant.from(reference.originAt).toZonedDateTimeISO(info.timeZone).toPlainDate().toString();
  return { id: `level:pack-reference:${owner}:${reference.id}`, instrument: template.instrument,
    createdInSessionId: `${owner === 'es' ? 'ES' : owner}:${date}`, createdInRthDate: date,
    levelType: reference.levelType, shape: reference.shape, price: reference.price, zoneLow: reference.zoneLow, zoneHigh: reference.zoneHigh,
    originTimePrecision: 'approximate', originAt: reference.originAt, sourceTimeframe: reference.sourceTimeframe,
    label: reference.label, note: null, notes: [], marketEvents: [], episodes: [], producedTwentyPlus: false,
    qualifyingMoveDirection: null, qualifyingMovePoints: null, linkedCpObservationId: null, showOnMap: false,
    createdAt: reference.knownAt, updatedAt: importedAt, currentStatus: 'active', lifecycleEvents: [], revisionHistory: [],
    studyReplay: { packId, sourceId: reference.id, knownAt: reference.knownAt, contract: reference.contract,
      importedAt, scope: 'CONTRACT', kind: 'RESISTANCE_REFERENCE', sourceStatus: 'RECORDED_HIGH',
      levelReference: { reference, info } } };
}
