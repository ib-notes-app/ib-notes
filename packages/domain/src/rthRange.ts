// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { JournalSession } from './index';
import { roundManualPriceFields } from './priceTicks';

/** A manually observed range is not a timestamped price or a completed day. */
export type RthRangeRevision = { high: number; low: number; recordedAt: string;
  /** When the range or named edge was observed, not its exact occurrence time. */
  observedAt?: string;
  observedEdge?: 'high' | 'low';
};

function priceFacts(session: JournalSession): number[] {
  const zoned = (clock: string) => Temporal.PlainDate.from(session.rthDate)
    .toZonedDateTime({ timeZone: session.market.canonicalTimeZone, plainTime: clock });
  const open = zoned(session.market.checkpoints.overnightLock).toInstant();
  let end = zoned(session.market.checkpoints.studyClose);
  if (Temporal.Instant.compare(end.toInstant(), open) <= 0) end = end.add({ days: 1 });
  const close = end.toInstant();
  const ranges = [session.fifteenMinute, session.aPeriod, ...session.bSnapshots, session.bPeriod];
  return [
    ...ranges.flatMap(r => [r.high, r.low]),
    ...session.cpObservations.filter(p => {
      const at = Temporal.Instant.from(p.observedAt);
      return Temporal.Instant.compare(at, open) >= 0 && Temporal.Instant.compare(at, close) <= 0;
    }).map(p => p.price),
    ...session.rthObservations.map(p => p.price), session.close.price,
  ].filter((p): p is number => p !== null && Number.isFinite(p));
}

/** RTH includes its opening IB hour. Corrections replace earlier manual range
 * entries, while corrected/deleted CPs and corrected IB edges recompute normally. */
export function deriveRecordedRthRange(session: JournalSession): { high: number | null; low: number | null } {
  const manual = session.rthRangeHistory?.at(-1);
  const prices = [...priceFacts(session), session.close.finishedAt ? session.close.rthHigh : manual?.high ?? session.close.rthHigh,
    session.close.finishedAt ? session.close.rthLow : manual?.low ?? session.close.rthLow]
    .filter((p): p is number => p !== undefined && p !== null && Number.isFinite(p));
  return { high: prices.length ? Math.max(...prices) : null, low: prices.length ? Math.min(...prices) : null };
}

export function withRthRangeCorrection(session: JournalSession, high: number, low: number, recordedAt: string, observedAt?: string, observedEdge?: 'high'|'low'): JournalSession {
  if (session.close.finishedAt) throw new Error('Use Review close to correct a finished day.');
  ({ high, low } = roundManualPriceFields({ high, low }, session.market.tickSize));
  if (!Number.isFinite(high) || !Number.isFinite(low) || high < low) throw new Error('Enter a valid RTH high and low. High must be at or above low.');
  Temporal.Instant.from(recordedAt);
  if(observedAt&&Temporal.Instant.compare(Temporal.Instant.from(observedAt),Temporal.Instant.from(recordedAt))>0)
    throw new Error('The range observation cannot be in the future.');
  const facts = priceFacts(session);
  if (facts.some(p => p > high || p < low)) throw new Error('The RTH range must include the IB and recorded prices. Correct a mistaken price in Day timeline first.');
  return { ...session, rthRangeHistory: [...session.rthRangeHistory ?? [], { high, low, recordedAt, ...(observedAt?{observedAt,...(observedEdge?{observedEdge}:{})}:{}) }], updatedAt: recordedAt };
}
