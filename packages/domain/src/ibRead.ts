// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { roundManualPriceFields, roundPriceToTick } from './priceTicks';

/** Descriptive research core. No predictions, author prose, training or persistence. */
export type ReadPrice = { at: string; price: number; contract: string };
export type ReadReference = { id: string; kind: 'IB' | 'ON' | 'PRIOR_RTH' | 'LOW';
  low: number; high: number; knownAt: string; contract: string; source: string; cutoffAt?: string };
export type ReadSide = 'BELOW' | 'INSIDE' | 'ABOVE';
export type ReferenceRead = { id: string; kind: ReadReference['kind']; low: number; high: number;
  source: string; knownAt: string; observedPrices: number; latestSide: ReadSide | null;
  belowCount: number; insideCount: number; aboveCount: number;
  lowerHalfCount: number; upperHalfCount: number; midpointCount: number;
  belowThenInside: number; aboveThenInside: number; acrossToOppositeSide: number;
  firstBelowAt: string | null; firstAboveAt: string | null;
  firstInsideAfterBelowAt: string | null; firstInsideAfterAboveAt: string | null;
  lowReclaimCount: number; firstLowReclaimAt: string | null;
  lastOutsideAt: string | null; latestSideRunCount: number;
  maxObservedBelow: number; maxObservedAbove: number;
  ambiguousGapTransitions: number; sampledBreaks: 'HIGH' | 'LOW' | 'BOTH' | 'NEITHER_RECORDED' | 'UNKNOWN';
  observationsComplete: boolean | null };
export type IbReadInput = { asOf: string; windowStart: string; contract: string; tickSize: number;
  sampling: 'MANUAL_PRICES' | 'MINUTE_CLOSES'; prices: readonly ReadPrice[];
  references: readonly ReadReference[] };

/** A fact about the supplied observations, not proof of the unobserved path. */
export function firstRecordedIbBreak(read: ReferenceRead | null | undefined): { side: 'IBH' | 'IBL'; at: string } | null {
  if (!read?.firstAboveAt && !read?.firstBelowAt) return null;
  if (!read.firstBelowAt) return { side: 'IBH', at: read.firstAboveAt! };
  if (!read.firstAboveAt) return { side: 'IBL', at: read.firstBelowAt };
  return Temporal.Instant.compare(read.firstAboveAt, read.firstBelowAt) < 0
    ? { side: 'IBH', at: read.firstAboveAt } : { side: 'IBL', at: read.firstBelowAt };
}

const instant = (value: string) => Temporal.Instant.from(value);
// The same observation times recur across hundreds of historical comparisons.
// Bounded caching retains exact nanosecond ordering and avoids parsing each one again.
const timeCache = new Map<string, bigint>();
const nanos = (value: string) => {
  const cached = timeCache.get(value);
  if (cached !== undefined) return cached;
  const result = instant(value).epochNanoseconds;
  if (timeCache.size >= 8192) timeCache.clear();
  timeCache.set(value, result); return result;
};
const minute = 60_000_000_000n;

function validPrice(price: number, tick: number): void {
  if (!Number.isFinite(price) || Math.abs(price / tick - Math.round(price / tick)) > 1e-6)
    throw new Error('Read prices and edges must be finite instrument ticks.');
}
const sideOf = (price: number, low: number, high: number): ReadSide => price < low ? 'BELOW' : price > high ? 'ABOVE' : 'INSIDE';

