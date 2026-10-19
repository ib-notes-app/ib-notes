// SPDX-License-Identifier: MPL-2.0
import { Temporal } from "@js-temporal/polyfill";
import type { JournalSession } from "@ib-field-notes/domain";

const MAP_NEARBY_OBSERVATION_WINDOW_MS = 2 * 60 * 1_000;
const MAP_MINIMUM_LARGE_MOVE_TICKS = 12;
const MAP_LARGE_MOVE_SHARE_OF_PRICE_SPAN = 0.1;
const MAP_RTH_PATH_START = 48;
const MAP_RTH_PATH_END = 94;

type MapObservation = JournalSession["cpObservations"][number];

export function collapseNearbyMapObservations(
  observations: MapObservation[],
  largeMoveThreshold: number,
): MapObservation[] {
  const collapsed: MapObservation[] = [];

  for (let index = 0; index < observations.length;) {
    const burstStartMs = Temporal.Instant.from(observations[index].observedAt).epochMilliseconds;
    const burst: MapObservation[] = [observations[index]];
    let nextIndex = index + 1;

    while (nextIndex < observations.length) {
      const nextMs = Temporal.Instant.from(observations[nextIndex].observedAt).epochMilliseconds;
      if (nextMs - burstStartMs > MAP_NEARBY_OBSERVATION_WINDOW_MS) break;
      burst.push(observations[nextIndex]);
      nextIndex += 1;
    }

    const burstPrices = burst.map((observation) => observation.price);
    const burstMove = Math.max(...burstPrices) - Math.min(...burstPrices);
    if (burst.length === 1 || burstMove < largeMoveThreshold) {
      collapsed.push(burst.at(-1)!);
    } else {
      const candidates = [
        burst[0],
        burst.reduce((lowest, observation) =>
          observation.price < lowest.price ? observation : lowest),
        burst.reduce((highest, observation) =>
          observation.price > highest.price ? observation : highest),
        burst.at(-1)!,
      ].sort((left, right) => left.observedAt.localeCompare(right.observedAt));
      for (const candidate of candidates) {
        if (!collapsed.some((observation) => observation.id === candidate.id)) {
          collapsed.push(candidate);
        }
      }
    }

    index = nextIndex;
  }

  return collapsed;
}

export function mapMoveThreshold(tickSize: number, span: number): number {
  return Math.max(MAP_MINIMUM_LARGE_MOVE_TICKS * tickSize, span * MAP_LARGE_MOVE_SHARE_OF_PRICE_SPAN);
}

/** Shared compressed timeline: 15R / A / B each occupy 15%, with RTH after 45%. */
export function mapObservationX(observedMs: number, boundaries: number[], firstRth: number | null, lastRth: number | null): number {
  const [open, fifteen, a, ib] = boundaries;
  if (observedMs <= ib) {
    if (observedMs < fifteen) return 15 * (observedMs - open) / (fifteen - open);
    if (observedMs < a) return 15 + 15 * (observedMs - fifteen) / (a - fifteen);
    return 30 + 15 * (observedMs - a) / (ib - a);
  }
  if (firstRth === null || lastRth === null || firstRth === lastRth) return MAP_RTH_PATH_START;
  const progress = (observedMs - firstRth) / (lastRth - firstRth);
  return Math.min(MAP_RTH_PATH_END, Math.max(MAP_RTH_PATH_START,
    MAP_RTH_PATH_START + progress * (MAP_RTH_PATH_END - MAP_RTH_PATH_START)));
}
