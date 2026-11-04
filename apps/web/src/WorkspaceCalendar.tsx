// SPDX-License-Identifier: MPL-2.0
import {Fragment,useMemo,useRef,useState,type CSSProperties} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {type JournalSession} from '@ib-field-notes/domain';
import {WorkspaceDialog} from './WorkspaceDialog';
import {workspaceStudyDate,workspaceCurrentDate} from './workspaceModel';
import {reviewIssues} from './reviewIssues';

/** Calendar rows retain their real Monday key, including month/year boundaries. */
export function calendarWeeks(month:Temporal.PlainDate,weekdays:readonly number[]=[1,2,3,4,5]){
 const first=month.with({day:1}),start=first.subtract({days:first.dayOfWeek-1});
 return Array.from({length:6},(_,i)=>start.add({days:i*7})).map(start=>({start,days:weekdays.map(day=>start.add({days:day-1}))}))
  .filter(week=>week.days.some(day=>day.month===first.month&&day.year===first.year));
}
export function WorkspaceCalendar({session,sessions,savedDates,onSelect,onClose,onReviewWeek}:{session:JournalSession;sessions:JournalSession[];
 savedDates:string[];onSelect:(date:string)=>void;onClose:()=>void;onReviewWeek:(weekStart:string)=>void}){
 const [month,setMonth]=useState(()=>Temporal.PlainDate.from(session.rthDate).with({day:1}));
 const title=month.toLocaleString('en-US',{month:'long',year:'numeric'}),grid=useRef<HTMLDivElement>(null);
 const start=month.subtract({days:month.dayOfWeek-1});
 const weekdays=[1,2,3,4,5,...[6,7].filter(day=>session.market.weekdays.includes(day))],weeks=calendarWeeks(month,weekdays);
 const minute=Math.floor(Date.now()/60000);
 const attention=useMemo(()=>new Map([...sessions.filter(s=>s.journalId===session.journalId&&s.rthDate>=start.toString()&&s.rthDate<=start.add({days:41}).toString()),session].map(s=>[s.rthDate,reviewIssues(s,Temporal.Now.instant().toString())])),[sessions,session,month.toString(),minute]);
 const move=(date:Temporal.PlainDate)=>{
  while(!weekdays.includes(date.dayOfWeek))date=date.add({days:1});
  setMonth(date.with({day:1}));requestAnimationFrame(()=>grid.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus());
 };
 return <WorkspaceDialog title="Session calendar" className="workspace-calendar" onClose={onClose}>
  <div className="workspace-calendar-month"><button type="button" aria-label="Previous month" onClick={()=>setMonth(month.subtract({months:1}))}>‹</button>
   <h3 aria-live="polite">{title}</h3><button type="button" aria-label="Next month" onClick={()=>setMonth(month.add({months:1}))}>›</button></div>
  <div className="workspace-calendar-grid" ref={grid} aria-label={title} data-weekend-sessions={weekdays.length>5} style={{'--calendar-days':weekdays.length} as CSSProperties}>
   {weekdays.map(day=><span key={day} aria-hidden="true">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day-1]}</span>)}<span className="calendar-review-heading">Review</span>
   {weeks.map((week,index)=><Fragment key={week.start.toString()}>{week.days.map(day=>{
    const date=day.toString(),eligible=workspaceStudyDate(session,sessions,date),saved=savedDates.includes(date),needsAttention=saved&&!!attention.get(date)?.attention;
    return <button type="button" key={date} data-date={date} data-outside={day.month!==month.month} data-closed={!eligible}
     data-attention={needsAttention} aria-label={`Select session ${date}${saved?', saved session':''}${needsAttention?', needs attention':''}${!eligible?', non-session date':''}`} aria-pressed={session.rthDate===date}
     aria-disabled={!eligible} onClick={()=>{if(eligible)onSelect(date);}}
     onKeyDown={e=>{const days={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(days){e.preventDefault();let next=day.add({days});while(!weekdays.includes(next.dayOfWeek))next=next.add({days:days<0?-1:1});move(next);}}}>
     {day.day}{saved&&<small aria-hidden="true">●</small>}
    </button>;
   })}<button type="button" className="workspace-week-review" data-week-start={week.start.toString()} aria-label={`Review week ${index+1}, starting ${week.start}`} onClick={()=>onReviewWeek(week.start.toString())}><span className="calendar-review-title">Review · </span>Week {index+1}<span aria-hidden="true"> ›</span></button></Fragment>)}
  </div>
  <p className="workspace-calendar-key"><span className="calendar-saved">● Saved session</span> · <span className="calendar-attention">● Needs attention</span><br/>Muted dates are outside the study calendar.</p>
  <button type="button" className="workspace-current-session" onClick={()=>onSelect(workspaceCurrentDate(session,sessions,Temporal.Now.instant().toString()))}>Current session</button>
 </WorkspaceDialog>;
}
