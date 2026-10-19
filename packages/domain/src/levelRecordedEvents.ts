// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,SignificantLevel,SignificantLevelMarketEventKind,SignificantLevelMarketEvent} from './index';
import {deriveVisitsFromEligibleDays} from './levelVisits';
import {levelPriceRole} from './levelPriceRole';

export type LevelRecordedEvent={
  id:string;levelId:string;sessionId:string;rthDate:string;
  kind:SignificantLevelMarketEventKind|'contact';at:string;startAt:string;endAt:string;price:number|null;
  source:'prices'|'manual'|'both';manual:SignificantLevelMarketEvent|null;
};
const ms=(at:string)=>Date.parse(at);
const minute=(at:string)=>Math.floor(ms(at)/60000);

/** A manual clock has minute precision. Match contact clusters in that minute,
 * or a crossing inside its actual observed interval. Never infer a rejection. */
export function matchingPriceLevelEvent(events:LevelRecordedEvent[],kind:SignificantLevelMarketEventKind,at:string,sessionId:string){
  const candidates=events.filter(event=>event.sessionId===sessionId&&event.source!=='manual'&&
    (event.kind===kind||event.kind==='contact'&&kind.startsWith('tested_'))&&
    (kind.startsWith('crossed_')?ms(at)>=ms(event.startAt)&&ms(at)<=ms(event.endAt)
      :minute(at)>=minute(event.startAt)&&minute(at)<=minute(event.endAt)));
  const unique=[...new Map(candidates.map(event=>[`${event.kind}:${event.startAt}:${event.endAt}`,event])).values()];
  return unique.length===1?unique[0]!:null;
}

export function duplicateManualLevelEvent(level:SignificantLevel,kind:SignificantLevelMarketEventKind,at:string,sessionId:string){
  return level.marketEvents.find(event=>!event.removedAt&&event.sessionId===sessionId&&event.kind===kind&&minute(event.observedAt)===minute(at))??null;
}

/** Already eligible observations. Contacts are tests; side changes are intervals,
 * even when an exact contact separates outside prices. No count of unseen tests. */
export function recordedEventsFromEligibleDays(level:SignificantLevel,days:JournalSession[],manual:SignificantLevelMarketEvent[]):LevelRecordedEvent[]{
  const prices:LevelRecordedEvent[]=[];
  for(const visit of deriveVisitsFromEligibleDays(level,days).visits)prices.push({id:visit.id,levelId:level.id,
    sessionId:visit.sessionId,rthDate:visit.rthDate,kind:visit.approach==='above'?'tested_from_above':visit.approach==='below'?'tested_from_below':'contact',
    at:visit.at,startAt:visit.at,endAt:visit.lastContactAt,price:visit.price,source:'prices',manual:null});
  for(const day of days){
    let prior:JournalSession['cpObservations'][number]|null=null,priorSide:'support'|'resistance'|null=null;
    const interruptions=level.lifecycleEvents.filter(event=>event.resultingStatus!=='active').map(event=>ms(event.occurredAt));
    for(const p of day.cpObservations){
      if(prior&&interruptions.some(at=>at>ms(prior!.observedAt)&&at<=ms(p.observedAt))){prior=null;priorSide=null;}
      const side=levelPriceRole(level,p.price,day.market.tickSize,'reference');
      if(side==='reference')continue;
      if(prior&&priorSide!==side)prices.push({id:`cross:${level.id}:${day.id}:${prior.id}:${p.id}`,levelId:level.id,
        sessionId:day.id,rthDate:day.rthDate,kind:side==='support'?'crossed_above':'crossed_below',at:p.observedAt,
        startAt:prior.observedAt,endAt:p.observedAt,price:p.price,source:'prices',manual:null});
      prior=p;priorSide=side;
    }
  }
  const covered=new Set<string>(),rows:LevelRecordedEvent[]=[],seen=new Set<string>();
  for(const event of manual){
    const key=JSON.stringify([event.sessionId,event.kind,minute(event.observedAt)]);
    if(seen.has(key))continue;seen.add(key);
    const match=matchingPriceLevelEvent(prices,event.kind,event.observedAt,event.sessionId);
    if(match)covered.add(match.id);
    rows.push({id:event.id,levelId:level.id,sessionId:event.sessionId,rthDate:event.rthDate,kind:event.kind,
      at:event.observedAt,startAt:match?.startAt??event.observedAt,endAt:match?.endAt??event.observedAt,
      price:event.observedPrice,source:match?'both':'manual',manual:event});
  }
  return [...prices.filter(event=>!covered.has(event.id)),...rows].sort((a,b)=>ms(b.at)-ms(a.at)||a.id.localeCompare(b.id));
}
