// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,MarketContextItem} from './index';
import {eventObservationWindow} from './eventWindows';

/** Broader review labels do not change the forecast's existing event families. */
export function studyEventFamily(name:string){
 const text=name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(/^(?:core )?(?:cpi|consumer price index)\b/.test(text))return 'CPI';
 if(/^(?:core )?(?:ppi|producer price index)\b/.test(text))return 'PPI';
 if(/\b(?:fomc|federal open market committee)\b/.test(text))return 'FOMC';
 if(/^(?:nfp|jobs report|employment situation|nonfarm payrolls)\b/.test(text))return 'Jobs / NFP';
 if(/^(?:core )?(?:pce|personal income and outlays)\b/.test(text))return 'PCE';
 if(/^(?:gdp|gross domestic product)\b/.test(text))return 'GDP';
 return text;
}
export function sessionHasStudyEvent(session:JournalSession,family:string){
 return session.marketContextItems.some(item=>!item.holiday&&studyEventFamily(item.name)===family);
}
export function studyEventChoices(sessions:JournalSession[]){
 return [...new Set(sessions.flatMap(s=>s.marketContextItems.filter(i=>!i.holiday).map(i=>studyEventFamily(i.name))))].sort((a,b)=>a.localeCompare(b));
}
/** Sparse observations establish recorded extrema, not continuous event coverage. */
export function deriveEventWindowRange(session:JournalSession,item:MarketContextItem,asOf:string){
 const window=eventObservationWindow(item),cutoff=Date.parse(asOf);
 if(!window||!Number.isFinite(cutoff))return null;
 const start=Date.parse(window.startAt),end=Math.min(cutoff,window.endAt===null?Infinity:Date.parse(window.endAt));
 const points=session.cpObservations.filter(p=>(p.timePrecision===undefined||p.timePrecision==='exact')&&Number.isFinite(p.price)&&
  Date.parse(p.observedAt)>=start&&Date.parse(p.observedAt)<=end&&(!p.recordedAt||Date.parse(p.recordedAt)<=cutoff));
 const byInstant=new Map<string,typeof points[number][]>();
 for(const p of points){const key=String(Date.parse(p.observedAt)),prior=byInstant.get(key)??[];prior.push(p);byInstant.set(key,prior);}
 const observations=[...byInstant.values()].flatMap(group=>new Set(group.map(p=>p.price)).size===1?[group[0]]:[]).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const high=observations.length?Math.max(...observations.map(p=>p.price)):null,low=observations.length?Math.min(...observations.map(p=>p.price)):null;
 const notes=session.sessionNotes.filter(n=>(n.link?.kind==='event'&&n.link.targetId===item.id||n.link?.eventId===item.id)&&Date.parse(n.recordedAt)<=cutoff);
 return {window,state:cutoff<start?'upcoming' as const:window.endAt!==null&&cutoff>=Date.parse(window.endAt)?'ended' as const:'recording' as const,
  high,low,midpoint:high!==null&&low!==null?(high+low)/2:null,width:high!==null&&low!==null?high-low:null,count:observations.length,observations,notes};
}
