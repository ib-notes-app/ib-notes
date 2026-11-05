// SPDX-License-Identifier: MPL-2.0
import {useLayoutEffect,useRef,useState} from 'react';
import {WorkspaceWritingView} from './WorkspaceWritingView';
import {formatEntryNote} from './WorkspaceNoteComposer';

/** Keep text local while writing; apply one complete draft on Done/Back. */
export function ShareCommentaryEditor({initialText,context,onDraft,onCommit}:{initialText:string;context:string;onDraft:(text:string)=>void;onCommit:(text:string)=>void}){
 const [text,setText]=useState(initialText),field=useRef<HTMLTextAreaElement>(null),selection=useRef<{start:number;end:number}|null>(null);
 const latest=useRef(text);latest.current=text;
 const change=(value:string)=>{latest.current=value;setText(value);onDraft(value);};
 useLayoutEffect(()=>{if(selection.current&&field.current){field.current.focus({preventScroll:true});field.current.setSelectionRange(selection.current.start,selection.current.end);selection.current=null;}},[text]);
 const format=(kind:'bullets'|'numbers'|'paragraph')=>{const node=field.current;if(!node)return;const next=formatEntryNote(text,node.selectionStart,node.selectionEnd,kind);selection.current=next;change(next.text);};
 return <WorkspaceWritingView title="Commentary" context={context} onDone={()=>onCommit(latest.current)}>
  <div className="workspace-writing-tools workspace-note-format" role="group" aria-label="Commentary formatting">
   <button type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>format('bullets')}>• Bullets</button>
   <button type="button" onPointerDown={e=>e.preventDefault()} onClick={()=>format('numbers')}>1. List</button>
   <button type="button" aria-label="¶ Paragraph" title="New paragraph" onPointerDown={e=>e.preventDefault()} onClick={()=>format('paragraph')}>¶</button>
  </div>
  <label className="workspace-writing-paper"><span className="workspace-visually-hidden">Your commentary</span>
   <textarea ref={field} aria-label="Your commentary" aria-describedby="share-commentary-help" placeholder="Your take on this session…" value={text} onChange={event=>change(event.target.value)}/>
  </label>
  <small id="share-commentary-help">For this image card. Your journal is unchanged.</small>
 </WorkspaceWritingView>;
}
