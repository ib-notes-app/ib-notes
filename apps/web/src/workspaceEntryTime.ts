// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {JournalSession} from '@ib-field-notes/domain';

export function workspaceEntryTimeFields(at:string,zone:string){
 const local=Temporal.Instant.from(at).toZonedDateTimeISO(zone);
 return {date:local.toPlainDate().toString(),time:local.toPlainTime().toLocaleString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'})};
}

function entryClock(time:string){
 const match=/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(time.trim());
 if(!match)throw Error('Enter a time such as 7:12 AM or 14:12.');
 let hour=Number(match[1]);const minute=Number(match[2]),second=Number(match[3]??0),period=match[4]?.toUpperCase();
 if(period){if(hour<1||hour>12)throw Error('Use hours 1–12 with AM or PM.');hour=hour%12+(period==='PM'?12:0);}
 let clock:Temporal.PlainTime;
 try{clock=Temporal.PlainTime.from({hour,minute,second},{overflow:'reject'});}catch{throw Error('Enter a valid time such as 7:12 AM or 14:12.');}
 return clock;
}
/** Native picker values carry a clock only; timezone/date conversion stays at save. */
export const workspaceEntryClockValue=(time:string)=>time?entryClock(time).toString({smallestUnit:'second'}):'';
export const workspaceEntryClockText=(value:string)=>value?Temporal.PlainTime.from(value).toLocaleString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'}):'';
export const workspaceEntryClockDisplay=(time:string)=>time?entryClock(time).toLocaleString('en-US',{hour:'numeric',minute:'2-digit'}):'';

export function workspaceEntryTimeInstant(date:string,time:string,zone:string){
 if(!date||!time.trim())throw Error('Enter the observation date and time for this session and phase.');
 let day:Temporal.PlainDate;
 try{day=Temporal.PlainDate.from(date);}catch{throw Error('Enter a valid observation date.');}
 return day.toPlainDateTime(entryClock(time)).toZonedDateTime(zone,{disambiguation:'reject'}).toInstant().toString();
}

/** A clock entered for ON belongs to its configured session window, not today. */
export function workspaceOvernightEntryDate(session:Pick<JournalSession,'market'|'rthDate'|'displayTimeZone'>,time:string):string|null{
 if(!time.trim())return null;
 const clock=createSessionClock(session.market),zone=session.displayTimeZone;
 const candidate=clock.sessionObservationInstant(session.rthDate,entryClock(time).toString(),zone);
 const date=workspaceEntryTimeFields(candidate.toString(),zone).date;
 // Retain strict DST validation; never normalize a missing/repeated clock time.
 const exact=Temporal.Instant.from(workspaceEntryTimeInstant(date,time,zone));
 const start=clock.overnightStart(session.rthDate),end=clock.checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock);
 return Temporal.Instant.compare(exact,start)>=0&&Temporal.Instant.compare(exact,end)<=0?date:null;
}
