// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import type {Plugin} from 'vite';
import {validNewsResult,type NewsResult} from '../../../packages/domain/src/newsResults.ts';
import {fetchBody} from './schedulePlugin.ts';
import {MONTH_NAMES} from './scheduleParsers.ts';

export const RESULT_URLS={cpi:'https://www.bls.gov/news.release/cpi.nr0.htm',ppi:'https://www.bls.gov/news.release/ppi.nr0.htm',
  jobs:'https://www.bls.gov/news.release/empsit.nr0.htm'} as const;
export type ResultFamily=keyof typeof RESULT_URLS;
export type NewsResultsResponse={date:string;checkedAt:string;sources:Array<{family:ResultFamily;status:'ok'|'unavailable';message:string|null;result:NewsResult|null}>};
const clean=(html:string)=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const signed=(n:number,unit='%')=>`${n>0?'+':''}${n.toLocaleString('en-US',{maximumFractionDigits:2})}${unit}`;
function percent(text:string):string|null{
  const found=text.match(/\b(increased|decreased|rose|fell|rising|falling|declined|advanced|moved up|moved down)\s+(\d+(?:\.\d+)?)\s*percent/i);
  if(found)return signed(Number(found[2])*(/decreased|fell|falling|declined|down/i.test(found[1]!)?-1:1));
  return /\b(?:was|were|remained) unchanged\b/i.test(text)?'0%':null;
}

/** Headline monthly figures only. Fail closed on dates, periods or prose we cannot identify. */
export function parseNewsResult(body:string,family:ResultFamily,date:string,checkedAt:string):NewsResult{
  const text=clean(body),months=MONTH_NAMES.join('|');
  const release=text.match(new RegExp(`embargoed until.{0,60}?(\\d{1,2}):(\\d{2})\\s*([ap])\\.?m\\.?\\s*\\(ET\\)\\s*\\w+,?\\s*(${months})\\s+(\\d{1,2}),?\\s+(20\\d{2})`,'i'));
  if(!release)throw new Error('The release time could not be verified.');
  const releaseDate=`${release[6]}-${String(MONTH_NAMES.indexOf(release[4]!.toLowerCase())+1).padStart(2,'0')}-${release[5]!.padStart(2,'0')}`;
  const hour=Number(release[1])%12+(release[3]!.toLowerCase()==='p'?12:0);
  if(Number(release[1])<1||Number(release[1])>12)throw new Error('The release clock could not be verified.');
  const publishedAt=Temporal.PlainDateTime.from(`${releaseDate}T${String(hour).padStart(2,'0')}:${release[2]}`)
    .toZonedDateTime('America/New_York',{disambiguation:'reject'}).toInstant().toString();
  if(releaseDate!==date||Date.parse(publishedAt)>Date.parse(checkedAt))throw new Error('No matching published result for this date.');
  const heading={cpi:'CONSUMER PRICE INDEX',ppi:'PRODUCER PRICE INDEXES',jobs:'(?:THE )?EMPLOYMENT SITUATION'}[family];
  const report=text.match(new RegExp(`${heading}\\s*[-–]\\s*(${months})\\s+(20\\d{2})`,'i'));
  if(!report)throw new Error('The report period could not be verified.');
  const period=`${report[2]}-${String(MONTH_NAMES.indexOf(report[1]!.toLowerCase())+1).padStart(2,'0')}`;
  if(period>date.slice(0,7))throw new Error('The report period is ahead of the release.');
  let actual:string|null=null,previous:string|null=null;
  const priorMonth=MONTH_NAMES[(MONTH_NAMES.indexOf(report[1]!.toLowerCase())+11)%12]!;
  if(family==='jobs'){
    const lead=text.match(/Total nonfarm payroll employment\s+([\s\S]{0,250}?)(?:\.(?:\s|$))/i)?.[1];
    const number=lead&&new RegExp(`\\bin ${report[1]}\\b`,'i').test(lead)?lead.match(/\(([+-]?[\d,]+)\)|(?:increased|rose|decreased|fell|declined)\s+by\s+([\d,]+)/i):null;
    if(number)actual=signed(Number((number[1]??number[2])!.replaceAll(',',''))*(number[1]?1:/decreased|fell|declined/i.test(lead!)?-1:1),' jobs');
    const revision=text.match(new RegExp(`change for ${priorMonth} was revised [^.]{0,100}? to ([+-]?[\\d,]+)`,'i'));
    if(revision)previous=signed(Number(revision[1]!.replaceAll(',','')),' jobs');
  }else{
    const anchor=family==='ppi'?'The Producer Price Index for final demand':'The Consumer Price Index for All Urban Consumers';
    const start=text.indexOf(anchor),lead=start<0?'':text.slice(start,start+600);
    const first=lead.split(/\.\s+(?=[A-Z])/)[0]??'';
    if(!new RegExp(`\\bin ${report[1]}\\b`,'i').test(first)||!/seasonally adjusted/i.test(first))throw new Error('The headline monthly measure could not be verified.');
    actual=percent(first.split(/\bafter\b/i)[0]!);
    const prior=family==='ppi'?lead.match(new RegExp(`Final demand prices ([\\s\\S]{0,100}?) in ${priorMonth}`,'i'))?.[1]:
      first.match(new RegExp(`after ([\\s\\S]{0,70}?) in ${priorMonth}`,'i'))?.[1];
    previous=prior?percent(prior):null;
  }
  if(actual===null)throw new Error('The headline result could not be read.');
  const result:NewsResult={family,releaseDate,measure:family==='jobs'?'Monthly payroll change':'Monthly change',period,actual,previous,expected:null,
    source:'official',sourceUrl:RESULT_URLS[family],publishedAt,checkedAt};
  if(!validNewsResult(result))throw new Error('The release result failed validation.');
  return result;
}

