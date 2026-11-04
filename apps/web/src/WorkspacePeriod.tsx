// SPDX-License-Identifier: MPL-2.0
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {type FifteenMinuteUpdate,type JournalSession} from '@ib-field-notes/domain';
import {compareTimelineItems,reviewTimelinePrices,timelineClockLabel,timelineMatches,timelinePage,type SessionTimelineItem,type TimelineCursor} from './dayTimelineModel';
import {workspaceFormatPrice,type WorkspacePhase} from './workspaceModel';

/** The existing range commands are supplied by App, with the selected phase frozen. */
export function WorkspaceRangeEditor({phase,high,low,note,openPrice,showCommentary=true,onSave,formId,completed=false,rangeAt,timeZone,focusField,attention={}}:{phase:WorkspacePhase;high:number|null;low:number|null;note?:string|null;openPrice?:number|null;showCommentary?:boolean;formId:string;completed?:boolean;rangeAt:string;timeZone:string;focusField?:'high'|'low'|'open';attention?:Partial<Record<'high'|'low',string>>;
 onSave:(update:FifteenMinuteUpdate&{rthOpen?:number|null},at:string)=>Promise<string|null>}){
 const [h,setHigh]=useState(high===null?'':String(high)),[l,setLow]=useState(low===null?'':String(low));
 const [open,setOpen]=useState(openPrice==null?'':String(openPrice));
 const focusInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!focusField)return;const frame=requestAnimationFrame(()=>focusInput.current?.focus());return()=>cancelAnimationFrame(frame);},[focusField]);
 const previous=useRef({high,low,openPrice});
 useEffect(()=>{const old=previous.current,fmt=(v:number|null|undefined)=>v==null?'':String(v);previous.current={high,low,openPrice};setHigh(v=>v===fmt(old.high)?fmt(high):v);setLow(v=>v===fmt(old.low)?fmt(low):v);setOpen(v=>v===fmt(old.openPrice)?fmt(openPrice):v);},[high,low,openPrice]);
 const [comment,setComment]=useState(note??'');
 const [time,setTime]=useState(()=>Temporal.Instant.from(rangeAt).toZonedDateTimeISO(timeZone).toPlainDateTime().toString({smallestUnit:'second'}));
 const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),submitting=useRef(false);
 return <form id={formId} className="workspace-range-form" onSubmit={async e=>{e.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError(null);
  try{const parse=(value:string)=>value.trim()?Number(value):null;
   if([h,l,open].some(v=>v.trim()&&!Number.isFinite(Number(v))))throw Error('Enter valid prices.');
   if(!time)throw Error('Enter when this range was known.');
   const at=Temporal.PlainDateTime.from(time).toZonedDateTime(timeZone,{disambiguation:'reject'}).toInstant().toString();
   setError(await onSave({high:parse(h),low:parse(l),cp:null,note:comment,...(openPrice!==undefined?{rthOpen:parse(open)}:{})},at));
  }catch(e){setError(e instanceof Error?e.message:'Unable to save.');}finally{submitting.current=false;setBusy(false);}}}>
  <p className="workspace-range-help">{completed?'Completed period range':'Range so far'} · CP stays separate.</p>
  <div className="workspace-range-edges">
  <label data-attention={!h.trim()||!!attention.high}>{phase} high<input aria-label={`${phase} high`} ref={focusField==='high'?focusInput:undefined} type="text" inputMode="decimal" autoFocus={focusField==='high'} autoComplete="off" value={h} disabled={busy} aria-describedby={!h.trim()||attention.high?`${formId}-high-help`:undefined} onChange={e=>setHigh(e.target.value)}/>{(!h.trim()||attention.high)&&<small id={`${formId}-high-help`}>{attention.high??'High not recorded · Enter if known.'}</small>}</label>
  <label data-attention={!l.trim()||!!attention.low}>{phase} low<input aria-label={`${phase} low`} ref={focusField==='low'?focusInput:undefined} type="text" inputMode="decimal" autoFocus={focusField==='low'} autoComplete="off" value={l} disabled={busy} aria-describedby={!l.trim()||attention.low?`${formId}-low-help`:undefined} onChange={e=>setLow(e.target.value)}/>{(!l.trim()||attention.low)&&<small id={`${formId}-low-help`}>{attention.low??'Low not recorded · Enter if known.'}</small>}</label>
  </div>
  {openPrice!==undefined&&<label>RTH open (optional)<input ref={focusField==='open'?focusInput:undefined} inputMode="decimal" autoFocus={focusField==='open'} value={open} disabled={busy} onChange={e=>setOpen(e.target.value)}/></label>}
  <details><summary>Range time</summary><label>Range known by<input type="datetime-local" step="1" value={time} disabled={busy} onChange={e=>setTime(e.target.value)}/></label><p>This records when the range was known, not the exact occurrence of either extreme.</p></details>
  {showCommentary&&<details><summary>Commentary</summary><label>Period commentary<textarea value={comment} disabled={busy} onChange={e=>setComment(e.target.value)}/></label></details>}
  {error&&<p role="alert">{error}</p>}
 </form>;
}

