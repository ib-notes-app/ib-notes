// SPDX-License-Identifier: MPL-2.0
import {useEffect,useRef} from 'react';

/** View clocks sleep while hidden. Resume from the real clock, without replaying
 * missed ticks. Align foreground wakes and honor exact configured boundaries. */
export function subscribeVisibleRefresh(refresh:()=>void,everyMs:number,deadlines:readonly number[]=[]){
 let timer:number|undefined,disposed=false;
 const clear=()=>{if(timer!==undefined){window.clearTimeout(timer);timer=undefined;}};
 const schedule=()=>{
  if(disposed||document.hidden)return;
  const now=Date.now();let next=(Math.floor(now/everyMs)+1)*everyMs;
  for(const at of deadlines)if(at>now&&at<next)next=at;
  timer=window.setTimeout(tick,Math.max(1,next-now));
 };
 const tick=()=>{timer=undefined;if(disposed||document.hidden)return;refresh();schedule();};
 const resume=()=>{clear();if(disposed||document.hidden)return;refresh();schedule();};
 document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
 resume();
 return()=>{disposed=true;clear();document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
}

export function useVisibleRefresh(refresh:()=>void,everyMs:number,enabled=true,deadlines:readonly string[]=[]){
 const callback=useRef(refresh);callback.current=refresh;
 const key=deadlines.join('|');
 useEffect(()=>{
  if(!enabled)return;
  return subscribeVisibleRefresh(()=>callback.current(),everyMs,key?key.split('|').map(Date.parse):[]);
 },[enabled,everyMs,key]);
}
