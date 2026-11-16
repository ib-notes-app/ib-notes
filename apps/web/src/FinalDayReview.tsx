// SPDX-License-Identifier: MPL-2.0
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {dayReviewRanges,dayReviewIssues,deriveSessionMissingFields,latestCpObservation,type DayReviewInput,type JournalSession,type ReviewPeriod} from '@ib-field-notes/domain';
import {workspaceClock,workspaceFormatPrice,workspacePrice} from './workspaceModel';
import {Temporal} from '@js-temporal/polyfill';
import './FinalDayReview.css';
const periods=['ON','15R','A','B'] as const;
export function DayReviewButton({session,onClick,disabled=false}:{session:JournalSession;onClick:()=>void;disabled?:boolean}){
 const clock=workspaceClock(session,Temporal.Now.instant().toString());
 const state=session.close.finishedAt&&deriveSessionMissingFields(session).length===0?'confirmed':clock.closed&&!clock.unavailable?'pending':'open';
 return <button type="button" className="workspace-day-review" data-state={state} aria-label="Review day" disabled={disabled} onClick={onClick}>
  <span>Review day</span>{state!=='open'&&<small>{state==='pending'?'Needs review':'✓ Confirmed'}</small>}
 </button>;
}
export function FinalDayReview({session,onConfirm,onViewEntries,renderPeriod}:{session:JournalSession;onConfirm:(input:DayReviewInput)=>Promise<string|null>;onViewEntries?:()=>void;
 renderPeriod?:(phase:ReviewPeriod|'RTH',openedAt:string,done:()=>void)=>ReactNode}){
 const clock=workspaceClock(session,Temporal.Now.instant().toString());
 const savedRanges=dayReviewRanges(session),ranges=dayReviewRanges(session,clock.windows),format=(n:number|null)=>n===null?'':workspaceFormatPrice(n,session.market.tickSize);
 const [values,setValues]=useState(()=>Object.fromEntries([...periods,'RTH' as const].map(p=>[p,{high:format(ranges[p].high),low:format(ranges[p].low)}])) as Record<ReviewPeriod|'RTH',{high:string;low:string}>);
 const [close,setClose]=useState(format(session.close.price)),[note,setNote]=useState(session.close.note??'');
 const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),saving=useRef(false);
 const [period,setPeriod]=useState<{phase:ReviewPeriod|'RTH';openedAt:string}|null>(null),previousRanges=useRef(ranges);
 useEffect(()=>{
  const previous=previousRanges.current;previousRanges.current=ranges;
  // Refresh saved period edits without discarding other unsaved review fields.
  setValues(old=>Object.fromEntries([...periods,'RTH' as const].map(p=>[p,Object.fromEntries((['high','low'] as const).map(edge=>[edge,
   old[p][edge]===format(previous[p][edge])?format(ranges[p][edge]):old[p][edge]]))])) as typeof old);
 },[session]);
 const cp=latestCpObservation(session);
 const fields=useRef<Record<string,HTMLInputElement|null>>({});
 const draftPrice=(text:string)=>{try{return text.trim()?workspacePrice(text,session.market.tickSize):null;}catch{return Number.NaN;}};
 const draft={ranges:Object.fromEntries(periods.map(p=>[p,{high:draftPrice(values[p].high),low:draftPrice(values[p].low)}])) as DayReviewInput['ranges'],rthHigh:draftPrice(values.RTH.high),rthLow:draftPrice(values.RTH.low),closePrice:draftPrice(close),note};
 const issues=dayReviewIssues(session,draft,clock.windows);
 const included=dayReviewIssues(session,{ranges:savedRanges,rthHigh:savedRanges.RTH.high,rthLow:savedRanges.RTH.low,closePrice:session.close.price,note},clock.windows).filter(i=>i.kind==='recorded');
 const pending=periods.filter(p=>(p==='ON'?session.overnight:p==='15R'?session.fifteenMinute:p==='A'?session.aPeriod:session.bPeriod).status!=='confirmed'&&ranges[p].high!==null&&ranges[p].low!==null);
 const focusField=(period:ReviewPeriod|'RTH',edge:'high'|'low'|'close')=>{const field=fields.current[`${period}:${edge}`];field?.scrollIntoView({block:'center',behavior:'instant'});field?.focus({preventScroll:true});};
 const ended=Temporal.Instant.compare(Temporal.Now.instant(),clock.windows.RTH.end)>=0;
 const update=(period:ReviewPeriod|'RTH',edge:'high'|'low',text:string)=>{setError(null);setValues(old=>({...old,[period]:{...old[period],[edge]:text}}));};
 const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
 return <section className="final-day-review" aria-label="Review day">
  <form noValidate onSubmit={async e=>{
   e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError(null);
   try{
    const blocked=issues.find(i=>i.kind!=='missing'||i.period==='RTH');
    if(blocked){focusField(blocked.period,blocked.edge);throw Error(blocked.message);}
    setError(await onConfirm({...draft,rthHigh:draft.rthHigh!,rthLow:draft.rthLow!}));
   }catch(e){setError(e instanceof Error?e.message:'Unable to save. Your entries are preserved.');}
   finally{saving.current=false;setBusy(false);}
  }}>
   <div className="final-day-heading"><div><h3>Final prices</h3><p>{session.instrument} · {new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(`${session.rthDate}T12:00:00Z`))}</p></div>
    <button className="primary-action" type="submit" disabled={busy||!ended||clock.unavailable}>{busy?'Saving…':'Confirm day'}</button></div>
   <p className="stage-helper">Your entries are already saved. A complete day needs ON, 15R, A, B/IB and daily highs and lows, reviewed once. No CP or closing price is required.</p>
   {!ended&&<p role="status">Available after the session closes at {time(clock.windows.RTH.end)}.</p>}
   {included.length>0&&<section className="final-day-included" aria-label="Recorded prices included"><strong>Included from your recorded entries</strong>
    {included.map(i=><p key={`${i.period}:${i.edge}`}>{i.period} {i.edge}: <b>{format(i.price!)}</b> · {new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(i.observedAt!))}</p>)}
    <small>Check the values below. Confirm day saves them to their periods.</small></section>}
   {ended&&issues.length>0&&<section className="final-day-issues" aria-label="Items to review"><strong>{issues.length} {issues.length===1?'item':'items'} to review</strong>
    <ul>{issues.map(i=><li key={`${i.period}:${i.edge}:${i.kind}`}><button type="button" onClick={()=>focusField(i.period,i.edge)}>{i.message}<span aria-hidden="true"> ›</span></button></li>)}</ul></section>}
   {pending.length>0&&<p className="final-day-pending">Confirm day will also confirm: {pending.join(' · ')}.</p>}
   {error&&<p role="alert">{error}</p>}
   <fieldset disabled={busy}><legend className="visually-hidden">Final period prices</legend>
    <div className="final-day-prices" role="group" aria-label="Period highs and lows">
     <div className="final-day-columns" aria-hidden="true"><span>Period</span><span>High</span><span>Low</span></div>
     {[...periods,'RTH' as const].map(period=><div className="final-day-row" key={period} data-daily={period==='RTH'}>
      {renderPeriod?<button type="button" className="final-day-period" aria-label={`Review ${period} period`} onClick={()=>setPeriod({phase:period,openedAt:Temporal.Now.instant().toString()})}>{period==='RTH'?'Daily / RTH':period==='B'?'B / IB':period}<span aria-hidden="true">›</span></button>:<strong>{period==='RTH'?'Daily / RTH':period==='B'?'B / IB':period}</strong>}
      {(['high','low'] as const).map(edge=><label key={edge}><span className="visually-hidden">{period==='RTH'?'Daily':period} {edge}</span>
       <input aria-label={`${period==='RTH'?'Daily':period} ${edge}`} ref={node=>{fields.current[`${period}:${edge}`]=node;}} data-review-field={`${period}:${edge}`} aria-invalid={ended&&issues.some(i=>i.period===period&&i.edge===edge)} type="text" inputMode="decimal" autoComplete="off" placeholder="—" value={values[period][edge]} onChange={e=>update(period,edge,e.target.value)}/>
       {ended&&issues.some(i=>i.period===period&&i.edge===edge)&&<small className="final-day-field-hint">{values[period][edge].trim()?'Check this value':'Missing'}</small>}</label>)}
     </div>)}
    </div>
    <label className="final-day-close">RTH close (optional)<input ref={node=>{fields.current['RTH:close']=node;}} aria-invalid={issues.some(i=>i.edge==='close')} type="text" inputMode="decimal" autoComplete="off" placeholder="Unknown" value={close} onChange={e=>{setError(null);setClose(e.target.value);}}/></label>
    {cp&&<p className="final-day-last-cp">Last recorded CP: {format(cp.price)} · {time(cp.observedAt)}</p>}
    <p className="stage-helper">Leave unknown prices blank; missing ranges will stay listed for review. Gaps between observations remain unknown.</p>
    <label className="final-day-notes"><span>Day Notes</span><textarea rows={5} value={note} onChange={e=>setNote(e.target.value)}/></label>
   </fieldset>
  </form>
  {onViewEntries&&<button type="button" className="final-day-entries" disabled={busy} onClick={onViewEntries}>View entries <span aria-hidden="true">›</span></button>}
  {period&&renderPeriod?.(period.phase,period.openedAt,()=>setPeriod(null))}
 </section>;
}
