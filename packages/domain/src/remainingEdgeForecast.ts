// SPDX-License-Identifier: MPL-2.0
import { firstRecordedIbBreak, type IbReadInput, type ReferenceRead } from './ibRead';
import type { BestFitPathDay } from './bestFitForecast';
import { Temporal } from '@js-temporal/polyfill';

export type RemainingEdgePosition={price:number;priceAt:string;low:number;high:number;typicalRthWidth?:number|null};
export type RemainingEdgeDistance={
  points:number;ibWidths:number;recentRangeWidths:number|null;priceAt:string;
  baselineEffectiveDays:number;unconditionedProbability:number;
};

/** A remaining-session target, separate from the immutable opening forecast. */
export type RemainingEdgeForecast = {
  version: 1; target: 'IBH' | 'IBL'; asOf: string; until: string; remainingMinutes: number;
  probability: number | null; baselineProbability: number | null;
  support: 'limited' | 'moderate'; eligibleDays: number; matchingDays: number; effectiveDays: number;
  sourceRowIds: string[]; referenceBatchIds: string[];
  progress: PostBreakProgress | null;
  distance?:RemainingEdgeDistance;
};
export type PostBreakProgress = {
  minutesSinceBreak: number; quarterReached: boolean; midpointReached: boolean;
};
export type RemainingEdgeCandidate = {
  id: string; batchId: string; date: string; path: BestFitPathDay;
  distance: number; freshnessWeight: number; progress: PostBreakProgress | null;
  position?:RemainingEdgePosition|null;
};

/** Reuses the existing 25%/midpoint return definitions, on recorded observations.
 * An unreached threshold means not recorded; it never proves continuous residence. */
export function recordedPostBreakProgress(read: ReferenceRead | null | undefined,
  prices: IbReadInput['prices'], asOf: string): PostBreakProgress | null {
  const first = firstRecordedIbBreak(read);
  if (!first || !read || read.high <= read.low) return null;
  const start = Date.parse(first.at), end = Date.parse(asOf), width = read.high - read.low;
  const progress = prices.filter(p => Date.parse(p.at) >= start && Date.parse(p.at) <= end)
    .map(p => first.side === 'IBL' ? (p.price - read.low) / width : (read.high - p.price) / width);
  const furthest = Math.max(0, ...progress);
  return { minutesSinceBreak: Math.max(0, (end - start) / 60000),
    quarterReached: furthest >= .25, midpointReached: furthest >= .5 };
}

/** Fixed, soft comparisons; no pooled table percentage is pasted into a live forecast. */
function progressDistance(a: PostBreakProgress | null, b: PostBreakProgress | null) {
  if (!a || !b) return 0;
  return .35 * (Number(a.quarterReached !== b.quarterReached) + Number(a.midpointReached !== b.midpointReached) +
    ((Math.min(60, a.minutesSinceBreak) - Math.min(60, b.minutesSinceBreak)) / 60) ** 2);
}

/** Only outcomes after the cutoff can label the target. Prefix extremes merely
 * establish that one edge broke and the target edge has not already broken.
 * A crossing in the minute straddling a subminute cutoff has unknown timing. */
function remainingOutcome(path: BestFitPathDay, target: 'IBH' | 'IBL', tick: number,
  lockMinute: number, elapsed: number, total: number): boolean | null {
  const { highs, lows } = path;
  if (!highs || !lows || highs.length !== total || lows.length !== total ||
      highs.some((h, i) => h === null || lows[i] === null || !Number.isInteger(h) ||
        !Number.isInteger(lows[i]) || h < lows[i]!)) return null;
  const highEdge = Math.round((path.high - path.low) / tick) + 1;
  const hit = (i: number) => target === 'IBH' ? highs[i]! >= highEdge : lows[i]! <= -1;
  const otherHit = (i: number) => target === 'IBH' ? lows[i]! <= -1 : highs[i]! >= highEdge;
  const completed = Math.floor(elapsed), after = Math.ceil(elapsed);
  let knownBreak = false;
  for (let i = lockMinute; i < completed; i++) {
    if (hit(i)) return null; // Already happened: not an eligible future target.
    knownBreak ||= otherHit(i);
  }
  if (!knownBreak || after > completed && hit(completed)) return null;
  for (let i = after; i < total; i++) if (hit(i)) return true;
  return false;
}

function requiredMove(position:RemainingEdgePosition,target:'IBH'|'IBL',tick:number,asOf:string){
  const width=position.high-position.low,priceTime=Date.parse(position.priceAt),cutoff=Date.parse(asOf);
  if(![position.price,position.high,position.low,tick,width].every(Number.isFinite)||width<=0||tick<=0||
    !Number.isFinite(priceTime)||priceTime>cutoff||priceTime===cutoff&&position.priceAt!==asOf&&
      Temporal.Instant.compare(position.priceAt,asOf)>0)return null;
  const points=target==='IBH'?position.high+tick-position.price:position.price-(position.low-tick);
  if(!Number.isFinite(points)||points<=0)return null; // An already-reached edge is not a future target.
  const typical=position.typicalRthWidth;
  return {points,ibWidths:points/width,recentRangeWidths:typical&&Number.isFinite(typical)&&typical>0?points/typical:null};
}

