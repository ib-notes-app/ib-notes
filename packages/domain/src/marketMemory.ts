// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { deriveIbRead, type ReadPrice } from './ibRead';
import { fbdCompatibility, type FbdBatch, type HistoricalLow } from './fbdHistory';
import { contextCompatibility, type ContextBatch } from './contextHistory';
import { newsCategory } from './forecast';
import { EVENT_WINDOW } from './eventWindows';
import type { JournalSession, SignificantLevel } from './index';
import { replayLevelApplies } from './journalReplay';
import { formatPriceNumber } from './instruments';

export type RecoveryRecord = {
  id: string; contract: string; reference: number; floor: number; floorAt: string;
  returnedAt: string; returnPrice: number; lossAt: string | null;
  // Increasing peaks, each available at its own observation time. No final maximum.
  peaks: Array<[string, number]>;
};
export type MemoryLandmark = { id: string; low: number; high: number; knownAt: string };
export type MemoryEvent = { name: string; at: string; knownAt: string };
export type MarketMemory = {
  recovery: { strength: number; age: number; distance: number } | null;
  local: { state: 'RECOVERED' | 'FLOOR_LOST'; distance: number; strength: number; nested: boolean } | null;
  landmark: { side: 'ABOVE' | 'BELOW' | 'AT'; reaction: 'RETURN' | 'LOSS' | null } | null;
  news: string[];
  // Live display evidence only; excluded from packed features and distance.
  evidence?: {
    local: { floor: number; reference: number; returnedAt: string; lossAt: string | null } | null;
    larger: { floor: number; returnedAt: string } | null;
    landmark: { low: number; high: number } | null;
  };
};
export type MarketMemoryLibrary = {
  version: 1; instrument: string; cohort: 'REFERENCE'; tickSize: number; timeZone: string;
  open: string; lock: string; close: string;
  sources: Array<{file: string; sha256: string}>;
  days: Array<{date: string; contract: string; low: number; high: number;
    snapshots: Array<{minute: number; memory: MarketMemory}>}>;
};
export type PackedMarketMemoryLibrary = Omit<MarketMemoryLibrary,'days'> & {
  encoding:'memory-tuples-v1';
  days:Array<{date:string;contract:string;low:number;high:number;snapshots:Array<[
    number,[number,number,number]|null,[number,number,number,number]|null,[number,number]|null,string[]]>}>;
};
export function unpackMarketMemoryLibrary(data:PackedMarketMemoryLibrary):MarketMemoryLibrary {
  if(data.encoding!=='memory-tuples-v1'||data.version!==1)throw new Error('Unsupported market memory projection.');
  return {...data,days:data.days.map(d=>({...d,snapshots:d.snapshots.map(([minute,r,l,a,news])=>({minute,memory:{
    recovery:r?{strength:r[0],age:r[1],distance:r[2]}:null,
    local:l?{state:l[0]?'FLOOR_LOST' as const:'RECOVERED' as const,distance:l[1],strength:l[2],nested:!!l[3]}:null,
    landmark:a?{side:(['BELOW','AT','ABOVE'] as const)[a[0]]!,reaction:([null,'RETURN','LOSS'] as const)[a[1]]!}:null,news}}))}))};
}
const ms = (at: string) => Date.parse(at);
const before = (a: string,b: string) => ms(a)!==ms(b) ? ms(a)<ms(b) : Temporal.Instant.compare(a,b)<0;
const known = (at: string,asOf: string) => !before(asOf,at);
const week = 7*86400000;
const clamp = (n:number,limit:number) => Math.max(-limit,Math.min(limit,n));
const rounded = (n:number) => Math.round(n*1000)/1000;

/** Same explicitly supplied expiry, including the short year/CME suffix.
 * No unknown contract, continuous series or rollover offset is inferred. */
export function memoryContractMatches(a: string|null,b: string|null,year: number): boolean {
  if (!a||!b) return false;
  if(a===b)return true;
  const key=(s:string)=>{
    const match=/^(?:MES|ES)([HMUZ])(\d{1,4})(?:\.CME)?$/.exec(s.toUpperCase());
    if(!match)return s;
    const digits=match[2]!;
    const y=digits.length===1?Math.floor(year/10)*10+Number(digits):digits.length===2?2000+Number(digits):Number(digits);
    return `ES:${match[1]}:${y}`;
  };
  return key(a)===key(b);
}

