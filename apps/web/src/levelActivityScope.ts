// SPDX-License-Identifier: MPL-2.0
import type {JournalSession} from '@ib-field-notes/domain';
import {journalClock} from './journalClock';
export function levelActivityScope(sessions:JournalSession[],current:JournalSession,asOf:string){
  const windows=new Map(sessions.map(day=>{
    const clock=journalClock(day.market),close=clock.checkpointInstant(day.rthDate,day.market.checkpoints.studyClose).toString();
    return [day.id,{start:clock.overnightStart(day.rthDate).toString(),ibLockAt:clock.checkpointInstant(day.rthDate,day.market.checkpoints.ibLock).toString(),
      close:day.close.observedAt??close}];
  }));
  return {sessions,context:current,asOf,windows};
}
