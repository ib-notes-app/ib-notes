// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {createSessionClock} from '@ib-field-notes/session-templates';
import {formatPriceNumber,roundPriceToTick,deriveRecordedRthRange,carryRangeEdgesForward,latestPreOpenSnapshot,withStandaloneCpObservation,withRthObservation,
  withFifteenMinuteRange,withAPeriodUpdate,withBPeriodUpdate,withPreOpenUpdate,withOvernightUpdate,withRthRangeCorrection,
  withRemovedStandaloneCpObservation,withRemovedRthObservation,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {groupNearbyAreas} from './levelAreas';
import {nearbyLevelScope} from './nearbyZoneRead';

export const workspacePhases=['ON','15R','A','B','RTH'] as const;
export type WorkspacePhase=typeof workspacePhases[number];
export const workspacePhaseNames:Record<WorkspacePhase,string>={ON:'Overnight','15R':'First 15 minutes',A:'A period',B:'B period',RTH:'Post-IB RTH'};
export function workspaceStudyDate(session:JournalSession,sessions:JournalSession[],date:string){
 if(!createSessionClock(session.market).isPotentialRthDate(date))return false;
 return ![...sessions,session].some(day=>day.journalId===session.journalId&&day.rthDate===date&&
  (day.calendarStatus==='CLOSED'||day.marketContextItems.some(item=>item.eventDate===date&&item.holiday?.session==='closed')));
}
export function workspaceAdjacentDate(session:JournalSession,sessions:JournalSession[],direction:-1|1){
 const clock=createSessionClock(session.market);let date=session.rthDate;
 do{date=direction<0?clock.previousPotentialRthDate(date):clock.nextPotentialRthDate(date);}while(!workspaceStudyDate(session,sessions,date));
 return date;
}
export function workspaceCurrentDate(session:JournalSession,sessions:JournalSession[],now:string){
 const clock=createSessionClock(session.market);let date=clock.resolveLaunchRthDate(Temporal.Instant.from(now));
 while(!workspaceStudyDate(session,sessions,date))date=clock.previousPotentialRthDate(date);
 return date;
}
const ms=(at:string)=>Temporal.Instant.from(at).epochMilliseconds;
export function workspaceWindows(session:JournalSession){
  const clock=createSessionClock(session.market),c=session.market.checkpoints;
  const at=(time:string)=>clock.checkpointInstant(session.rthDate,time).toString();
  const open=at(c.overnightLock),fifteen=at(c.fifteenMinuteLock),a=at(c.aLock),ib=at(c.ibLock);
  const early=session.marketContextItems.flatMap(item=>item.holiday?.session==='early_close'&&item.holiday.closeAt?[item.holiday.closeAt]:[])
    .filter(t=>ms(t)>ms(open));
  const close=[at(c.studyClose),...early].sort((x,y)=>ms(x)-ms(y))[0]!;
  return {ON:{start:clock.overnightStart(session.rthDate).toString(),end:open},'15R':{start:open,end:fifteen},
    A:{start:fifteen,end:a},B:{start:a,end:ib},RTH:{start:ib,end:close}};
}
export function workspaceClock(session:JournalSession,now:string){
  const clock=createSessionClock(session.market),windows=workspaceWindows(session),t=ms(now);
  const unavailable=session.calendarStatus==='CLOSED'||!clock.isPotentialRthDate(session.rthDate)||session.marketContextItems.some(item=>item.eventDate===session.rthDate&&item.holiday?.session==='closed');
  const phase=workspacePhases.find(p=>t>=ms(windows[p].start)&&t<ms(windows[p].end))??null;
  const historical=session.rthDate<clock.resolveLaunchRthDate(Temporal.Instant.from(now));
  const closed=!!session.close.finishedAt||t>=ms(windows.RTH.end)||unavailable;
  const current=!historical&&session.rthDate===clock.resolveLaunchRthDate(Temporal.Instant.from(now));
  return {phase:unavailable?null:phase,closed,current,historical,upcoming:t<ms(windows.ON.start),unavailable,windows};
}
export function workspaceDefaultPhase(session:JournalSession,now:string):WorkspacePhase{
  const clock=workspaceClock(session,now);return clock.closed||clock.historical?'RTH':clock.phase??'ON';
}
export function workspaceCp(session:JournalSession,_phase:WorkspacePhase,now:string){
  const w=workspaceWindows(session),end=ms(w.RTH.end),start=ms(w.ON.start);
  return session.cpObservations.filter(cp=>ms(cp.observedAt)>=start&&ms(cp.observedAt)<=ms(now)&&ms(cp.observedAt)<=end&&
    (!cp.recordedAt||ms(cp.recordedAt)<=ms(now))).sort((a,b)=>ms(a.observedAt)-ms(b.observedAt)||a.id.localeCompare(b.id)).at(-1)??null;
}
export type WorkspaceEntry={sessionId:string;journalId:string;rthDate:string;instrument:string;phase:WorkspacePhase;observedAt:string;kind:'CP'|'High'|'Low';price:string;editFinalized?:boolean};
export function workspaceEntryTarget(session:JournalSession,phase:WorkspacePhase,now:string):WorkspaceEntry{
  const w=workspaceWindows(session)[phase],t=Math.max(ms(w.start),Math.min(ms(now),ms(w.end)-1000));
  return {sessionId:session.id,journalId:session.journalId,rthDate:session.rthDate,instrument:session.instrument,phase,
    observedAt:Temporal.Instant.fromEpochMilliseconds(t).toString(),kind:'CP',price:''};
}
export function workspaceFormatPrice(value:number,tick:number){
  const [mantissa,exponent='0']=String(tick).toLowerCase().split('e');
  const places=Math.max(2,(mantissa!.split('.')[1]?.length??0)-Number(exponent));
  return formatPriceNumber(value,places);
}
export function workspacePrice(text:string,tick:number){
  if(!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim()))throw Error('Enter a valid price without commas or other characters.');
  const value=Number(text);if(!Number.isFinite(value))throw Error('Enter a finite price.');
  if(Math.abs(roundPriceToTick(value,tick)-value)>Math.max(1e-10,tick*1e-7))throw Error(`Use ${workspaceFormatPrice(tick,tick)} price increments. This price is between ticks.`);
  return value;
}
function rangeFor(session:JournalSession,phase:WorkspacePhase){
  return phase==='15R'?session.fifteenMinute:phase==='A'?session.aPeriod:session.bPeriod;
}
/** Existing period projections only; prefilling an input never records an observation. */
export function workspaceRecordedRange(session:JournalSession,phase:WorkspacePhase):{high:number|null;low:number|null}{
  if(phase==='ON'){
    const forming=latestPreOpenSnapshot(session);
    return {high:session.overnight.high??forming?.formingOvernightHigh??null,low:session.overnight.low??forming?.formingOvernightLow??null};
  }
  if(phase==='15R')return session.fifteenMinute;
  const a=carryRangeEdgesForward(session.aPeriod,session.fifteenMinute);
  if(phase==='A')return a;
  if(phase==='B')return carryRangeEdgesForward(session.bPeriod,session.fifteenMinute,a,...session.bSnapshots);
  return deriveRecordedRthRange(session);
}
/** Existing journal commands, with strict input validation at the preview boundary.
 * High/Low are range-as-of edits, never timestamped CP or exact extreme occurrences. */