/** Prices have already been normalized/deduplicated by the shared IB reader.
 * Describes observed recoveries; never confirms an FBD or changes a level. */
export function recoveryPath(prices: readonly ReadPrice[], landmarks: readonly MemoryLandmark[],contract:string): RecoveryRecord[] {
  const result:RecoveryRecord[]=[];
  const timed=prices.map(p=>({p,at:ms(p.at)}));
  for(const reference of landmarks){
    const referenceAt=ms(reference.knownAt);
    let pending:{floor:number;at:string}|null=null,active:RecoveryRecord|null=null;
    for(const {p,at} of timed){
      if(at<referenceAt||at===referenceAt&&before(p.at,reference.knownAt))continue;
      if(active&&p.price<active.floor){active.lossAt=p.at;active=null;}
      if(active){
        if(p.price>active.peaks.at(-1)![1])active.peaks.push([p.at,p.price]);
        continue;
      }
      if(p.price<reference.low&&(!pending||p.price<pending.floor))pending={floor:p.price,at:p.at};
      if(pending&&p.price>=reference.high){
        active={id:`${reference.id}:${p.at}`,contract,reference:reference.high,floor:pending.floor,floorAt:pending.at,
          returnedAt:p.at,returnPrice:p.price,lossAt:null,peaks:[[p.at,p.price]]};
        result.push(active);pending=null;
      }
    }
  }
  return result;
}

/** Shared historical/live summary, cut off before using loss, peak or event facts.
 * Missing evidence stays absent; no recorded loss is not continuous survival. */
