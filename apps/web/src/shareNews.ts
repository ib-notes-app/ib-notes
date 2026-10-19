// SPDX-License-Identifier: MPL-2.0
import {formatPriceNumber,newsResultForItem,newsResultSourceLabel,NEWS_RESULT_NAMES,resolveEventPriceMove,type JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {ShareFactSection} from './dashboardShare';

/** Explicit News & events selection includes structured results, never event notes. */
export function buildShareNewsSections(session:JournalSession,asOf:string,showTimes=true):ShareFactSection[]{
  const clock=createSessionClock(session.market),check=session.market.checkpoints;
  const windows=new Map([[session.id,{start:clock.overnightStart(session.rthDate).toString(),ibLockAt:clock.checkpointInstant(session.rthDate,check.ibLock).toString(),close:clock.checkpointInstant(session.rthDate,check.studyClose).toString()}]]);
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  return [...session.marketContextItems].sort((a,b)=>Date.parse(a.eventAt)-Date.parse(b.eventAt)).map(item=>{
    if(item.holiday)return {title:item.name,rows:[{label:'Event',value:'All day'}]};
    const r=newsResultForItem(item,asOf),move=resolveEventPriceMove(session,item,asOf,windows);
    const period=r?.period?new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(`${r.period}-15T12:00:00Z`)):null;
    const source=r?newsResultSourceLabel(r):null;
    return {title:`${item.name}${r&&NEWS_RESULT_NAMES[r.family]?` · ${NEWS_RESULT_NAMES[r.family]}`:''}`,footnote:'Check your sources.',rows:[
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
