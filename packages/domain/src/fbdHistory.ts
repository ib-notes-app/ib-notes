// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { HistoricalIbCohort, StudyTemplate } from './index';
import { historicalContentHash } from './studyPack';
import { BACKTEST_DEFINITION, BACKTEST_LABEL, readBacktestEvidence, type BreakoutBacktestEvidence } from './breakoutBacktests';

export const FBD_PACK_FORMAT = 'ib-notes-fbd-history-pack';
export const FBD_PACK_MAX_BYTES = 10 * 1024 * 1024;
export type FbdInfo = {
  title: string; version: string; instrument: string; cohort: HistoricalIbCohort;
  tickSize: number; timeZone: string; qualificationPoints: number;
  definition: 'strict-1h-first-flush-v1' | typeof BACKTEST_DEFINITION; source: string; sourceFile: string; sourceSha256: string;
};
export type FbdPack = { format: typeof FBD_PACK_FORMAT; formatVersion: 1 | 2; info: FbdInfo; data: string; dataSha256: string };
export type HistoricalFlush = { low: number; lowAt: string; reclaimAt: string | null; reclaimPrice: number | null;
  lowBrokenAt: string | null; replacementId: string | null };
export type HistoricalLow = {
  breakoutBacktest?: BreakoutBacktestEvidence;
  id: string; contract: string; price: number; originAt: string; pivotKnownAt: string; qualifiedAt: string;
  confirmationPrice: number; threeHourKnownAt: string | null; cutoffAt: string;
  flushAt: string | null; firstPriceBelow: number | null; episode: HistoricalFlush | null;
};
export type FbdWindow = { contract: string; firstOriginAt: string; cutoffAt: string };
export type FbdBatch = { id: string; journalId: string; importedAt: string; sourceFileName: string; contentSha256: string;
  info: FbdInfo; windows: FbdWindow[]; lowCount: number; flushedCount: number; reclaimedCount: number; threeHourCount: number };
export type ParsedFbdPack = { pack: FbdPack; lows: HistoricalLow[]; windows: FbdWindow[]; contentSha256: string };
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid FBD pack record.');
  return v as Record<string, unknown>;
}
function str(v: unknown, name: string, max = 240): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error(`Invalid ${name}.`);
  return v;
}
function hash(v: unknown): string {
  const s = str(v, 'checksum'); if (!/^[a-f0-9]{64}$/.test(s)) throw new Error('Invalid FBD checksum.'); return s;
}
function num(v: unknown): number {
  if ((typeof v !== 'number' && typeof v !== 'string') || (typeof v === 'string' && !v.trim()) || !Number.isFinite(Number(v))) throw new Error('Invalid FBD price or size.');
  return Number(v);
}
function at(v: unknown): string {
  const s = str(v, 'UTC timestamp'); if (!s.endsWith('Z')) throw new Error('FBD timestamps must include UTC (Z).');
  return Temporal.Instant.from(s).toString({ fractionalSecondDigits: 6 });
}
const optionalAt = (v: unknown) => v === '' ? null : at(v);
function rows(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length > 10000) throw new Error('FBD packs accept up to 10,000 lows or episodes.');
  return v.map(obj);
}
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }

