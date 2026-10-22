// SPDX-License-Identifier: MPL-2.0
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {createPortal} from 'react-dom';

/** Native modal semantics, outside any animated/transformed application ancestor. */
export function WorkspaceDialog({title,children,onClose,busy=false,className='',dismissLabel='Close',headerAction,dismissAriaLabel,manageHistory=false}:{title:string;children:ReactNode;
 onClose:()=>void;busy?:boolean;className?:string;dismissLabel?:'Close'|'Cancel'|'Cancel/Close'|'Back to Review day'|'Back to price entry'|'Back to period';headerAction?:ReactNode;dismissAriaLabel?:string;manageHistory?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const historyId=useId(),closeRef=useRef(onClose);closeRef.current=onClose;
 const dismiss=()=>{if(busy)return;if(manageHistory&&window.history.state?.ibWorkspaceDialog===historyId)window.history.back();else onClose();};
 useEffect(()=>{
  const node=dialog.current!,prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  if(manageHistory&&window.history.state?.ibWorkspaceDialog!==historyId)window.history.pushState({...window.history.state,ibWorkspaceDialog:historyId},'',window.location.href);
  const back=()=>{if(manageHistory&&window.history.state?.ibWorkspaceDialog!==historyId)closeRef.current();};
  if(manageHistory)window.addEventListener('popstate',back);
  document.body.style.overflow='hidden';node.showModal();
  const viewport=window.visualViewport;
  const resize=()=>{
   const height=viewport?.height??innerHeight,top=viewport?.offsetTop??0;
   node.style.setProperty('--workspace-viewport-height',`${height}px`);
   node.style.setProperty('--workspace-viewport-top',`${top}px`);
   node.style.setProperty('--workspace-keyboard-bottom',`${Math.max(0,innerHeight-height-top)}px`);
  };
  resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  return()=>{window.removeEventListener('popstate',back);
    viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);node.close();document.body.style.overflow=overflow;prior?.focus({preventScroll:true});
    // StrictMode remounts effects immediately; only unwind a genuinely closed dialog.
    if(manageHistory)queueMicrotask(()=>{if(!node.open&&window.history.state?.ibWorkspaceDialog===historyId)window.history.back();});
  };
 },[]);
 return createPortal(<dialog ref={dialog} className={`workspace-sheet ${className}`} aria-label={title}
  onCancel={e=>{e.preventDefault();dismiss();}}>
  <header><h2>{title}</h2>{headerAction}<button type="button" aria-label={dismissAriaLabel??(className.includes('calendar')?'Close calendar':`${dismissLabel} price entry`)} disabled={busy} onClick={dismiss}>{dismissLabel}</button></header>
  {children}
 </dialog>,document.body);
}
