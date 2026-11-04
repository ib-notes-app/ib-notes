// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {deriveRecordedRthRange,type JournalSession,type RangeCheckpoint,type SignificantLevel} from '@ib-field-notes/domain';
import {workspaceClock,workspaceDefaultPhase,workspacePhases,workspacePhaseNames,workspaceRecordedRange,workspaceWindows,type WorkspacePhase} from './workspaceModel';
import {buildTopicShareCard,type ImageShareSections} from './imageShareContent';
import type {DashboardShareInput,DashboardShareCard,ShareFactSection} from './dashboardShare';
import {workspaceFormatPrice} from './workspaceModel';

export const SESSION_SHARE_SCOPES=[['ON','ON'],['15R','15R'],['A','A'],['B','B'],['RTH','RTH'],['all','Full session']] as const;
export type SessionShareScope=typeof SESSION_SHARE_SCOPES[number][0];
export const defaultSessionShareScope=(s:JournalSession,now:string):SessionShareScope=>workspaceDefaultPhase(s,now);
const time=(at:string)=>Temporal.Instant.from(at).epochNanoseconds;
const emptyRange=(r:RangeCheckpoint):RangeCheckpoint=>({...r,high:null,low:null,cp:null,note:null,status:'pending',confirmedAt:null});

/** Read-only recorded-period projection. Corrections remain corrections; later phases never enter an earlier card. */
export function sessionShareProjection(source:JournalSession,scope:SessionShareScope,now:string){
 const windows=workspaceWindows(source),phase=scope==='all'?'RTH':scope,index=workspacePhases.indexOf(phase);
 const cutoff=Temporal.Instant.from(time(now)<time(windows[phase].end)?now:windows[phase].end).toString();
 const ended=time(now)>=time(windows[phase].end),pastPhase=ended&&phase!=='RTH';
 const visible=(at:string)=>time(at)<=time(cutoff);
 const priceVisible=(at:string)=>visible(at)&&(!pastPhase||time(at)<time(cutoff));
 const allowed=(p:WorkspacePhase)=>workspacePhases.indexOf(p)<=index;
 const closeVisible=allowed('RTH')&&!!source.close.observedAt&&visible(source.close.observedAt);
 const s:JournalSession={...source,
  fifteenMinute:allowed('15R')?source.fifteenMinute:emptyRange(source.fifteenMinute),
  fifteenMinuteHistory:allowed('15R')?source.fifteenMinuteHistory:[],
  aPeriod:allowed('A')?source.aPeriod:emptyRange(source.aPeriod),aPeriodHistory:allowed('A')?source.aPeriodHistory:[],
  bPeriod:allowed('B')?source.bPeriod:emptyRange(source.bPeriod),bPeriodHistory:allowed('B')?source.bPeriodHistory:[],
  bSnapshots:allowed('B')?source.bSnapshots.filter(r=>visible(r.observedAt)):[],
  cpObservations:source.cpObservations.filter(p=>priceVisible(p.observedAt)),
  rthObservations:allowed('RTH')?source.rthObservations.filter(p=>priceVisible(p.observedAt)):[],
  rthRangeHistory:allowed('RTH')?source.rthRangeHistory?.filter(p=>visible(p.observedAt??p.recordedAt)):[],
  preOpenSnapshots:source.preOpenSnapshots.filter(p=>visible(p.recordedAt)),
  sessionNotes:source.sessionNotes.filter(n=>priceVisible(n.observedAt)),
  marketContextItems:source.marketContextItems.filter(item=>item.holiday||visible(item.eventAt)),
  forecast:source.forecast&&visible(source.forecast.issuedAt)?source.forecast:null,
  forecastUpdates:source.forecastUpdates.filter(r=>visible(r.issuedAt)&&visible(r.asOf)),
  onForecastUpdates:(source.onForecastUpdates??[]).filter(r=>visible(r.recordedAt)&&visible(r.forecast.asOf)),
  close:closeVisible?source.close:{...source.close,price:null,rthHigh:null,rthLow:null,observedAt:null,recordedAt:null,finishedAt:null,pathComplete:false,note:null},
 };
 // The opening print belongs to the next phase; it must not appear on an ON card.
 if(scope==='ON')s.overnight={...s.overnight,rthOpen:null,rthOpenStatus:'pending'};
 const active=workspaceClock(source,cutoff),through=scope==='all'||scope==='RTH'?(active.phase??(active.closed?'RTH':'ON')):phase;
 return {session:s,cutoff,ended,through,title:scope==='all'?'Full session':workspacePhaseNames[phase]};
}
export function shareLevelAvailable(level:SignificantLevel,cutoff:string){
 return time(level.sessionEdge?.availableAt??level.createdAt)<=time(cutoff)&&(!level.originAt||time(level.originAt)<=time(cutoff));
}

/** Compose saved/live existing projections; scope changes never request or save a new forecast. */
export function buildSessionShareCard(scope:SessionShareScope,input:DashboardShareInput,selected:ImageShareSections):DashboardShareCard{
 const phase=scope==='all'?'RTH':scope,s=input.session;
 const card=buildTopicShareCard(phase==='ON'?'on':'ib',{...input,phase:scope==='all'?(workspaceClock(s,input.read.now).phase??'RTH'):phase},selected);
 const fmt=(n:number|null)=>n===null?'Not recorded':workspaceFormatPrice(n,s.market.tickSize);
 if(phase!=='ON'&&phase!=='RTH'&&selected.recap){
  const range=workspaceRecordedRange(s,phase);
  card.sections=card.sections.filter(section=>section.title!=='Initial Balance summary');
  card.sections.unshift({title:`${scope} recorded range`,rows:[{label:'Low / high',value:`${fmt(range.low)}–${fmt(range.high)}`},
   {label:'Width',value:range.high===null||range.low===null?'Not recorded':`${fmt(range.high-range.low)} pt`} ]});
  card.headline=`${scope} period`;card.caption='Recorded structure through this period';
 }
 card.title=scope==='all'?'Full session':phase==='RTH'?'Post-IB RTH':workspacePhaseNames[phase];
 if(!selected.recap&&!selected.forecast&&!selected.conditions){
  card.headline='Recorded structure';card.caption='Ranges and recorded prices';delete card.meter;
 }
 if(scope==='all'){
  if(selected.recap){
   const rows:ShareFactSection['rows']=workspacePhases.map(p=>{const r=p==='RTH'?deriveRecordedRthRange(s):workspaceRecordedRange(s,p);
    return {label:p==='RTH'?'Full RTH (including IB)':p,value:r.high===null||r.low===null?'Not recorded':`${fmt(r.low)}–${fmt(r.high)} · ${fmt(r.high-r.low)} pt`};});
   card.sections=card.sections.filter(section=>section.title!=='Initial Balance summary');card.sections.unshift({title:'Session ranges',rows});
  }
  card.headline=time(input.read.now)<time(workspaceWindows(s).RTH.end)?'Session so far':'Full session recap';
 }
 const clockLabel=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:s.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
 card.caption=[card.caption,input.showTimes===false?'':`Recorded through ${clockLabel(input.read.now)}`].filter(Boolean).join(' · ');
 return card;
}
