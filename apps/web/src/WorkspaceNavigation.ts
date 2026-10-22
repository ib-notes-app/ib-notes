// SPDX-License-Identifier: MPL-2.0
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';

/** Preview-only history. Legacy destinations keep their existing state and content. */
export function useWorkspaceNavigation<P extends string>(enabled:boolean,panel:P,setPanel:Dispatch<SetStateAction<P>>,home:P){
  const [level,setLevel]=useState<string|null>(null);
  const [levelParent,setLevelParent]=useState<P|null>(null);
  const [parent,setParent]=useState<{panel:P;level:string|null}>({panel:home,level:null});
  const last=useRef(panel),scroll=useRef<Record<string,number>>({});
  const current=useRef(panel);current.current=panel;
  const currentLevel=useRef(level);currentLevel.current=level;
  const restoring=useRef<number|null>(null);
  const key=(destination:P,record:string|null)=>`${destination}:${record??''}`;
  const depth=()=>Number(window.history.state?.ibWorkspaceDepth??0);
  const saveScroll=()=>{scroll.current[key(current.current,currentLevel.current)]=window.scrollY;};
  const restore=(next:P,record:string|null=null)=>{
    if(restoring.current!==null)cancelAnimationFrame(restoring.current);
    restoring.current=requestAnimationFrame(()=>{
      restoring.current=null;
      if(current.current!==next||currentLevel.current!==record)return;
      // A fast user (or browser automation) may already be typing before the
      // navigation frame runs. Do not move focus/scroll away from that form.
      if(document.activeElement?.closest('form,input,textarea,select,[contenteditable="true"]'))return;
      window.scrollTo({top:scroll.current[key(next,record)]??0});
      document.querySelector<HTMLElement>(next===home?'.workspace-record':'.workspace-destination-toolbar h2')?.focus({preventScroll:true});
    });
  };
  useEffect(()=>()=>{if(restoring.current!==null)cancelAnimationFrame(restoring.current);},[]);
  useEffect(()=>{
    if(!enabled)return;
    // A reload starts on Today, without trusting an expired in-memory panel.
    window.history.replaceState({...window.history.state,ibWorkspacePanel:home,ibWorkspaceDepth:0,ibWorkspaceLevel:null,ibWorkspaceLevelParent:null,ibWorkspaceParent:home,ibWorkspaceParentLevel:null},'',window.location.href);
    const pop=(event:PopStateEvent)=>{
      saveScroll();const next=(event.state?.ibWorkspacePanel??home) as P;
      const record=event.state?.ibWorkspaceLevel??null;
      const same=next===current.current&&record===currentLevel.current;
      last.current=next;setPanel(next);setLevel(record);setLevelParent(event.state?.ibWorkspaceLevelParent??null);
      setParent({panel:event.state?.ibWorkspaceParent??home,level:event.state?.ibWorkspaceParentLevel??null});if(!same)restore(next,record);
    };
    window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
  },[enabled]);
  useEffect(()=>{
    if(!enabled||last.current===panel)return;
    const previous=last.current,previousLevel=currentLevel.current;
    scroll.current[key(previous,previousLevel)]=window.scrollY;last.current=panel;
    if(panel===home){setLevel(null);setLevelParent(null);setParent({panel:home,level:null});if(depth()>0)window.history.go(-depth());else restore(home);return;}
    window.history.pushState({...window.history.state,ibWorkspacePanel:panel,ibWorkspaceDepth:depth()+1,ibWorkspaceLevel:null,ibWorkspaceLevelParent:null,ibWorkspaceParent:previous,ibWorkspaceParentLevel:previousLevel,ibWorkspaceSheet:false},'',window.location.href);
    setParent({panel:previous,level:previousLevel});
    setLevel(null);setLevelParent(null);restore(panel);
  },[enabled,panel]);
  const selectLevel=(id:string|null)=>{
    saveScroll();
    if(id===null&&level!==null&&depth()>0){window.history.back();return;}
    window.history.pushState({...window.history.state,ibWorkspaceLevel:id,ibWorkspaceLevelParent:panel,ibWorkspaceParent:panel,ibWorkspaceParentLevel:level,ibWorkspaceDepth:depth()+1},'',window.location.href);setParent({panel,level});setLevel(id);setLevelParent(panel);restore(panel,id);
  };
  return {level,levelParent,selectLevel,backTarget:parent.panel,backLevel:parent.level,canGoBack:parent.panel!==home,
    replaceLevel:(id:string)=>{
      if(id===level)return;
      saveScroll();window.history.replaceState({...window.history.state,ibWorkspaceLevel:id},'',window.location.href);
      setLevel(id);restore(panel,id);
    },
    openLevel:(destination:P,id:string)=>{
      saveScroll();last.current=destination;
      // A shortcut opens the detail directly; do not insert an unvisited list.
      const state={...window.history.state,ibWorkspacePanel:destination,ibWorkspaceDepth:depth()+1,ibWorkspaceLevel:id,ibWorkspaceLevelParent:current.current,ibWorkspaceParent:current.current,ibWorkspaceParentLevel:currentLevel.current,ibWorkspaceSheet:false};
      window.history.pushState(state,'',window.location.href);
      setParent({panel:current.current,level:currentLevel.current});setPanel(destination);setLevel(id);setLevelParent(current.current);restore(destination,id);
    },
    back:()=>{if(depth()>0)window.history.back();else {setLevel(null);setLevelParent(null);setPanel(home);restore(home);}},
    close:()=>{saveScroll();if(depth()>0)window.history.go(-depth());else{setLevel(null);setLevelParent(null);setPanel(home);restore(home);}}};
}
