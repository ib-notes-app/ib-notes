// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,MarketContextItem,SignificantLevel} from './index';
import {deriveLevelRecordedEvents,levelActivityPriceDays} from './levelActivityStatistics';
import type {LevelRecordedEvent} from './levelRecordedEvents';

export type EventPriceMoveLink={startCpId:string;endCpId:string;linkedAt:string};
export type EventMoveScope=Omit<Parameters<typeof deriveLevelRecordedEvents>[0],'level'>;
export type EventMoveAssociation={sessionId:string;eventId:string;name:string;eventAt:string;
  levelType:SignificantLevel['levelType'];
  start:JournalSession['cpObservations'][number];end:JournalSession['cpObservations'][number];
  activities:LevelRecordedEvent[];laterBacktest:LevelRecordedEvent|null;formed:boolean};

/** Event-move annotations are not forecast inputs or refresh triggers. */
export function eventContextForForecast(session:JournalSession){
  const strip=(item:MarketContextItem|null)=>{if(!item)return item;const {priceMove:_,newsResult:__,...rest}=item;return rest;};
  return {items:session.marketContextItems.map(item=>strip(item)!),history:session.marketContextHistory.flatMap(entry=>{
    const prior=strip(entry.prior),resulting=strip(entry.resulting);
    if((entry.prior?.priceMove||entry.resulting?.priceMove||entry.prior?.newsResult||entry.resulting?.newsResult)&&JSON.stringify(prior)===JSON.stringify(resulting))return [];
    return [{...entry,prior,resulting}];
  })};
}

export function eventMovePrices(session:JournalSession,asOf:string,windows:EventMoveScope['windows']) {
  return levelActivityPriceDays({sessions:[session],context:session,asOf,windows})[0]?.cpObservations??[];
}

export function resolveEventPriceMove(session:JournalSession,item:MarketContextItem,asOf:string,windows:EventMoveScope['windows']){
  const prices=eventMovePrices(session,asOf,windows),link=item.priceMove;
  if(!link||typeof link.startCpId!=='string'||typeof link.endCpId!=='string'||typeof link.linkedAt!=='string'||!Number.isFinite(Date.parse(link.linkedAt)))return null;
  const start=prices.find(p=>p.id===link?.startCpId),end=prices.find(p=>p.id===link?.endCpId);
  if(!link||item.holiday||!start||!end||Date.parse(start.observedAt)>=Date.parse(end.observedAt)||
    Date.parse(end.observedAt)<Date.parse(item.eventAt)||Date.parse(link.linkedAt)>Date.parse(asOf))return null;
  return {start,end};
}

/** Save one event link, never duplicate level observations or price entries. */
export function withEventPriceMove(session:JournalSession,itemId:string,anchors:Omit<EventPriceMoveLink,'linkedAt'>|null,at:string,windows:EventMoveScope['windows']):JournalSession {
  if(!Number.isFinite(Date.parse(at)))throw new Error('The link time is invalid.');
  const prior=session.marketContextItems.find(item=>item.id===itemId);
  if(!prior)throw new Error('That event is no longer available.');
  if(prior.holiday)throw new Error('Link a move to a timed news event.');
  const {priceMove:old,...rest}=prior;
  const resulting:MarketContextItem=anchors?{...rest,priceMove:{...anchors,linkedAt:at}}:rest;
  if(anchors&&!resolveEventPriceMove(session,resulting,at,windows))throw new Error('Choose two available saved prices in time order, ending after the event.');
  if(anchors&&old?.startCpId===anchors.startCpId&&old.endCpId===anchors.endCpId||!anchors&&!old)return session;
  const history={id:`context-history:${at}:price-move:${session.marketContextHistory.length+1}`,itemId,
    action:'corrected' as const,prior,resulting,occurredAt:at};
  return {...session,updatedAt:at,marketContextItems:session.marketContextItems.map(item=>item.id===itemId?resulting:item),
    marketContextHistory:[...session.marketContextHistory,history]};
}

/** Descriptive context only. A gap remains an interval, not an invented test or cause. */
export function deriveEventMoveAssociations(input:EventMoveScope&{levels:SignificantLevel[]},only?:{sessionId:string;eventId:string}){
  const result=new Map<string,EventMoveAssociation[]>(),cutoff=Date.parse(input.asOf);
  const moves=input.sessions.filter(day=>day.journalId===input.context.journalId&&day.instrument===input.context.instrument&&day.rthDate<=input.context.rthDate)
    .flatMap(day=>day.marketContextItems.filter(item=>item.priceMove&&!item.holiday&&Date.parse(item.recordedAt)<=cutoff&&
      (!only||only.sessionId===day.id&&only.eventId===item.id)).flatMap(item=>{
      const bounds=resolveEventPriceMove(day,item,input.asOf,input.windows);
      return bounds?[{day,item,...bounds}]:[];
    }));
  if(!moves.length)return result;
  for(const level of input.levels){
    if(level.instrument!==input.context.instrument||level.currentStatus==='removed'||level.sessionEdge?.status==='forming')continue;
    const events=deriveLevelRecordedEvents({...input,level});
    for(const move of moves){
      const start=Date.parse(move.start.observedAt),end=Date.parse(move.end.observedAt);
      const activities=events.filter(event=>event.sessionId===move.day.id&&(event.manual
        ?Date.parse(event.at)>=start&&Date.parse(event.at)<=end
        :Date.parse(event.startAt)>=start&&Date.parse(event.endAt)<=end));
      // Formation requires an explicit origin and eligible evidence, not a new CP minimum.
      const formed=!!level.originAt&&level.originTimePrecision!=='unknown'&&Date.parse(level.originAt)>=start&&Date.parse(level.originAt)<=end&&
        activities.length>0;
      if(!activities.length)continue;
      const loss=activities.some(event=>event.kind==='crossed_below');
      const laterBacktest=loss&&level.levelType==='low'?events.filter(event=>Date.parse(event.at)>end&&
        ['tested_from_below','held_below'].includes(event.kind)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0]??null:null;
      const association:EventMoveAssociation={sessionId:move.day.id,eventId:move.item.id,name:move.item.name,eventAt:move.item.eventAt,levelType:level.levelType,
        start:move.start,end:move.end,activities,laterBacktest,formed};
      const list=result.get(level.id)??[];list.push(association);result.set(level.id,list);
    }
  }
  for(const list of result.values())list.sort((a,b)=>Date.parse(b.end.observedAt)-Date.parse(a.end.observedAt));
  return result;
}
