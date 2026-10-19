// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {deriveClosingOutcome,deriveSessionFinalIb,type JournalSession} from './index';
import {compareForecastUpdates,type ForecastUpdate} from './forecastUpdates';
import {forecastActual} from './forecast';
import {roundManualPriceFields,roundPriceToTick} from './priceTicks';

export type PostIbForecastPoint={update:ForecastUpdate;probability:number};
export type PostIbForecastTimeline={
  target:'RETURN'|'IBH'|'IBL';count:number;points:PostIbForecastPoint[];
  outlook:'EVENT_FAVORED'|'NO_EVENT_FAVORED'|'SHIFTED_TO_EVENT'|'SHIFTED_AWAY'|'MIXED'|'EVEN';
  result:'RETURN_RECORDED'|'NO_RETURN_RECORDED'|'BREAK_RECORDED'|'NO_BREAK'|'UNCONFIRMED';
  earlierReturnOnly?:boolean;
};

/** Sample actual first/middle/latest times, never the most flattering odds or
 * an average weighted by how frequently someone saved a price. */
function timeline(target:PostIbForecastTimeline['target'],rows:PostIbForecastPoint[],result:PostIbForecastTimeline['result']):PostIbForecastTimeline{
  const unique=[...new Map(rows.map(row=>[row.update.issuedAt,row])).values()];
  const first=unique[0]!,last=unique.at(-1)!,middle=(Date.parse(first.update.issuedAt)+Date.parse(last.update.issuedAt))/2;
  const points=unique.length<=3?unique:[first,unique.slice(1,-1).reduce((a,b)=>
    Math.abs(Date.parse(a.update.issuedAt)-middle)<=Math.abs(Date.parse(b.update.issuedAt)-middle)?a:b),last];
  const probabilities=rows.map(row=>row.probability);
  const outlook=probabilities.every(p=>p<.5)?'NO_EVENT_FAVORED':probabilities.every(p=>p>.5)?'EVENT_FAVORED':
    probabilities.every(p=>p===.5)?'EVEN':first.probability<=.5&&last.probability>.5?'SHIFTED_TO_EVENT':
    first.probability>=.5&&last.probability<.5?'SHIFTED_AWAY':'MIXED';
  return {target,count:rows.length,points,outlook,result};
}

/** Read-only close projection. A saved return estimate is never reconstructed
 * for an older day, and an unobserved return is never labeled a failure. */