export type WorkspaceRecordSelection={id:string;canEdit:boolean;kind?:'note'}|null;
export type WorkspaceRecordControls={selection:WorkspaceRecordSelection;onSelect:(selection:WorkspaceRecordSelection)=>void;onSaved:()=>void;formId:string;onBusy:(busy:boolean)=>void};

/** A focused browser over the existing observations, not a separate journal. */
export function WorkspacePhaseRecords({session,items,reviewItems=items,controls,latestId,canEdit,renderActions}:{session:JournalSession;items:SessionTimelineItem[];reviewItems?:SessionTimelineItem[];
 controls:WorkspaceRecordControls;latestId?:string;canEdit:(item:SessionTimelineItem)=>boolean;
 renderActions:(item:SessionTimelineItem,done:()=>void)=>ReactNode}){
 const [query,setQuery]=useState(''),[unusualOnly,setUnusualOnly]=useState(false),[cursor,setCursor]=useState<TimelineCursor>(null);
 const reviews=useMemo(()=>reviewTimelinePrices(reviewItems,session.market.tickSize),[reviewItems,session.market.tickSize]);
 const unusualCount=items.filter(item=>reviews.has(item.id)).length;
 const filtered=items.filter(item=>(!unusualOnly||reviews.has(item.id))&&(!query.trim()||timelineMatches(item,query,session))).sort((a,b)=>
  Temporal.Instant.compare(a.sortAt,b.sortAt)||Temporal.Instant.compare(a.recordedAt??a.sortAt,b.recordedAt??b.sortAt)||compareTimelineItems(a,b));
 const page=timelinePage(filtered,cursor),selected=items.find(item=>item.id===controls.selection?.id);
 const buttons=useRef(new Map<string,HTMLButtonElement>()),priorSelection=useRef<string|null>(null);
 useEffect(()=>{
  if(priorSelection.current&&!selected)buttons.current.get(priorSelection.current)?.focus({preventScroll:true});
  priorSelection.current=selected?.id??null;
 },[selected?.id]);
 const review=selected&&reviews.get(selected.id);
 if(selected)return <section className="workspace-record-editor" aria-label="Selected entry">
  <div className="workspace-selected-record"><strong>{selected.label}</strong><time dateTime={selected.sortAt}>Observed {recordClock(selected.sortAt,session.displayTimeZone)}</time></div>
  {renderActions(selected,()=>controls.onSelect(null))}
  {review&&<details className="workspace-price-review"><summary>Unusual price · Check</summary>
   <p>This value is far from nearby recorded prices. A real move can also qualify.</p>
   <p>Nearby: {review.neighbors.slice(0,3).map(p=>`${p.price} at ${timelineClockLabel(p.at,session.displayTimeZone)}`).join(' · ')}.</p>
   <p>Keep it if correct. It remains included in your journal calculations.</p>
  </details>}
 </section>;
 return <section className="workspace-record-browser" aria-label="Browse phase entries">
  <div className="workspace-record-tools">
   <label>Find price or time<input type="search" placeholder="Price, time or note" value={query} onChange={event=>{setQuery(event.target.value);setCursor(null);}}/></label>
   {(unusualCount>0||unusualOnly)&&<button type="button" className="workspace-unusual-filter" aria-pressed={unusualOnly} onClick={()=>{setUnusualOnly(!unusualOnly);setCursor(null);}}>Unusual prices · {unusualCount}</button>}
  </div>
  <p className="workspace-record-count" role="status">{query.trim()||unusualOnly?`${filtered.length} matching entries`:items.length?`${items.length} entries · Newest first`:'No records in this phase yet.'}</p>
  <ol className="workspace-period-records" aria-label="Selected phase records">{page.items.slice().reverse().map(item=><li key={item.id} data-review={reviews.has(item.id)}>
   <button type="button" aria-label={`${item.label} ${item.detail} at ${recordClock(item.sortAt,session.displayTimeZone)}${item.id===latestId?' · Latest CP':''}${reviews.has(item.id)?' · Unusual price':''}`} ref={node=>{if(node)buttons.current.set(item.id,node);else buttons.current.delete(item.id);}} onClick={()=>controls.onSelect({id:item.id,canEdit:canEdit(item),...(item.id.startsWith('timeline:note:')?{kind:'note' as const}:{})})}>
    <span className="workspace-record-row-heading"><time dateTime={item.sortAt}>{recordClock(item.sortAt,session.displayTimeZone)}</time>{item.id===latestId&&<span className="workspace-latest-tag">Latest CP</span>}</span>
    <strong>{item.price==null?item.label:workspaceFormatPrice(item.price,session.market.tickSize)}</strong>
    <span>{item.price==null?item.detail:item.label}</span>
    {reviews.has(item.id)&&<span className="workspace-unusual-tag">⚑ Unusual price · Check</span>}
   </button>
  </li>)}</ol>
  {filtered.length===0&&items.length>0&&<p>No matching entries. <button type="button" onClick={()=>{setQuery('');setUnusualOnly(false);setCursor(null);}}>Clear filters</button></p>}
  {filtered.length>25&&<nav className="workspace-record-paging" aria-label="Phase entry pages">
   <button type="button" disabled={!page.hasNewer} onClick={()=>setCursor(page.newer)}>Newer entries</button>
   <span>{page.total-page.end+1}–{page.total-page.start} / {page.total}</span>
   <button type="button" disabled={!page.hasEarlier} onClick={()=>setCursor(page.earlier)}>Older entries</button>
  </nav>}
 </section>;
}

