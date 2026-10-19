// SPDX-License-Identifier: MPL-2.0
import {useContext,useEffect,useMemo,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {deriveLevelRecordedEvents,duplicateManualLevelEvent,matchingPriceLevelEvent,
  type JournalSession,type SignificantLevel,type SignificantLevelMarketEventKind,type LevelRecordedEvent} from '@ib-field-notes/domain';
import {LevelTrackingContext} from './LevelPriceTracking';
import {useJournalClock} from './journalClock';
import {levelActivityScope} from './levelActivityScope';
export {levelActivityScope} from './levelActivityScope';
import {levelMapRole} from './mapLevelReferences';
import {EventMoveActivityTags} from './EventPriceMoves';

export function levelObservationLabel(level:SignificantLevel,kind:SignificantLevelMarketEventKind|'contact'){
  if(kind==='contact')return 'Contact · approach unknown';
  const labels:Record<SignificantLevelMarketEventKind,string>={tested_from_above:'Tested as support',held_above:'Held as support',
    crossed_below:level.levelType==='low'?'Lost / flushed below':'Crossed below',tested_from_below:'Tested as resistance',held_below:'Rejected as resistance',
    crossed_above:level.levelType==='low'?'Reclaimed above':'Broke above'};
  if(level.levelType==='low'&&kind==='tested_from_below')return 'Backtested as resistance';
  if(level.levelType==='high'&&kind==='tested_from_above')return 'Backtested as support';
  return labels[kind];
}
type Save=(kind:SignificantLevelMarketEventKind,time:string,price:number|null,eventIds:string[],note:string)=>Promise<boolean>;
const clockTime=(at:string,zone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
const localNow=(zone:string)=>Temporal.Now.instant().toZonedDateTimeISO(zone).toPlainTime().toString({smallestUnit:'minute'});

function ObservationForm({session,level,events,onSave,onCancel}:{session:JournalSession;level:SignificantLevel;events:LevelRecordedEvent[];onSave:Save;onCancel:()=>void}){
  const sessions=useContext(LevelTrackingContext),{sessionObservationInstant}=useJournalClock();
  const [now,setNow]=useState(()=>localNow(session.displayTimeZone)),[manualTime,setManualTime]=useState<string|null>(null);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(localNow(session.displayTimeZone)),1000);return()=>window.clearInterval(timer);},[session.displayTimeZone]);
  const [kind,setKind]=useState<SignificantLevelMarketEventKind>(()=>levelMapRole(level,sessions,session)==='resistance'?'tested_from_below':'tested_from_above');
  const [note,setNote]=useState(''),[ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const time=manualTime??now;
  const at=sessionObservationInstant(session.rthDate,time,session.displayTimeZone).toString();
  const duplicate=duplicateManualLevelEvent(level,kind,at,session.id),match=matchingPriceLevelEvent(events,kind,at,session.id);
  const earlier=session.marketContextItems.filter(item=>item.eventAt<=at);
  return <form className="level-market-event-form" aria-label="Record a level observation" onSubmit={async event=>{
    event.preventDefault();if(busy||duplicate)return;
    setBusy(true);setError('');
    try{if(await onSave(kind,time,null,ids,note))onCancel();else setError('Could not save this observation. See the message above.');}
    finally{setBusy(false);}
  }}>
    <label>What happened<select aria-label="What happened" value={kind} onChange={event=>{setKind(event.target.value as SignificantLevelMarketEventKind);setError('');}}>
      {(['tested_from_above','tested_from_below','held_above','held_below','crossed_below','crossed_above'] as const)
        .map(candidate=><option key={candidate} value={candidate}>{levelObservationLabel(level,candidate)}</option>)}
    </select></label>
    <label className="context-picker-field"><span>When</span><span className="context-picker-readout">
      <strong>{clockTime(at,session.displayTimeZone)}</strong><em>{manualTime===null?'Now':'Changed'}</em></span>
      <input className="native-picker-overlay" aria-label="Observation time" type="time" required value={time}
        onChange={event=>{setManualTime(event.target.value);setIds([]);setError('');}}/>
    </label>
    {duplicate?<p className="levels-help" role="status">Already recorded at this time. Add a note or choose a different time.</p>
      :match&&<p className="levels-help" role="status">Already shown from prices. Saving confirms the same event.</p>}
    <details className="level-observation-extras"><summary>Optional note &amp; context</summary>
      <label>Note<textarea aria-label="Observation note" value={note} onChange={event=>setNote(event.target.value)}/></label>
      {!!earlier.length&&<fieldset className="level-episode-events"><legend>Related earlier events</legend>{earlier.map(item=><label key={item.id}>
        <input type="checkbox" checked={ids.includes(item.id)} onChange={event=>setIds(values=>event.target.checked?[...values,item.id]:values.filter(id=>id!==item.id))}/>
        <span>{item.name} · {item.holiday?'All day':clockTime(item.eventAt,session.displayTimeZone)}</span>
      </label>)}</fieldset>}
    </details>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="level-observation-actions"><button className="secondary-action" type="submit" disabled={busy||!!duplicate}>{busy?'Saving…':duplicate?'Already recorded':match?'Confirm existing event':'Save observation'}</button>
      <button type="button" onClick={onCancel} disabled={busy}>Cancel</button></div>
  </form>;
}

