// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { carryRangeEdgesForward, deriveFinalIb, deriveClosingOutcome, deriveRange, type JournalSession, type RangeCheckpoint,
  type RangeCheckpointRevision, type HistoricalIbSession, type HistoricalIbImportBatch } from './index';
import { deriveIbRead } from './ibRead';
import { studyPackCompatibility } from './studyPack';
import { roundManualPriceFields } from './priceTicks';
import {deriveSessionRecordedIb} from './recordedIb';

export type SessionReadWindow = { now: string; openAt: string; ibLockAt: string; closeAt: string };
const ns = (at: string) => Temporal.Instant.from(at).epochNanoseconds;
const finite = (n: number | null): n is number => n !== null && Number.isFinite(n);
const empty: RangeCheckpoint = { high: null, low: null, cp: null, status: 'pending', note: null, confirmedAt: null };

/** Display the current session's forming overnight facts, without confirming its range. */
export function deriveSessionOvernightRead(session: JournalSession,
  window: { now: string; overnightStartAt: string; openAt: string }) {
  const now = ns(window.now), start = ns(window.overnightStartAt);
  if (now < start || now >= ns(window.openAt)) return null;
  const snapshot = session.preOpenSnapshots.filter(row => ns(row.recordedAt) >= start && ns(row.recordedAt) <= now).at(-1);
  const {high,low} = roundManualPriceFields({high:snapshot?.formingOvernightHigh ?? null,
    low:snapshot?.formingOvernightLow ?? null},session.market.tickSize);
  const knownAt = snapshot?.recordedAt ?? window.overnightStartAt;
  const scope = `session:${session.id}`;
  const read = deriveIbRead({ asOf: window.now, windowStart: window.overnightStartAt,
    contract: scope, tickSize: session.market.tickSize, sampling: 'MANUAL_PRICES',
    prices: session.cpObservations.filter(row => !row.recordedAt || ns(row.recordedAt) <= now)
      .map(row => ({ at: row.observedAt, price: row.price, contract: scope })),
    references: finite(high) && finite(low) ? [{ id: 'on', kind: 'ON', high, low, knownAt,
      contract: scope, source: 'Current journal overnight range' }] : [],
  });
  // A range update must not relocate an older price into the new range.
  const price = read.latest && ns(read.latest.at) >= ns(knownAt) ? read.latest.price : null;
  const geometry = deriveRange({ high, low, cp: price });
  return { high, low, width: geometry?.width ?? null, rangeKnownAt: knownAt,
    positionPercent: geometry?.cpPositionPct ?? null, read };
}