export function summarizeMarketMemory(args:{asOf:string;price:number|null;width:number;recoveries:RecoveryRecord[];
  landmarks?:MemoryLandmark[];prices?:readonly ReadPrice[];events?:MemoryEvent[];includeEvidence?:boolean}):MarketMemory {
  const {asOf,price,width}=args;
  const candidates=args.recoveries.filter(r=>known(r.returnedAt,asOf)&&ms(asOf)-ms(r.returnedAt)<=week)
    .map(r=>{
      const lost=!!r.lossAt&&known(r.lossAt,asOf);
      const peak=Math.max(r.returnPrice,...r.peaks.filter(p=>known(p[0],asOf)&&(!lost||before(p[0],r.lossAt!))).map(p=>p[1]));
      return {r,lost,strength:Math.log1p(Math.max(0,peak-r.floor)/width),
        distance:price===null?null:(price-r.floor)/width,age:(ms(asOf)-ms(r.returnedAt))/86400000};
    });
  // One flushing floor mentioned by several references is one piece of evidence.
  const floors=new Map<string,typeof candidates[number]>();
  for(const c of candidates){
    const key=`${c.r.contract}:${c.r.floor}:${new Date(ms(c.r.floorAt)).toISOString().slice(0,16)}`;
    const old=floors.get(key);
    if(!old||before(c.r.returnedAt,old.r.returnedAt))floors.set(key,c);
  }
  const values=[...floors.values()];
  const surviving=values.filter(c=>!c.lost&&c.distance!==null&&c.distance>=0&&c.distance<=10)
    .sort((a,b)=>b.strength/(1+b.age)-a.strength/(1+a.age)||a.r.id.localeCompare(b.r.id));
  const parent=surviving[0];
  const nearby=values.filter(c=>c.distance!==null&&Math.abs(c.distance)<=3)
    .sort((a,b)=>Math.abs(a.distance!)-Math.abs(b.distance!)||ms(b.r.returnedAt)-ms(a.r.returnedAt)||a.r.id.localeCompare(b.r.id))[0];
  const refs=(args.landmarks??[]).filter(r=>known(r.knownAt,asOf)&&price!==null)
    .sort((a,b)=>Math.min(Math.abs(price!-a.low),Math.abs(price!-a.high))-
      Math.min(Math.abs(price!-b.low),Math.abs(price!-b.high))||a.id.localeCompare(b.id));
  const ref=refs[0];let landmark:MarketMemory['landmark']=null;
  if(ref&&Math.min(Math.abs(price!-ref.low),Math.abs(price!-ref.high))<=3*width){
    const observations=(args.prices??[]).filter(p=>known(p.at,asOf)&&known(ref.knownAt,p.at));
    const below=observations.some(p=>p.price<ref.low),above=observations.some(p=>p.price>ref.high);
    const side=price!>ref.high?'ABOVE':price!<ref.low?'BELOW':'AT';
    landmark={side,reaction:side==='ABOVE'&&below?'RETURN':side==='BELOW'&&above?'LOSS':null};
  }
  const news=[...new Set((args.events??[]).filter(e=>known(e.knownAt,asOf)).map(e=>{
    const delta=(ms(asOf)-ms(e.at))/60000;
    if(delta < -EVENT_WINDOW.beforeMinutes)return `${newsCategory(e.name)}:AHEAD`;
    if(delta<=EVENT_WINDOW.afterMinutes)return `${newsCategory(e.name)}:WINDOW`;
    return `${newsCategory(e.name)}:AFTER`;
  }))].sort();
  return {recovery:parent?{strength:rounded(parent.strength),age:rounded(parent.age),distance:rounded(clamp(parent.distance!,10))}:null,
    local:nearby?{state:nearby.lost?'FLOOR_LOST':'RECOVERED',distance:rounded(clamp(nearby.distance!,3)),strength:rounded(nearby.strength),
      nested:surviving.some(p=>p.r.floor<nearby.r.floor&&before(p.r.returnedAt,nearby.r.returnedAt))}:null,landmark,news,
    ...(args.includeEvidence?{evidence:{
      local:nearby?{floor:nearby.r.floor,reference:nearby.r.reference,returnedAt:nearby.r.returnedAt,lossAt:nearby.lost?nearby.r.lossAt:null}:null,
      larger:(()=>{const larger=nearby&&surviving.find(p=>p.r.floor<nearby.r.floor&&before(p.r.returnedAt,nearby.r.returnedAt));
        return larger?{floor:larger.r.floor,returnedAt:larger.r.returnedAt}:null;})(),
      landmark:landmark&&ref?{low:ref.low,high:ref.high}:null,
    }}:{})};
}

/** A small bounded contribution to analogue distance, never a directional rule.
 * Unknown features neither agree nor disagree; broader odds remain in place. */
export function marketMemoryDistance(a:MarketMemory,b:MarketMemory):{distance:number;groups:number;recoveryCompared:boolean;landmarkCompared:boolean;newsCompared:boolean} {
  let distance=0,groups=0;
  let newsCompared=false;
  if(a.recovery&&b.recovery){groups++;distance+=.3*Math.min(1,
    (a.recovery.strength-b.recovery.strength)**2/4+(a.recovery.age-b.recovery.age)**2/16+
    (a.recovery.distance-b.recovery.distance)**2/16);}
  if(a.local&&b.local){groups++;distance+=.2*Math.min(1,Number(a.local.state!==b.local.state)+
    .25*Number(a.local.nested!==b.local.nested)+(a.local.strength-b.local.strength)**2/4);}
  if(a.landmark&&b.landmark){groups++;distance+=.15*Math.min(1,Number(a.landmark.side!==b.landmark.side)+
    .5*Number(a.landmark.reaction!==b.landmark.reaction));}
  if(a.news.length&&b.news.length){
    // An unverified historical advance schedule cannot disagree with an upcoming live event.
    const comparable=a.news.filter(e=>b.news.some(f=>f.split(':')[0]===e.split(':')[0]&&
      (!e.endsWith(':AHEAD')||f.endsWith(':AHEAD'))));
    if(comparable.length){groups++;newsCompared=true;distance+=.1*Number(comparable.some(e=>!b.news.includes(e)));}
  }
  return {distance,groups,recoveryCompared:!!(a.recovery&&b.recovery||a.local&&b.local),landmarkCompared:!!(a.landmark&&b.landmark),newsCompared};
}

