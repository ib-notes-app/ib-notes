// SPDX-License-Identifier: MPL-2.0
import {useEffect,useLayoutEffect,useRef} from 'react';
import {workspaceEntryClockText,workspaceEntryClockValue} from './workspaceEntryTime';
import type {MarketContextItem} from '@ib-field-notes/domain';

type NoteFormat='bullets'|'numbers'|'paragraph';
/** Plain-text formatting stays readable in existing notes, exports and share selections. */
export function formatEntryNote(value:string,start:number,end:number,format:NoteFormat){
 if(format==='paragraph'){const text=value.slice(0,start)+'\n\n'+value.slice(end);return {text,start:start+2,end:start+2};}
 const from=start===0?0:value.lastIndexOf('\n',start-1)+1;
 const last=end>start&&value[end-1]==='\n'?end-1:end;
 const next=value.indexOf('\n',last),to=next<0?value.length:next;
 const lines=value.slice(from,to).split('\n'),remove=format==='bullets'&&lines.every(line=>line.startsWith('• '));
 const text=lines.map((line,i)=>{const plain=line.replace(/^(?:• |\d+\. )/,'');return remove?plain:`${format==='bullets'?'• ':`${i+1}. `}${plain}`;}).join('\n');
 const result=value.slice(0,from)+text+value.slice(to),cursor=from+text.length;
 return {text:result,start:cursor,end:cursor};
}

export function WorkspaceNoteComposer({formId,value,onChange,onSubmit,busy,error,priceLabel,time,onTimeChange,events=[],eventId,onEventChange}:{formId:string;value:string;onChange:(value:string)=>void;onSubmit:()=>Promise<void>;busy:boolean;error:string|null;priceLabel?:string;time:string;onTimeChange:(time:string)=>void;events?:MarketContextItem[];eventId?:string;onEventChange?:(id:string)=>void}){
 const input=useRef<HTMLTextAreaElement>(null),selection=useRef<{start:number;end:number}|null>(null);
 useLayoutEffect(()=>{const node=input.current;if(!node)return;const dialog=node.closest('dialog');if(dialog)dialog.scrollTop=0;node.focus({preventScroll:true});},[]);
 useEffect(()=>{const node=input.current,viewport=window.visualViewport;if(!node)return;
  let frame=0;const reveal=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(document.activeElement!==node)return;const form=node.closest('form');if(!form)return;const paper=node.getBoundingClientRect(),box=form.getBoundingClientRect();if(paper.bottom>box.bottom)form.scrollTop+=paper.bottom-box.bottom;else if(paper.top<box.top)form.scrollTop-=box.top-paper.top;});};
  reveal();viewport?.addEventListener('resize',reveal);window.addEventListener('resize',reveal);
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',reveal);window.removeEventListener('resize',reveal);};
 },[]);
 useLayoutEffect(()=>{if(selection.current&&input.current){input.current.focus({preventScroll:true});input.current.setSelectionRange(selection.current.start,selection.current.end);selection.current=null;}},[value]);
 const format=(kind:NoteFormat)=>{const node=input.current;if(!node)return;const next=formatEntryNote(value,node.selectionStart,node.selectionEnd,kind);selection.current=next;onChange(next.text);};
 return <form id={formId} className="workspace-note-composer" onSubmit={e=>{e.preventDefault();void onSubmit();}}>
  <div className="workspace-note-reference"><strong>{priceLabel||'Note only · No price'}</strong><label className="workspace-note-clock"><span>{time?workspaceEntryClockText(workspaceEntryClockValue(time)):'Set time'}</span>
   <input type="time" step="1" aria-label="Note observed at" value={workspaceEntryClockValue(time)} disabled={busy}
    onClick={e=>{try{e.currentTarget.showPicker?.();}catch{e.currentTarget.focus();}}}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();input.current?.focus({preventScroll:true});}}}
    onChange={e=>onTimeChange(workspaceEntryClockText(e.target.value))}/></label></div>
  <div className="workspace-note-format" role="group" aria-label="Note formatting">
   <button type="button" disabled={busy} onPointerDown={e=>e.preventDefault()} onClick={()=>format('bullets')}>• Bullets</button>
   <button type="button" disabled={busy} onPointerDown={e=>e.preventDefault()} onClick={()=>format('numbers')}>1. List</button>
   <button type="button" aria-label="¶ Paragraph" title="New paragraph" disabled={busy} onPointerDown={e=>e.preventDefault()} onClick={()=>format('paragraph')}>¶</button>
   {events.length>0&&onEventChange&&<select aria-label="Note event" title={events.find(e=>e.id===eventId)?.name??'Attach note to event (optional)'} value={eventId??''} disabled={busy} onChange={e=>onEventChange(e.target.value)}><option value="">Event</option>{events.filter(e=>!e.holiday).map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select>}
  </div>
  {error&&<p role="alert">{error}</p>}
  <label className="workspace-note-paper"><span className="workspace-visually-hidden">Entry note</span><textarea ref={input} aria-label="Entry note" placeholder="What did you notice?" value={value} readOnly={busy} onChange={e=>onChange(e.target.value)}/></label>
 </form>;
}
