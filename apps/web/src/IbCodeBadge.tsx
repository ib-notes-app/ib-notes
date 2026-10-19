// SPDX-License-Identifier: MPL-2.0
import {deriveCurrentIbCode,deriveSessionIbRead,type JournalSession} from '@ib-field-notes/domain';
import {Temporal} from '@js-temporal/polyfill';
import {journalClock} from './journalClock';

export function currentSessionIbCode(session:JournalSession):string|null {
  const clock=journalClock(session.market),cp=session.market.checkpoints;
  const current=deriveSessionIbRead(session,{now:Temporal.Now.instant().toString(),
    openAt:clock.checkpointInstant(session.rthDate,cp.overnightLock).toString(),
    ibLockAt:clock.checkpointInstant(session.rthDate,cp.ibLock).toString(),
    closeAt:clock.checkpointInstant(session.rthDate,cp.studyClose).toString()},{provisional:true});
  return deriveCurrentIbCode(session,current);
}

export function IbCodeBadge({code,closed=false}:{code:string;closed?:boolean}) {
  const compact=code.replace(/\+(\d+(?:\.\d+)?)/,(_,distance:string)=>`+${Number(distance)}`);
  return <span className="ib-code-nameplate" aria-label={`${closed?'Final':'Current'} IB code ${compact}`}>{compact}</span>;
}