export async function parseFbdPack(text: string): Promise<ParsedFbdPack> {
  assert(new TextEncoder().encode(text).length <= FBD_PACK_MAX_BYTES, 'FBD packs have a 10 MB limit.');
  const raw = obj(JSON.parse(text)), v = obj(raw.info);
  assert(raw.format === FBD_PACK_FORMAT && (raw.formatVersion === 1 || raw.formatVersion === 2), 'Unsupported FBD pack format.');
  const backtests = raw.formatVersion === 2 && v.definition === BACKTEST_DEFINITION;
  assert(backtests || raw.formatVersion === 1 && v.definition === 'strict-1h-first-flush-v1', 'Unsupported significant-low definition.');
  assert(v.cohort === 'REFERENCE' || v.cohort === 'FORWARD_OBSERVATION', 'Declare the FBD study group.');
  const info: FbdInfo = { title: str(v.title, 'title'), version: str(v.version, 'version', 40),
    instrument: str(v.instrument, 'instrument', 20), cohort: v.cohort, tickSize: num(v.tickSize), timeZone: str(v.timeZone, 'timezone'),
    qualificationPoints: num(v.qualificationPoints), definition: v.definition as FbdInfo['definition'], source: str(v.source, 'source', 2000),
    sourceFile: str(v.sourceFile, 'source filename'), sourceSha256: hash(v.sourceSha256) };
  assert(/^[A-Z0-9][A-Z0-9./-]*$/.test(info.instrument) && /^\d+\.\d+\.\d+$/.test(info.version), 'Invalid FBD pack identity.');
  assert(info.tickSize > 0 && info.tickSize <= 1000000 && info.qualificationPoints > 0, 'Invalid FBD price settings.');
  new Intl.DateTimeFormat('en-US', { timeZone: info.timeZone });
  const price = (value: unknown) => {
    const p = num(value); assert(Math.abs(p / info.tickSize - Math.round(p / info.tickSize)) < 1e-6, 'FBD price does not match the tick size.'); return p;
  };
  const data = str(raw.data, 'FBD data', FBD_PACK_MAX_BYTES), dataSha256 = hash(raw.dataSha256);
  assert(await historicalContentHash(data) === dataSha256, 'FBD data does not match its pack checksum.');
  const payload = obj(JSON.parse(data));
  const lows: HistoricalLow[] = rows(payload.lows).map(r => {
    assert(r.instrument === info.instrument && r.cohort === info.cohort, 'A low belongs to another instrument or study group.');
    const low: HistoricalLow = { id: str(r.id, 'low ID'), contract: str(r.contract, 'contract', 80), price: price(r.low), originAt: at(r.origin_at),
      pivotKnownAt: at(r.pivot_known_at), qualifiedAt: at(backtests ? r.qualified_at : r.qualified_20pt_at), confirmationPrice: price(r.confirmation_price),
      cutoffAt: at(r.source_cutoff_at), threeHourKnownAt: optionalAt(r.three_hour_known_at), flushAt: optionalAt(r.first_flush_at),
      firstPriceBelow: r.first_price_below === '' ? null : price(r.first_price_below), episode: null };
    assert(low.originAt < low.pivotKnownAt && low.pivotKnownAt <= low.qualifiedAt && low.qualifiedAt <= low.cutoffAt, 'Low qualification times are out of order.');
    assert(low.confirmationPrice - low.price >= info.qualificationPoints - 1e-8, 'The low did not meet the stated rise threshold.');
    assert(low.flushAt ? low.flushAt > low.qualifiedAt && low.flushAt <= low.cutoffAt && low.firstPriceBelow !== null && low.firstPriceBelow < low.price
      : low.firstPriceBelow === null, 'Invalid first flush evidence.');
    assert(r.untouched_status === (low.flushAt ? 'FLUSHED' : 'UNFLUSHED_AT_SOURCE_CUTOFF'), 'Low status contradicts its first flush.');
    assert(r.three_hour_evidence === (low.threeHourKnownAt ? 'CONFIRMED' : 'NOT_CONFIRMED_IN_AVAILABLE_BARS'), '3H evidence is inconsistent.');
    assert(!low.threeHourKnownAt || (low.threeHourKnownAt >= low.qualifiedAt && low.threeHourKnownAt <= low.cutoffAt && (!low.flushAt || low.threeHourKnownAt < low.flushAt)), '3H confirmation must be known before the first flush.');
    if (backtests) low.breakoutBacktest = readBacktestEvidence(r.formation, low, info);
    else assert(r.formation === undefined, 'Backtest evidence needs its own versioned Low Pack.');
    return low;
  });
  assert(lows.length, 'This FBD pack has no significant lows.');
  const byId = new Map(lows.map(l => [l.id, l]));
  assert(byId.size === lows.length && new Set(lows.map(l => `${l.contract}:${l.originAt}:${l.price}`)).size === lows.length, 'Duplicate significant lows in this pack.');
  for (const r of rows(payload.first_flush_episodes)) {
    const low = byId.get(str(r.level_id, 'episode low ID'));
    assert(low && !low.episode && low.flushAt, 'A flush episode is duplicated or has no matching flushed low.');
    assert(r.contract === low.contract && r.cohort === info.cohort && price(r.original_low) === low.price && at(r.flush_at) === low.flushAt && at(r.source_cutoff_at) === low.cutoffAt, 'Flush episode provenance differs from its low.');
    const e: HistoricalFlush = { low: price(r.flush_low), lowAt: at(r.flush_low_at), reclaimAt: optionalAt(r.reclaim_at),
      reclaimPrice: r.reclaim_price === '' ? null : price(r.reclaim_price), lowBrokenAt: optionalAt(r.flush_low_broken_at),
      replacementId: r.new_qualified_1h_low_id === '' ? null : str(r.new_qualified_1h_low_id, 'replacement low ID') };
    assert(e.low <= low.firstPriceBelow! && e.lowAt >= low.flushAt && e.lowAt <= low.cutoffAt, 'Invalid flushing low.');
    assert(e.reclaimAt ? e.reclaimAt >= e.lowAt && e.reclaimAt <= low.cutoffAt && e.reclaimPrice !== null && e.reclaimPrice > low.price
      : e.reclaimPrice === null, 'Invalid reclaim evidence.');
    assert(r.status === (e.reclaimAt ? 'RECLAIM_OBSERVED' : 'NO_RECLAIM_BY_SOURCE_CUTOFF'), 'Reclaim status contradicts recorded evidence.');
    assert(!e.lowBrokenAt || (!!e.reclaimAt && e.lowBrokenAt >= e.reclaimAt && e.lowBrokenAt <= low.cutoffAt), 'Flushing-low loss cannot precede the reclaim.');
    if (e.replacementId) {
      const replacement = byId.get(e.replacementId);
      assert(replacement && replacement.contract === low.contract && replacement.price === e.low && replacement.originAt === e.lowAt && replacement.qualifiedAt === at(r.new_low_qualified_at), 'Replacement low does not match independent qualification.');
      assert(replacement.flushAt === e.lowBrokenAt, 'Replacement low and flushing-low loss disagree.');
    } else assert(r.new_low_qualified_at === '', 'Replacement time without a replacement low.');
    low.episode = e;
  }
  assert(backtests || lows.every(l => !!l.flushAt === !!l.episode), 'A flushed low is missing its episode.');
  lows.sort((a,b) => a.originAt.localeCompare(b.originAt) || a.id.localeCompare(b.id));
  const windows: FbdWindow[] = [];
  for (const low of lows) {
    const w = windows.find(w => w.contract === low.contract);
    if (w) assert(w.cutoffAt === low.cutoffAt, 'Contract source cutoffs disagree.');
    else windows.push({ contract: low.contract, firstOriginAt: low.originAt, cutoffAt: low.cutoffAt });
  }
  const contentSha256 = await historicalContentHash(JSON.stringify([info.instrument, info.cohort, info.tickSize, info.timeZone, info.qualificationPoints, info.definition, dataSha256]));
  return { pack: { format: FBD_PACK_FORMAT, formatVersion: raw.formatVersion, info, data, dataSha256 }, lows, windows, contentSha256 };
}

