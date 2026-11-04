// SPDX-License-Identifier: MPL-2.0
import {DEFAULT_IMAGE_SHARE_SECTIONS} from './imageShareContent';
import {DEFAULT_IMAGE_CARD_OPTIONS} from './imageCard';
import {DEFAULT_DASHBOARD_SHARE_DETAILS} from './dashboardShare';
const key=(journalId:string)=>`ib-notes:share-defaults:v1:${journalId}`;
const selectionKey=(journalId:string,id:string,created:string)=>`ib-notes:share-selection:v1:${journalId}:${id}:${created}`;
const defaults=()=>({sections:{...DEFAULT_IMAGE_SHARE_SECTIONS},map:{...DEFAULT_IMAGE_CARD_OPTIONS,selectedOptionalLines:[] as string[]},details:{...DEFAULT_DASHBOARD_SHARE_DETAILS},levels:'nearby' as 'nearby'|'visited'});
export type ShareDefaults=ReturnType<typeof defaults>;
function booleans<T extends object>(base:T,input:unknown):T{
 const result={...base};if(!input||typeof input!=='object')return result;
 for(const k of Object.keys(base) as Array<keyof T>)if(typeof base[k]==='boolean'&&typeof (input as T)[k]==='boolean')result[k]=(input as T)[k];
 return result;
}
export function readShareDefaults(journalId:string):ShareDefaults{
 const base=defaults();try{const saved=JSON.parse(localStorage.getItem(key(journalId))??'null');if(!saved||saved.version!==1)return base;
  return {sections:booleans(base.sections,saved.sections),map:booleans(base.map,saved.map),details:booleans(base.details,saved.details),levels:saved.levels==='visited'?'visited':'nearby'};
 }catch{return base;}
}
export function rememberShareDefaults(journalId:string,value:ShareDefaults):boolean{
 try{localStorage.setItem(key(journalId),JSON.stringify({version:1,...value,map:{...value.map,selectedOptionalLines:[]}}));return true;}catch{return false;}
}
const ids=(value:unknown):string[]=>Array.isArray(value)?[...new Set(value.filter((id):id is string=>typeof id==='string'&&id.length<500))].slice(0,500):[];
export function readShareSelection(journalId:string,id:string,created:string){
 try{const data=JSON.parse(localStorage.getItem(selectionKey(journalId,id,created))??'{}');return {optional:ids(data.optional),nearby:ids(data.nearby)};}catch{return {optional:[],nearby:[]};}
}
export function rememberShareSelection(journalId:string,id:string,created:string,optional:string[],nearby:string[]){
 try{localStorage.setItem(selectionKey(journalId,id,created),JSON.stringify({optional:ids(optional),nearby:ids(nearby)}));}catch{/* The current draft remains usable. */}
}