/** Fixed soft scales, declared before replay: a factor of two in points, half
 * an IB width and (when both known) half a prior typical RTH range. Never use
 * the target session's final range or future movement to match its inputs. */
export function remainingMoveDifference(a:NonNullable<ReturnType<typeof requiredMove>>,b:NonNullable<ReturnType<typeof requiredMove>>){
  return (Math.log(a.points/b.points)/Math.log(2))**2+((a.ibWidths-b.ibWidths)/.5)**2+
    (a.recentRangeWidths!==null&&b.recentRangeWidths!==null?((a.recentRangeWidths-b.recentRangeWidths)/.5)**2:0);
}

export function deriveRemainingEdgeForecast(args: {
  recorded: 'HIGH' | 'LOW'; asOf: string; openAt: string; lockAt: string; closeAt: string;
  tickSize: number; candidates: RemainingEdgeCandidate[]; progress: PostBreakProgress | null;
  position?:RemainingEdgePosition|null;
}): RemainingEdgeForecast {
  const { asOf, openAt, lockAt, closeAt, tickSize, progress } = args;
  const elapsed = (Date.parse(asOf) - Date.parse(openAt)) / 60000;
  const total = (Date.parse(closeAt) - Date.parse(openAt)) / 60000;
  const remainingMinutes = Math.max(0, total - elapsed);
  const target = args.recorded === 'LOW' ? 'IBH' : 'IBL';
  const base: RemainingEdgeForecast = { version: 1, target, asOf, until: closeAt, remainingMinutes,
    probability: remainingMinutes === 0 ? 0 : null, baselineProbability: null, support: 'limited',
    eligibleDays: 0, matchingDays: 0, effectiveDays: 0, sourceRowIds: [], referenceBatchIds: [], progress };
  if (!remainingMinutes) return base;
  const lockMinute = (Date.parse(lockAt) - Date.parse(openAt)) / 60000;
  if (!Number.isInteger(total) || !Number.isInteger(lockMinute) || elapsed < lockMinute) return base;
  const move=args.position?requiredMove(args.position,target,tickSize,asOf):null;
  if(args.position!==undefined&&!move)return base;
  const freshness=args.position?1/(1+Math.max(0,(Date.parse(asOf)-Date.parse(args.position.priceAt))/60000)/15):1;
  const eligible = args.candidates.flatMap(candidate => {
    const outcome = remainingOutcome(candidate.path, target, tickSize, lockMinute, elapsed, total);
    if(outcome===null)return [];
    let geometry=0;
    if(move){
      const position=candidate.position;
      if(!position||!Number.isFinite(Date.parse(position.priceAt))||position.low!==candidate.path.low||position.high!==candidate.path.high||
        position.priceAt!==args.position!.priceAt&&Temporal.Instant.compare(position.priceAt,args.position!.priceAt)!==0)return [];
      const other=requiredMove(position,target,tickSize,asOf);
      if(!other)return [];
      // A stale manual price is not a current quote. Widen the soft comparison
      // as it ages; historical prices use the SAME observation time as the user.
      geometry=freshness*remainingMoveDifference(move,other);
    }
    return [{...candidate,outcome,geometry,kernel:Math.exp(-geometry/2),
      distance:candidate.distance+progressDistance(progress,candidate.progress)+geometry}];
  });
  if (!eligible.length) return base;
  const nearest = eligible.sort((a, b) => a.distance - b.distance || a.date.localeCompare(b.date)).slice(0, 40);
  const weighted = nearest.map(row => ({ ...row, weight: row.kernel*row.freshnessWeight / (1 + row.distance) }));
  const effectiveDays = weighted.reduce((n, row) => n + row.weight, 0);
  // Every baseline has the same cutoff, surviving edge state and deadline.
  // Calls without a position retain the original time-only method for replay.
  const unconditionedProbability = (eligible.filter(r => r.outcome).length + .5) / (eligible.length + 1);
  const baselineEffectiveDays=eligible.reduce((n,r)=>n+r.kernel,0);
  // One broad pseudo-day stabilizes thin distance evidence. Twenty days of the
  // resulting distance-aware baseline then smooth the contextual matches.
  // No extra neutral half-success can impose a several-percent late floor.
  const baselineProbability = move?(eligible.reduce((n,r)=>n+(r.outcome?r.kernel:0),0)+unconditionedProbability)/
    (baselineEffectiveDays+1):unconditionedProbability;
  const probability = (20 * baselineProbability + (move?0:.5) + weighted.reduce((n, r) => n + (r.outcome ? r.weight : 0), 0)) /
    (20 + (move?0:1) + effectiveDays);
  return { ...base, probability, baselineProbability, eligibleDays: eligible.length,
    matchingDays: weighted.length, effectiveDays,
    support: effectiveDays >= 20 && nearest.filter(r => r.distance <= 2).length >= 20 ? 'moderate' : 'limited',
    sourceRowIds: weighted.map(r => r.id), referenceBatchIds: [...new Set(eligible.map(r => r.batchId))].sort(),
    ...(move?{distance:{...move,priceAt:args.position!.priceAt,baselineEffectiveDays,unconditionedProbability}}:{}) };
}
