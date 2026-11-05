// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {carryRangeEdgesForward,type JournalSession} from '@ib-field-notes/domain';
import {workspaceRecordedRange,workspaceWindows,type WorkspacePhase} from './workspaceModel';

/** Read the selected period's existing observations. No snapshot, new journal or writes.
 * A contains 15R; full RTH contains the IB. Other periods do not borrow their paths. */
export function periodMapRead(session:JournalSession,phase:WorkspacePhase,now:string){
  const windows=workspaceWindows(session),window={...windows[phase]};
  if(phase==='A'||phase==='RTH')window.start=windows['15R'].start;
  const at=(t:string)=>Temporal.Instant.from(t).epochNanoseconds;
  const cutoff=at(now)<at(window.end)?now:window.end;
  const closingSource=phase==='15R'?'checkpoint-15m':phase==='A'?'checkpoint-a':phase==='B'?'checkpoint-b':null;
  const points=session.cpObservations.filter(p=>Number.isFinite(p.price)&&at(p.observedAt)>=at(window.start)&&
    (phase==='RTH'||p.source===closingSource?at(p.observedAt)<=at(window.end):at(p.observedAt)<at(window.end))&&at(p.observedAt)<=at(cutoff)&&
    (!p.recordedAt||at(p.recordedAt)<=at(now))).sort((a,b)=>Temporal.Instant.compare(a.observedAt,b.observedAt)||a.id.localeCompare(b.id));
  let range=workspaceRecordedRange(session,phase);
  // B's own saved checkpoint/snapshots may include carried bounds. Do not make
  // an entirely unrecorded B look populated solely because A has a range.
  if(phase==='B')range=carryRangeEdgesForward(session.bPeriod,...session.bSnapshots);
  if(at(now)<at(window.start))range={high:null,low:null};
  const ended=at(now)>=at(window.end);
  return {phase,window,cutoff,points,range,ended};
}