export function applyWorkspaceEntry(session:JournalSession,entry:WorkspaceEntry,now:string):JournalSession{
  if(entry.sessionId!==session.id||entry.journalId!==session.journalId||entry.rthDate!==session.rthDate||entry.instrument!==session.instrument)
    throw Error('The selected journal changed. Close this sheet and open it again.');
  if(session.close.finishedAt){
    if(!entry.editFinalized)throw Error('This day is finished. Use Review / Edit entries.');
    session={...session,close:{...session.close,finishedAt:null,pathComplete:false}};
  }
  const state=workspaceClock(session,now),w=state.windows[entry.phase],t=ms(entry.observedAt);
  if(state.unavailable)throw Error('This date is marked closed. Use Context or Review to correct the session calendar.');
  // A range can be known by its closing boundary, as in the existing period
  // editor. A CP at that instant belongs to the following phase instead.
  if(t<ms(w.start)||t>ms(w.end)||(entry.kind==='CP'&&t===ms(w.end)))throw Error('This time is outside the selected phase. Change the phase or observation time.');
  if(t>ms(now))throw Error('An observation cannot be in the future.');
  const price=workspacePrice(entry.price,session.market.tickSize);
  if(entry.kind==='CP'){
    if(session.cpObservations.some(cp=>ms(cp.observedAt)===t&&cp.price===price))throw Error('This price and time are already recorded. Review that entry instead.');
    const lock=state.windows.RTH.start;
    let next=t>=ms(lock)+1000?withRthObservation(session,{price,note:null},entry.observedAt,now,lock,state.windows.RTH.end):
      withStandaloneCpObservation(session,price,entry.observedAt,now,state.windows.ON.end);
    if(entry.phase==='ON'&&!session.preOpenSnapshots.length&&session.overnight.status!=='confirmed'){
      next=withPreOpenUpdate(next,{contractStatus:session.contractStatus,contract:session.contract,
        formingOvernightHigh:price,formingOvernightLow:price,cp:null,note:null},entry.observedAt,now,true);
      next={...next,preOpenSnapshots:next.preOpenSnapshots.map((snapshot,i)=>i===next.preOpenSnapshots.length-1
        ?{...snapshot,cpObservationId:next.cpObservations.at(-1)!.id}:snapshot)};
    }
    return next;
  }
  const high=entry.kind==='High';
  const known=session.cpObservations.filter(cp=>ms(cp.observedAt)>=ms(entry.phase==='A'?state.windows['15R'].start:w.start)&&ms(cp.observedAt)<ms(w.end));
  if(high&&known.some(cp=>cp.price>price)||!high&&known.some(cp=>cp.price<price))throw Error('The range must include recorded CPs. Use Day timeline to correct a mistaken observation.');
  if(entry.phase==='ON'){
    if(session.overnight.status==='confirmed')return withOvernightUpdate(session,{high:high?price:session.overnight.high,
      low:high?session.overnight.low:price,rthOpen:session.overnight.rthOpen,confirm:true},now);
    const existing=session.preOpenSnapshots.at(-1);
    if(existing&&ms(existing.recordedAt)>t)throw Error('A later ON range is already recorded. Use that range-as-of time or edit the period.');
    return withPreOpenUpdate(session,{contractStatus:session.contractStatus,contract:session.contract,
      formingOvernightHigh:high?price:existing?.formingOvernightHigh??null,formingOvernightLow:high?existing?.formingOvernightLow??null:price,
      cp:null,note:null},entry.observedAt,now,true);
  }
  if(entry.phase==='RTH'){
    const range=deriveRecordedRthRange(session),h=high?price:range.high,l=high?range.low:price;
    if(h===null||l===null)throw Error('The other RTH edge is not yet known. Record a CP or use Edit period to enter the range.');
    return withRthRangeCorrection(session,h,l,now,entry.observedAt,high?'high':'low');
  }
  const keys={ '15R':'fifteenMinuteHistory',A:'aPeriodHistory',B:'bPeriodHistory'} as const;
  const history=session[keys[entry.phase]],latest=history.map(r=>r.observedAt??r.recordedAt).sort((a,b)=>ms(a)-ms(b)).at(-1);
  if(latest&&ms(latest)>t)throw Error('This range contains later observations. Use a later range-as-of time or edit the period.');
  const prior=rangeFor(session,entry.phase),update={high:high?price:prior.high,low:high?prior.low:price,cp:null,note:prior.note};
  if(update.high!==null&&update.low!==null&&update.high<update.low)throw Error('High must be at or above Low. Use Edit period for a range correction.');
  const save=entry.phase==='15R'?withFifteenMinuteRange:entry.phase==='A'?withAPeriodUpdate:withBPeriodUpdate;
  return save(session,update,entry.observedAt,now,prior.status==='confirmed',true);
}
export function workspaceEvidenceKey(session:JournalSession){
  const {forecast,forecastUpdates,onForecastUpdates,forecastCoverage,updatedAt,...evidence}=session;return JSON.stringify(evidence);
}
export function undoWorkspaceEntry(before:JournalSession,after:JournalSession,current:JournalSession,now:string){
  if(workspaceEvidenceKey(after)!==workspaceEvidenceKey(current))throw Error('New entries were saved. Use Day timeline to edit the earlier observation.');
  const cp=after.cpObservations.find(p=>!before.cpObservations.some(old=>old.id===p.id));
  if(cp){const rth=after.rthObservations.find(row=>row.cpObservationId===cp.id);
    return rth?withRemovedRthObservation(current,rth.id,now):withRemovedStandaloneCpObservation(current,cp.id,now);}
  // Restore the previous range projection and retain the withdrawn revision in
  // a counter-revision. No invented price point or new persistence format.
  const next={...current,updatedAt:now};
  for(const [key,history] of [['fifteenMinute','fifteenMinuteHistory'],['aPeriod','aPeriodHistory'],['bPeriod','bPeriodHistory']] as const){
    if(JSON.stringify(before[key])!==JSON.stringify(after[key])){next[key]=before[key];next[history]=[...current[history],{...before[key],recordedAt:now,observedAt:now}];}
  }
  if(before.preOpenSnapshots.length!==after.preOpenSnapshots.length)next.preOpenSnapshots=before.preOpenSnapshots;
  if(before.overnightHistory.length!==after.overnightHistory.length){next.overnight=before.overnight;next.overnightHistory=[...current.overnightHistory,{...before.overnight,recordedAt:now}];}
  if(before.rthRangeHistory?.length!==after.rthRangeHistory?.length){const prior=deriveRecordedRthRange(before);
    if(prior.high!==null&&prior.low!==null)next.rthRangeHistory=[...current.rthRangeHistory??[],{high:prior.high,low:prior.low,recordedAt:now}];}
  return next;
}

