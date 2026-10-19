// SPDX-License-Identifier: MPL-2.0
import {remainingMoveDifference,type RemainingEdgeCandidate,type RemainingEdgeDistance,type RemainingEdgePosition} from './remainingEdgeForecast';
import type {BestFitPathDay} from './bestFitForecast';
import {Temporal} from '@js-temporal/polyfill';

/** A fresh return from the last recorded outside price, even after earlier returns.
 * Kept separate from which IB edges break and from the original forecast. */
export type IbReturnForecast={
  version:1;modelVersion:'ib-return-v1';from:'ABOVE'|'BELOW';asOf:string;until:string;remainingMinutes:number;
  probability:number|null;baselineProbability:number|null;support:'limited'|'moderate';
  eligibleDays:number;matchingDays:number;effectiveDays:number;sourceRowIds:string[];referenceBatchIds:string[];
  distance:RemainingEdgeDistance;
};

function move(position:RemainingEdgePosition,from:IbReturnForecast['from'],tick:number){
  const {price,low,high,typicalRthWidth}=position,width=high-low;
  if(![price,low,high,width,tick].every(Number.isFinite)||tick<=0||width<2*tick-1e-9||
    (from==='BELOW'?price>=low:price<=high))return null;
  const points=from==='BELOW'?low+tick-price:price-(high-tick);
  return {points,ibWidths:points/width,recentRangeWidths:typicalRthWidth&&Number.isFinite(typicalRthWidth)&&typicalRthWidth>0?points/typicalRthWidth:null};
}

/** Minute ranges must overlap the strict interior. A touch of the edge alone
 * does not count. No crossing order is inferred from a minute's extremes. */
export function ibReturnPathOutcome(path:BestFitPathDay,tick:number,elapsed:number,total:number):boolean|null{
  const {highs,lows}=path,rawWidth=(path.high-path.low)/tick,width=Math.round(rawWidth);
  if(!Number.isInteger(total)||!Number.isFinite(elapsed)||elapsed<0||elapsed>total||tick<=0||
    !Number.isFinite(rawWidth)||Math.abs(rawWidth-width)>1e-6||width<2||!highs||!lows||highs.length!==total||lows.length!==total)return null;
  for(let i=0;i<total;i++)if(!Number.isInteger(highs[i])||!Number.isInteger(lows[i])||highs[i]!<lows[i]!)return null;
  const inside=(i:number)=>highs[i]!>=1&&lows[i]!<=width-1;
  const completed=Math.floor(elapsed),after=Math.ceil(elapsed);
  if(after>completed&&inside(completed))return null; // The cutoff splits this minute; event timing is unknown.
  for(let i=after;i<total;i++)if(inside(i))return true;
  return false;
}

export function deriveIbReturnForecast(args:{
  asOf:string;openAt:string;lockAt:string;closeAt:string;tickSize:number;
  position:RemainingEdgePosition;candidates:RemainingEdgeCandidate[];
}):IbReturnForecast|null{
  const {asOf,openAt,lockAt,closeAt,tickSize,position}=args;
  const cutoff=Date.parse(asOf),priceAt=Date.parse(position.priceAt),lock=Date.parse(lockAt);
  const elapsed=(cutoff-Date.parse(openAt))/60000,total=(Date.parse(closeAt)-Date.parse(openAt))/60000;
  const from=position.price<position.low?'BELOW':'ABOVE',distance=move(position,from,tickSize);
  if(!distance||![cutoff,priceAt,lock,elapsed,total].every(Number.isFinite)||priceAt<=lock||priceAt>cutoff||
    cutoff<lock||elapsed>=total||!Number.isInteger(total))return null;
  try{if(Temporal.Instant.compare(position.priceAt,asOf)>0)return null;}catch{return null;}
  const base:IbReturnForecast={version:1,modelVersion:'ib-return-v1',from,asOf,until:closeAt,remainingMinutes:total-elapsed,
    probability:null,baselineProbability:null,support:'limited',eligibleDays:0,matchingDays:0,effectiveDays:0,
    sourceRowIds:[],referenceBatchIds:[],distance:{...distance,priceAt:position.priceAt,baselineEffectiveDays:0,unconditionedProbability:0}};
  const freshness=1/(1+(cutoff-priceAt)/60000/15);
  const eligible=args.candidates.flatMap(candidate=>{
    const other=candidate.position;
    if(!other||Date.parse(other.priceAt)!==priceAt||other.low!==candidate.path.low||other.high!==candidate.path.high||
      !Number.isFinite(candidate.distance)||candidate.distance<0||!Number.isFinite(candidate.freshnessWeight)||
      candidate.freshnessWeight<0||candidate.freshnessWeight>1)return [];
    try{if(Temporal.Instant.compare(other.priceAt,position.priceAt)!==0)return [];}catch{return [];}
    const required=move(other,from,tickSize),outcome=ibReturnPathOutcome(candidate.path,tickSize,elapsed,total);
    if(!required||outcome===null)return [];
    const geometry=freshness*remainingMoveDifference(distance,required);
    return [{...candidate,outcome,distance:candidate.distance+geometry,kernel:Math.exp(-geometry/2)}];
  });
  if(!eligible.length)return base;
  const nearest=eligible.sort((a,b)=>a.distance-b.distance||a.date.localeCompare(b.date)).slice(0,40);
  const weighted=nearest.map(row=>({...row,weight:row.kernel*row.freshnessWeight/(1+row.distance)}));
  const effectiveDays=weighted.reduce((sum,row)=>sum+row.weight,0);
  const unconditionedProbability=(eligible.filter(row=>row.outcome).length+.5)/(eligible.length+1);
  const baselineEffectiveDays=eligible.reduce((sum,row)=>sum+row.kernel,0);
  const baselineProbability=(eligible.reduce((sum,row)=>sum+(row.outcome?row.kernel:0),0)+unconditionedProbability)/(baselineEffectiveDays+1);
  const probability=(20*baselineProbability+weighted.reduce((sum,row)=>sum+(row.outcome?row.weight:0),0))/(20+effectiveDays);
  return {...base,probability,baselineProbability,eligibleDays:eligible.length,matchingDays:weighted.length,effectiveDays,
    support:effectiveDays>=20&&nearest.filter(row=>row.distance<=2).length>=20?'moderate':'limited',
    sourceRowIds:weighted.map(row=>row.id),referenceBatchIds:[...new Set(eligible.map(row=>row.batchId))].sort(),
    distance:{...base.distance,baselineEffectiveDays,unconditionedProbability}};
}
