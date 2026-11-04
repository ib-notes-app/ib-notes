// SPDX-License-Identifier: MPL-2.0
import type {JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';

const key=(journalId:string)=>`ib-notes:share-timezone:${journalId}`;
function valid(zone:string){
  if(zone==='none')return true;
  try{new Intl.DateTimeFormat('en-US',{timeZone:zone});return true;}catch{return false;}
}
/** A browser presentation preference only; never save a projected journal. */
export function readShareTimeZone(journalId:string,fallback:string):string{
  try{const saved=localStorage.getItem(key(journalId));return saved&&valid(saved)?saved:fallback;}catch{return fallback;}
}
export function rememberShareTimeZone(journalId:string,zone:string):void{
  if(!valid(zone))return;
  try{localStorage.setItem(key(journalId),zone);}catch{ /* Sharing works without browser preferences. */ }
}
export function sessionForSharing(session:JournalSession,displayTimeZone:string):JournalSession{
  return {...session,displayTimeZone:displayTimeZone==='none'?session.displayTimeZone:displayTimeZone};
}
export function shareTimeZoneLabel(session:JournalSession):string{
  const at=createSessionClock(session.market).checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock);
  return new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,timeZoneName:'short'})
    .formatToParts(new Date(at.epochMilliseconds)).find(p=>p.type==='timeZoneName')?.value??session.displayTimeZone;
}