/** Current saved records only. This is not a historical knowledge-time replay. */
export function deriveSessionIbRead(session: JournalSession, window: SessionReadWindow, options: { provisional?: boolean } = {}) {
  const now = ns(window.now), open = ns(window.openAt), lock = ns(window.ibLockAt);
  if (now < open) return null;
  const cutoff = now < ns(window.closeAt) ? window.now : window.closeAt;
  const visible = (range: RangeCheckpoint, history: RangeCheckpointRevision[]) => {
    const last = history.at(-1);
    const recordedAt = last?.recordedAt ?? range.confirmedAt ?? session.updatedAt;
    const observedAt = last?.observedAt ?? recordedAt;
    return ns(recordedAt) <= now && ns(observedAt) <= ns(cutoff)
      ? { range, observedAt } : { range: empty, observedAt: window.openAt };
  };
  const fifteen = visible(session.fifteenMinute, session.fifteenMinuteHistory);
  const a = visible(session.aPeriod, session.aPeriodHistory);
  const b = visible(session.bPeriod, session.bPeriodHistory);
  const snapshots = session.bSnapshots.filter(s => ns(s.recordedAt) <= now && ns(s.observedAt) <= ns(cutoff));
  const aRange = carryRangeEdgesForward(a.range, fifteen.range);
  const bRange = carryRangeEdgesForward(b.range, fifteen.range, aRange, ...snapshots);
  const final = now >= lock ? deriveFinalIb(aRange, bRange) : null;
  // Live reads and descriptive statistics share the same recorded bounds.
  // Confirmation remains separate from observing a price beyond those bounds.
  const recorded=now>=lock&&options.provisional===true?deriveSessionRecordedIb({...session,
    fifteenMinute:fifteen.range,aPeriod:a.range,bPeriod:b.range,bSnapshots:snapshots},window.now):null;
  const provisional = !final&&recorded!==null;
  const savedRange = now < lock ? carryRangeEdgesForward(fifteen.range, a.range, ...snapshots, b.range) : final ?? recorded;
  const range = savedRange ? roundManualPriceFields(savedRange,session.market.tickSize) : null;
  const phase = now < lock ? 'FORMING' as const : range && finite(range.high) && finite(range.low) ? 'LOCKED' as const : 'PENDING' as const;
  // A current forming snapshot cannot relocate earlier CPs within a later range.
  const rangeTimes = [fifteen, a, b].filter(r => finite(r.range.high) || finite(r.range.low)).map(r => r.observedAt);
  const knownAt = phase === 'FORMING'
    ? [...rangeTimes, ...snapshots.map(s => s.observedAt)].sort((x, y) => ns(x) < ns(y) ? -1 : ns(x) > ns(y) ? 1 : 0).at(-1) ?? window.openAt
    : window.ibLockAt;
  // CPs are scoped to this session. No contract is inferred or joined to an external path.
  const scope = `session:${session.id}`;
  const prices = [
    ...session.cpObservations.map(p => ({ at: p.observedAt, price: p.price, contract: scope })),
    ...session.rthObservations.filter(p => ns(p.recordedAt) <= now)
      .map(p => ({ at: p.observedAt, price: p.price, contract: scope })),
    ...(session.close.price !== null && session.close.observedAt && session.close.recordedAt && ns(session.close.recordedAt) <= now
      ? [{ at: session.close.observedAt, price: session.close.price, contract: scope }] : []),
  ];
  const read = deriveIbRead({ asOf: cutoff, windowStart: window.openAt, contract: scope,
    sampling: 'MANUAL_PRICES', tickSize: session.market.tickSize, prices,
    references: range && finite(range.high) && finite(range.low) ? [{ id: 'ib', kind: 'IB',
      high: range.high, low: range.low, knownAt, contract: scope, source: 'Current journal ranges' }] : [] });
  const lockPrices = read.observations.filter(p => ns(p.at) === lock);
  const lockPrice = phase === 'LOCKED' && lockPrices.length && lockPrices.every(p => p.price === lockPrices[0]!.price)
    ? lockPrices[0]!.price : null;
  return { phase, asOf: cutoff, rangeKnownAt: knownAt, provisional,
    high: range?.high ?? null, low: range?.low ?? null,
    width: range && finite(range.high) && finite(range.low) ? range.high - range.low : null,
    lockPrice, read, closed: session.close.finishedAt !== null && ns(session.close.finishedAt) <= now };
}

export const ibPositionQuartile = (position: number) => position < 25 ? 0 : position < 50 ? 1 : position < 75 ? 2 : 3;

/** Display-only classification of the recorded post-lock path at its latest price.
 * Reuses the closing code rules without recording a close or finalizing the day. */
export function deriveCurrentIbCode(session: JournalSession, current: ReturnType<typeof deriveSessionIbRead>): string | null {
  if(!current||current.phase!=='LOCKED'||current.high===null||current.low===null||!current.width||!current.read.ib)return null;
  const {latest,observations,ib}=current.read;
  if(!current.closed&&(!latest||ns(latest.at)<=ns(ib.knownAt)))return null;
  const prices=observations.filter(p=>ns(p.at)>ns(ib.knownAt));
  const projection:JournalSession={...session,
    rthObservations:prices.map((p,i)=>({id:`code-${i}`,price:p.price,observedAt:p.at,recordedAt:p.at,note:null,cpObservationId:null})),
    close:current.closed?session.close:{...session.close,price:latest!.price,pathComplete:false},
  };
  const outcome=deriveClosingOutcome(projection,{high:current.high,low:current.low,cp:null},session.market.tickSize);
  // During a live session IBN means no break recorded yet, not a completed no-break day.
  return outcome?.breakCode??(!current.closed?'IBN':null);
}
export type LockPositionReference = {
  positionPct: number; quartile: number; matchingDays: number;
  firstBreak: Record<'IBH' | 'IBL' | 'none', number>;
  years: Array<{ year: string; matchingDays: number; firstBreak: Record<'IBH' | 'IBL' | 'none', number> }>;
  sources: Array<{ id: string; contentSha256: string; importedAt: string }>;
  rowIds: string[];
};

