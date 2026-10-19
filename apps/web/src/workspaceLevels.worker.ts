// SPDX-License-Identifier: MPL-2.0
import {WorkspaceLevelReader,type WorkspaceLevelInput} from './workspaceLevelContext';
type Request=Omit<WorkspaceLevelInput,'sessions'|'sources'>&{id:number;sessions?:WorkspaceLevelInput['sessions'];sources?:WorkspaceLevelInput['sources']};
let sessions:WorkspaceLevelInput['sessions']=[],sources:WorkspaceLevelInput['sources']=new Map();
const reader=new WorkspaceLevelReader();
self.onmessage=(event:MessageEvent<Request>)=>{
 const input=event.data;
 if(input.sessions)sessions=input.sessions;
 if(input.sources)sources=input.sources;
 try{self.postMessage({id:input.id,result:reader.read({...input,sessions,sources})});}
 catch(error){self.postMessage({id:input.id,error:error instanceof Error?error.message:String(error)});}
};
