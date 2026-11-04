// SPDX-License-Identifier: MPL-2.0
import {deriveSessionFinalIb,roundPriceToTick,type DayType,type ForecastUpdate,type JournalSession,
  type WeeklySessionSummary} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import {periodShareSummary,type PeriodShareOptions} from './periodShareSummary';

export type WeeklyMarketOptions=PeriodShareOptions&{sessions?:JournalSession[];timeZone?:string};
export type MarketRange={low:number;high:number;width:number};
export type WeeklyMarketDay={date:string;on:MarketRange|null;ib:MarketRange|null;rth:MarketRange|null;
  ibWidth:number|null;close:number|null;actual:DayType|null;contract:string|null;
  forecast:{types:DayType[];probability:number;at:string;earlier:boolean}|null};

const ms=(s:string|null|undefined)=>Date.parse(s??'');
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const median=(ns:number[])=>{const sorted=[...ns].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);
  return !sorted.length?null:sorted.length%2?sorted[i]!:((sorted[i-1]!+sorted[i]!)/2);};
function range(low:unknown,high:unknown,tick:number):MarketRange|null{
  if(!finite(low)||!finite(high)||high<low)return null;
  const l=roundPriceToTick(low,tick),h=roundPriceToTick(high,tick);return {low:l,high:h,width:Math.round((h-l)/tick)*tick};
}

/** Latest valid saved estimate in the lock minute, consistently for every day.
 * A later post-break estimate
 * cannot replace a missing lock forecast or turn an observation into a forecast. */
export function weeklyIbLockForecast(session:JournalSession){
  const clock=createSessionClock(session.market),lock=clock.checkpointInstant(session.rthDate,session.market.checkpoints.ibLock).epochMilliseconds;
  const final=deriveSessionFinalIb(session),tick=session.market.tickSize,edges=range(final?.low,final?.high,tick);
  const quoteFacts=[...session.cpObservations,...session.rthObservations];
  const candidates=session.forecastUpdates.filter(u=>{
    const at=ms(u.issuedAt),probabilities=Object.values(u.estimate.dayType);
    if(!Number.isFinite(at)||u.sessionId!==session.id||u.journalId!==session.journalId||u.contract!==session.contract||
      !session.forecast||u.originalIssuedAt!==session.forecast.issuedAt||at<ms(session.forecast.issuedAt)||
      u.asOf!==u.issuedAt||at>=lock+60_000||u.recordedEdges||u.settled||
      probabilities.length!==4||probabilities.some(p=>!finite(p)||p<0||p>1)||Math.abs(probabilities.reduce((a,b)=>a+b,0)-1)>1e-6)return false;
    if(at>=lock&&u.phase!=='LOCKED'||at<lock&&u.phase!=='FORMING')return false;
    if(u.phase==='LOCKED'&&(!final||final.low===null||final.high===null||
      Math.abs(u.low-roundPriceToTick(final.low,tick))>1e-8||Math.abs(u.high-roundPriceToTick(final.high,tick))>1e-8))return false;
    if(u.price!==null){
      const before=quoteFacts.filter(p=>ms(p.observedAt)<=at).sort((a,b)=>ms(a.observedAt)-ms(b.observedAt));
      const latest=before.at(-1);if(!latest||ms(latest.observedAt)!==ms(u.priceAt)||
        before.some(p=>ms(p.observedAt)===ms(latest.observedAt)&&p.price!==u.price))return false;
    }
    // Backfilled breaks before this receipt also make it an already-observed target.
    return !edges||!quoteFacts.some(p=>ms(p.observedAt)>lock&&ms(p.observedAt)<=at&&
      (p.price>=edges.high+tick-1e-9||p.price<=edges.low-tick+1e-9));
  }).sort((a,b)=>ms(a.issuedAt)-ms(b.issuedAt)||a.id.localeCompare(b.id));
  const atLock=candidates.filter(u=>ms(u.issuedAt)>=lock).at(-1),u:ForecastUpdate|undefined=atLock??candidates.at(-1);
  if(!u)return null;
  const probability=Math.max(...Object.values(u.estimate.dayType));
  return {types:(Object.keys(u.estimate.dayType) as DayType[]).filter(t=>u.estimate.dayType[t]===probability),
    probability,at:u.issuedAt,earlier:!atLock};
}

/** Explicit public facts only; no notes, receipt payloads, internal IDs or quality labels. */
export function weeklyMarketFacts(summary:WeeklySessionSummary,instrument:string,options:WeeklyMarketOptions={}){
  const view=periodShareSummary(summary,options),sources=options.sessions??[];
  const days:WeeklyMarketDay[]=view.days.filter(d=>d.rthDate>=summary.weekStart&&d.rthDate<=summary.weekEnd).map(day=>{
    const s=sources.find(s=>s.id===day.sessionId&&s.rthDate===day.rthDate&&s.instrument===instrument);
    if(!s)return {date:day.rthDate,on:null,ib:null,rth:null,ibWidth:day.finalIbWidth,close:null,
      actual:day.dayType,contract:null,forecast:null};
    const tick=s.market.tickSize,final=deriveSessionFinalIb(s),ib=range(final?.low,final?.high,tick);
    const on=s.overnight.status==='confirmed'?range(s.overnight.low,s.overnight.high,tick):null;
    let rth=s.close.finishedAt?range(s.close.rthLow,s.close.rthHigh,tick):null;
    // Full regular hours includes the first hour. Never substitute the post-IB range.
    if(rth&&ib)rth=range(Math.min(rth.low,ib.low),Math.max(rth.high,ib.high),tick);
    const close=s.close.finishedAt&&finite(s.close.price)?roundPriceToTick(s.close.price,tick):null;
    const highBreak=!!rth&&!!ib&&rth.high>=ib.high+tick-1e-9,lowBreak=!!rth&&!!ib&&rth.low<=ib.low-tick+1e-9;
    const actual:DayType|null=rth&&ib?highBreak?(lowBreak?'IBB':'IBH'):(lowBreak?'IBL':'IBN'):null;
    return {date:day.rthDate,on,ib,rth,ibWidth:ib?.width??null,close,actual,
      contract:s.contractStatus==='known'?s.contract:null,forecast:weeklyIbLockForecast(s)};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const contracts=[...new Set(days.flatMap(d=>d.contract?[d.contract]:[]))];
  const rths=days.flatMap(d=>d.rth?[d.rth]:[]),ons=days.flatMap(d=>d.on?[d.on.width]:[]);
  const comparableClose=days.filter(d=>d.close!==null&&d.ib);
  const widest=rths.length===days.length?days.filter(d=>d.rth).sort((a,b)=>b.rth!.width-a.rth!.width||a.date.localeCompare(b.date))[0]??null:null;
  const counts={IBH:0,IBL:0,IBB:0,IBN:0};for(const d of days)if(d.actual)counts[d.actual]++;
  return {days,counts,contract:contracts.length===1?contracts[0]!:null,timeZone:options.timeZone??sources[0]?.displayTimeZone??'UTC',
    typicalIb:median(days.flatMap(d=>d.ibWidth===null?[]:[d.ibWidth])),typicalOn:median(ons),typicalRth:median(rths.map(r=>r.width)),
    weekRange:contracts.length===1&&days.every(d=>d.contract===contracts[0])&&rths.length===days.length&&rths.length?
      Math.max(...rths.map(r=>r.high))-Math.min(...rths.map(r=>r.low)):null,widest,
    closeOutside:{count:comparableClose.filter(d=>d.close!<d.ib!.low||d.close!>d.ib!.high).length,total:comparableClose.length}};
}
