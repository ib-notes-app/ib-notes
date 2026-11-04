// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { JournalSession, StudyTemplate } from './index';
import { eventFamily } from './eventWindows';
import {eventContextForForecast} from './eventPriceMoves';
import type { ContextBatch } from './contextHistory';

export const ON_MODEL = 'overnight-opening-bands-v2' as const;
export const ON_BANDS = ['BELOW', 'LOWER', 'LOWER_MIDDLE', 'UPPER_MIDDLE', 'UPPER', 'ABOVE'] as const;
export type OnBand = typeof ON_BANDS[number];
export const onBandNames: Record<OnBand, string> = { BELOW:'Below the range', LOWER:'Lower quarter',
  LOWER_MIDDLE:'Lower middle', UPPER_MIDDLE:'Upper middle', UPPER:'Upper quarter', ABOVE:'Above the range' };
export const onNewsFamily=eventFamily;
export type OnEvent = { family:string; minute:number };
export type OvernightPath = { id:string; date:string; contract:string; sourceId:string; base:number;
  closes:(number|null)[]; highs:(number|null)[]; lows:(number|null)[]; observed:number[]; opening:number; events:OnEvent[] };
export type OvernightLibrary = { version:1; instrument:string; cohort:'REFERENCE'; tickSize:number; timeZone:string;
  start:string; open:string; sampleMinutes:number[]; days:OvernightPath[];
  sources:{file:string;sha256:string}[] };
export type OnWindow = { now:string; startAt:string; openAt:string };
export type OnRead = { high:number|null; low:number|null; width:number|null; knownAt:string|null;
  prices:{at:string;price:number}[]; bandCounts:Record<OnBand,number>; dominant:OnBand|null;
  direction:'Moving higher'|'Moving lower'|'Tight rotation'|'Rotating'|'Developing'; spanMinutes:number; largestGapMinutes:number };
export type OnForecast = { modelVersion:typeof ON_MODEL|'overnight-opening-bands-v1'; asOf:string; until:string; referenceAt:string;
  high:number; low:number; price:number|null; priceAt:string|null; remainingMinutes:number;
  probabilities:Record<OnBand,number>; eligibleDays:number; selectedDays:number; effectiveDays:number;
  matches:{id:string;weight:number}[]; sources:OvernightLibrary['sources'];
  news:{family:string;at:string;state:'Upcoming'|'Released'}[]; newsMatches:number; newsMatchedBaseline:boolean;
  baselineDays:number; scheduleReconstructed:boolean;
  baseline?:{probabilities:Record<OnBand,number>;effectiveDays:number;priceAgeMinutes:number|null;pricePosition:number|null} };
export type OnForecastUpdate = { version:1; id:string; sessionId:string; journalId:string; contract:string|null;
  recordedAt:string; inputKey:string; sessionInputKey:string; origin:'LIVE'|'RECONSTRUCTED'; forecast:OnForecast };
export type OvernightStudy = { read:OnRead; widthComparison:{percentile:number;median:number;days:number;at:string}|null;
  initial:OnForecast|null; outlook:OnForecast|null; startsAt:string; live:boolean };
