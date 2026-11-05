// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {compareOnOpening,onBandNames,deriveRecordedRthRange,deriveSessionIbRead,type JournalSession,type RangeCheckpoint,type SignificantLevel} from '@ib-field-notes/domain';
import {workspaceClock,workspaceDefaultPhase,workspacePhases,workspacePhaseNames,workspaceRecordedRange,workspaceWindows,type WorkspacePhase} from './workspaceModel';
import {buildTopicShareCard,type ImageShareSections} from './imageShareContent';
import type {DashboardShareInput,DashboardShareCard,ShareFactSection} from './dashboardShare';
import {workspaceFormatPrice} from './workspaceModel';
import {sessionImageFacts} from './sessionImageFacts';
import {imageForecastRecap} from './imageForecastRecap';
import {onForecastStory,rangeStory,recordedOnRange} from './forecastStory';

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
export function buildSessionShareCard(scope:SessionShareScope,input:DashboardShareInput,selected:ImageShareSections,options:{includeCurrentOrClose?:boolean;actualSession?:JournalSession;sharedAt?:string}={}):DashboardShareCard{
 const phase=scope==='all'?'RTH':scope,s=input.session;
 const windows=workspaceWindows(s),closed=phase==='RTH'&&time(input.read.now)>=time(windows.RTH.end);
 if(closed){
  // A recorded recap uses the saved corrections available when sharing. The
  // observation window still ends at close; saved forecasts keep their cutoff.
  const knownAt=time(s.updatedAt)>time(input.read.now)?s.updatedAt:input.read.now;
  input={...input,read:{...input.read,current:deriveSessionIbRead(s,{now:knownAt,openAt:windows.ON.end,ibLockAt:windows.B.end,closeAt:windows.RTH.end},{provisional:true})}};
 }
 const viewedPhase=scope==='all'?(workspaceClock(s,input.read.now).phase??'RTH'):phase;
 const card=buildTopicShareCard(viewedPhase==='ON'?'on':'ib',{...input,phase:viewedPhase},selected);
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
   const totals=card.sections.flatMap(section=>section.rows.filter(row=>row.counters));
   card.sections=card.sections.filter(section=>section.title!=='Initial Balance summary');card.sections.unshift({title:'Session ranges',rows:[...rows,...totals]});
  }
  card.headline=time(input.read.now)<time(workspaceWindows(s).RTH.end)?'Session so far':'Full session recap';
 }
 const clockLabel=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:s.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
 card.caption=[s.close.finishedAt?'Day confirmed':'',input.showTimes===false?'':`Through ${clockLabel(input.read.now)}`].filter(Boolean).join(' · ');
 card.stage=scope;
 // Give the image one prominent estimate. Its supporting facts remain selected
 // sections, while routine empty/pending recap rows do not fill the card.
 card.sections=card.sections.map(section=>{
  if(section.title==='Initial Balance summary'||section.title==='Overnight record'||section.title.endsWith('recorded range'))
   return {...section,layout:'metrics' as const,rows:section.rows.filter(row=>
    !(row.label==='Close'&&row.value==='Day still open')&&
    !(row.label==='Regular-session opening price'&&row.value==='Not recorded')&&
    !(row.label==='Observed mostly'&&row.value==='Across bands / not enough entries'))};
  return section;
 });
 const counts=card.sections.some(section=>section.rows.some(row=>row.counters));
 card.sections=card.sections.map(section=>{
  if(section.title==='Today in context')return {...section,layout:'context' as const};
  if(section.title==='Recorded position')return {...section,layout:'metrics' as const};
  if(counts&&section.title==='RTH outlook')return {...section,rows:section.rows.filter(row=>row.label!=='Recorded so far'&&row.label!=='Returns inside IB')};
  return section;
 });
 const context=card.sections.find(section=>section.title==='Today in context');
 if(context&&selected.recap){
  const merged=new Set<string>();
  for(const section of card.sections.filter(section=>section.layout==='metrics'))for(const row of section.rows){
   const duplicate=context.rows.find(item=>(item.label==='Recorded ON range'||item.label==='Recorded IB range'||item.label==='IB range so far')&&item.value.split(' · ')[0]===row.value);
   if(duplicate){row.value=duplicate.value;merged.add(duplicate.label);}
  }
  context.rows=context.rows.filter(row=>!merged.has(row.label));
 }
 card.imageFacts=sessionImageFacts(scope,input,selected);
 // Completed range facts and ordinary historical comparisons belong to Recap,
 // independently of whether the user also includes a forecast.
 card.sections=card.sections.filter(section=>section.title!=='Today in context');
 if(selected.recap){
  const context=rangeStory(s,phase==='ON'?null:input.read.current,recordedOnRange(s,input.read.now),input.read.comparisons);
  card.sections.push({title:'Today in context',layout:'context',rows:context.rows.filter(row=>!row.label.includes('IBs at least')).map(({detail,...row})=>{
   const comparison=input.read.comparisons?.find(c=>row.label===`${c.range} · ${c.source==='JOURNAL'?'your journal':'learning history'}`);
   return {...row,...(comparison?{comparison:{percent:Math.floor(100*(comparison.strict?.narrower??comparison.narrower)/comparison.days),days:comparison.days,range:comparison.range}}:{})};
  })});
 }
 const actual=options.actualSession;
 const resultSession=actual&&actual.id===s.id&&actual.journalId===s.journalId&&actual.rthDate===s.rthDate&&actual.instrument===s.instrument&&actual.contract===s.contract?actual:null;
 const sharedAt=options.sharedAt??input.read.now;
 if(selected.forecast&&phase==='ON'&&resultSession&&time(sharedAt)>=time(windows.ON.end)){
  const f=onForecastStory({session:s,now:input.read.now,...input.overnight,showTimes:input.showTimes}).forecast;
  const result=f?compareOnOpening(resultSession,f):null;
  if(result)card.imageFacts={...card.imageFacts,forecastResult:`RTH opened ${fmt(result.price)} · ${onBandNames[result.band]} of the fixed ON range`};
 }
 if(selected.forecast&&(closed||phase!=='ON'&&resultSession&&time(sharedAt)>=time(windows.RTH.end))){
  // Retrospective results may use the completed day. The estimate and all
  // other modules retain the selected period's original observation cutoff.
  const resultInput=resultSession?{...input,session:{...resultSession,displayTimeZone:s.displayTimeZone,forecast:s.forecast,forecastUpdates:s.forecastUpdates}}:input;
  const recap=imageForecastRecap(resultInput);
  card.sections=card.sections.filter(section=>!['RTH outlook','Forecast details','Forecast vs result'].includes(section.title)&&!section.title.startsWith('IB edges broken'));
  const inPanel=(section:ShareFactSection)=>['IB width · forecast vs recorded','Return forecast vs record'].includes(section.title);
  const support=recap.sections.filter(inPanel).flatMap(section=>section.rows);
  card.sections.push(...recap.sections.filter(section=>!inPanel(section)));card.focus=recap.focus;card.comparisonUnavailable=recap.unavailable;
  // Keep snapshot counts with their original time, and the closing result
  // separately identified inside the same forecast panel.
  card.imageFacts={...card.imageFacts,forecastTiming:undefined,forecastResult:recap.result,
   forecastGraphic:card.imageFacts.forecastGraphic||support.length?{...card.imageFacts.forecastGraphic,support}:undefined};
 }
 return card;
}
