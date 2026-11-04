// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { JournalSession, RangeCheckpointRevision, RangeObservation } from './index';

type Edges = Pick<RangeObservation, 'high' | 'low'>;
export type FormingPeriod = '15R' | 'A' | 'B';
const keys = { '15R': 'fifteenMinute', A: 'aPeriod', B: 'bPeriod' } as const;
const histories = { '15R': 'fifteenMinuteHistory', A: 'aPeriodHistory', B: 'bPeriodHistory' } as const;
const empty: Edges = { high: null, low: null };
const ms = (at: string) => Temporal.Instant.from(at).epochMilliseconds;
const edges = (range: Edges & { rangeInputs?: Edges }) => range.rangeInputs ?? { high: range.high, low: range.low };
function union(...ranges: Edges[]): Edges {
  const highs = ranges.flatMap(r => r.high === null ? [] : [r.high]);
  const lows = ranges.flatMap(r => r.low === null ? [] : [r.low]);
  return { high: highs.length ? Math.max(...highs) : null, low: lows.length ? Math.min(...lows) : null };
}

/** Instrument clock, including studies whose checkpoints cross midnight. */
export function formingPricePeriods(session: JournalSession, observedAt: string): FormingPeriod[] {
  const { canonicalTimeZone: timeZone, checkpoints: c } = session.market;
  const openTime = Temporal.PlainTime.from(c.overnightLock);
  const at = (clock: string) => {
    let day = Temporal.PlainDate.from(session.rthDate);
    if (Temporal.PlainTime.compare(clock, openTime) < 0) day = day.add({ days: 1 });
    return day.toZonedDateTime({ timeZone, plainTime: clock }).toInstant().epochMilliseconds;
  };
  const t = ms(observedAt);
  if (t < at(c.overnightLock) || t >= at(c.ibLock)) return [];
  const period: FormingPeriod = t < at(c.fifteenMinuteLock) ? '15R' : t < at(c.aLock) ? 'A' : 'B';
  return session[keys[period]].status === 'confirmed' ? [] : [period];
}

/** Unchanged prefilled edges retain their provenance rather than becoming independent manual facts. */
export function manualRangeInputs(session: JournalSession, period: FormingPeriod, supplied: Edges): Edges | undefined {
  if (!session.cpObservations.some(p => p.formingPeriods?.length) && !session[keys[period]].rangeInputs) return undefined;
  const current = session[keys[period]], earlier = period === '15R' ? empty
    : period === 'A' ? session.fifteenMinute : union(session.fifteenMinute, session.aPeriod, ...session.bSnapshots);
  const effective = union(current, earlier), direct = edges(current);
  return Object.fromEntries((['high', 'low'] as const).map(edge => [edge,
    supplied[edge] === effective[edge] ? direct[edge] : supplied[edge]])) as Edges;
}

/** Rebuild only price-linked range contributions; old journals without provenance retain their saved truth. */
export function reconcileFormingPriceRanges(session: JournalSession): JournalSession {
  if (!session.cpObservations.some(p => p.formingPeriods?.length) &&
      !(['15R', 'A', 'B'] as const).some(p => session[keys[p]].rangeInputs)) return session;
  let next = { ...session };
  let earlier: Edges = empty;
  for (const period of ['15R', 'A', 'B'] as const) {
    const key = keys[period], historyKey = histories[period], current = session[key];
    const direct = edges(current);
    const prices = session.cpObservations.filter(p => p.formingPeriods?.includes(period));
    const manual = session[historyKey].filter(r => !r.cpObservationId);
    const snapshots = period === 'B' ? session.bSnapshots.map(edges) : [];
    const hasOwn = current.high !== null || current.low !== null || manual.length > 0 || prices.length > 0 || snapshots.length > 0;
    const effective = hasOwn ? union(direct, earlier, ...snapshots, ...prices.map(p => ({ high: p.price, low: p.price }))) : direct;
    next[key] = { ...current, ...effective, rangeInputs: direct };
    // Replay range entries and CP expansions at their supplied times. Every generated step links to its price.
    const events = [
      ...manual.map((row, order) => ({ at: row.observedAt ?? row.recordedAt, recorded: row.recordedAt, order, row, price: null, snapshot: null })),
      ...prices.map((price, order) => ({ at: price.observedAt, recorded: price.recordedAt ?? price.observedAt,
        order: manual.length + order, row: null, price, snapshot: null })),
      ...(period === 'B' ? session.bSnapshots.map((snapshot, order) => ({ at: snapshot.observedAt,
        recorded: snapshot.recordedAt, order: manual.length + prices.length + order, row: null, price: null, snapshot })) : []),
    ].sort((a, b) => ms(a.at) - ms(b.at) || ms(a.recorded) - ms(b.recorded) || a.order - b.order);
    let observedPrices: Edges = empty, observedSnapshots: Edges = empty, base: Edges = empty, previous = earlier;
    const rebuilt: RangeCheckpointRevision[] = [];
    for (const event of events) {
      if (event.row) {
        base = edges(event.row);
        previous = union(base, earlier, observedPrices, observedSnapshots);
        rebuilt.push({ ...event.row, ...previous, rangeInputs: base });
      } else if (event.price) {
        const prior = previous;
        observedPrices = union(observedPrices, { high: event.price.price, low: event.price.price });
        previous = union(base, earlier, observedPrices, observedSnapshots);
        // A first price can start a period inside inherited edges. Keep its
        // observation time even when no edge changes, rather than falling back
        // to the later save time and hiding that same price from the reader.
        if (!rebuilt.length || prior.high !== previous.high || prior.low !== previous.low) rebuilt.push({
          ...current, ...previous, rangeInputs: base, status: 'pending', confirmedAt: null,
          recordedAt: event.recorded, observedAt: event.at, cpObservationId: event.price.id,
          priorHigh: prior.high, priorLow: prior.low,
        });
      } else if (event.snapshot) {
        observedSnapshots = union(observedSnapshots, edges(event.snapshot));
        previous = union(base, earlier, observedPrices, observedSnapshots);
      }
    }
    // Readers use the most recently saved revision, independently of observation chronology.
    next[historyKey] = rebuilt.sort((a, b) => ms(a.recordedAt) - ms(b.recordedAt) || ms(a.observedAt ?? a.recordedAt) - ms(b.observedAt ?? b.recordedAt));
    if (period === 'B') next.bSnapshots = session.bSnapshots.map(snapshot => ({ ...snapshot, rangeInputs: edges(snapshot),
      ...union(edges(snapshot), earlier, ...prices.filter(p => ms(p.observedAt) <= ms(snapshot.observedAt))
        .map(p => ({ high: p.price, low: p.price }))) }));
    if (hasOwn) earlier = union(earlier, effective);
  }
  return next;
}

export function priceRangeChanges(session: JournalSession, observationId: string) {
  return (['15R', 'A', 'B'] as const).flatMap(period => session[histories[period]]
    .filter(r => r.cpObservationId === observationId).flatMap(r => (['high', 'low'] as const)
      .filter(edge => r[edge] !== r[edge === 'high' ? 'priorHigh' : 'priorLow'])
      .map(edge => ({ period, edge, price: r[edge], prior: r[edge === 'high' ? 'priorHigh' : 'priorLow'] }))));
}