export function workspaceLevels(levels:SignificantLevel[],sessions:JournalSession[],session:JournalSession,cp:number,cutoff:string){
  const days=new Map([...sessions,session].map(day=>[day.id,day]));
  const eligible=levels.filter(l=>l.currentStatus==='active'&&(!l.sessionEdge||ms(l.sessionEdge.availableAt)<=ms(cutoff))&&
    (!l.originAt||ms(l.originAt)<=ms(cutoff)));
  // Session edges combine only at identical prices. A nearby but distinct IB/ON
  // edge must never disappear into a broad whole-number zone.
  const areas=groupNearbyAreas(eligible,l=>({id:l.id,low:l.price??l.zoneLow!,high:l.price??l.zoneHigh!,shape:l.shape,
    type:l.sessionEdge?'edge':l.studyReplay?.kind==='BREAKOUT_BACKTEST'?'backtest':l.levelType,
    scope:nearbyLevelScope(l,days,Number(session.rthDate.slice(0,4)))}));
  const edgeGroups=new Map<string,typeof areas[number]>();
  const combined=areas.filter(area=>{
    const level=area.members[0]!;if(!level.sessionEdge)return true;
    const key=JSON.stringify([nearbyLevelScope(level,days,Number(session.rthDate.slice(0,4))),area.low]);
    const prior=edgeGroups.get(key);if(prior){prior.members.push(...area.members);return false;}edgeGroups.set(key,area);return true;
  });
  const rows=combined.map(area=>{
    const codes=[...new Set(area.members.flatMap(l=>l.sessionEdge?[l.sessionEdge.code]:[]))];
    const low=area.low,high=area.high,inside=cp>=low&&cp<=high;
    return {...area,title:codes.length?codes.join(' / '):area.grouped?area.title:area.members[0]?.label??workspaceFormatPrice(area.low,session.market.tickSize),
      side:inside?'at':low>cp?'above':'below',distance:inside?0:low>cp?low-cp:cp-high};
  });
  const sort=(a:typeof rows[number],b:typeof rows[number])=>a.distance-b.distance||a.id.localeCompare(b.id);
  return {above:rows.filter(r=>r.side==='above').sort(sort).slice(0,2).reverse(),
    below:rows.filter(r=>r.side==='below').sort(sort).slice(0,2),at:rows.filter(r=>r.side==='at').sort(sort).slice(0,1)};
}