export function createNewsResultLookup(fetcher:typeof fetch=fetch,clock=()=>Date.now()){
  const cache=new Map<string,{at:number;value:Promise<NewsResultsResponse>}>();
  return (date:string)=>{
    const old=cache.get(date);if(old&&clock()-old.at<60_000)return old.value;
    const checkedAt=new Date(clock()).toISOString();
    const value=Promise.all((Object.keys(RESULT_URLS) as ResultFamily[]).map(async family=>{
      try{return {family,status:'ok' as const,message:null,result:parseNewsResult(await fetchBody(RESULT_URLS[family],'text/html',fetcher),family,date,checkedAt)};}
      catch(error){return {family,status:'unavailable' as const,result:null,message:error instanceof Error?error.message:'Result unavailable.'};}
    })).then(sources=>({date,checkedAt,sources}));
    cache.set(date,{at:clock(),value});if(cache.size>32)cache.delete(cache.keys().next().value!);
    return value;
  };
}
export function newsResultsPlugin():Plugin{
  const lookup=createNewsResultLookup();
  const handler:import('vite').Connect.NextHandleFunction=(request,response,next)=>{
    const url=new URL(request.url??'/','http://localhost');if(url.pathname!=='/api/news-results')return next();
    response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
    const date=url.searchParams.get('date')??'';
    try{Temporal.PlainDate.from(date);if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||request.method!=='GET'||
      [...url.searchParams.keys()].some(k=>k!=='date')||Number(date.slice(0,4))<new Date().getUTCFullYear()-2||Number(date.slice(0,4))>new Date().getUTCFullYear()+1)throw new Error();}
    catch{response.statusCode=400;response.end(JSON.stringify({error:'Choose a valid release date.'}));return;}
    void lookup(date).then(result=>response.end(JSON.stringify(result))).catch(()=>{response.statusCode=503;response.end(JSON.stringify({error:'News results are unavailable.'}));});
  };
  return {name:'ib-official-news-results',configureServer(server){server.middlewares.use(handler);},configurePreviewServer(server){server.middlewares.use(handler);}};
}
