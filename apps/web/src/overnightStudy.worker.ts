// SPDX-License-Identifier: MPL-2.0
import { deriveOvernightStudy, overnightLibraryCompatible, type OvernightLibrary } from '@ib-field-notes/domain';
type Input=Parameters<typeof deriveOvernightStudy>[0];
let bundled:Promise<OvernightLibrary>|null=null;
let latest=0;
let installed:OvernightLibrary[]=[];
self.onmessage=async(event:MessageEvent<{id:number;input:Omit<Input,'libraries'>;libraries?:OvernightLibrary[]}>)=>{
  const {id,input}=event.data;latest=id;
  if(event.data.libraries)installed=event.data.libraries;
  try{
    const live=Date.parse(input.window.now)>=Date.parse(input.window.startAt)&&Date.parse(input.window.now)<Date.parse(input.window.openAt);
    const libraries=live?[...installed]:[];
    if(import.meta.env.MODE !== 'beta-rehearsal'&&import.meta.env.MODE !== 'public-blank'&&live&&['ES','MES'].includes(input.session.instrument)){
      bundled??=import('./data/es-overnight-reference.json').then(d=>d.default as unknown as OvernightLibrary);
      const library=await bundled;
      if(overnightLibraryCompatible(library,input.session.market))libraries.unshift(library);
    }
    if(id!==latest)return;
    const study=deriveOvernightStudy({...input,libraries});
    self.postMessage({id,study});
  }catch{if(id===latest)self.postMessage({id,error:'Overnight comparisons could not be read. Your saved prices are intact.'});}
};
