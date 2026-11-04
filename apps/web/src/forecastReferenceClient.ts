// SPDX-License-Identifier: MPL-2.0
import type { assembleForecastReferences, ForecastReferences } from '@ib-field-notes/domain';
type Input=Parameters<typeof assembleForecastReferences>[0];
type Result={references:ForecastReferences|null;error:string|null};
type Request={source:string;minute:number;receive:((result:Result)=>void)|null};
let worker:Worker|null=null,sequence=0,sentSource:string|null=null;
const requests=new Map<number,Request>(),cached=new Map<string,{minute:number;result:Result}>();
const failure:Result={references:null,error:'Some forecast history could not be prepared. Broader IB history is still available.'};

/** One page-lifetime worker: opening CP/CTX/Review must not throw away the
 * reference preparation. No journal writes occur here or after unsubscription. */
export function requestForecastReferences(inputs:Input,source:string,receive:(result:Result)=>void):()=>void {
  const previous=cached.get(source);
  if(previous?.minute===inputs.minute){let active=true;queueMicrotask(()=>{if(active)receive(previous.result);});return()=>{active=false;};}
  try{
    if(!worker){
      worker=new Worker(new URL('./forecastReferences.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=event=>{
        const request=requests.get(event.data.id);if(!request)return;
        requests.delete(event.data.id);
        const result:Result={references:event.data.references??null,error:event.data.error??null};
        cached.delete(request.source);cached.set(request.source,{minute:request.minute,result});
        while(cached.size>2)cached.delete(cached.keys().next().value!);
        request.receive?.(result);
      };
      worker.onerror=()=>{for(const request of requests.values())request.receive?.(failure);requests.clear();
        worker?.terminate();worker=null;sentSource=null;};
    }
    for(const [id,request] of requests)if(!request.receive)requests.delete(id);
    const id=++sequence,changed=sentSource!==source;sentSource=source;
    requests.set(id,{source,minute:inputs.minute,receive});
    worker.postMessage({id,...(changed?{inputs}:{}),minute:inputs.minute,now:inputs.now});
    return()=>{const request=requests.get(id);if(request)request.receive=null;};
  }catch{let active=true;queueMicrotask(()=>{if(active)receive(failure);});return()=>{active=false;};}
}
