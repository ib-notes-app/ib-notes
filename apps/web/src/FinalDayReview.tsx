// SPDX-License-Identifier: MPL-2.0
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {dayReviewRanges,latestCpObservation,type DayReviewInput,type JournalSession,type ReviewPeriod} from '@ib-field-notes/domain';
import {workspaceClock,workspaceFormatPrice,workspacePrice} from './workspaceModel';
import {Temporal} from '@js-temporal/polyfill';
import './FinalDayReview.css';
const periods=['ON','15R','A','B'] as const;
export function DayReviewButton({session,onClick,disabled=false}:{session:JournalSession;onClick:()=>void;disabled?:boolean}){
 const clock=workspaceClock(session,Temporal.Now.instant().toString());
 const state=session.close.finishedAt?'confirmed':clock.closed&&!clock.unavailable?'pending':'open';
 return <button type="button" className="workspace-day-review" data-state={state} aria-label="Review day" disabled={disabled} onClick={onClick}>
  <span>Review day</span>{state!=='open'&&<small>{state==='pending'?'Needs review':'✓ Confirmed'}</small>}
 </button>;
}
export function FinalDayReview({session,onConfirm,onViewEntries,renderPeriod}:{session:JournalSession;onConfirm:(input:DayReviewInput)=>Promise<string|null>;onViewEntries?:()=>void;
 renderPeriod?:(phase:ReviewPeriod|'RTH',openedAt:string,done:()=>void)=>ReactNode}){
 const ranges=dayReviewRanges(session),format=(n:number|null)=>n===null?'':workspaceFormatPrice(n,session.market.tickSize);
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
 const clock=workspaceClock(session,Temporal.Now.instant().toString()),cp=latestCpObservation(session);
 const ended=Temporal.Instant.compare(Temporal.Now.instant(),clock.windows.RTH.end)>=0;
 const update=(period:ReviewPeriod|'RTH',edge:'high'|'low',text:string)=>{setError(null);setValues(old=>({...old,[period]:{...old[period],[edge]:text}}));};
 const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
 return <section className="final-day-review" aria-label="Review day">
  <form noValidate onSubmit={async e=>{
   e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);setError(null);
   try{
    const parse=(text:string)=>text.trim()?workspacePrice(text,session.market.tickSize):null;
    const rthHigh=parse(values.RTH.high),rthLow=parse(values.RTH.low);
    if(rthHigh===null||rthLow===null)throw Error('Enter the daily high and low. Other missing values can stay blank.');
    const inputs=Object.fromEntries(periods.map(p=>[p,{high:parse(values[p].high),low:parse(values[p].low)}])) as DayReviewInput['ranges'];
    setError(await onConfirm({ranges:inputs,rthHigh,rthLow,closePrice:parse(close),note}));
   }catch(e){setError(e instanceof Error?e.message:'Unable to save. Your entries are preserved.');}
   finally{saving.current=false;setBusy(false);}
  }}>
   <div className="final-day-heading"><div><h3>Final prices</h3><p>{session.instrument} · {new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(`${session.rthDate}T12:00:00Z`))}</p></div>
    <button className="primary-action" type="submit" disabled={busy||!ended||clock.unavailable}>{busy?'Saving…':'Confirm day'}</button></div>
   <p className="stage-helper">Your entries are already saved. Confirm these final ranges once to track the Daily Low in Levels.</p>
   {!ended&&<p role="status">Available after the session closes at {time(clock.windows.RTH.end)}.</p>}
   {error&&<p role="alert">{error}</p>}
   <fieldset disabled={busy}><legend className="visually-hidden">Final period prices</legend>
    <div className="final-day-prices" role="group" aria-label="Period highs and lows">
     <div className="final-day-columns" aria-hidden="true"><span>Period</span><span>High</span><span>Low</span></div>
     {[...periods,'RTH' as const].map(period=><div className="final-day-row" key={period} data-daily={period==='RTH'}>
      {renderPeriod?<button type="button" className="final-day-period" aria-label={`Review ${period} period`} onClick={()=>setPeriod({phase:period,openedAt:Temporal.Now.instant().toString()})}>{period==='RTH'?'Daily / RTH':period==='B'?'B / IB':period}<span aria-hidden="true">›</span></button>:<strong>{period==='RTH'?'Daily / RTH':period==='B'?'B / IB':period}</strong>}
      {(['high','low'] as const).map(edge=><label key={edge}><span className="visually-hidden">{period==='RTH'?'Daily':period} {edge}</span>
       <input type="text" inputMode="decimal" autoComplete="off" placeholder="—" value={values[period][edge]} onChange={e=>update(period,edge,e.target.value)}/></label>)}
     </div>)}
    </div>
    <label className="final-day-close">RTH close (optional)<input type="text" inputMode="decimal" autoComplete="off" placeholder="Unknown" value={close} onChange={e=>{setError(null);setClose(e.target.value);}}/></label>
    {cp&&<p className="final-day-last-cp">Last recorded CP: {format(cp.price)} · {time(cp.observedAt)}</p>}
    <p className="stage-helper">Leave the close blank if unknown. Gaps between observations remain unknown.</p>
    <label className="final-day-notes"><span>Day Notes</span><textarea rows={5} value={note} onChange={e=>setNote(e.target.value)}/></label>
   </fieldset>
  </form>
  {onViewEntries&&<button type="button" className="final-day-entries" disabled={busy} onClick={onViewEntries}>View entries <span aria-hidden="true">›</span></button>}
  {period&&renderPeriod?.(period.phase,period.openedAt,()=>setPeriod(null))}
 </section>;
}
