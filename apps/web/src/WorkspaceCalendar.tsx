// SPDX-License-Identifier: MPL-2.0
import {useRef,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {type JournalSession} from '@ib-field-notes/domain';
import {WorkspaceDialog} from './WorkspaceDialog';
import {workspaceStudyDate,workspaceCurrentDate} from './workspaceModel';

export function WorkspaceCalendar({session,sessions,savedDates,onSelect,onClose}:{session:JournalSession;sessions:JournalSession[];
 savedDates:string[];onSelect:(date:string)=>void;onClose:()=>void}){
 const [month,setMonth]=useState(()=>Temporal.PlainDate.from(session.rthDate).with({day:1}));
 const title=month.toLocaleString('en-US',{month:'long',year:'numeric'}),grid=useRef<HTMLDivElement>(null);
 const start=month.subtract({days:month.dayOfWeek-1});
 const move=(date:Temporal.PlainDate)=>{
  setMonth(date.with({day:1}));requestAnimationFrame(()=>grid.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus());
 };
 return <WorkspaceDialog title="Session calendar" className="workspace-calendar" onClose={onClose}>
  <div className="workspace-calendar-month"><button type="button" aria-label="Previous month" onClick={()=>setMonth(month.subtract({months:1}))}>‹</button>
   <h3 aria-live="polite">{title}</h3><button type="button" aria-label="Next month" onClick={()=>setMonth(month.add({months:1}))}>›</button></div>
  <div className="workspace-calendar-grid" ref={grid} aria-label={title}>
   {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day} aria-hidden="true">{day}</span>)}
   {Array.from({length:42},(_,i)=>start.add({days:i})).map(day=>{
    const date=day.toString(),eligible=workspaceStudyDate(session,sessions,date),saved=savedDates.includes(date);
    return <button type="button" key={date} data-date={date} data-outside={day.month!==month.month} data-closed={!eligible}
     aria-label={`Select session ${date}${saved?', saved session':''}${!eligible?', non-session date':''}`} aria-pressed={session.rthDate===date}
     aria-disabled={!eligible} onClick={()=>{if(eligible)onSelect(date);}}
     onKeyDown={e=>{const days={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(days){e.preventDefault();move(day.add({days}));}}}>
     {day.day}{saved&&<small aria-hidden="true">●</small>}
    </button>;
   })}
  </div>
  <p className="workspace-calendar-key">● Saved session · Muted dates are outside the configured study calendar.</p>
  <button type="button" className="workspace-current-session" onClick={()=>onSelect(workspaceCurrentDate(session,sessions,Temporal.Now.instant().toString()))}>Current session</button>
 </WorkspaceDialog>;
}
