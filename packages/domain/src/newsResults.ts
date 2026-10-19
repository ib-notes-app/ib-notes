// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {eventFamily} from './eventWindows.ts';
import type {JournalSession,MarketContextItem} from './index.ts';

export type NewsResult={family:string;releaseDate:string;measure:string;period:string|null;
  actual:string;previous:string|null;expected:string|null;source:'manual'|'official';
  sourceName?:string|null;sourceUrl:string|null;publishedAt:string|null;checkedAt:string};
export const NEWS_RESULT_FAMILIES=['cpi','ppi','jobs'] as const;
export const NEWS_RESULT_NAMES:Record<string,string>={cpi:'Consumer prices',ppi:'Producer prices',jobs:'Nonfarm payrolls'};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function validNewsSourceUrl(value:unknown):value is string{
  if(!text(value,500))return false;
  try{const url=new URL(value as string);return ['https:','http:'].includes(url.protocol)&&!!url.hostname&&!url.username&&!url.password;}
  catch{return false;}
}
export function newsResultSourceLabel(result:NewsResult):string|null{
  if(result.source==='official')return 'BLS release';
  if(result.sourceName?.trim())return result.sourceName.trim();
  return validNewsSourceUrl(result.sourceUrl)?new URL(result.sourceUrl).hostname.replace(/^www\./,''):null;
}
export function validNewsResult(value:unknown):value is NewsResult{
  if(!value||typeof value!=='object')return false;
  const r=value as NewsResult;
  if(!text(r.family,200)||!/^20\d{2}-\d{2}-\d{2}$/.test(r.releaseDate)||!text(r.measure,80)||!text(r.actual,120)||
    !(r.period===null||/^20\d{2}-(0[1-9]|1[0-2])$/.test(r.period))||
    ![r.previous,r.expected].every(v=>v===null||text(v,120))||!['official','manual'].includes(r.source)||
    !(r.sourceName==null||text(r.sourceName,200))||
    !Number.isFinite(Date.parse(r.checkedAt))||!(r.publishedAt===null||Number.isFinite(Date.parse(r.publishedAt))))return false;
  if(r.source==='official'){
    if(!NEWS_RESULT_FAMILIES.includes(r.family as typeof NEWS_RESULT_FAMILIES[number])||!r.publishedAt||!r.sourceUrl||r.expected!==null||r.sourceName!=null)return false;
    try{const url=new URL(r.sourceUrl);if(url.origin!=='https://www.bls.gov'||url.username||url.password||url.port||url.search||url.hash||
      !/^\/news\.release\/(cpi|ppi|empsit)\.nr0\.htm$/.test(url.pathname))return false;
      const file={cpi:'cpi',ppi:'ppi',jobs:'empsit'}[r.family];
      if(url.pathname!==`/news.release/${file}.nr0.htm`||Temporal.Instant.from(r.publishedAt).toZonedDateTimeISO('America/New_York').toPlainDate().toString()!==r.releaseDate)return false;
    }catch{return false;}
  }else if(r.sourceUrl!==null&&!validNewsSourceUrl(r.sourceUrl))return false;
  return true;
}
export function newsReleaseDate(item:MarketContextItem){return Temporal.Instant.from(item.eventAt).toZonedDateTimeISO('America/New_York').toPlainDate().toString();}
export function newsResultForItem(item:MarketContextItem,asOf:string):NewsResult|null{
  const r=item.newsResult;
  return !item.holiday&&validNewsResult(r)&&r.family===eventFamily(item.name)&&r.releaseDate===newsReleaseDate(item)&&
    !(r.source==='official'&&/\b(core|yoy|annual|year|excluding|less|unemployment|wages)\b/i.test(item.name))&&
    Date.parse(item.eventAt)<=Date.parse(asOf)&&Date.parse(r.checkedAt)<=Date.parse(asOf)&&
    (!r.publishedAt||Date.parse(r.publishedAt)<=Date.parse(asOf))?r:null;
}
/** Descriptive release metadata only. Uses the ordinary context correction/Undo history. */
export function withNewsResult(session:JournalSession,itemId:string,result:NewsResult|null,at:string):JournalSession{
  if(!Number.isFinite(Date.parse(at)))throw new Error('The save time is invalid.');
  const prior=session.marketContextItems.find(item=>item.id===itemId);
  if(!prior)throw new Error('That event is no longer available.');
  if(result&&!newsResultForItem({...prior,newsResult:result},at))throw new Error('Check the result, release date and event before saving.');
  const {newsResult:old,...rest}=prior,resulting:MarketContextItem=result?{...rest,newsResult:result}:rest;
  const withoutCheck=(r:NewsResult|undefined)=>r?{...r,checkedAt:''}:null;
  if(JSON.stringify(withoutCheck(old))===JSON.stringify(withoutCheck(result??undefined)))return session;
  return {...session,updatedAt:at,marketContextItems:session.marketContextItems.map(item=>item.id===itemId?resulting:item),
    marketContextHistory:[...session.marketContextHistory,{id:`context-history:${at}:result:${session.marketContextHistory.length+1}`,
      itemId,action:'corrected',prior,resulting,occurredAt:at}]};
}
/** An explicit refresh may enrich saved events, never resurrect one or overwrite manual results. */
export function withOfficialNewsResults(session:JournalSession,results:NewsResult[],at:string):JournalSession{
  let next=session;
  for(const item of session.marketContextItems){
    if(item.newsResult?.source==='manual')continue;
    const last=session.marketContextHistory.filter(e=>e.itemId===item.id&&(e.prior?.newsResult||e.resulting?.newsResult)).at(-1);
    if(last?.prior?.newsResult&&!last.resulting?.newsResult)continue;
    const result=results.find(r=>r.source==='official'&&newsResultForItem({...item,newsResult:r},at));
    if(result)next=withNewsResult(next,item.id,result,at);
  }
  return next;
}
