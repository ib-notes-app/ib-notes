// SPDX-License-Identifier: MPL-2.0
import {useEffect,useRef,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import type {WorkspaceLevelInput,WorkspaceLevelResult} from './workspaceLevelContext';
const empty:WorkspaceLevelResult={supersessions:new Map(),mapReferences:new Map(),eventMoves:new Map()};
type Input=Omit<WorkspaceLevelInput,'now'>;
type State={input:Input;result:WorkspaceLevelResult;error:string|null};
const same=(a:Input,b:Input)=>a.session===b.session&&a.sessions===b.sessions&&a.levels===b.levels&&a.sources===b.sources&&a.distance===b.distance;

/** A single read worker per mounted app. Date/price entry never waits for a
 * historical level replay; stale replies cannot become another day's levels. */
export function useWorkspaceLevels(input:Input|null,enabled:boolean){
 const [state,setState]=useState<State|null>(null);
 const worker=useRef<Worker|null>(null),sequence=useRef(0);
 const sent=useRef<{sessions:Input['sessions']|null;sources:Input['sources']|null}>({sessions:null,sources:null});
 useEffect(()=>()=>{worker.current?.terminate();worker.current=null;},[]);
 useEffect(()=>{
  if(!enabled||!input)return;
  let active=true;
  const id=++sequence.current;
  try{
   if(!worker.current){worker.current=new Worker(new URL('./workspaceLevels.worker.ts',import.meta.url),{type:'module',name:'ib-notes-level-context'});sent.current={sessions:null,sources:null};}
   const current=worker.current;
   current.onmessage=event=>{
    if(!active||event.data.id!==id)return;
    setState({input,result:event.data.result??empty,error:event.data.error?'Nearby level history could not be prepared.':null});
   };
   current.onerror=()=>{
    if(!active)return;
    current.terminate();if(worker.current===current)worker.current=null;
    setState({input,result:empty,error:'Nearby level history could not be prepared.'});
   };
   current.postMessage({id,session:input.session,levels:input.levels,distance:input.distance,now:Temporal.Now.instant().toString(),
    ...(sent.current.sessions===input.sessions?{}:{sessions:input.sessions}),
    ...(sent.current.sources===input.sources?{}:{sources:input.sources})});
   sent.current={sessions:input.sessions,sources:input.sources};
  }catch{setState({input,result:empty,error:'Nearby level history could not be prepared.'});}
  return()=>{active=false;};
 },[enabled,input?.session,input?.sessions,input?.levels,input?.sources,input?.distance]);
 const ready=!!input&&!!state&&same(input,state.input);
 return {result:ready?state.result:empty,loading:enabled&&!ready,error:ready?state.error:null};
}
