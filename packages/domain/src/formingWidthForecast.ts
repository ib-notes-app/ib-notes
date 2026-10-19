// SPDX-License-Identifier: MPL-2.0
import type { BestFitPathDay } from './bestFitForecast';
import type { ForecastEstimate } from './forecast';

export type FormingWidthCandidate = {
  id: string; batchId: string; path: BestFitPathDay; weight: number;
};
export type FormingWidthForecast = {
  version: 'ib-remaining-width-v1'; asOf: string; until: string; remainingMinutes: number;
  observedAt: string; evidenceAgeMinutes: number; sampleMinute: number;
  eligibleDays: number; matchingDays: number; effectiveDays: number;
  sourceRowIds: string[]; referenceBatchIds: string[];
  estimate: ForecastEstimate['width'] | null;
};

/** Historical cumulative edges through the completed minute; the locked width
 * is an outcome of an already completed learning day, never today's future. */
function growthRatio(path: BestFitPathDay, minute: number, total: number, tick: number): number | null {
  if (path.formingHighs.length !== total || path.formingLows.length !== total || minute < 1) return null;
  const high=path.formingHighs[minute-1],low=path.formingLows[minute-1];
  const final=path.high-path.low;
  if (!Number.isInteger(high)||!Number.isInteger(low)||!Number.isFinite(final)||final<=0||
      high<=low||low<0||high*tick>final+1e-8) return null;
  const width=(high-low)*tick;
  return Math.max(0,(final-width)/width);
}
function quantile(rows: Array<{value:number;weight:number}>, fraction: number): number {
  const sorted=[...rows].sort((a,b)=>a.value-b.value);
  const cutoff=sorted.reduce((sum,row)=>sum+row.weight,0)*fraction;
  let sum=0;
  for(const row of sorted){sum+=row.weight;if(sum>=cutoff)return row.value;}
  return sorted.at(-1)!.value;
}

/** Width-only target. The caller supplies its existing eligible rows and selected
 * IDs; this function cannot change edge ranking, probabilities or saved originals. */
export function deriveFormingWidthForecast(args: {
  width: number; asOf: string; observedAt: string; openAt: string; lockAt: string; tickSize: number;
  candidates: FormingWidthCandidate[]; selectedIds: string[];
}): FormingWidthForecast {
  const {width,asOf,observedAt,openAt,lockAt,tickSize}=args;
  const elapsed=(Date.parse(asOf)-Date.parse(openAt))/60000;
  const total=(Date.parse(lockAt)-Date.parse(openAt))/60000;
  const sampleMinute=Math.min(total,Math.floor(elapsed));
  const evidenceAgeMinutes=Math.max(0,(Date.parse(asOf)-Date.parse(observedAt))/60000);
  const base:FormingWidthForecast={version:'ib-remaining-width-v1',asOf,until:lockAt,
    remainingMinutes:Math.max(0,total-elapsed),observedAt,evidenceAgeMinutes,sampleMinute,
    eligibleDays:0,matchingDays:0,effectiveDays:0,sourceRowIds:[],referenceBatchIds:[],estimate:null};
  if(!Number.isInteger(total)||total<1||!Number.isFinite(elapsed)||elapsed<1||elapsed>=total||!Number.isFinite(width)||width<=0||
      !Number.isFinite(evidenceAgeMinutes)||!Number.isFinite(tickSize)||tickSize<=0||
      Date.parse(observedAt)>Date.parse(asOf)) return base;
  const eligible=args.candidates.flatMap(candidate=>{
    const growth=growthRatio(candidate.path,sampleMinute,total,tickSize);
    return growth===null||!Number.isFinite(candidate.weight)||candidate.weight<0 ? [] : [{...candidate,growth}];
  });
  if(!eligible.length)return base;
  const selectedIds=new Set(args.selectedIds),selected=eligible.filter(row=>selectedIds.has(row.id)&&row.weight>0);
  // Same 20-day shrinkage, spread across outcomes of the SAME remaining interval.
  // The old 15R estimate is not a point mass holding the late forecast up.
  const distribution=[...eligible.map(row=>({value:width*(1+row.growth),weight:20/eligible.length})),
    ...selected.map(row=>({value:width*(1+row.growth),weight:row.weight}))];
  const estimate={median:quantile(distribution,.5),low:quantile(distribution,.1),high:quantile(distribution,.9)};
  // Sparse entries do not confirm that nothing expanded between observations.
  // Keep the late estimate time-aware, but allow missed expansion in its upper band.
  const evidenceMinute=Math.max(1,Math.min(sampleMinute,Math.floor((Date.parse(observedAt)-Date.parse(openAt))/60000)));
  if(evidenceMinute<sampleMinute) {
    const uncertain=eligible.flatMap(row=>{
      const growth=growthRatio(row.path,evidenceMinute,total,tickSize);
      return growth===null?[]:[{value:width*(1+growth),weight:20/eligible.length+(selectedIds.has(row.id)?row.weight:0)}];
    });
    if(uncertain.length)estimate.high=Math.max(estimate.high,quantile(uncertain,.9));
  }
  return {...base,estimate,eligibleDays:eligible.length,matchingDays:selected.length,
    effectiveDays:selected.reduce((sum,row)=>sum+row.weight,0),sourceRowIds:selected.map(row=>row.id),
    referenceBatchIds:[...new Set(eligible.map(row=>row.batchId))].sort()};
}