export function fbdCompatibility(info: FbdInfo, template: StudyTemplate): { error: string | null; comparison: boolean } {
  const comparison = info.instrument !== template.instrument && [info.instrument, template.instrument].every(s => ['ES','MES'].includes(s));
  const error = info.instrument !== template.instrument && !comparison ? `This pack belongs to ${info.instrument}. Open a matching instrument journal first.`
    : info.tickSize !== template.tickSize || info.timeZone !== template.canonicalTimeZone ? 'This FBD pack uses a different tick size or study timezone from this journal.' : null;
  return { error, comparison };
}
export function fbdImportConflict(parsed: ParsedFbdPack, batches: FbdBatch[]): string | null {
  const existing = batches.filter(b => b.info.cohort === parsed.pack.info.cohort && b.info.definition === parsed.pack.info.definition);
  if (existing.some(b => b.contentSha256 === parsed.contentSha256)) return 'This FBD history is already imported.';
  if (existing.some(b => b.windows.some(a => parsed.windows.some(w => a.contract === w.contract && a.firstOriginAt <= w.cutoffAt && w.firstOriginAt <= a.cutoffAt))))
    return 'This overlaps an installed FBD pack. Remove that FBD pack before replacing it.';
  return null;
}
export function fbdSummary(parsed: ParsedFbdPack) {
  return { windows: parsed.windows, lowCount: parsed.lows.length, flushedCount: parsed.lows.filter(l => l.flushAt).length,
    reclaimedCount: parsed.lows.filter(l => l.episode?.reclaimAt).length, threeHourCount: parsed.lows.filter(l => l.threeHourKnownAt).length };
}
export function historicalLowStatus(low: HistoricalLow): string {
  if (!low.flushAt && low.breakoutBacktest?.coverageHasGaps) return 'No flush recorded · coverage gaps';
  return !low.flushAt ? 'Unflushed at data cutoff' : low.episode?.reclaimAt ? 'Flushed & reclaimed' : 'No reclaim by data cutoff';
}
export type HistoricalLowLine = { price: number; label: string; from: string; through: string };
export function historicalLowLines(low: HistoricalLow, when: string): HistoricalLowLine[] {
  const now = at(when);
  if (now < low.qualifiedAt || now > low.cutoffAt) return [];
  const lines: HistoricalLowLine[] = [{ price: low.price, label: low.flushAt && now >= low.flushAt ? 'Original low · used' : low.breakoutBacktest ? BACKTEST_LABEL : 'Significant low', from: low.qualifiedAt, through: low.cutoffAt }];
  const e = low.episode;
  // Its final depth was not known at the low's origin; wait for the reclaim.
  if (e?.reclaimAt && now >= e.reclaimAt) lines.push({ price: e.low,
    label: e.lowBrokenAt && now >= e.lowBrokenAt ? 'Flushing low · later broken' : 'Flushing low', from: e.reclaimAt, through: low.cutoffAt });
  return lines;
}