export function LevelActivity({session,level,allowEntry,onSave,onRemove}:{session:JournalSession;level:SignificantLevel;allowEntry:boolean;onSave:Save;onRemove:(id:string)=>void}){
  const sessions=useContext(LevelTrackingContext),[requested,setRequested]=useState(false),[record,setRecord]=useState(false),[page,setPage]=useState(0);
  const events=useMemo(()=>!requested||!sessions?null:deriveLevelRecordedEvents({level,...levelActivityScope(sessions,session,Temporal.Now.instant().toString())}),[requested,sessions,level,session]);
  const rows=events??[],pages=Math.max(1,Math.ceil(rows.length/8)),current=Math.min(page,pages-1);
  const stamp=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at));
  return <details className="level-market-event-history" onToggle={event=>{if(event.currentTarget.open)setRequested(true);}}>
    <summary>Level activity{events?` · ${events.length}`:''}</summary>
    <p className="levels-help">Prices update this history. Gaps between entries may hide other tests or reactions.</p>
    {allowEntry&&!record&&<button className="secondary-action" type="button" onClick={()=>setRecord(true)}>Record what happened</button>}
    {allowEntry&&record&&<ObservationForm session={session} level={level} events={rows} onSave={onSave} onCancel={()=>setRecord(false)}/>}
    {!events?<p>{sessions?'Reading saved prices…':'Price history is loading.'}</p>:<>
      {!rows.length&&<p>No level activity recorded yet.</p>}
      {!!rows.length&&<ol aria-label="Level activity history">{rows.slice(current*8,current*8+8).map(event=><li key={event.id}>
        <strong>{levelObservationLabel(level,event.kind)}</strong><time dateTime={event.at}>{stamp(event.at)}</time>
        <small>{event.source==='both'?'Confirmed by you · also shown from prices':event.source==='manual'?'Confirmed by you':'From saved prices'}</small>
        {event.source==='prices'&&event.kind.startsWith('crossed_')&&<small>Between {clockTime(event.startAt,session.displayTimeZone)} and {clockTime(event.endAt,session.displayTimeZone)} · exact crossing time unknown</small>}
        {event.manual?.note&&<p>{event.manual.note}</p>}
        {!!event.manual?.linkedEvents.length&&<small>Events · {event.manual.linkedEvents.map(item=>item.name).join(', ')}</small>}
        <EventMoveActivityTags levelId={level.id} event={event}/>
        {event.manual&&<button className="remove-action" type="button" onClick={()=>onRemove(event.manual!.id)}>Remove confirmation</button>}
      </li>)}</ol>}
      {pages>1&&<div className="levels-pagination"><button type="button" disabled={!current} onClick={()=>setPage(current-1)}>Previous</button>
        <span>{current+1} / {pages}</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>More</button></div>}
    </>}
  </details>;
}
