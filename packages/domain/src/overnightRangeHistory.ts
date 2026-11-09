// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import type {JournalSession,PreOpenSnapshot} from './index';
import {projectRangeEdgeHistory} from './rangeEdgeHistory';

/** Only journals with explicit backfilled edge inputs use this projection.
 * Old snapshots retain their behavior; original supplied bounds are retained
 * as rangeInputs when their cumulative display needs rebuilding. */
export function reconcileOvernightRangeHistory(session:JournalSession):JournalSession{
 if(!session.preOpenSnapshots.some(r=>r.edgeInput))return session;
 const open=Temporal.PlainDate.from(session.rthDate).toZonedDateTime({timeZone:session.market.canonicalTimeZone,
  plainTime:session.market.checkpoints.overnightLock}).epochMilliseconds;
 const byId=new Map(session.cpObservations.map(p=>[p.id,p]));
 const snapshots=[...session.preOpenSnapshots].sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt));
 const prices=session.cpObservations.filter(p=>Date.parse(p.observedAt)<open).map(p=>({at:p.observedAt,price:p.price}));
 const result=projectRangeEdgeHistory(snapshots.map(r=>({
  ...(r.rangeInputs??{high:r.formingOvernightHigh,low:r.formingOvernightLow}),at:r.recordedAt,savedAt:r.enteredAt??r.recordedAt,
  edgeInput:r.edgeInput,derived:!!r.cpObservationId&&byId.get(r.cpObservationId)?.source==='standalone',
 })),prices);
 const rebuilt:PreOpenSnapshot[]=snapshots.map((r,i)=>({...r,
  rangeInputs:r.rangeInputs??{high:r.formingOvernightHigh,low:r.formingOvernightLow},
  formingOvernightHigh:result.steps[i]!.high,formingOvernightLow:result.steps[i]!.low}));
 const last=rebuilt.at(-1),latest=prices.filter(p=>!last||Date.parse(p.at)>Date.parse(last.recordedAt))
  .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).at(-1);
 if(latest&&(!last||last.formingOvernightHigh!==result.current.high||last.formingOvernightLow!==result.current.low)){
  const cp=session.cpObservations.find(p=>p.observedAt===latest.at&&p.price===latest.price)!;
  rebuilt.push({id:`preopen:range:${cp.id}`,recordedAt:cp.observedAt,enteredAt:cp.recordedAt??cp.observedAt,
   formingOvernightHigh:result.current.high,formingOvernightLow:result.current.low,rangeInputs:{high:null,low:null},cpObservationId:cp.id,note:null});
 }
 return {...session,preOpenSnapshots:rebuilt};
}
