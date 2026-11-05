// SPDX-License-Identifier: MPL-2.0
import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {WorkspaceDialog} from './WorkspaceDialog';

/** One writing layer in the existing native dialog; keep its source mounted. */
export function WorkspaceWritingView({title,context,onDone,children}:{title:string;context:string;onDone:()=>void;children:ReactNode}){
 const anchor=useRef<HTMLSpanElement>(null),panel=useRef<HTMLElement>(null),id=useId(),done=useRef(onDone);done.current=onDone;
 const [host,setHost]=useState<HTMLDialogElement|null|undefined>(undefined);
 const dismiss=()=>{if(window.history.state?.ibWritingView===id)window.history.back();else done.current();};
 useLayoutEffect(()=>{setHost(anchor.current?.closest('dialog')??null);},[]);
 useLayoutEffect(()=>{
  if(host===undefined)return;
  const node=panel.current,prior=document.activeElement as HTMLElement|null;
  if(!node)return;
  const siblings=host?[...host.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&child!==node):[];
  const saved=siblings.map(child=>({child,inert:child.inert,aria:child.getAttribute('aria-hidden')}));
  const labelled=host?.getAttribute('aria-labelledby'),scroll=host?.scrollTop??0;
  if(host){host.classList.add('workspace-writing-host');host.setAttribute('aria-labelledby',`${id}-heading`);host.scrollTop=0;}
  const input=node.querySelector<HTMLTextAreaElement>('textarea');input?.focus({preventScroll:true});
  if(input)input.setSelectionRange(input.value.length,input.value.length);
  for(const {child} of saved){child.inert=true;child.setAttribute('aria-hidden','true');}
  if(window.history.state?.ibWritingView!==id)window.history.pushState({...window.history.state,ibWritingView:id},'',window.location.href);
  const back=()=>{if(window.history.state?.ibWritingView!==id)done.current();};
  const cancel=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();dismiss();};
  const modal=host??node.closest('dialog'),focusRoot=host?node:modal??node;
  const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;
   const controls=[...focusRoot.querySelectorAll<HTMLElement>('button,input,textarea,select,a[href],[tabindex]')].filter(control=>control.tabIndex>=0&&!control.hasAttribute('disabled')&&control.getClientRects().length);
   const first=controls[0],last=controls.at(-1),active=document.activeElement;
   if(first&&last&&(!focusRoot.contains(active)||event.shiftKey&&active===first||!event.shiftKey&&active===last)){event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});}
  };
  modal?.addEventListener('keydown',trap);
  window.addEventListener('popstate',back);host?.addEventListener('cancel',cancel,true);
  return()=>{
   window.removeEventListener('popstate',back);host?.removeEventListener('cancel',cancel,true);modal?.removeEventListener('keydown',trap);
   for(const {child,inert,aria} of saved){child.inert=inert;if(aria===null)child.removeAttribute('aria-hidden');else child.setAttribute('aria-hidden',aria);}
   if(host){host.classList.remove('workspace-writing-host');if(labelled==null)host.removeAttribute('aria-labelledby');else host.setAttribute('aria-labelledby',labelled);host.scrollTop=scroll;}
   prior?.focus({preventScroll:true});
   queueMicrotask(()=>{if(!panel.current?.isConnected&&window.history.state?.ibWritingView===id)window.history.back();});
  };
 },[host,id]);
 const body=<section ref={panel} className={`workspace-writing-panel${host?' workspace-writing-overlay':''}`} aria-label={`${title} editor`}>
  {host&&<header><h2 id={`${id}-heading`}>{title}</h2><button className="workspace-save" type="button" onClick={dismiss}>Done</button></header>}
  <p className="workspace-sheet-target">{context}</p>{children}
 </section>;
 return <><span ref={anchor} hidden/>{host===undefined?null:host?createPortal(body,host):
  <WorkspaceDialog title={title} className="workspace-writing-sheet" onClose={dismiss} dismissLabel="Done" dismissAriaLabel="Done" initialFocus="textarea">{body}</WorkspaceDialog>}</>;
}
