// SPDX-License-Identifier: MPL-2.0
import {useEffect,useId,useRef,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {deriveEventWindowRange,eventObservationWindow,eventWindowsAt,studyEventChoices,type JournalSession,type MarketContextItem,type MarketContextUpdate} from '@ib-field-notes/domain';
import {workspaceClock,workspaceFormatPrice} from './workspaceModel';
import './EventStudy.css';

export const eventClock=(at:string,zone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit',second:new Date(at).getUTCSeconds()?'2-digit':undefined}).format(new Date(at));
const local=(at:string,zone:string)=>Temporal.Instant.from(at).toZonedDateTimeISO(zone).toPlainDateTime().toString({smallestUnit:'second'});
const instant=(value:string,zone:string)=>Temporal.PlainDateTime.from(value).toZonedDateTime(zone,{disambiguation:'reject'}).toInstant().toString();
const concise=(value:number)=>value.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:8});
const trackingDurations=['1','5','15','30'];
/** Separate native date/time controls keep phone time wheels compact and editable. */
function EventTimeField({label,name,value,date,onChange,disabled=false}:{label:string;name:string;value:string;date:string;onChange:(value:string)=>void;disabled?:boolean}){
 const [day=date,time='']=value.split('T');
 return <div className="event-time-field"><span>{label}</span><div>
  <input type="date" aria-label={`${name} date`} value={day||date} required disabled={disabled} onChange={e=>onChange(`${e.target.value}T${time}`)}/>
  <input type="time" aria-label={name} step="1" value={time} required disabled={disabled} onClick={e=>{try{e.currentTarget.showPicker?.();}catch{e.currentTarget.focus();}}} onChange={e=>onChange(`${day||date}T${e.target.value}`)}/>
 </div></div>;
}
export function EventDayFilter({sessions,value,onChange}:{sessions:JournalSession[];value:string;onChange:(value:string)=>void}){
 const choices=[...new Set(['CPI','PPI','FOMC','Jobs / NFP','PCE','GDP',...studyEventChoices(sessions)])];
 return <label className="event-day-filter">Event days<select aria-label="Filter by event" value={value} onChange={e=>onChange(e.target.value)}><option value="">All recorded days</option>{choices.map(name=><option key={name} value={name}>{name}</option>)}</select></label>;
}
export function EventRangeSummary({session,item,now}:{session:JournalSession;item:MarketContextItem;now:string}){
 const [pricesOpen,setPricesOpen]=useState(false),[priceCount,setPriceCount]=useState(20);
 const range=deriveEventWindowRange(session,item,now);if(!range)return null;
 const price=(n:number|null)=>n===null?'—':workspaceFormatPrice(n,session.market.tickSize);
 return <div className="event-range-summary">
  <p className="event-window-time">{eventClock(range.window.startAt,session.displayTimeZone)}–{range.window.endAt?eventClock(range.window.endAt,session.displayTimeZone):'Until ended'} · {range.state==='recording'?'Recording':range.state==='upcoming'?'Upcoming':'Window ended'}{!range.window.explicit?' · Default window':''}</p>
  <dl><div><dt>Recorded high</dt><dd>{price(range.high)}</dd></div><div><dt>Recorded low</dt><dd>{price(range.low)}</dd></div><div><dt>Midpoint</dt><dd>{range.midpoint===null?'—':concise(range.midpoint)}</dd></div><div><dt>Width</dt><dd>{range.width===null?'—':`${concise(range.width)} pt`}</dd></div></dl>
  <small>{range.count} timed {range.count===1?'price':'prices'} · Recorded observations; gaps may exist.</small>
  {range.count>0&&<details className="event-recorded-prices" onToggle={e=>setPricesOpen(e.currentTarget.open)}><summary>Recorded prices · {range.count}</summary>{pricesOpen&&<><ol>{range.observations.slice(-priceCount).reverse().map(p=><li key={p.id}><time>{eventClock(p.observedAt,session.displayTimeZone)}</time><strong>{price(p.price)}</strong></li>)}</ol>{priceCount<range.count&&<button type="button" onClick={()=>setPriceCount(n=>n+20)}>Earlier prices</button>}</>}</details>}
 </div>;
}
export function EventRanges({session,onOpen}:{session:JournalSession;onOpen?:()=>void}){
 const [now,setNow]=useState(()=>Temporal.Now.instant().toString());
 useEffect(()=>{const tick=()=>setNow(Temporal.Now.instant().toString());tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[]);
 const events=session.marketContextItems.filter(i=>!i.holiday);if(!events.length)return null;
 return <section className="event-ranges" aria-label="Event windows"><h3>Event windows</h3>{events.map(item=><details key={item.id}><summary>{item.name} · {eventClock(item.eventAt,session.displayTimeZone)}</summary><EventRangeSummary session={session} item={item} now={now}/>{item.note&&<p>{item.note}</p>}{session.rthObservations.filter(p=>p.eventId===item.id&&p.note).map(p=><p key={p.id}>{p.note}</p>)}{session.sessionNotes.filter(n=>(n.link?.kind==='event'&&n.link.targetId===item.id||n.link?.eventId===item.id)).map(n=><p key={n.id}>{n.text}</p>)}</details>)}{onOpen&&<button type="button" onClick={onOpen}>Manage events</button>}</section>;
}
export function EventEntryTag({session,at,onOpen,disabled=false}:{session:JournalSession;at:string|null;onOpen?:()=>void;disabled?:boolean}){
 const events=at?eventWindowsAt(session.marketContextItems,at):[];
 const next=at&&!events.length?session.marketContextItems.filter(i=>!i.holiday&&Date.parse(eventObservationWindow(i)?.startAt??'')>Date.parse(at)).sort((a,b)=>Date.parse(a.eventAt)-Date.parse(b.eventAt))[0]:null;
 return <div className="event-entry-tag">{next&&<span>Next {next.name} · {eventClock(next.eventAt,session.displayTimeZone)}</span>}{events.length>0&&<span>Within {events.map(e=>e.name).join(' · ')}</span>}{onOpen&&<button type="button" disabled={disabled} onClick={onOpen}>{events.length?'Events':'＋ Event'}</button>}</div>;
}

/** One form for manual events from Context, the dashboard and price entry. */
export function EventCaptureForm({session,item,onSave,onCancel,onBusy}:{session:JournalSession;item:MarketContextItem|null;onSave:(update:MarketContextUpdate,time:string)=>Promise<string|null>;onCancel:()=>void;onBusy?:(busy:boolean)=>void}){
 const opened=useRef(Temporal.Now.instant().toString()),zone=session.displayTimeZone;
 const clock=workspaceClock(session,opened.current),defaultAt=item?.eventAt??(clock.current&&!clock.closed?opened.current:null),window=item?eventObservationWindow(item):null;
 const [name,setName]=useState(item?.name??''),[release,setRelease]=useState(defaultAt?local(defaultAt,zone):''),[start,setStart]=useState(window?local(window.startAt,zone):defaultAt?local(defaultAt,zone):'');
 const savedMinutes=window?.endAt?String((Date.parse(window.endAt)-Date.parse(window.startAt))/60000):'5';
 const [duration,setDuration]=useState(trackingDurations.includes(savedMinutes)?savedMinutes:'custom'),[end,setEnd]=useState(window?.endAt?local(window.endAt,zone):defaultAt?local(Temporal.Instant.from(defaultAt).add({minutes:5}).toString(),zone):'');
 const [ongoing,setOngoing]=useState(!!window&&window.endAt===null),[note,setNote]=useState(item?.note??''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),saving=useRef(false),formId=useId();
 const [windowOpen,setWindowOpen]=useState(!!window&&(window.startAt!==item?.eventAt||!trackingDurations.includes(savedMinutes)));
 const input=useRef<HTMLInputElement>(null);useEffect(()=>{const id=requestAnimationFrame(()=>input.current?.focus());return()=>cancelAnimationFrame(id);},[]);
 const adjustEnd=(from:string,minutes:string)=>{if(from&&minutes!=='custom'){try{setEnd(local(Temporal.Instant.from(instant(from,zone)).add({minutes:Number(minutes)}).toString(),zone));}catch{}}};
 return <form id={formId} className="event-capture" aria-label={item?'Edit event':'Add event'} onSubmit={async e=>{e.preventDefault();if(saving.current)return;saving.current=true;setBusy(true);onBusy?.(true);setError(null);try{
   if(!release||!start||!ongoing&&!end)throw Error('Enter the event and tracking window times.');
   const releaseAt=instant(release,zone),startAt=instant(start,zone),endAt=ongoing?null:instant(end,zone);
   const date=Temporal.Instant.from(releaseAt).toZonedDateTimeISO(zone).toPlainDate().toString();
   const message=await onSave({name,eventDate:date,note,observationWindow:{startAt,endAt,recordedAt:Temporal.Now.instant().toString()}},Temporal.Instant.from(releaseAt).toZonedDateTimeISO(zone).toPlainTime().toString({smallestUnit:'second'}));setError(message);
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Your input is preserved.');}finally{saving.current=false;setBusy(false);onBusy?.(false);}}}>
  <div className="event-form-toolbar"><h3>{item?'Edit event':'Add event'}</h3><div><button type="submit" className="workspace-save" disabled={busy}>{busy?'Saving…':'Save event'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div></div>
  <label className="event-name-field">Event name<input ref={input} aria-label="Event name" value={name} required placeholder="CPI, PPI, FOMC, earnings…" readOnly={busy} onChange={e=>setName(e.target.value)}/></label>
  <label className="event-note-field"><span>Event notes <small>optional</small></span><textarea aria-label="Event note" placeholder="What are you watching or recording?" rows={3} value={note} readOnly={busy} onChange={e=>setNote(e.target.value)}/></label>
  <section className="event-schedule" aria-label="Event timing"><h4>Time &amp; tracking <span>{new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'short'}).formatToParts(new Date(defaultAt??opened.current)).find(p=>p.type==='timeZoneName')?.value}</span></h4>
   <EventTimeField label="Release / event time" name="Event time" value={release} date={session.rthDate} disabled={busy} onChange={value=>{setRelease(value);if(start===release){setStart(value);adjustEnd(value,duration);}}}/>
   <label className="event-duration-field">Track for<select aria-label="Tracking duration" value={ongoing?'ongoing':duration} disabled={busy} onChange={e=>{const value=e.target.value;setOngoing(value==='ongoing');if(value!=='ongoing'){setDuration(value);adjustEnd(start,value);}if(value==='custom')setWindowOpen(true);}}>{trackingDurations.map(value=><option key={value} value={value}>{value} {value==='1'?'minute':'minutes'}</option>)}<option value="custom">Custom window</option><option value="ongoing">Until I end it</option></select></label>
   <p className="event-tracking-hint">Timed prices inside this window build its recorded range.</p>
   <details className="event-window-adjust" open={windowOpen} onToggle={e=>setWindowOpen(e.currentTarget.open)}><summary>Adjust tracking window</summary>
    <EventTimeField label="Tracking starts" name="Tracking starts" value={start} date={release.split('T')[0]||session.rthDate} disabled={busy} onChange={value=>{setStart(value);adjustEnd(value,duration);}}/>
    {!ongoing&&<EventTimeField label="Tracking ends" name="Tracking ends" value={end} date={start.split('T')[0]||session.rthDate} disabled={busy} onChange={value=>{setDuration('custom');setEnd(value);}}/>}
   </details>
  </section>
  {error&&<p role="alert">{error}</p>}
 </form>;
}
export function EventsWorkspace({session,onSave,onRemove,onUndo,undoAvailable,onContext,onBusy,onSaved}:{session:JournalSession;onSave:(update:MarketContextUpdate,time:string,id:string|null)=>Promise<string|null>;onRemove:(id:string)=>Promise<string|null>;onUndo:()=>Promise<string|null>;undoAvailable:boolean;onContext?:()=>void;onBusy?:(busy:boolean)=>void;onSaved?:()=>void}){
 const [editing,setEditing]=useState<MarketContextItem|null|undefined>(),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),[saved,setSaved]=useState(''),[now,setNow]=useState(()=>Temporal.Now.instant().toString());
 useEffect(()=>{const id=setInterval(()=>setNow(Temporal.Now.instant().toString()),1000);return()=>clearInterval(id);},[]);
 const perform=async(action:()=>Promise<string|null>,message:string)=>{if(busy)return;setBusy(true);onBusy?.(true);try{const error=await action();setError(error);if(!error)setSaved(message);}catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{setBusy(false);onBusy?.(false);}};
 if(editing!==undefined)return <EventCaptureForm key={editing?.id??'new'} session={session} item={editing} onBusy={onBusy} onCancel={()=>setEditing(undefined)} onSave={async(update,time)=>{const error=await onSave(update,time,editing?.id??null);if(!error){setEditing(undefined);setSaved('Event saved.');onSaved?.();}return error;}}/>;
 const events=session.marketContextItems.filter(i=>!i.holiday);
 return <section className="events-workspace" aria-label="Session events"><header><div><h3>Session events</h3><p>{events.length} {events.length===1?'event':'events'} recorded</p></div><button className="workspace-save" type="button" disabled={busy} onClick={()=>setEditing(null)}>＋ Add event</button></header>
  {error&&<p role="alert">{error}</p>}{(saved||undoAvailable)&&<p role="status">{saved||'Recent event change'}{undoAvailable&&<button type="button" disabled={busy} onClick={()=>void perform(onUndo,'Change undone.')}>Undo</button>}</p>}
  {!events.length&&<div className="event-empty"><strong>No events recorded yet</strong><p>Add CPI, FOMC or your own event. Choose a time and tracking window; keep your observations and notes together.</p></div>}
  {events.map(item=>{const range=deriveEventWindowRange(session,item,now);return <article key={item.id}><h4>{item.name} <small>{eventClock(item.eventAt,session.displayTimeZone)}</small></h4><EventRangeSummary session={session} item={item} now={now}/>{item.note&&<div className="event-saved-note"><h5>Event notes</h5><p>{item.note}</p></div>}
   <div className="event-actions"><button type="button" disabled={busy} onClick={()=>setEditing(item)}>Edit event</button>{range?.state==='recording'&&<button type="button" disabled={busy} onClick={()=>void perform(()=>onSave({name:item.name,eventDate:Temporal.Instant.from(item.eventAt).toZonedDateTimeISO(session.displayTimeZone).toPlainDate().toString(),note:item.note,observationWindow:{startAt:range.window.startAt,endAt:Temporal.Now.instant().toString(),recordedAt:now}},Temporal.Instant.from(item.eventAt).toZonedDateTimeISO(session.displayTimeZone).toPlainTime().toString({smallestUnit:'second'}),item.id),'Event window ended.')}>End now</button>}<button type="button" disabled={busy} aria-label={`Remove event ${item.name}`} onClick={()=>void perform(()=>onRemove(item.id),'Event removed.')}>Remove</button></div>
  </article>;})}{onContext&&<button type="button" disabled={busy} onClick={onContext}>Day context &amp; holidays</button>}
 </section>;
}
