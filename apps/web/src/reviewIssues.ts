// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {dayReviewRanges,deriveSessionMissingFields,type JournalSession,type SessionMissingField} from '@ib-field-notes/domain';
import {workspaceClock,type WorkspacePhase} from './workspaceModel';
import {reviewTimelinePrices,type SessionTimelineItem} from './dayTimelineModel';
import {workspacePeriodStatus} from './workspacePeriodStatus';

export type ReviewOrigin='week'|'month'|'year';
export type ReviewRepair={sessionId:string;target:'day'|WorkspacePhase;focus?:'high'|'low'|'open';origin:ReviewOrigin};
const fields:ReadonlyArray<readonly[WorkspacePhase,SessionMissingField]>=[['ON','OVERNIGHT_RANGE'],['15R','FIFTEEN_MINUTE_RANGE'],['A','A_PERIOD'],['B','B_PERIOD'],['RTH','RTH_RANGE']];
export function reviewIssues(session:JournalSession,now:string){
 const clock=workspaceClock(session,now),ranges=dayReviewRanges(session),missingFields=deriveSessionMissingFields(session);
 const hasPrices=Object.values(ranges).some(r=>r.high!==null||r.low!==null)||session.cpObservations.length>0||session.rthObservations.length>0;
 const points:SessionTimelineItem[]=[...session.cpObservations,...session.rthObservations].map(p=>({id:p.id,sortAt:p.observedAt,price:p.price,label:'Recorded price',detail:'',commentary:null,attachment:null}));
 const unusual=reviewTimelinePrices(points,session.market.tickSize);
 const edgeAlerts:Partial<Record<WorkspacePhase,Partial<Record<'high'|'low',string>>>>={},unusualPhases:WorkspacePhase[]=[];
 for(const [phase] of fields){
  const start=phase==='ON'?clock.windows.ON.start:clock.windows['15R'].start,end=clock.windows[phase].end;
  const flagged=points.filter(p=>unusual.has(p.id)&&Temporal.Instant.compare(p.sortAt,start)>=0&&Temporal.Instant.compare(p.sortAt,end)<=0);
  for(const edge of ['high','low'] as const)if(flagged.some(p=>p.price===ranges[phase][edge]))(edgeAlerts[phase]??={})[edge]='Unusual recorded price · Check the source in Entries. A real move can also qualify.';
  if(flagged.length)unusualPhases.push(phase);
 }
 const missing=clock.unavailable||!hasPrices?[]:fields.filter(([phase,field])=>missingFields.includes(field)&&Temporal.Instant.compare(now,clock.windows[phase].end)>=0).map(([phase])=>{
  const r=ranges[phase],name=phase==='RTH'?'Daily / RTH':phase==='B'?'B / IB':phase;
  const invalid=r.high!==null&&r.low!==null&&(!Number.isFinite(r.high)||!Number.isFinite(r.low)||r.high<r.low);
  const manual=phase==='RTH'?session.rthRangeHistory?.at(-1):null;
  const recorded=phase==='RTH'?{high:manual?.high??session.close.rthHigh,low:manual?.low??session.close.rthLow}:r;
  const absent=recorded.high===null&&recorded.low===null?'high and low':recorded.high===null?'high':'low';
  return {phase,label:invalid?`${name} range needs correction`:`${name} ${absent} not recorded`,
   focus:(recorded.high===null||invalid?'high':'low') as 'high'|'low',
   help:invalid?'High must be at or above low. Correct the saved period range.':'Add the actual period prices if known. Leave unknown values blank.'};
 });
 const unconfirmed=hasPrices&&!clock.unavailable?(['ON','15R','A','B'] as const).filter(phase=>{
  const status=workspacePeriodStatus(session,phase,now);return status.ended&&!status.confirmed&&!missing.some(row=>row.phase===phase);
 }).map(phase=>({phase,label:`${phase==='B'?'B / IB':phase} range needs review`})) : [];
 const complete=!clock.unavailable&&!!session.close.finishedAt&&missingFields.length===0&&unconfirmed.length===0;
 const needsReview=!clock.unavailable&&hasPrices&&clock.closed&&(!session.close.finishedAt||missingFields.length>0);
 const pendingFinalRange=needsReview&&missing.length===0;
 const availability:Array<{label:string;detail:string;target?:'day'|WorkspacePhase;focus?:'open'}>=[];
 if(hasPrices&&!clock.unavailable){
  if(session.market.requiresContract&&session.contractStatus==='unknown')availability.push({label:'Exact contract unspecified',detail:'Contract-specific comparisons may be limited. This does not make the day incomplete.'});
  if(session.overnight.rthOpen===null&&Temporal.Instant.compare(now,clock.windows.ON.end)>=0)availability.push({label:'Opening price not recorded',detail:'The overnight opening-price comparison is unavailable. Optional; the period highs and lows are sufficient for day completion.',target:'ON',focus:'open'});
  if(clock.closed){
   if(session.close.price===null)availability.push({label:'Closing price not recorded',detail:'Close-position statistics remain unavailable. An optional close can be added in Review day.',target:'day'});
   if(!session.close.pathComplete)availability.push({label:'Full price-path coverage unknown',detail:'Unobserved breaks, returns and their order remain unknown. Reviewing highs and lows does not certify an unseen path; no extra confirmation is needed.'});
  }
  if(!session.cpObservations.length&&!session.rthObservations.length)availability.push({label:'No CP trail recorded',detail:'Highs and lows are sufficient for day completion. A timed price path and event sequence cannot be reconstructed from them.'});
 }
 return {sessionId:session.id,rthDate:session.rthDate,complete,needsReview,missing,unconfirmed,availability,edgeAlerts,unusualPhases,pendingFinalRange,attention:needsReview||missing.length>0||unconfirmed.length>0||unusualPhases.length>0,
  status:clock.unavailable?'No trading session':!hasPrices?'Notes / context only':complete?'Complete':clock.closed?'Needs review':'Session in progress'};
}
export type ReviewIssuesReport=ReturnType<typeof reviewIssues>;
