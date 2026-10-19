// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,SignificantLevel} from './index';
import {levelPriceRole} from './levelPriceRole';

export type LevelVisit = {
  id:string;levelId:string;sessionId:string;rthDate:string;at:string;price:number;
  lastContactAt:string;lastContactPrice:number;entries:number;
  approach:'above'|'below'|'unknown';departure:'above'|'below'|null;
  departureAt:string|null;departurePrice:number|null;
  response:LevelVisitResponse|null;
};
export type LevelVisitResponse = {
  maxAbove:number;maxAbovePrice:number|null;maxAboveAt:string|null;
  maxBelow:number;maxBelowPrice:number|null;maxBelowAt:string|null;
  firstAboveAt:string|null;firstBelowAt:string|null;reclaimedAt:string|null;
  latestSide:'above'|'below';throughAt:string;end:'last_entry'|'return'|'archived';endAt:string;
  newerLows:QualifiedLowReference[];
};
export type QualifiedLowReference = {
  id:string;sourceId:string;price:number;originAt:string;knownAt:string;
  contract:string;timeframe:SignificantLevel['sourceTimeframe'];basis:'pack'|'recorded';
};
export type LevelReclaimCycle = {
  id:string;levelId:string;sessionId:string;rthDate:string;belowAt:string;belowPrice:number;
  priorAboveAt:string|null;lowestPrice:number;reclaimAt:string;reclaimPrice:number;
};
export type LevelVisitHistory = {visits:LevelVisit[];cycles:LevelReclaimCycle[]};

/** Input prices must already satisfy contract, availability, lifecycle, cutoff
 * and conflict checks. Visits are observed contacts, never interpolated tests.
 * Session boundaries and archival gaps prevent stitching separate visits. */
export function deriveVisitsFromEligibleDays(level:SignificantLevel,days:JournalSession[]):LevelVisitHistory {
  const visits:LevelVisit[]=[],cycles:LevelReclaimCycle[]=[];
  const low=level.price??level.zoneLow,high=level.price??level.zoneHigh;
  if(low===null||high===null||level.sessionEdge?.status==='forming')return {visits,cycles};
  const interruptions=level.lifecycleEvents.filter(event=>event.resultingStatus!=='active')
    .map(event=>({at:Date.parse(event.occurredAt),observedAt:event.occurredAt})).sort((a,b)=>a.at-b.at);
  for(const day of days) {
    let visit:LevelVisit|null=null,lastSide:LevelVisit['approach']='unknown',lastAboveAt:string|null=null;
    let responseVisit:LevelVisit|null=null;
    let cycle:Omit<LevelReclaimCycle,'reclaimAt'|'reclaimPrice'>|null=null,priorAt=-Infinity,interruption=0;
    for(const p of day.cpObservations) {
      const at=Date.parse(p.observedAt);
      let interrupted=false;
      while(interruption<interruptions.length&&interruptions[interruption]!.at<=at) {
        if(interruptions[interruption]!.at>priorAt)interrupted=true;
        interruption++;
      }
      if(interrupted){
        if(responseVisit?.response){responseVisit.response.end='archived';responseVisit.response.endAt=interruptions[interruption-1]!.observedAt;}
        responseVisit=null;visit=null;cycle=null;lastSide='unknown';lastAboveAt=null;
      }
      priorAt=at;
      const side=levelPriceRole(level,p.price,day.market.tickSize,'reference');
      const contact=p.price>=low-1e-9&&p.price<=high+1e-9;
      if(contact) {
        if(!visit) {
          if(responseVisit?.response){responseVisit.response.end='return';responseVisit.response.endAt=p.observedAt;}
          responseVisit=null;
          visit={id:`visit:${level.id}:${day.id}:${p.id}`,levelId:level.id,sessionId:day.id,rthDate:day.rthDate,
            at:p.observedAt,price:p.price,lastContactAt:p.observedAt,lastContactPrice:p.price,entries:1,
            approach:lastSide,departure:null,departureAt:null,departurePrice:null,response:null};
          visits.push(visit);
        } else {visit.entries++;visit.lastContactAt=p.observedAt;visit.lastContactPrice=p.price;}
      } else if(side!=='reference') {
        const outside=side==='support'?'above':'below';
        if(visit){
          visit.departure=outside;visit.departureAt=p.observedAt;visit.departurePrice=p.price;
          visit.response={maxAbove:0,maxAbovePrice:null,maxAboveAt:null,maxBelow:0,maxBelowPrice:null,maxBelowAt:null,
            firstAboveAt:null,firstBelowAt:null,reclaimedAt:visit.approach==='below'&&outside==='above'?p.observedAt:null,
            latestSide:outside,throughAt:p.observedAt,end:'last_entry',endAt:p.observedAt,newerLows:[]};
          responseVisit=visit;visit=null;
        }
        if(responseVisit?.response) {
          const response=responseVisit.response;
          response.latestSide=outside;response.throughAt=p.observedAt;response.endAt=p.observedAt;
          if(outside==='above') {
            if(response.firstBelowAt&&!response.reclaimedAt)response.reclaimedAt=p.observedAt;
            response.firstAboveAt??=p.observedAt;
            if(p.price-high>response.maxAbove){response.maxAbove=p.price-high;response.maxAbovePrice=p.price;response.maxAboveAt=p.observedAt;}
          } else {
            response.firstBelowAt??=p.observedAt;
            if(low-p.price>response.maxBelow){response.maxBelow=low-p.price;response.maxBelowPrice=p.price;response.maxBelowAt=p.observedAt;}
          }
        }
        lastSide=outside;
        if(level.levelType==='low') {
          if(outside==='below') {
            if(!cycle)cycle={id:`cycle:${level.id}:${day.id}:${p.id}`,levelId:level.id,sessionId:day.id,rthDate:day.rthDate,
              belowAt:p.observedAt,belowPrice:p.price,priorAboveAt:lastAboveAt,lowestPrice:p.price};
            else cycle.lowestPrice=Math.min(cycle.lowestPrice,p.price);
          } else {
            if(cycle){cycles.push({...cycle,reclaimAt:p.observedAt,reclaimPrice:p.price});cycle=null;}
            lastAboveAt=p.observedAt;
          }
        }
      }
    }
  }
  return {visits,cycles};
}
