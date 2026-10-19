// SPDX-License-Identifier: MPL-2.0
import type { RangeCheckpointRevision } from '@ib-field-notes/domain';
type Edges = { high: number; low: number };
export type FormationStep = Edges & { left: number; width: number };
/** Snapshots show supplied ranges and timestamped price expansions, never an invented intrabar path. */
export function formationSteps(current: Edges, history: Array<Pick<RangeCheckpointRevision, 'high' | 'low' | 'recordedAt' | 'observedAt'>>, start: number, end: number, column: number, initial?: Edges): FormationStep[] {
  const points = new Map<number, Edges>();
  // A known range carries into the next period until a recorded update expands it.
  if (initial && initial.high <= current.high && initial.low >= current.low) points.set(start, initial);
  let timedUpdates = 0;
  for (const revision of [...history].sort((a,b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))) {
    if (revision.high === null || revision.low === null) continue;
    // A corrected final range must not retain a superseded out-of-range extreme.
    if (revision.high > current.high || revision.low < current.low) continue;
    const time = Date.parse(revision.observedAt ?? revision.recordedAt);
    if (!Number.isFinite(time) || time < start || time >= end) continue;
    timedUpdates++;
    points.set(time, { high: revision.high, low: revision.low });
  }
  if (!timedUpdates) return [{ ...current, left: column * 15, width: 15 }];
  const ordered = [...points].sort(([a], [b]) => a-b);
  // Historical/late corrections establish the end-of-period range, not a made-up earlier time.
  const last = ordered.at(-1)![1];
  if (last.high !== current.high || last.low !== current.low) ordered.push([end, current]);
  return ordered.map(([time, edges], index) => ({
    ...edges, left: column * 15 + 15 * (time-start)/(end-start),
    width: 15 * ((ordered[index+1]?.[0] ?? end)-time)/(end-start),
  }));
}