function recordClock(at:string,zone:string){return Temporal.Instant.from(at).toZonedDateTimeISO(zone).toLocaleString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'});}

/** Edit existing commentary without changing its attachment or creating price evidence. */
export function WorkspaceEntryNoteEditor({text,attachment,formId,onSave,onBusy}:{text:string;attachment?:string;formId:string;onSave:(text:string)=>Promise<string|null>;onBusy:(busy:boolean)=>void}){
 const [value,setValue]=useState(text),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),submitting=useRef(false);
 const input=useRef<HTMLTextAreaElement>(null);useEffect(()=>{input.current?.focus({preventScroll:true});},[]);
 return <form id={formId} className="workspace-note-editor" onSubmit={async e=>{e.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);onBusy(true);setError(null);
  try{setError(await onSave(value));}catch(e){setError(e instanceof Error?e.message:'Unable to save. Your note is preserved.');}finally{submitting.current=false;setBusy(false);onBusy(false);}}}>
  {attachment&&<p className="workspace-note-attachment">{attachment}</p>}
  <label className="workspace-correction-note"><span>Entry note</span><textarea ref={input} aria-label="Entry note" rows={5} value={value} disabled={busy} onChange={e=>setValue(e.target.value)} placeholder="What did you notice?"/></label>
  {error&&<p role="alert">{error}</p>}
 </form>;
}
