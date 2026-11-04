// SPDX-License-Identifier: MPL-2.0
import { deriveOvernightStudy, type OvernightLibrary } from '@ib-field-notes/domain';
type Input=Parameters<typeof deriveOvernightStudy>[0];
let latest=0;
let installed:OvernightLibrary[]=[];
self.onmessage=async(event:MessageEvent<{id:number;input:Omit<Input,'libraries'>;libraries?:OvernightLibrary[]}>)=>{
  const {id,input}=event.data;latest=id;
  if(event.data.libraries)installed=event.data.libraries;
  try{
    const live=Date.parse(input.window.now)>=Date.parse(input.window.startAt)&&Date.parse(input.window.now)<Date.parse(input.window.openAt);
    const libraries=live?[...installed]:[];
    if(id!==latest)return;
    const study=deriveOvernightStudy({...input,libraries});
    self.postMessage({id,study});
  }catch{if(id===latest)self.postMessage({id,error:'Overnight comparisons could not be read. Your saved prices are intact.'});}
};