/** Descriptive reuse of the IB-close position study; never feeds the estimator. */
export function deriveLockPositionReference(session: JournalSession,
  current: ReturnType<typeof deriveSessionIbRead>, rows: HistoricalIbSession[], batches: HistoricalIbImportBatch[],
  now: string): LockPositionReference | null {
  if (!current || current.phase !== 'LOCKED' || current.lockPrice === null || current.low === null ||
    current.high === null || !current.width || current.lockPrice < current.low || current.lockPrice > current.high) return null;
  const time = ns(now), positionPct = 100 * (current.lockPrice - current.low) / current.width;
  const quartile = ibPositionQuartile(positionPct);
  const compatible = new Map(batches.filter(b => b.cohort === 'REFERENCE' && (b.journalId ?? 'es') === session.journalId &&
    ns(b.importedAt) <= time && !studyPackCompatibility(b.studyPack ?? { instrument: session.instrument }, session.market).error)
    .map(b => [b.id, b]));
  const dated = new Map<string, HistoricalIbSession[]>();
  for (const row of rows) {
    if (row.cohort !== 'REFERENCE' || (row.journalId ?? 'es') !== session.journalId || row.rthDate >= session.rthDate ||
      !compatible.has(row.batchId) || ns(row.importedAt) > time) continue;
    const values = dated.get(row.rthDate) ?? []; values.push(row); dated.set(row.rthDate, values);
  }
  const firstBreak = { IBH: 0, IBL: 0, none: 0 }, years = new Map<string, LockPositionReference['years'][number]>();
  const sources = new Set<string>(), rowIds: string[] = [];
  for (const candidates of dated.values()) {
    // Duplicate dates cannot vote twice; divergent versions cannot select the favorable result.
    const signature = (r: HistoricalIbSession) => JSON.stringify([r.status, r.lockedIbh, r.lockedIbl,
      r.lockedIbWidthPoints, r.cp0730, r.cp0730PositionPct, r.firstBreakSide, r.dayType]);
    if (candidates.some(r => signature(r) !== signature(candidates[0]!))) continue;
    const row = [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0]!;
    if (row.status !== 'OK' || !finite(row.cp0730) || !finite(row.lockedIbh) || !finite(row.lockedIbl) ||
      !finite(row.lockedIbWidthPoints) || row.lockedIbh <= row.lockedIbl ||
      Math.abs(row.lockedIbh - row.lockedIbl - row.lockedIbWidthPoints) > 1e-8 ||
      row.cp0730 < row.lockedIbl || row.cp0730 > row.lockedIbh) continue;
    const pct = 100 * (row.cp0730 - row.lockedIbl) / row.lockedIbWidthPoints;
    // CSV positions are rounded to two decimals; compute the actual quartile from prices.
    if (row.cp0730PositionPct !== null && (!finite(row.cp0730PositionPct) || Math.abs(pct - row.cp0730PositionPct) > .011)) continue;
    const side = row.firstBreakSide === 'IBH' && (row.dayType === 'IBH' || row.dayType === 'IBB') ? 'IBH'
      : row.firstBreakSide === 'IBL' && (row.dayType === 'IBL' || row.dayType === 'IBB') ? 'IBL'
      : row.firstBreakSide === null && row.dayType === 'IBN' ? 'none' : null;
    if (!side || ibPositionQuartile(pct) !== quartile) continue;
    firstBreak[side]++; rowIds.push(row.id); sources.add(row.batchId);
    const year = row.rthDate.slice(0, 4), group = years.get(year) ?? { year, matchingDays: 0, firstBreak: { IBH: 0, IBL: 0, none: 0 } };
    group.matchingDays++; group.firstBreak[side]++; years.set(year, group);
  }
  return { positionPct, quartile, matchingDays: rowIds.length, firstBreak,
    years: [...years.values()].sort((a, b) => a.year.localeCompare(b.year)), rowIds,
    sources: [...sources].sort().map(id => { const b = compatible.get(id)!; return { id, contentSha256: b.contentSha256, importedAt: b.importedAt }; }) };
}