export function describeMarketMemory(memory:MarketMemory,timeZone='America/Los_Angeles',sessionDate?:string):string|null {
  const e=memory.evidence;
  const when=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',minute:'2-digit',
    ...(sessionDate&&Temporal.Instant.from(at).toZonedDateTimeISO(timeZone).toPlainDate().toString()!==sessionDate?{month:'short',day:'numeric'}:{})}).format(new Date(at));
  if(e?.local&&memory.local?.state==='FLOOR_LOST')return `Recovery low ${formatPriceNumber(e.local.floor)} lost${e.local.lossAt?` · ${when(e.local.lossAt)}`:''}.${e.larger?` Larger recovery low ${formatPriceNumber(e.larger.floor)} has no recorded break.`:''}`;
  if(e?.local&&memory.local?.state==='RECOVERED')return `Reclaimed ${formatPriceNumber(e.local.reference)} · ${when(e.local.returnedAt)}. Recovery low ${formatPriceNumber(e.local.floor)} has no recorded break.`;
  if(e?.landmark&&memory.landmark?.reaction==='RETURN')return `Price returned above ${formatPriceNumber(e.landmark.high)}.`;
  if(e?.landmark&&memory.landmark?.reaction==='LOSS')return `Price moved below ${formatPriceNumber(e.landmark.low)}.`;
  if(memory.local?.state==='FLOOR_LOST')return memory.recovery&&memory.local.nested
    ? 'A nearby recovery floor was lost; a larger recovery remains in the recorded history.'
    : 'A nearby recovery floor was lost in the recorded prices.';
  if(memory.local?.state==='RECOVERED')return 'A nearby low recovered. No loss of its recovery floor is recorded.';
  if(memory.landmark?.reaction==='RETURN')return 'Price returned above a nearby recorded level.';
  if(memory.landmark?.reaction==='LOSS')return 'Price moved below a nearby recorded level.';
  return null;
}