export function derivePostIbRecap(session:JournalSession,updates=session.forecastUpdates){
  if(!session.close.finishedAt)return null;
  const instant=(clock:string)=>{
    let date=Temporal.PlainDate.from(session.rthDate);
    if(Temporal.PlainTime.compare(clock,session.market.checkpoints.overnightLock)<0)date=date.add({days:1});
    return date.toZonedDateTime({timeZone:session.market.canonicalTimeZone,plainTime:clock}).toInstant().epochMilliseconds;
  };
  const lock=instant(session.market.checkpoints.ibLock),end=instant(session.market.checkpoints.studyClose);
  const closeTime=session.close.observedAt?Date.parse(session.close.observedAt):end;
  const cutoff=Math.min(closeTime,end),tick=session.market.tickSize;
  const known=Math.max(Date.parse(session.updatedAt),Date.parse(session.close.finishedAt));
  const values=new Map<number,Set<number>>();
  const prices=[...session.cpObservations,...session.rthObservations,
    ...(session.close.price!==null&&session.close.observedAt?[{price:session.close.price,observedAt:session.close.observedAt,recordedAt:session.close.recordedAt??undefined}]:[])];
  for(const price of prices){
    const at=Date.parse(price.observedAt);
    if(!Number.isFinite(at)||at<=lock||at>cutoff||!Number.isFinite(price.price)||
      price.recordedAt&&Date.parse(price.recordedAt)>known)continue;
    const row=values.get(at)??new Set<number>();row.add(roundPriceToTick(price.price,tick));values.set(at,row);
  }
  const observations=[...values].filter(([,row])=>row.size===1).sort(([a],[b])=>a-b).map(([at,row],i)=>({
    id:`recap-${i}`,observedAt:new Date(at).toISOString(),recordedAt:new Date(at).toISOString(),
    price:[...row][0]!,note:null,cpObservationId:null}));
  const bounded:JournalSession={...session,cpObservations:[],rthObservations:observations,
    fifteenMinute:roundManualPriceFields(session.fifteenMinute,tick),aPeriod:roundManualPriceFields(session.aPeriod,tick),
    bPeriod:roundManualPriceFields(session.bPeriod,tick),bSnapshots:session.bSnapshots.map(row=>roundManualPriceFields(row,tick)),
    close:roundManualPriceFields({...session.close,
      price:closeTime<=end?session.close.price:null},tick)};
  const ib=deriveSessionFinalIb(bounded),outcome=deriveClosingOutcome(bounded,ib,tick);
  const close=bounded.close.price;
  const position=close===null||!ib||ib.low===null||ib.high===null?null:
    close>ib.high?'ABOVE':close<ib.low?'BELOW':close===ib.high?'AT_HIGH':close===ib.low?'AT_LOW':'INSIDE';
  const scoped=[...new Map(updates.filter(update=>{
    const at=Date.parse(update.issuedAt);
    return update.sessionId===session.id&&update.journalId===session.journalId&&update.contract===session.contract&&
      !!session.forecast&&update.originalIssuedAt===session.forecast.issuedAt&&at>=Date.parse(session.forecast.issuedAt)&&
      update.version===1&&update.phase==='LOCKED'&&at>lock&&at<end&&at<=cutoff&&update.asOf===update.issuedAt;
  }).map(update=>[update.id,update])).values()].sort((a,b)=>Date.parse(a.issuedAt)-Date.parse(b.issuedAt)||a.id.localeCompare(b.id));
  const probability=(p:unknown):p is number=>typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1;
  const eligible=scoped.filter(update=>{
    const future=update.ibReturn;
    return future?.version===1&&future.modelVersion==='ib-return-v1'&&future.asOf===update.asOf&&Date.parse(future.until)===end&&probability(future.probability);
  });
  const comparisons=compareForecastUpdates(bounded,scoped),byId=new Map(comparisons.map(row=>[row.update.id,row]));
  const ambiguous=(update:ForecastUpdate)=>[...values].some(([at,row])=>row.size>1&&at>=Date.parse(update.priceAt??'')&&at<=Date.parse(update.issuedAt));
  const allEstimates=eligible.map(update=>{
    const comparison=byId.get(update.id)!;
    const ambiguousQuote=ambiguous(update);
    const returned=comparison.ibReturnOutcome===true&&!ambiguousQuote?observations.find(price=>
      Date.parse(price.observedAt)>Date.parse(update.issuedAt)&&Date.parse(price.observedAt)<=Date.parse(update.ibReturn!.until)&&
      price.price>=update.low+tick-1e-9&&price.price<=update.high-tick+1e-9):null;
    const result=returned?'RETURN_RECORDED' as const:
      !ambiguousQuote&&comparison.ibReturnReason?.startsWith('No later inside price recorded')?'NO_RETURN_RECORDED' as const:'CANNOT_COMPARE' as const;
    return {update,returnAt:returned?.observedAt??null,result,
      reason:ambiguousQuote?'Conflicting prices at the estimate time':comparison.ibReturnReason};
  });
  const estimates=allEstimates.length>1?[allEstimates[0]!,allEstimates.at(-1)!]:allEstimates;
  const timelines:PostIbForecastTimeline[]=[];
  const returns=allEstimates.filter(row=>row.result!=='CANNOT_COMPARE');
  if(returns.length)timelines.push({...timeline('RETURN',returns.map(row=>({update:row.update,probability:row.update.ibReturn!.probability!})),
    returns.some(row=>row.returnAt)?'RETURN_RECORDED':'NO_RETURN_RECORDED'),
    earlierReturnOnly:returns.some(row=>row.returnAt)&&!returns.at(-1)!.returnAt});
  const quotes=[...values].sort(([a],[b])=>a-b);
  for(const target of ['IBH','IBL'] as const){
    const rows=comparisons.filter(comparison=>{
      const {update}=comparison,future=update.remainingEdge,at=Date.parse(update.issuedAt);
      const quote=quotes.filter(([time])=>time<=at).at(-1);
      return future?.version===1&&future.target===target&&future.asOf===update.asOf&&Date.parse(future.until)===end&&
        probability(future.probability)&&!!ib&&Math.abs(update.low-ib.low!)<1e-8&&Math.abs(update.high-ib.high!)<1e-8&&
        update.recordedEdges===(target==='IBH'?'LOW':'HIGH')&&!update.settled&&!ambiguous(update)&&
        !!quote&&quote[0]===Date.parse(update.priceAt??'')&&quote[1].size===1&&quote[1].has(update.price!)&&
        !observations.some(price=>Date.parse(price.observedAt)<=at&&
          (target==='IBH'?price.price>=ib.high!+tick-1e-9:price.price<=ib.low!-tick+1e-9))&&
        comparison.reason!=='Other edge already recorded'&&comparison.reason!=='Both edges already recorded';
    });
    if(!rows.length)continue;
    const hit=observations.some(price=>Date.parse(price.observedAt)>Date.parse(rows[0]!.update.issuedAt)&&
      (target==='IBH'?price.price>=ib!.high!+tick-1e-9:price.price<=ib!.low!-tick+1e-9));
    timelines.push(timeline(target,rows.map(row=>({update:row.update,probability:row.update.remainingEdge!.probability!})),
      hit?'BREAK_RECORDED':rows.every(row=>row.remainingEdgeOutcome===false)?'NO_BREAK':'UNCONFIRMED'));
  }
  return {code:outcome?.breakCode??null,complete:forecastActual(bounded).complete,close,position,
    outsideDistance:outcome?.outsideCloseDistance??null,estimates,savedCount:eligible.length,timelines,
    excludedCount:allEstimates.length-returns.length};
}