function readReference(reference: ReadReference, observations: { value: ReadPrice; at: bigint }[],
  start: bigint, end: bigint, minuteCloses: boolean): ReferenceRead {
  const known = nanos(reference.knownAt), boundary = known > start ? known : start;
  // A close known at the range lock is formation evidence, not a post-lock price.
  const values = observations.filter(p => p.at > boundary && p.at <= end);
  const result: ReferenceRead = { id: reference.id, kind: reference.kind, low: reference.low, high: reference.high,
    source: reference.source, knownAt: reference.knownAt, observedPrices: values.length, latestSide: null,
    belowCount: 0, insideCount: 0, aboveCount: 0, lowerHalfCount: 0, upperHalfCount: 0, midpointCount: 0,
    belowThenInside: 0, aboveThenInside: 0, acrossToOppositeSide: 0,
    firstBelowAt: null, firstAboveAt: null, firstInsideAfterBelowAt: null, firstInsideAfterAboveAt: null,
    lowReclaimCount: 0, firstLowReclaimAt: null,
    lastOutsideAt: null, latestSideRunCount: 0, maxObservedBelow: 0, maxObservedAbove: 0,
    ambiguousGapTransitions: 0, sampledBreaks: values.length ? 'NEITHER_RECORDED' : 'UNKNOWN', observationsComplete: null };
  const midpoint = (reference.low + reference.high) / 2;
  let previous: typeof values[number] | undefined, previousSide: ReadSide | undefined, lowBelow = false;
  for (const point of values) {
    const side = sideOf(point.value.price, reference.low, reference.high);
    const adjacent = !!previous && (!minuteCloses || point.at - previous.at === minute);
    if (previous && !adjacent) lowBelow = false;
    if (reference.kind === 'LOW') {
      if (side === 'BELOW') lowBelow = true;
      else if (side === 'ABOVE' && lowBelow) {
        result.lowReclaimCount++; result.firstLowReclaimAt ??= point.value.at; lowBelow = false;
      }
    }
    if (side === 'BELOW') { result.belowCount++; result.firstBelowAt ??= point.value.at;
      result.maxObservedBelow = Math.max(result.maxObservedBelow, reference.low - point.value.price); }
    else if (side === 'ABOVE') { result.aboveCount++; result.firstAboveAt ??= point.value.at;
      result.maxObservedAbove = Math.max(result.maxObservedAbove, point.value.price - reference.high); }
    else { result.insideCount++; if (point.value.price < midpoint) result.lowerHalfCount++;
      else if (point.value.price > midpoint) result.upperHalfCount++; else result.midpointCount++; }
    if (side !== 'INSIDE') result.lastOutsideAt = point.value.at;
    if (previousSide !== undefined && side !== previousSide) {
      if (!adjacent) result.ambiguousGapTransitions++;
      else if (side === 'INSIDE' && previousSide === 'BELOW') {
        result.belowThenInside++; result.firstInsideAfterBelowAt ??= point.value.at;
      } else if (side === 'INSIDE' && previousSide === 'ABOVE') {
        result.aboveThenInside++; result.firstInsideAfterAboveAt ??= point.value.at;
      } else if (side !== 'INSIDE' && previousSide !== 'INSIDE') result.acrossToOppositeSide++;
    }
    result.latestSideRunCount = previousSide === side && adjacent ? result.latestSideRunCount + 1 : 1;
    result.latestSide = side; previous = point; previousSide = side;
  }
  result.sampledBreaks = result.belowCount && result.aboveCount ? 'BOTH' : result.belowCount ? 'LOW'
    : result.aboveCount ? 'HIGH' : values.length ? 'NEITHER_RECORDED' : 'UNKNOWN';
  if (minuteCloses) {
    const expected = end > boundary ? Number((end - boundary) / minute) : 0;
    result.observationsComplete = end >= boundary && (end - boundary) % minute === 0n
      && values.length === expected && values.every((p, i) => p.at === boundary + BigInt(i + 1) * minute);
  }
  return result;
}

