// SPDX-License-Identifier: MPL-2.0
import type {JournalSession} from '@ib-field-notes/domain';
import {workspaceClock,workspacePhases,workspaceRecordedRange,workspaceWindows,type WorkspacePhase} from './workspaceModel';

/** Saved observations, clock closure and explicit range confirmation stay separate. */
export function workspacePeriodStatus(session:JournalSession,phase:WorkspacePhase,now:string){
  const window=workspaceWindows(session)[phase],range=workspaceRecordedRange(session,phase);
  const ended=Date.parse(now)>=Date.parse(window.end),complete=range.high!==null&&range.low!==null;
  const checkpoint=phase==='ON'?session.overnight:phase==='15R'?session.fifteenMinute:phase==='A'?session.aPeriod:phase==='B'?session.bPeriod:null;
  const rth=session.rthRangeHistory?.at(-1);
  const confirmedAt=checkpoint?.status==='confirmed'?checkpoint.confirmedAt:phase==='RTH'?
    session.close.finishedAt??(rth&&Date.parse(rth.observedAt??rth.recordedAt)>=Date.parse(window.end)&&rth.high===range.high&&rth.low===range.low?rth.recordedAt:null):null;
  return {range,ended,confirmed:ended&&complete&&!!confirmedAt,confirmedAt,saved:range.high!==null||range.low!==null};
}

export function workspaceEndedPeriods(session:JournalSession,from:string,to:string){
  const clock=workspaceClock(session,to);
  if(!clock.current||clock.unavailable)return [];
  return workspacePhases.filter(phase=>Date.parse(clock.windows[phase].end)>Date.parse(from)&&
    Date.parse(clock.windows[phase].end)<=Date.parse(to)&&!workspacePeriodStatus(session,phase,to).confirmed);
}