export function deriveLiveMarketMemory(args:{session:JournalSession;sessions?:JournalSession[];levels?:SignificantLevel[];
  lows?:Array<{batch:FbdBatch;lows:HistoricalLow[]}>;news?:ContextBatch[];asOf:string;now:string;price:number|null;width:number;openAt?:string}):MarketMemory {
  const {session,asOf,now,width}=args,year=Number(session.rthDate.slice(0,4));
  const scope=`memory:${session.id}`,start=new Date(ms(asOf)-week).toISOString();
  const startMs=ms(start),endMs=ms(asOf);
  const sessions=[...(args.sessions??[]).filter(s=>s.id!==session.id),session]
    .filter(s=>s.journalId===session.journalId&&s.instrument===session.instrument&&s.rthDate<=session.rthDate&&
      (s.id===session.id||memoryContractMatches(s.contract,session.contract,year)));
  const prices=deriveIbRead({asOf,windowStart:start,contract:scope,tickSize:session.market.tickSize,sampling:'MANUAL_PRICES',
    // Coarse bounds discard older journal prices before exact timestamp parsing.
    // Keep boundary milliseconds (and unparseable values) for the shared reader's
    // nanosecond ordering, conflict handling and validation.
    prices:sessions.flatMap(s=>s.cpObservations.filter(p=>{
      const at=ms(p.observedAt);return !Number.isFinite(at)||at>=startMs&&at<=endMs;
    }).map(p=>({at:p.observedAt,price:p.price,contract:scope}))),references:[]}).observations;
  const refs:Array<MemoryLandmark&{kind:string}>=(args.levels??[]).filter(l=>!l.sessionEdge&&l.instrument===session.instrument&&l.currentStatus==='active'&&known(l.createdAt,now)&&
    replayLevelApplies(l,session,asOf,now)&&
    (!l.originAt||known(l.originAt,asOf))&&l.createdInRthDate<=session.rthDate&&
    (l.studyReplay?.kind==='RESISTANCE_REFERENCE'&&l.id.startsWith(`level:pack-reference:${session.journalId}:`)||
      l.createdInSessionId===session.id||sessions.some(s=>s.id===l.createdInSessionId)))
    .flatMap(l=>{const low=l.price??l.zoneLow,high=l.price??l.zoneHigh;
      return low===null||high===null?[]:[{id:l.id,low,high,knownAt:l.createdAt,kind:l.levelType}];});
  if(args.openAt&&session.overnight.status==='confirmed'&&session.overnight.high!==null&&session.overnight.low!==null&&
    known(args.openAt,asOf)&&(!session.overnight.confirmedAt||known(session.overnight.confirmedAt,now))){
    refs.push({id:'on-low',low:session.overnight.low,high:session.overnight.low,knownAt:args.openAt,kind:'low'},
      {id:'on-high',low:session.overnight.high,high:session.overnight.high,knownAt:args.openAt,kind:'other'});
  }
  const prior=session.forecast?.priorDay;
  if(prior&&known(prior.availableAt,asOf))refs.push(
    {id:'prior-ib-low',low:prior.low,high:prior.low,knownAt:prior.availableAt,kind:'other'},
    {id:'prior-ib-high',low:prior.high,high:prior.high,knownAt:prior.availableAt,kind:'other'});
  const recoveries=recoveryPath(prices,refs.filter(r=>r.kind==='low'),scope);
  for(const pack of args.lows??[]){
    if(pack.batch.journalId!==session.journalId||!known(pack.batch.importedAt,now)||fbdCompatibility(pack.batch.info,session.market).error)continue;
    for(const low of pack.lows){
      if(!memoryContractMatches(low.contract,session.contract,year)||!known(low.qualifiedAt,asOf)||!known(low.pivotKnownAt,asOf))continue;
      recoveries.push(...recoveryPath(prices,[{id:low.id,low:low.price,high:low.price,knownAt:low.qualifiedAt}],scope));
      const e=low.episode;
      // A final flushing depth without a known return is never an earlier input.
      if(!e?.reclaimAt||e.reclaimPrice===null||!known(e.reclaimAt,asOf)||!known(e.lowAt,asOf)||before(e.reclaimAt,start))continue;
      const family:RecoveryRecord={id:low.id,contract:scope,reference:low.price,floor:e.low,floorAt:e.lowAt,
        returnedAt:e.reclaimAt,returnPrice:e.reclaimPrice,lossAt:e.lowBrokenAt&&known(e.lowBrokenAt,asOf)?e.lowBrokenAt:null,
        peaks:[[e.reclaimAt,e.reclaimPrice]]};
      // Seed with only a price actually known from the pack, then follow user prices.
      const replacement=pack.lows.find(r=>r.id===e.replacementId);
      if(replacement&&known(replacement.qualifiedAt,asOf)&&!before(replacement.qualifiedAt,e.reclaimAt)&&
        (!family.lossAt||before(replacement.qualifiedAt,family.lossAt)))family.peaks.push([replacement.qualifiedAt,replacement.confirmationPrice]);
      for(const p of prices){
        if(before(p.at,e.reclaimAt)||family.lossAt&&known(family.lossAt,p.at))continue;
        if(p.price<family.floor){family.lossAt=p.at;continue;}
        family.peaks.push([p.at,p.price]);
      }
      recoveries.push(family);
    }
  }
  const events:MemoryEvent[]=session.marketContextItems.filter(e=>!e.holiday&&known(e.recordedAt,now)&&e.eventDate===session.rthDate)
    .map(e=>({name:e.name,at:e.eventAt,knownAt:before(e.recordedAt,e.eventAt)?e.recordedAt:e.eventAt}));
  for(const batch of args.news??[]){
    if(batch.journalId!==session.journalId||!known(batch.importedAt,now)||contextCompatibility(batch.info,session.market).error)continue;
    for(const e of batch.events.filter(e=>!e.holiday&&e.sessionDate===session.rthDate))events.push({name:e.name,at:e.eventAt,knownAt:e.eventAt});
  }
  return summarizeMarketMemory({asOf,price:args.price,width,recoveries,landmarks:refs,prices,events,includeEvidence:true});
}
