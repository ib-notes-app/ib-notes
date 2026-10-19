// SPDX-License-Identifier: MPL-2.0
import {useRef,useState,type ReactNode} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {type FifteenMinuteUpdate,type JournalSession} from '@ib-field-notes/domain';
import {type SessionTimelineItem} from './dayTimelineModel';
import {type WorkspacePhase} from './workspaceModel';

/** The existing range commands are supplied by App, with the selected phase frozen. */
export function WorkspaceRangeEditor({phase,high,low,note,openPrice,showCommentary=true,onSave,formId,completed=false,rangeAt,timeZone}:{phase:WorkspacePhase;high:number|null;low:number|null;note?:string|null;openPrice?:number|null;showCommentary?:boolean;formId:string;completed?:boolean;rangeAt:string;timeZone:string;
 onSave:(update:FifteenMinuteUpdate&{rthOpen?:number|null},at:string)=>Promise<string|null>}){
 const [h,setHigh]=useState(high===null?'':String(high)),[l,setLow]=useState(low===null?'':String(low));
 const [open,setOpen]=useState(openPrice==null?'':String(openPrice));
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
  <label>{phase} high<input type="text" inputMode="decimal" autoComplete="off" value={h} disabled={busy} onChange={e=>setHigh(e.target.value)}/></label>
  <label>{phase} low<input type="text" inputMode="decimal" autoComplete="off" value={l} disabled={busy} onChange={e=>setLow(e.target.value)}/></label>
  </div>
  {openPrice!==undefined&&<label>RTH open (optional)<input inputMode="decimal" value={open} disabled={busy} onChange={e=>setOpen(e.target.value)}/></label>}
  <details><summary>Range time</summary><label>Range known by<input type="datetime-local" step="1" value={time} disabled={busy} onChange={e=>setTime(e.target.value)}/></label><p>This records when the range was known, not the exact occurrence of either extreme.</p></details>
  {showCommentary&&<details><summary>Commentary</summary><label>Period commentary<textarea value={comment} disabled={busy} onChange={e=>setComment(e.target.value)}/></label></details>}
  {error&&<p role="alert">{error}</p>}
 </form>;
}

export function WorkspacePhaseRecords({session,items,renderActions}:{session:JournalSession;items:SessionTimelineItem[];
 renderActions:(item:SessionTimelineItem,done:()=>void)=>ReactNode}){
 const [selected,setSelected]=useState<string|null>(null);
 if(!items.length)return <p>No records in this phase yet.</p>;
 return <ol className="workspace-period-records" aria-label="Selected phase records">{items.map(item=><li key={item.id}>
  <button type="button" aria-expanded={selected===item.id} onClick={()=>setSelected(selected===item.id?null:item.id)}>
   <time>{new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(item.sortAt))}</time>
   <strong>{item.label}</strong><span>{item.detail}</span>
  </button>
  {selected===item.id&&renderActions(item,()=>setSelected(null))}
 </li>)}</ol>;
}