export function deriveIbRead(input: IbReadInput) {
  if (!input.contract.trim() || !Number.isFinite(input.tickSize) || input.tickSize <= 0)
    throw new Error('Supply the exact contract and a positive tick size.');
  const end = nanos(input.asOf), start = nanos(input.windowStart);
  if (start > end) throw new Error('The read window begins after the cutoff.');
  let foreignPrices = 0, foreignReferences = 0, futureReferences = 0, censoredReferences = 0;
  const observations = input.prices.filter(p => {
    if (p.contract !== input.contract) { foreignPrices++; return false; }
    const at = nanos(p.at);
    if (at < start || at > end) return false;
    return true;
  }).map(value => {
    // Older manual records can predate entry rounding. Project them without
    // rewriting saved facts or relaxing validation of imported minute data.
    if (input.sampling === 'MANUAL_PRICES' && Number.isFinite(value.price)) {
      const price = roundPriceToTick(value.price, input.tickSize);
      if (price !== value.price) value = { ...value, price };
    }
    validPrice(value.price, input.tickSize);
    return { value, at: nanos(value.at) };
  }).sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  // Conflicting simultaneous observations cannot establish direction. Same-price duplicates count once.
  const groups = new Map<bigint, typeof observations>();
  for (const point of observations) { const group = groups.get(point.at) ?? []; group.push(point); groups.set(point.at, group); }
  let conflictingInstants = 0;
  const unambiguous = [...groups.values()].flatMap(group => {
    if (group.some(p => p.value.price !== group[0]!.value.price)) { conflictingInstants++; return []; }
    return [group[0]!];
  });
  const references = input.references.filter(r => {
    if (r.contract !== input.contract) { foreignReferences++; return false; }
    if (nanos(r.knownAt) > end) { futureReferences++; return false; }
    if (r.cutoffAt && nanos(r.cutoffAt) < end) { censoredReferences++; return false; }
    return true;
  }).map(r => {
    if (input.sampling === 'MANUAL_PRICES') r = roundManualPriceFields(r, input.tickSize);
    validPrice(r.low, input.tickSize); validPrice(r.high, input.tickSize);
    if (r.low > r.high) throw new Error('Reference edges are reversed.');
    return r;
  });
  if (new Set(references.map(r => r.id)).size !== references.length) throw new Error('Reference IDs must be unique.');
  if (references.filter(r => r.kind === 'IB').length > 1 || references.filter(r => r.kind === 'ON').length > 1)
    throw new Error('Supply one IB and one overnight range for this read.');
  const reads = references.map(r => readReference(r, unambiguous, start, end, input.sampling === 'MINUTE_CLOSES'));
  const ib = reads.find(r => r.kind === 'IB') ?? null, on = reads.find(r => r.kind === 'ON') ?? null;
  const latest = unambiguous.at(-1)?.value ?? null;
  let position: 'LOWER_HALF' | 'UPPER_HALF' | 'MIDPOINT' | 'BELOW_IB' | 'ABOVE_IB' | 'UNKNOWN' = 'UNKNOWN';
  let positionPercent: number | null = null;
  if (ib && latest && nanos(latest.at) >= nanos(ib.knownAt)) {
    const mid = (ib.low + ib.high) / 2;
    position = latest.price < ib.low ? 'BELOW_IB' : latest.price > ib.high ? 'ABOVE_IB'
      : latest.price < mid ? 'LOWER_HALF' : latest.price > mid ? 'UPPER_HALF' : 'MIDPOINT';
    if (ib.high > ib.low) positionPercent = (latest.price - ib.low) / (ib.high - ib.low) * 100;
  }
  const shortPosition = { LOWER_HALF: 'Price is in the lower half of the IB.', UPPER_HALF: 'Price is in the upper half of the IB.',
    MIDPOINT: 'Price is at the IB midpoint.', BELOW_IB: 'Price is below the IB.', ABOVE_IB: 'Price is above the IB.',
    UNKNOWN: ib ? 'Waiting for a price recorded after IB lock.' : 'IB is still pending.' }[position];
  const noun = input.sampling === 'MINUTE_CLOSES' ? 'Minute closes' : 'Recorded prices';
  const returnText = ib?.latestSide === 'INSIDE' && (ib.belowThenInside || ib.aboveThenInside)
    ? ' A return inside has been recorded.' : '';
  const breakText = ib?.sampledBreaks === 'BOTH' ? ` ${noun} have crossed both edges.`
    : ib?.sampledBreaks === 'LOW' ? ` ${noun} have crossed the low.`
    : ib?.sampledBreaks === 'HIGH' ? ` ${noun} have crossed the high.` : '';
  return { version: 'ib-read-research-v1' as const, asOf: input.asOf, contract: input.contract, sampling: input.sampling,
    latest, observations: unambiguous.map(point => point.value), position, positionPercent, ib, on, references: reads,
    ibWithinOvernight: ib && on ? ib.low >= on.low && ib.high <= on.high : null,
    recordedLowerHalfShare: ib?.insideCount ? ib.lowerHalfCount / ib.insideCount : null,
    shortRead: shortPosition + breakText + returnText,
    quality: { observedPrices: unambiguous.length, foreignPrices, foreignReferences, futureReferences,
      censoredReferences, conflictingInstants, continuousPathKnown: false as const,
      description: input.sampling === 'MINUTE_CLOSES'
        ? 'Closes describe sampled position. Intraminute paths and exact residence time remain unknown.'
        : 'Sparse entries describe recorded position. Movement between entries remains unknown.' } };
}
