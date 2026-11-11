// SPDX-License-Identifier: MPL-2.0
import {withOvernightUpdate,withFifteenMinuteRange,withAPeriodUpdate,withBPeriodUpdate,type JournalSession} from '@ib-field-notes/domain';
import {workspaceClock,workspacePhases,workspaceRecordedRange,workspaceWindows,workspacePrice,type WorkspacePhase} from './workspaceModel';

/** Saved observations, clock closure and explicit range confirmation stay separate. */
export function workspacePeriodStatus(session:JournalSession,phase:WorkspacePhase,now:string){
  const window=workspaceWindows(session)[phase],range=workspaceRecordedRange(session,phase);
  const ended=Date.parse(now)>=Date.parse(window.end),complete=range.high!==null&&range.low!==null&&Number.isFinite(range.high)&&Number.isFinite(range.low)&&range.high>=range.low;
  const checkpoint=phase==='ON'?session.overnight:phase==='15R'?session.fifteenMinute:phase==='A'?session.aPeriod:phase==='B'?session.bPeriod:null;
  const rth=session.rthRangeHistory?.at(-1);
  const confirmedAt=checkpoint?.status==='confirmed'?checkpoint.confirmedAt:phase==='RTH'?
    session.close.finishedAt??(rth&&Date.parse(rth.observedAt??rth.recordedAt)>=Date.parse(window.end)&&rth.high===range.high&&rth.low===range.low?rth.recordedAt:null):null;
  return {range,ended,confirmed:ended&&complete&&!!confirmedAt,confirmedAt,saved:range.high!==null||range.low!==null};
}

/** A carried earlier range alone is not evidence that A or B was recorded. */
export function workspaceAutoCloseRange(session:JournalSession,phase:WorkspacePhase,now:string){
  if(phase==='RTH'||session.studyReplay||workspaceClock(session,now).unavailable)return null;
  const status=workspacePeriodStatus(session,phase,now),window=workspaceWindows(session)[phase];
  if(!status.ended||status.confirmed)return null;
  const checkpoint=phase==='15R'?session.fifteenMinute:phase==='A'?session.aPeriod:phase==='B'?session.bPeriod:null;
  if(checkpoint&&checkpoint.high===null&&checkpoint.low===null&&!(phase==='B'&&session.bSnapshots.some(r=>r.high!==null||r.low!==null)))return null;
  const {high,low}=status.range;if(high===null||low===null||!Number.isFinite(high)||!Number.isFinite(low)||high<low)return null;
  try{workspacePrice(String(high),session.market.tickSize);workspacePrice(String(low),session.market.tickSize);}catch{return null;}
  const start=phase==='A'?workspaceWindows(session)['15R'].start:window.start;
  if(session.cpObservations.some(p=>Date.parse(p.observedAt)>=Date.parse(start)&&Date.parse(p.observedAt)<Date.parse(window.end)&&(p.price>high||p.price<low)))return null;
  return {high,low};
}

/** Idempotent close of recorded ON/formation ranges. No CP, final close or coverage is invented. */
export function workspaceAutoClosePeriods(session:JournalSession,now:string){
  if(session.close.finishedAt)return session;
  let next=session;
  for(const phase of ['ON','15R','A','B'] as const){
    const range=workspaceAutoCloseRange(next,phase,now);if(!range)continue;
    if(phase==='ON')next=withOvernightUpdate(next,{...range,rthOpen:next.overnight.rthOpen,confirm:true},now);
    else{
      const key=phase==='15R'?'fifteenMinute':phase==='A'?'aPeriod':'bPeriod',save=phase==='15R'?withFifteenMinuteRange:phase==='A'?withAPeriodUpdate:withBPeriodUpdate;
      next=save(next,{...range,cp:null,note:next[key].note},workspaceWindows(next)[phase].end,now,true,true);
    }
  }
  return next;
}

export function workspaceEndedPeriods(session:JournalSession,from:string,to:string){
  const clock=workspaceClock(session,to);
  if(!clock.current||clock.unavailable)return [];
  return workspacePhases.filter(phase=>Date.parse(clock.windows[phase].end)>Date.parse(from)&&
    Date.parse(clock.windows[phase].end)<=Date.parse(to)&&!workspacePeriodStatus(session,phase,to).confirmed&&!workspaceAutoCloseRange(session,phase,to));
}
