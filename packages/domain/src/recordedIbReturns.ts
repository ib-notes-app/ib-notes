// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import type {deriveSessionIbRead} from './sessionIbRead';

export type RecordedIbReturn={from:'IBH'|'IBL';breakAt:string;lastOutsideAt:string;returnedAt:string};
/** Count completed recorded excursions, not inside quotes, edge touches or an unseen path. */
export function deriveRecordedIbReturns(current:ReturnType<typeof deriveSessionIbRead>,tickSize:number){
 const breaks:Array<{side:'IBH'|'IBL';at:string}>=[],returns:RecordedIbReturn[]=[];
 if(!current||current.phase!=='LOCKED'||current.low===null||current.high===null||!current.read.ib||
  !Number.isFinite(tickSize)||tickSize<=0||current.high-current.low<2*tickSize-1e-9)return {breaks,returns,count:0,firstBreak:null,lastReturn:null};
 const {low,high}=current,lock=current.read.ib.knownAt;
 let outside:{side:'IBH'|'IBL';breakAt:string;at:string}|null=null;
 for(const point of current.read.observations){
  if(Temporal.Instant.compare(point.at,lock)<=0||Temporal.Instant.compare(point.at,current.asOf)>0)continue;
  const side=point.price>=high+tickSize-1e-9?'IBH':point.price<=low-tickSize+1e-9?'IBL':null;
  if(side){
   if(!outside||outside.side!==side){outside={side,breakAt:point.at,at:point.at};breaks.push({side,at:point.at});}
   else outside.at=point.at;
  }else if(point.price>=low+tickSize-1e-9&&point.price<=high-tickSize+1e-9&&outside){
   returns.push({from:outside.side,breakAt:outside.breakAt,lastOutsideAt:outside.at,returnedAt:point.at});outside=null;
  }
 }
 return {breaks,returns,count:returns.length,firstBreak:breaks[0]??null,lastReturn:returns.at(-1)??null};
}
