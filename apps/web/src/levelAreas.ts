// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber, memoryContractMatches } from '@ib-field-notes/domain';
import { Temporal } from '@js-temporal/polyfill';

export type DisplayLevel = { id: string; low: number; high: number; type: string; scope: string; shape?: string };
export type LevelArea<T> = {
  id: string; members: T[]; low: number; high: number;
  displayLow: number; displayHigh: number; midpoint: number; grouped: boolean; title: string;
};
const compactPrice = (price: number) => formatPriceNumber(price).replace(/\.00$/, '');

/** Presentation only. Filter/sort exact records first; never write these areas back as levels.
 * Single-price lows in a whole-number bucket stay together. Adjacent buckets may
 * join only within a total three-point span (both exact prices and display bounds).
 * Explicit zones and other level types stay independent; contracts are separate scopes. */
export function groupLowAreas<T>(rows: readonly T[], describe: (row: T) => DisplayLevel): LevelArea<T>[] {
  return groupPriceAreas(rows, describe, new Set(['low']));
}

/** Dashboard reading only. Exact highs/lows and session edges may describe the
 * same small price neighborhood; explicit zones and backtests retain meaning. */
export function groupNearbyAreas<T>(rows: readonly T[], describe: (row: T) => DisplayLevel): LevelArea<T>[] {
  return groupPriceAreas(rows, describe, new Set(['low', 'high', 'session-edge']));
}

function groupPriceAreas<T>(rows: readonly T[], describe: (row: T) => DisplayLevel, types: ReadonlySet<string>): LevelArea<T>[] {
  const entries = rows.map((row, rank) => ({ row, rank, ...describe(row) }));
  const buckets = new Map<string, typeof entries>();
  const groups: Array<typeof entries> = [];
  for (const entry of entries) {
    if (!types.has(entry.type) || entry.low !== entry.high || entry.shape === 'price_zone') { groups.push([entry]); continue; }
    const key = JSON.stringify([entry.scope, Math.floor(entry.low)]);
    const bucket = buckets.get(key) ?? [];
    bucket.push(entry); buckets.set(key, bucket);
  }
  const scopes = new Map<string, Array<typeof entries>>();
  for (const bucket of buckets.values()) {
    const scope = bucket[0].scope;
    const list = scopes.get(scope) ?? []; list.push(bucket); scopes.set(scope, list);
  }
  for (const list of scopes.values()) {
    list.sort((a, b) => Math.min(...a.map(e => e.low)) - Math.min(...b.map(e => e.low)));
    let group: typeof entries = [];
    for (const bucket of list) {
      const combined = [...group, ...bucket];
      const low = Math.min(...combined.map(e => e.low)), high = Math.max(...combined.map(e => e.high));
      if (group.length && (high - low > 3 || Math.floor(high) - Math.floor(low) > 3)) {
        groups.push(group); group = [];
      }
      group.push(...bucket);
    }
    if (group.length) groups.push(group);
  }
  return groups.sort((a, b) => Math.min(...a.map(e => e.rank)) - Math.min(...b.map(e => e.rank)))
    .map(group => {
      group.sort((a, b) => a.low - b.low || a.id.localeCompare(b.id));
      const low = Math.min(...group.map(e => e.low)), high = Math.max(...group.map(e => e.high));
      const grouped = group.length > 1;
      const displayLow = grouped ? Math.floor(low) : low, displayHigh = grouped ? Math.floor(high) : high;
      const midpoint = (displayLow + displayHigh) / 2;
      const title = grouped ? displayLow === displayHigh ? compactPrice(displayLow)
        : `${compactPrice(displayLow)}–${compactPrice(displayHigh)} zone`
        : `${formatPriceNumber(low)}${low !== high ? `–${formatPriceNumber(high)}` : ''}`;
      return { id: JSON.stringify(group.map(e => e.id).sort()), members: group.map(e => e.row), low, high,
        displayLow, displayHigh, midpoint, grouped, title };
    });
}

export function areaMidpoint(area: LevelArea<unknown>): string | null {
  return area.grouped && area.displayLow !== area.displayHigh ? `Midpoint ${compactPrice(area.midpoint)}` : null;
}

/** Display equivalence only: ES/MES of the same native expiry, never a roll offset.
 * Unknown/manual provenance stays separate from an explicit pack contract. */
export function levelAreaScope(instrument: string, contract?: string | null, referenceYear?: number): string {
  if (contract && ['ES', 'MES'].includes(instrument.toUpperCase())) {
    const match = /^(?:MES|ES)([HMUZ])(\d{1,4})(?:\.CME)?$/.exec(contract.toUpperCase());
    if (match) {
      const digits = match[2];
      const year = digits.length === 1 ? referenceYear === undefined ? null : Math.floor(referenceYear / 10) * 10 + Number(digits)
        : digits.length === 2 ? 2000 + Number(digits) : digits.length === 4 ? Number(digits) : null;
      if (year !== null && memoryContractMatches(contract, `ES${match[1]}${year}`, referenceYear ?? year))
        return JSON.stringify(['ES', `${match[1]}:${year}`]);
    }
  }
  return JSON.stringify([instrument, contract ?? 'manual/unlisted']);
}

/** Join mirrored source records for reading, retaining every original copy.
 * Price proximity alone is never evidence that two references are the same low. */
export function levelSourceCopies<T>(rows: readonly T[], describe: (row: T) => DisplayLevel & {
  sourceId?: string | null; originAt?: string | null;
}): T[][] {
  const groups = new Map<string, T[]>();
  rows.forEach((row, rank) => {
    const entry = describe(row);
    let origin = entry.originAt;
    if (origin) {
      try { origin = Temporal.Instant.from(origin).toString(); } catch { /* Keep unlisted formatting separate. */ }
    }
    const key = entry.sourceId && entry.originAt && entry.type === 'low' && entry.low === entry.high && entry.shape !== 'price_zone'
      ? JSON.stringify(['source', entry.scope, entry.sourceId, entry.low, origin])
      : JSON.stringify(['independent', rank]);
    const copies = groups.get(key) ?? [];
    copies.push(row); groups.set(key, copies);
  });
  return [...groups.values()];
}
