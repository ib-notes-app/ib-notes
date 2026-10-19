// SPDX-License-Identifier: MPL-2.0
import type {ForecastUpdate,JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';

/** A single saved forecast during minute 45, not a vote across irregular updates. */
export function ibForecastCheckpoint(session:JournalSession){
  const clock=createSessionClock(session.market),cp=session.market.checkpoints;
  const open=clock.checkpointInstant(session.rthDate,cp.overnightLock).epochMilliseconds;
  const lock=clock.checkpointInstant(session.rthDate,cp.ibLock).epochMilliseconds;
  const at=open+45*60_000;
  return at<lock?{at,until:Math.min(at+60_000,lock),open}:null;
}

/** An older fallback keeps its actual saved time; no later estimate fills a gap. */
export function selectIbCheckpointUpdate(session:JournalSession,updates:ForecastUpdate[],now:string){
  const point=ibForecastCheckpoint(session);if(!point)return null;
  const cutoff=Math.min(Date.parse(now),Date.parse(session.close.observedAt??now));
  const candidates=updates.filter(row=>row.sessionId===session.id&&row.journalId===session.journalId&&row.contract===session.contract&&
    row.originalIssuedAt===session.forecast?.issuedAt&&row.phase==='FORMING'&&row.asOf===row.issuedAt&&
    Date.parse(row.issuedAt)>=Math.max(point.open,Date.parse(session.forecast?.issuedAt??''))&&
    Date.parse(row.issuedAt)<point.until&&Date.parse(row.issuedAt)<=cutoff)
    .sort((a,b)=>Date.parse(a.issuedAt)-Date.parse(b.issuedAt)||a.id.localeCompare(b.id));
  const checkpoint=candidates.find(row=>Date.parse(row.issuedAt)>=point.at);
  const update=checkpoint??candidates.at(-1);
  return update?{update,atCheckpoint:!!checkpoint}:null;
}
