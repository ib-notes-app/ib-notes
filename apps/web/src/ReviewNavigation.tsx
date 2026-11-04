// SPDX-License-Identifier: MPL-2.0
import {createContext,useContext,useLayoutEffect,useRef} from 'react';
import type {JournalSession} from '@ib-field-notes/domain';

export function reuseJournalHistory(current:JournalSession[],incoming:JournalSession[]):JournalSession[] {
  const previous=new Map(current.map(day=>[day.id,day]));
  const merged=incoming.map(day=>{
    const old=previous.get(day.id);
    return old&&(old===day||old.updatedAt===day.updatedAt&&JSON.stringify(old)===JSON.stringify(day))?old:day;
  });
  if(merged.length===current.length&&merged.every((day,index)=>day===current[index]))return current;
  return merged.every((day,index)=>day===incoming[index])?incoming:merged;
}

type Snapshot={y:number;disclosures:Map<string,boolean>};
function disclosures(root:HTMLElement) {
  const result=new Map<string,HTMLDetailsElement>(),paths=new Map<Element,string>(),seen=new Map<string,number>();
  for(const detail of root.querySelectorAll('details')) {
    const summary=detail.querySelector(':scope > summary');
    const label=summary?.getAttribute('aria-label')??summary?.textContent?.trim()??'';
    const parent=detail.parentElement?.closest('details');
    const item=detail.closest('[data-review-item]')?.getAttribute('data-review-item')??'';
    const prefix=`${parent?paths.get(parent)??'':item}/${label}`;
    const occurrence=seen.get(prefix)??0;seen.set(prefix,occurrence+1);
    const key=`${prefix}:${occurrence}`;paths.set(detail,key);result.set(key,detail);
  }
  return result;
}

/** In-memory view positions only. No journal records or browser history writes. */
export class ReviewScrollMemory {
  private snapshots=new Map<string,Snapshot>();
  private current:{key:string;root:HTMLElement}|null=null;
  private observer:ResizeObserver|null=null;

  cancelRestore=()=>{this.observer?.disconnect();this.observer=null;};
  capture=()=>{
    this.cancelRestore();
    if(!this.current?.root.isConnected)return;
    const {key,root}=this.current;
    this.snapshots.delete(key);
    this.snapshots.set(key,{y:window.scrollY,disclosures:new Map([...disclosures(root)].map(([id,detail])=>[id,detail.open]))});
    while(this.snapshots.size>120)this.snapshots.delete(this.snapshots.keys().next().value!);
  };
  activate(key:string,root:HTMLElement) {
    this.cancelRestore();this.current={key,root};
    const snapshot=this.snapshots.get(key);
    const restore=()=>{
      if(this.current?.key!==key||this.current.root!==root)return;
      if(snapshot)for(const [id,detail] of disclosures(root)) {
        const open=snapshot.disclosures.get(id);
        if(open!==undefined&&detail.open!==open)detail.open=open;
      }
      window.scrollTo({top:snapshot?.y??0,behavior:'instant'});
      if(Math.abs(window.scrollY-(snapshot?.y??0))<2)this.cancelRestore();
    };
    // A saved position may be below a briefly loading panel. Restore again
    // when its content arrives, until it fits or the user takes control.
    if(snapshot&&snapshot.y>0&&typeof ResizeObserver!=='undefined') {
      const observer=new ResizeObserver(()=>{if(this.observer===observer)restore();});
      this.observer=observer;observer.observe(root);
    }
    restore();
  }
  release(key:string,root:HTMLElement) {
    if(this.current?.key!==key||this.current.root!==root)return;
    this.cancelRestore();this.current=null;
  }
}

export const ReviewScrollContext=createContext<ReviewScrollMemory|null>(null);
export function useReviewHome(request:number,clear:()=>void) {
  const previous=useRef(request);
  useLayoutEffect(()=>{
    if(previous.current===request)return;
    previous.current=request;clear();
  },[request,clear]);
}
export function useReviewScroll<T extends HTMLElement=HTMLElement>(key:string,active=true) {
  const memory=useContext(ReviewScrollContext),root=useRef<T>(null);
  useLayoutEffect(()=>{
    if(!active||!memory||!root.current)return;
    const element=root.current;memory.activate(key,element);
    return()=>memory.release(key,element);
  },[memory,key,active]);
  return root;
}