const time=(at:string)=>Date.parse(at);
const emptyCounts=()=>Object.fromEntries(ON_BANDS.map(b=>[b,0])) as Record<OnBand,number>;
const valid=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function onForecastInput(session:JournalSession) {
  const context=eventContextForForecast(session);
  const input=JSON.stringify([session.id,session.journalId,session.market,session.contract,session.preOpenSnapshots,
    session.cpObservations,context.items,context.history]);
  // Bounded revision identity, not a security checksum. Do not copy an entire
  // overnight journal into every receipt; exact sources remain in the journal.
  let a=2166136261,b=5381;
  for(let i=0;i<input.length;i++){const n=input.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n;}
  return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}:${input.length}`;
}
export function onBand(price:number,low:number,high:number):OnBand {
  if(price<low)return 'BELOW';if(price>high)return 'ABOVE';
  const p=(price-low)/(high-low);
  return p<.25?'LOWER':p<.5?'LOWER_MIDDLE':p<.75?'UPPER_MIDDLE':'UPPER';
}

/** Same sampling opportunity in live and historical paths: five-minute buckets,
 * then one-minute buckets in the last 90 minutes. Bursts cannot vote repeatedly. */
export function overnightSampleMinutes(total:number) {
  const points:number[]=[];
  for(let m=5;m<=total;m+=5)if(m<=total-90)points.push(m);
  for(let m=Math.max(1,total-89);m<=total;m++)points.push(m);
  return [...new Set(points)].sort((a,b)=>a-b);
}
function sampleIndex(minutes:number[],minute:number) {
  let low=0,high=minutes.length-1,result=-1;
  while(low<=high){const mid=(low+high)>>1;if(minutes[mid]!<=minute){result=mid;low=mid+1;}else high=mid-1;}
  return result;
}
export function overnightLibraryCompatible(library:OvernightLibrary,market:StudyTemplate) {
  return library.version===1&&library.cohort==='REFERENCE'&&library.tickSize===market.tickSize&&
    library.timeZone===market.canonicalTimeZone&&library.start===market.overnightStart.slice(0,5)&&
    library.open===market.checkpoints.overnightLock.slice(0,5)&&
    (library.instrument===market.instrument||['ES','MES'].includes(library.instrument)&&['ES','MES'].includes(market.instrument));
}

/** Project existing minutes only. A missing close remains missing; cumulative
 * extremes are observed extrema, never certified coverage or forward-filled prices. */
export function projectOvernightPath(args:{date:string;contract:string;sourceId:string;startAt:string;openAt:string;
  tickSize:number;events:OnEvent[];minutes:{at:string;open:number|null;high:number|null;low:number|null;close:number|null}[]}):OvernightPath|null {
  const start=time(args.startAt),open=time(args.openAt),total=(open-start)/60000;
  if(!Number.isInteger(total)||total<=90||!args.contract)return null;
  const opening=args.minutes.find(m=>time(m.at)===open)?.open;
  const rows=args.minutes.filter(m=>time(m.at)>=start&&time(m.at)<open).sort((a,b)=>time(a.at)-time(b.at));
  const base=rows.find(m=>valid(m.open))?.open;
  if(!valid(opening)||!valid(base))return null;
  const ticks=(p:number)=>{const v=(p-base)/args.tickSize;if(Math.abs(v-Math.round(v))>1e-7)throw new Error('Overnight prices are off tick.');return Math.round(v);};
  const byMinute=new Map<number,typeof rows[number]>();
  for(const row of rows){const minute=(time(row.at)-start)/60000;
    if(!Number.isInteger(minute)||byMinute.has(minute))return null;byMinute.set(minute,row);}
  const samples=new Set(overnightSampleMinutes(total)),closes:(number|null)[]=[],highs:(number|null)[]=[],lows:(number|null)[]=[],observed:number[]=[];
  let high=-Infinity,low=Infinity,count=0;
  for(let m=1;m<=total;m++){
    const row=byMinute.get(m-1);
    if(row&&valid(row.high)&&valid(row.low)&&valid(row.close)){high=Math.max(high,row.high);low=Math.min(low,row.low);count++;}
    if(samples.has(m)){closes.push(row&&valid(row.close)?ticks(row.close):null);
      highs.push(Number.isFinite(high)?ticks(high):null);lows.push(Number.isFinite(low)?ticks(low):null);observed.push(count);}
  }
  return {id:`${args.sourceId}:${args.date}:${args.contract}`,date:args.date,contract:args.contract,sourceId:args.sourceId,
    base,closes,highs,lows,observed,opening:ticks(opening),events:args.events};
}

export function deriveOvernightObservationRead(session:JournalSession,window:OnWindow,final=false):OnRead {
  const start=time(window.startAt),open=time(window.openAt),now=Math.min(time(window.now),open);
  const snapshots=session.preOpenSnapshots.filter(s=>time(s.recordedAt)>=start&&time(s.recordedAt)<=now)
    .sort((a,b)=>time(a.recordedAt)-time(b.recordedAt));
  const last=snapshots.at(-1);
  const high=final?session.overnight.high??last?.formingOvernightHigh??null:last?.formingOvernightHigh??null;
  const low=final?session.overnight.low??last?.formingOvernightLow??null:last?.formingOvernightLow??null;
  const total=(open-start)/60000,samples=overnightSampleMinutes(total),buckets=new Map<number,{at:string;price:number}|null>();
  const byInstant=new Map<string,number|null>();
  for(const p of session.cpObservations){const at=time(p.observedAt);
    if(at<start||at>=open||at>now||!valid(p.price)||!final&&p.recordedAt&&time(p.recordedAt)>now)continue;
    const key=new Date(at).toISOString(),old=byInstant.get(key);
    byInstant.set(key,old===undefined||old===p.price?p.price:null);
  }
  for(const [at,price] of [...byInstant].sort((a,b)=>time(a[0])-time(b[0]))){
    const bucket=sampleIndex(samples,(time(at)-start)/60000);
    if(price===null){buckets.set(bucket,null);continue;}
    buckets.set(bucket,{at,price});
  }
  const prices=[...buckets.values()].filter((p):p is {at:string;price:number}=>p!==null);
  const width=valid(high)&&valid(low)&&high>=low?high-low:null,bandCounts=emptyCounts();
  if(width&&valid(low)&&valid(high))for(const p of prices)bandCounts[onBand(p.price,low,high)]++;
  const leaders=ON_BANDS.filter(b=>bandCounts[b]===Math.max(...Object.values(bandCounts))&&bandCounts[b]>0);
  const dominant=leaders.length===1?leaders[0]!:null;
  const spanMinutes=prices.length>1?(time(prices.at(-1)!.at)-time(prices[0]!.at))/60000:0;
  const gaps=prices.slice(1).map((p,i)=>(time(p.at)-time(prices[i]!.at))/60000);
  const largestGapMinutes=gaps.length?Math.max(...gaps):0;
  let direction:OnRead['direction']='Developing';
  if(prices.length>=2&&width){
    const net=prices.at(-1)!.price-prices[0]!.price;
    const travel=prices.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.price-prices[i]!.price),0);
    if(Math.abs(net)>=width*.35&&(!travel||Math.abs(net)/travel>=.3))direction=net>0?'Moving higher':'Moving lower';
    else {
      const recent=prices.filter(p=>time(p.at)>=time(prices.at(-1)!.at)-3600000);
      const recentSpan=recent.length>1?(time(recent.at(-1)!.at)-time(recent[0]!.at))/60000:0;
      direction=recent.length>=4&&recentSpan>=30&&Math.max(...recent.map(p=>p.price))-Math.min(...recent.map(p=>p.price))<=width*.3
        ?'Tight rotation':'Rotating';
    }
  }
  const latestAt=prices.at(-1)?.at;
  const knownAt=final&&session.overnight.status==='confirmed'?window.openAt:last?
    latestAt&&time(latestAt)>time(last.recordedAt)?latestAt:last.recordedAt:null;
  return {high,low,width,knownAt,prices,bandCounts,dominant,direction,spanMinutes,largestGapMinutes};
}

function currentNews(session:JournalSession,news:ContextBatch[],asOf:string,startAt:string,openAt:string) {
  const at=time(asOf),start=time(startAt),end=time(openAt);
  const context=eventContextForForecast(session);
  const rows=[...context.items.filter(e=>!e.holiday&&time(e.recordedAt)<=at)
    .map(e=>({family:eventFamily(e.name),at:e.eventAt})),
    ...news.filter(b=>b.journalId===session.journalId&&time(b.importedAt)<=at&&
      b.info.timeZone===session.market.canonicalTimeZone&&(b.info.instrument===session.instrument||
        ['ES','MES'].includes(b.info.instrument)&&['ES','MES'].includes(session.instrument)))
      .flatMap(b=>b.events.filter(e=>!e.holiday&&e.sessionDate===session.rthDate)
        .filter(e=>!context.history.some(h=>h.prior?.contextPack?.eventId===e.id))
        .map(e=>({family:eventFamily(e.name),at:e.eventAt})))];
  return [...new Map(rows.filter(e=>time(e.at)>=start&&time(e.at)<end).map(e=>[`${e.family}:${e.at}`,e])).values()]
    .sort((a,b)=>time(a.at)-time(b.at)).map(e=>({...e,state:time(e.at)>at?'Upcoming' as const:'Released' as const}));
}
function uniquePaths(libraries:OvernightLibrary[],session:JournalSession) {
  const dates=new Map<string,{path:OvernightPath;library:OvernightLibrary}[]>();
  for(const library of libraries.filter(l=>overnightLibraryCompatible(l,session.market)))for(const path of library.days){
    if(path.date>=session.rthDate||!path.contract)continue;
    const rows=dates.get(path.date)??[];rows.push({path,library});dates.set(path.date,rows);
  }
  return [...dates.values()].flatMap(rows=>{
    if(rows.length===1)return rows;
    const sig=({path:p,library:l}:typeof rows[number])=>JSON.stringify([p.contract,p.base,p.closes,p.highs,p.lows,p.observed,p.opening,l.sampleMinutes]);
    if(rows.some(r=>sig(r)!==sig(rows[0]!)))return [];
    return [rows.sort((a,b)=>a.path.id.localeCompare(b.path.id))[0]!];
  });
}
function historicalPoint(path:OvernightPath,library:OvernightLibrary,minute:number) {
  const i=sampleIndex(library.sampleMinutes,minute);
  if(i<0)return null;
  const high=path.highs[i],low=path.lows[i];
  if(!valid(high)||!valid(low)||high<=low)return null;
  return {index:i,minute:library.sampleMinutes[i]!,high,low,width:high-low,close:path.closes[i]??null,
    coverage:path.observed[i]!/library.sampleMinutes[i]!};
}

function forecastAt(args:{session:JournalSession;window:OnWindow;libraries:OvernightLibrary[];news:ContextBatch[];
  reference:{high:number;low:number};asOf:string}):OnForecast|null {
  const {session,window,libraries,news,reference,asOf}=args,start=time(window.startAt),open=time(window.openAt);
  const begins=open-90*60000,cutoff=time(asOf);
  if(session.calendarStatus==='CLOSED'||cutoff<begins||cutoff>=open||reference.high<=reference.low)return null;
  const read=deriveOvernightObservationRead(session,{...window,now:asOf});
  const total=(open-start)/60000,anchorMinute=total-90,width=reference.high-reference.low;
  const observed=read.prices.at(-1)??null;
  const sampled=read.prices.filter(p=>time(p.at)<=cutoff);
  const events=currentNews(session,news,asOf,new Date(begins).toISOString(),window.openAt);
  const signatures=(rows:{family:string;minute:number}[])=>rows.filter(e=>['cpi','ppi','jobs'].includes(e.family)).map(e=>`${e.family}:${Math.round(e.minute)}`).sort().join('|');
  const expectedNews=signatures(events.map(e=>({family:e.family,minute:(time(e.at)-start)/60000})));
  const latestMinute=observed?(time(observed.at)-start)/60000:anchorMinute;
  const rangeMinute=read.knownAt?(time(read.knownAt)-start)/60000:anchorMinute;
  const priceAgeMinutes=observed?Math.max(0,(cutoff-time(observed.at))/60000):null;
  const pricePosition=observed?(observed.price-reference.low)/width:null;
  const freshness=priceAgeMinutes===null?0:1/(1+priceAgeMinutes/15);
  const candidates=uniquePaths(libraries,session).flatMap(({path,library})=>{
    const anchor=historicalPoint(path,library,anchorMinute),latest=historicalPoint(path,library,latestMinute);
    if(!anchor||!latest||!valid(latest.close)||anchor.coverage<.8||latest.coverage<.8)return [];
    const historicalWidth=anchor.width*library.tickSize;
    let distance=Math.abs(Math.log(historicalWidth/width));
    const range=historicalPoint(path,library,rangeMinute);
    if(range&&read.width)distance+=.5*Math.abs(Math.log(range.width*library.tickSize/read.width));
    // Match the supplied observation times; neither dense historical closes nor
    // a long unobserved gap becomes evidence of today's continuous residence.
    const pairs=sampled.flatMap(p=>{
      const m=(time(p.at)-start)/60000,index=sampleIndex(library.sampleMinutes,m),v=path.closes[index];
      return index<0||!valid(v)?[]:[{actual:(p.price-reference.low)/width,prior:(v-anchor.low)/anchor.width}];
    });
    if(pairs.length)distance+=pairs.reduce((sum,p)=>sum+Math.min(2,Math.abs(p.actual-p.prior)),0)/pairs.length;
    // Band balance compares identical observed opportunities. It is not an
    // assertion that a manual observation represents continuous occupation.
    if(pairs.length){const actual=emptyCounts(),prior=emptyCounts();
      for(const p of pairs){actual[onBand(p.actual,0,1)]++;prior[onBand(p.prior,0,1)]++;}
      distance+=.25*ON_BANDS.reduce((sum,b)=>sum+Math.abs(actual[b]-prior[b])/pairs.length,0);}
    if(pairs.length>1){const a=pairs[0]!,b=pairs.at(-1)!;
      distance+=.5*Math.min(2,Math.abs((b.actual-a.actual)-(b.prior-a.prior)));}
    const newsMatch=expectedNews!==''&&signatures(path.events)===expectedNews;
    if(expectedNews&&!newsMatch)distance+=1;
    const weight=Math.exp(-distance)*Math.min(1,latest.coverage)*(sampled.length?Math.max(.25,pairs.length/sampled.length):.5);
    // Only a completed learning outcome is used for remaining movement. A stale
    // live price uses the historical interval from THAT price time to the open.
    const projected=observed?observed.price+(path.opening-latest.close)/anchor.width*width:
      reference.low+(path.opening-anchor.low)/anchor.width*width;
    // Same relative price location means the same normalized moves into each
    // fixed opening band. Starting width adds the known absolute scale. These
    // soft comparisons never read the future opening; stale prices widen them.
    const geometry=(Math.log(historicalWidth/width)/Math.log(2))**2+
      (pricePosition===null?0:freshness*((pricePosition-(latest.close-anchor.low)/anchor.width)/.5)**2);
    const kernel=Math.exp(-geometry/2);
    return [{path,library,distance:distance+geometry,weight:weight*kernel,kernel,newsMatch,band:onBand(projected,reference.low,reference.high)}];
  });
  if(!candidates.length)return null;
  const selected=[...candidates].sort((a,b)=>a.distance-b.distance||a.path.date.localeCompare(b.path.date)).slice(0,40);
  const effectiveDays=selected.reduce((sum,c)=>sum+c.weight,0),counts=emptyCounts();
  // Broad support remains the same opening target and remaining horizon, never
  // the original 5 AM probabilities used as a floor in later updates.
  const newsPool=candidates.filter(c=>c.newsMatch),newsMatchedBaseline=!!expectedNews&&newsPool.length>=10;
  const baseline=newsMatchedBaseline?newsPool:candidates,broad=emptyCounts(),conditional=emptyCounts();
  for(const b of ON_BANDS)broad[b]=.5;
  for(const c of baseline){broad[c.band]++;conditional[c.band]+=c.kernel;}
  const baselineEffectiveDays=baseline.reduce((sum,c)=>sum+c.kernel,0),baselineProbabilities=emptyCounts();
  // Smooth once at the historical baseline, rather than adding a neutral
  // half-vote to every band of the final estimate. One broad pseudo-night
  // preserves uncertainty when geometry analogues are thin or weights vanish.
  for(const b of ON_BANDS){
    baselineProbabilities[b]=(conditional[b]+broad[b]/(baseline.length+3))/(baselineEffectiveDays+1);
    counts[b]=20*baselineProbabilities[b];
  }
  for(const c of selected)counts[c.band]+=c.weight;
  const sum=20+effectiveDays,probabilities=Object.fromEntries(ON_BANDS.map(b=>[b,counts[b]/sum])) as Record<OnBand,number>;
  const sources=[...new Map(candidates.flatMap(c=>c.library.sources).map(s=>[s.file,s])).values()];
  return {modelVersion:ON_MODEL,asOf,until:window.openAt,referenceAt:new Date(begins).toISOString(),high:reference.high,low:reference.low,
    price:observed?.price??null,priceAt:observed?.at??null,remainingMinutes:(open-cutoff)/60000,probabilities,
    eligibleDays:candidates.length,selectedDays:selected.length,effectiveDays,matches:selected.map(c=>({id:c.path.id,weight:c.weight})),
    sources,news:events,newsMatches:selected.filter(c=>c.newsMatch).length,newsMatchedBaseline,baselineDays:baseline.length,
    scheduleReconstructed:events.length>0,
    baseline:{probabilities:baselineProbabilities,effectiveDays:baselineEffectiveDays,priceAgeMinutes,pricePosition}};
}

export function deriveOvernightStudy(args:{session:JournalSession;window:OnWindow;libraries:OvernightLibrary[];
  news?:ContextBatch[];saved?:OnForecastUpdate[]}):OvernightStudy {
  const {session,window,libraries}=args,open=time(window.openAt),start=time(window.startAt),now=time(window.now);
  const begins=open-90*60000,live=now>=start&&now<open;
  const read=deriveOvernightObservationRead(session,window,!live);
  const saved=(args.saved??session.onForecastUpdates??[]).filter(r=>r.sessionId===session.id&&r.journalId===session.journalId&&r.contract===session.contract)
    .sort((a,b)=>time(a.forecast.asOf)-time(b.forecast.asOf)||time(a.recordedAt)-time(b.recordedAt));
  const anchorRead=deriveOvernightObservationRead(session,{...window,now:new Date(begins).toISOString()});
  const first=saved.find(r=>time(r.forecast.asOf)===begins)?.forecast??null;
  const reference=first??(anchorRead.width&&valid(anchorRead.high)&&valid(anchorRead.low)?{high:anchorRead.high,low:anchorRead.low}:null);
  const initial=first??(now>=begins&&reference?forecastAt({...args,news:args.news??[],reference,asOf:new Date(begins).toISOString()}):null);
  const outlook=live&&now>=begins&&reference?forecastAt({...args,news:args.news??[],reference,asOf:window.now}):null;
  let widthComparison:OvernightStudy['widthComparison']=null;
  if(read.width&&read.knownAt){
    const minute=(time(read.knownAt)-start)/60000,values=uniquePaths(libraries,session).flatMap(({path,library})=>{
      const p=historicalPoint(path,library,minute);return p&&p.coverage>=.8?[p.width*library.tickSize]:[];
    }).sort((a,b)=>a-b);
    if(values.length)widthComparison={percentile:100*values.filter(v=>v<=read.width!).length/values.length,
      median:values[Math.floor(values.length/2)]!,days:values.length,at:read.knownAt};
  }
  return {read,widthComparison,initial,outlook,startsAt:new Date(begins).toISOString(),live};
}

/** Atomic append only; late reconstruction is allowed while the current ON is
 * still open, never retrospectively manufactures a forecast on an old date. */
export function appendOnForecastUpdate(session:JournalSession,update:OnForecastUpdate):JournalSession {
  const f=update.forecast,open=Temporal.Instant.from(f.until),at=Temporal.Instant.from(update.recordedAt);
  const scheduledOpen=Temporal.PlainDate.from(session.rthDate).toPlainDateTime(session.market.checkpoints.overnightLock)
    .toZonedDateTime(session.market.canonicalTimeZone).toInstant();
  if(update.version!==1||!['overnight-opening-bands-v1',ON_MODEL].includes(f.modelVersion)||update.sessionId!==session.id||update.journalId!==session.journalId||
    update.contract!==session.contract||session.studyReplay||session.close.finishedAt||!open.equals(scheduledOpen)||
    update.sessionInputKey!==onForecastInput(session)||time(update.recordedAt)<time(f.referenceAt)||
    session.calendarStatus==='CLOSED'||!Number.isFinite(time(f.asOf))||time(f.asOf)>=time(f.until)||
    f.priceAt!==null&&(!Number.isFinite(time(f.priceAt))||time(f.priceAt)>time(f.asOf))||
    Temporal.Instant.compare(at,open)>=0||time(update.recordedAt)<time(f.asOf)||time(f.asOf)<time(f.referenceAt)||
    time(f.referenceAt)!==time(f.until)-90*60000||!valid(f.high)||!valid(f.low)||f.high<=f.low||
    ON_BANDS.some(b=>!valid(f.probabilities[b])||f.probabilities[b]<0||f.probabilities[b]>1)||
    Math.abs(Object.values(f.probabilities).reduce((s,p)=>s+p,0)-1)>1e-8||
    !/^[a-f0-9]{64}$/.test(update.id))throw new Error('This ON forecast is outside the current overnight session.');
  const baseline=f.baseline;
  if((f.modelVersion===ON_MODEL)!==!!baseline||baseline&&(
    !Number.isInteger(f.baselineDays)||f.baselineDays<1||!Number.isInteger(f.eligibleDays)||f.baselineDays>f.eligibleDays||
    !valid(baseline.effectiveDays)||baseline.effectiveDays<0||baseline.effectiveDays>f.baselineDays+1e-8||
    ON_BANDS.some(b=>!valid(baseline.probabilities[b])||baseline.probabilities[b]<=0||baseline.probabilities[b]>=1)||
    Math.abs(Object.values(baseline.probabilities).reduce((s,p)=>s+p,0)-1)>1e-8||
    (f.priceAt===null?f.price!==null||baseline.priceAgeMinutes!==null||baseline.pricePosition!==null:
      !valid(f.price)||!valid(baseline.priceAgeMinutes)||!valid(baseline.pricePosition)||
      Math.abs(baseline.priceAgeMinutes-(time(f.asOf)-time(f.priceAt))/60000)>1e-8||
      Math.abs(baseline.pricePosition-(f.price-f.low)/(f.high-f.low))>1e-8)
  ))throw new Error('This ON forecast has inconsistent distance evidence.');
  const rows=session.onForecastUpdates??[];
  if(rows.some(r=>r.id===update.id))return session;
  if(time(f.asOf)===time(f.referenceAt)&&rows.some(r=>r.contract===update.contract&&time(r.forecast.asOf)===time(f.referenceAt)))return session;
  return {...session,onForecastUpdates:[...rows,structuredClone(update)].sort((a,b)=>time(a.forecast.asOf)-time(b.forecast.asOf))};
}

export function compareOnOpening(session:JournalSession,forecast:OnForecast) {
  const price=session.overnight.rthOpen;
  if(!valid(price)||session.overnight.rthOpenStatus!=='recorded')return null;
  const band=onBand(price,forecast.low,forecast.high);
  return {price,band,probability:forecast.probabilities[band]};
}
