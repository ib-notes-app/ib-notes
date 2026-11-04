// SPDX-License-Identifier: MPL-2.0
import {useState} from 'react';
import type {ReviewIssuesReport,ReviewOrigin,ReviewRepair} from './reviewIssues';
import './ReviewIssues.css';

export function ReviewIssues({reports,filter,onFilter,onClose,onRepair,origin}:{reports:ReviewIssuesReport[];filter:'review'|'missing';onFilter:(filter:'review'|'missing')=>void;
 onClose:()=>void;onRepair:(repair:ReviewRepair)=>Promise<string|null>;origin:ReviewOrigin}){
 const [busy,setBusy]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 const days=reports.filter(r=>filter==='review'?r.needsReview:r.missing.length>0);
 async function open(request:ReviewRepair){if(busy)return;setBusy(`${request.sessionId}:${request.target}`);setError(null);try{setError(await onRepair(request));}catch(e){setError(e instanceof Error?e.message:'This day could not open. Try again.');}finally{setBusy(null);}}
 const label=(date:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00Z`));
 return <section className="review-issues" aria-label={`${origin} review issues`}>
  <header><h3>What needs attention</h3><button type="button" disabled={!!busy} onClick={onClose}>Close issues</button></header>
  <div className="review-issue-filters" role="group" aria-label="Review issue type">
   <button type="button" aria-pressed={filter==='review'} onClick={()=>onFilter('review')}>Needs review · {reports.filter(r=>r.needsReview).length}</button>
   <button type="button" aria-pressed={filter==='missing'} onClick={()=>onFilter('missing')}>Missing ranges · {reports.reduce((n,r)=>n+r.missing.length,0)}</button>
  </div>
  <p>A complete day needs each period’s high and low. Saving the last missing range after close completes the day. CP, open and close prices are optional.</p>
  {error&&<p role="alert">{error}</p>}
  {!days.length&&<p role="status">{filter==='review'?'No recorded days need review.':'No period ranges are missing.'}</p>}
  <ul className="review-issue-days">{days.map(day=><li key={day.sessionId}>
   <div className="review-issue-day-heading"><strong>{label(day.rthDate)}</strong><button type="button" disabled={!!busy} onClick={()=>void open({sessionId:day.sessionId,target:'day',origin})}>Review day <span aria-hidden="true">›</span></button></div>
   {!day.missing.length&&<><p>All period highs and lows are recorded. Save the final RTH range or check them in Review day.</p><button type="button" disabled={!!busy} onClick={()=>void open({sessionId:day.sessionId,target:'RTH',focus:'high',origin})}>Review RTH range</button></>}
   <ul className="review-issue-ranges">{day.missing.map(issue=><li key={issue.phase}><button type="button" disabled={!!busy} onClick={()=>void open({sessionId:day.sessionId,target:issue.phase,focus:issue.focus,origin})}><span><strong>{issue.label}</strong><small>{issue.help}</small></span><span aria-hidden="true">›</span></button></li>)}</ul>
  </li>)}</ul>
  {reports.some(day=>day.availability.length>0)&&<details className="review-stat-availability"><summary>Statistics availability <small>Optional · does not block completion</small></summary>
   {reports.filter(day=>day.availability.length>0).map(day=><section key={day.sessionId}><h4>{label(day.rthDate)}</h4><ul>{day.availability.map(item=><li key={item.label}><strong>{item.label}</strong><p>{item.detail}</p>{item.target&&<button type="button" disabled={!!busy} onClick={()=>void open({sessionId:day.sessionId,target:item.target!,focus:item.focus,origin})}>{item.target==='day'?'Open Review day':'Open ON period'}</button>}</li>)}</ul></section>)}
  </details>}
 </section>;
}
