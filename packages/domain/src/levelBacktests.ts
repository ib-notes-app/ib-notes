// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,SignificantLevel} from './index';
import {levelPriceRole,type LevelPriceRole} from './levelPriceRole';
import {deriveVisitsFromEligibleDays} from './levelVisits';

export type LevelBacktestDefense={sessionId:string;rthDate:string;visitAt:string;move:number;moveAt:string};

export type LevelBacktestEvidence={
  role:LevelPriceRole;reversedAt:string|null;maxAway:number;maxAwayPrice:number|null;maxAwayAt:string|null;
  returnedAt:string|null;earlierReturnAt:string|null;throughAt:string|null;
  lastOriginalAt:string|null;lastContactAt:string|null;throughPrice:number|null;
  defenses:LevelBacktestDefense[];
};

/** Eligible saved prices only. A crossover is not an interpolated return test.
 * A later role reversal cannot erase an already recorded opposite-side test. */
export function backtestFromEligibleDays(level:SignificantLevel,days:JournalSession[]):LevelBacktestEvidence {
  const result:LevelBacktestEvidence={role:'reference',reversedAt:null,maxAway:0,maxAwayPrice:null,maxAwayAt:null,
    returnedAt:null,earlierReturnAt:null,throughAt:null,lastOriginalAt:null,lastContactAt:null,throughPrice:null,defenses:[]};
  const low=level.price??level.zoneLow,high=level.price??level.zoneHigh;
  if(low===null||high===null||!['low','high'].includes(level.levelType))return result;
  const original=level.levelType==='low'?'support':'resistance';
  const interruptions=level.lifecycleEvents.filter(event=>event.resultingStatus!=='active').map(event=>Date.parse(event.occurredAt)).sort((a,b)=>a-b);
  let priorAt=-Infinity,interruption=0;
  for(const day of days)for(const price of day.cpObservations) {
    const at=Date.parse(price.observedAt);
    let interrupted=false;
    while(interruption<interruptions.length&&interruptions[interruption]!<=at){
      if(interruptions[interruption]!>priorAt)interrupted=true;
      interruption++;
    }
    if(interrupted){result.role='reference';result.reversedAt=null;result.maxAway=0;result.maxAwayAt=null;result.maxAwayPrice=null;result.returnedAt=null;result.lastOriginalAt=null;result.lastContactAt=null;}
    priorAt=at;result.throughAt=price.observedAt;result.throughPrice=price.price;
    const next=levelPriceRole(level,price.price,day.market.tickSize,'reference');
    if(next==='reference') {
      if(price.price>=low-1e-9&&price.price<=high+1e-9)result.lastContactAt=price.observedAt;
      if(result.reversedAt&&price.price>=low-1e-9&&price.price<=high+1e-9){
        result.returnedAt??=price.observedAt;result.earlierReturnAt??=price.observedAt;
      }
      continue;
    }
    if(next===original){
      result.lastOriginalAt=price.observedAt;
      result.role=next;result.reversedAt=null;result.maxAway=0;result.maxAwayAt=null;result.maxAwayPrice=null;result.returnedAt=null;
      continue;
    }
    if(result.role===original){
      result.reversedAt=price.observedAt;result.maxAway=0;result.maxAwayAt=null;result.maxAwayPrice=null;result.returnedAt=null;
    }
    result.role=next;
    if(result.reversedAt){
      const away=next==='resistance'?low-price.price:price.price-high;
      if(away>result.maxAway){result.maxAway=away;result.maxAwayPrice=price.price;result.maxAwayAt=price.observedAt;}
    }
  }
  // Only a pending, sufficiently displaced reversal needs shelf evidence.
  // Clip before the latest loss so that loss cannot contaminate the final
  // defense's response. Keep the existing knowledge/price eligibility scope.
  if(result.reversedAt&&result.lastOriginalAt&&result.maxAway>=20&&!result.earlierReturnAt){
    const end=Date.parse(result.lastOriginalAt);
    const start=interruptions.filter(at=>at<=end).at(-1)??-Infinity;
    const prefix=days.map(day=>({...day,cpObservations:day.cpObservations.filter(p=>{
      const at=Date.parse(p.observedAt);return at>start&&at<=end;
    })}));
    const side=level.levelType==='low'?'above':'below';
    const defended=new Map<string,LevelBacktestDefense>();
    for(const visit of deriveVisitsFromEligibleDays(level,prefix).visits){
      const response=visit.response;
      if(visit.approach!==side||visit.departure!==side||!response||
        (side==='above'?response.firstBelowAt:response.firstAboveAt))continue;
      const move=side==='above'?response.maxAbove:response.maxBelow;
      const moveAt=side==='above'?response.maxAboveAt:response.maxBelowAt;
      if(move<20||!moveAt)continue;
      const prior=defended.get(visit.rthDate);
      if(!prior||move>prior.move)defended.set(visit.rthDate,{sessionId:visit.sessionId,rthDate:visit.rthDate,visitAt:visit.at,move,moveAt});
    }
    result.defenses=[...defended.values()];
  }
  return result;
}
