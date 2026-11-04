// SPDX-License-Identifier: MPL-2.0
import {formatPriceNumber,newsResultForItem,newsResultSourceLabel,NEWS_RESULT_NAMES,resolveEventPriceMove,deriveEventWindowRange,type JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {ShareFactSection} from './dashboardShare';

/** Explicit News & events selection includes structured results, never event notes. */
export function buildShareNewsSections(session:JournalSession,asOf:string,showTimes=true):ShareFactSection[]{
  const clock=createSessionClock(session.market),check=session.market.checkpoints;
  const windows=new Map([[session.id,{start:clock.overnightStart(session.rthDate).toString(),ibLockAt:clock.checkpointInstant(session.rthDate,check.ibLock).toString(),close:clock.checkpointInstant(session.rthDate,check.studyClose).toString()}]]);
  const precise=(value:number)=>value.toLocaleString('en-US',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:8});
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  return [...session.marketContextItems].sort((a,b)=>Date.parse(a.eventAt)-Date.parse(b.eventAt)).map(item=>{
    if(item.holiday)return {title:item.name,rows:[{label:'Event',value:'All day'}]};
    const r=newsResultForItem(item,asOf),move=resolveEventPriceMove(session,item,asOf,windows),range=deriveEventWindowRange(session,item,asOf);
    const showRange=range&&(range.window.explicit||range.count>0);
    const period=r?.period?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(`${r.period}-15T12:00:00Z`)):null;
    const source=r?newsResultSourceLabel(r):null;
    return {title:`${item.name}${r&&NEWS_RESULT_NAMES[r.family]?` · ${NEWS_RESULT_NAMES[r.family]}`:''}`,footnote:showRange?'Recorded observations; gaps may exist. Check your sources.':'Check your sources.',rows:[
      ...(showRange?[...(showTimes?[{label:'Tracking window',value:`${time(range.window.startAt)}–${range.window.endAt?time(range.window.endAt):'Until ended'}`}]:[]),
        {label:'Recorded high / low',value:range.high===null?'No timed prices yet':`${precise(range.high)} / ${precise(range.low!)}`},
        ...(range.midpoint!==null?[{label:'Midpoint · Width',value:`${precise(range.midpoint)} · ${precise(range.width!)} pt`}]:[]),
        {label:'Recorded prices',value:String(range.count)}]:[]),
      ...(r?[{label:`${r.measure}${period?` · ${period}`:''}`,value:r.actual,tone:'blue' as const},
        ...(r.previous?[{label:r.measure==='Monthly change'?'Previous month':'Previous result',value:r.previous}]:[]),
        ...(r.expected?[{label:'Expected',value:r.expected}]:[]),
        ...(source?[{label:'Source',value:`${source}${showTimes&&r.publishedAt?` · ${time(r.publishedAt)}`:''}`}]:[]),
      ]:[{label:Date.parse(item.eventAt)>Date.parse(asOf)?'Scheduled release':'Result not added',value:showTimes?time(item.eventAt):'No released figure saved'}]),
      ...(move?[{label:`Recorded move${showTimes?` · ${time(move.start.observedAt)}–${time(move.end.observedAt)}`:''}`,
        value:`${formatPriceNumber(move.start.price)} → ${formatPriceNumber(move.end.price)} (${move.end.price-move.start.price>0?'+':''}${Number((move.end.price-move.start.price).toFixed(8))} pt)`}]:[]),
    ]};
  });
}
