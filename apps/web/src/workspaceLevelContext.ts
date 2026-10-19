// SPDX-License-Identifier: MPL-2.0
import {deriveEventMoveAssociations,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {nearbyLevelSupersessions} from './nearbySupersessions';
import {mapLevelReferences} from './mapLevelReferences';
import {levelActivityScope} from './levelActivityScope';
import {Temporal} from '@js-temporal/polyfill';
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {QualitySources} from './levelQuality';

export type WorkspaceLevelInput={session:JournalSession;sessions:JournalSession[];levels:SignificantLevel[];
 sources:QualitySources;distance:number;now:string};
/** Read-only; use the same projections as the existing Levels/Structure screens. */
export function workspaceLevelContext(input:WorkspaceLevelInput){
 const {session,sessions,levels,sources,distance,now}=input;
 return {
  supersessions:nearbyLevelSupersessions(levels,sessions,session,sources,distance,now),
  mapReferences:mapLevelReferences(levels,sessions,session,sources),
  eventMoves:sessions.some(day=>day.marketContextItems.some(item=>item.priceMove))
   ?deriveEventMoveAssociations({...levelActivityScope(sessions,session,now),levels}):new Map(),
 };
}
export type WorkspaceLevelResult=ReturnType<typeof workspaceLevelContext>;

/** Conservative knowledge boundary: include every stored timestamp, not just
 * updatedAt, because forecasts/pack evidence can arrive independently. */
function latestInstant(value:unknown,latest='1970-01-01T00:00:00Z'):string{
 let best=latest,at=Date.parse(best);
 const visit=(v:unknown)=>{
  if(typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)){
   const next=Date.parse(v);
   if(Number.isFinite(next)&&next>=at&&v!==best){
    // Prose is arbitrary; a date-looking note without an offset is not an Instant.
    try{if(Temporal.Instant.compare(v,best)>0){at=next;best=v;}}catch{/* Not a canonical stored instant. */}
   }
  }else if(v instanceof Map)for(const item of v.values())visit(item);
  else if(Array.isArray(v))for(const item of v)visit(item);
  else if(v&&typeof v==='object')for(const item of Object.values(v))visit(item);
 };
 visit(value);return best;
}
/** Bounded read cache for revisiting unchanged days. While any recorded future
 * instant or the session close remains ahead, the exact knowledge clock stays
 * in the key. No future evidence becomes available early. */
export class WorkspaceLevelReader{
 private sessions:WorkspaceLevelInput['sessions']|null=null;
 private sources:WorkspaceLevelInput['sources']|null=null;
 private boundary='1970-01-01T00:00:00Z';
 private results=new Map<string,WorkspaceLevelResult>();
 read(input:WorkspaceLevelInput){
  if(this.sessions!==input.sessions||this.sources!==input.sources){
   this.sessions=input.sessions;this.sources=input.sources;this.results.clear();
   this.boundary=latestInstant([input.sessions,input.sources]);
  }
  const close=createSessionClock(input.session.market).checkpointInstant(input.session.rthDate,input.session.market.checkpoints.studyClose).toString();
  const boundary=latestInstant([input.session,input.levels,close],this.boundary);
  const clock=Temporal.Instant.compare(input.now,boundary)>=0?boundary:input.now;
  const key=JSON.stringify([input.session,input.levels,input.distance,clock]);
  const cached=this.results.get(key);if(cached)return cached;
  const result=workspaceLevelContext(input);
  this.results.set(key,result);
  while(this.results.size>6)this.results.delete(this.results.keys().next().value!);
  return result;
 }
}
