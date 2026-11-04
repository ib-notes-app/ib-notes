// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { deriveIbRead } from './ibRead';
import { captureForecastContext, forecastSimilarityDistance, type ForecastExample, type ForecastEstimate,
  type ForecastSnapshot } from './forecast';
import { studyPackCompatibility } from './studyPack';
import type { deriveSessionIbRead, SessionReadWindow } from './sessionIbRead';
import type { HistoricalIbSession, HistoricalIbImportBatch, JournalSession, SignificantLevel } from './index';
import { marketMemoryDistance, memoryContractMatches, type MarketMemory, type MarketMemoryLibrary } from './marketMemory';
import { auctionForecastDistance, auctionReferenceCompatible, validAuctionForecastContext, type AuctionForecastContext, type AuctionReferenceLibrary } from './auctionForecast';
import { deriveRemainingEdgeForecast, recordedPostBreakProgress, type RemainingEdgeForecast, type RemainingEdgeCandidate } from './remainingEdgeForecast';
import { deriveFormingWidthForecast, type FormingWidthForecast } from './formingWidthForecast';
import { deriveIbReturnForecast, type IbReturnForecast } from './ibReturnForecast';

export type BestFitPathDay = {
  date: string; contract: string; low: number; high: number;
  // Minute-end closes, and cumulative forming edges, in ticks relative to locked IBL.
  closes: Array<number | null>; formingHighs: number[]; formingLows: number[];
  // Original minute extremes, in the same relative ticks. Missing detail is unknown.
  highs?: Array<number | null>; lows?: Array<number | null>;
  earlyContext?: ForecastSnapshot['context'];
};
export type BestFitPathLibrary = {
  version: 1; instrument: string; cohort: 'REFERENCE'; tickSize: number; timeZone: string;
  open: string; lock: string; close: string;
  sources: Array<{ file: string; sha256: string }>;
  days: BestFitPathDay[];
};
export type BestFitOutlook = {
  modelVersion: 'ib-best-fit-v1' | 'ib-best-fit-memory-v1' | 'ib-best-fit-auction-v1' | 'ib-best-fit-packs-v1' | 'ib-best-fit-time-v1' | 'ib-best-fit-distance-v1' | 'ib-best-fit-observed-v1'; asOf: string; priceAt: string | null;
  estimate: ForecastEstimate; support: 'limited' | 'moderate'; historicalDays: number;
  matchingDays: number; effectiveDays: number; pathDays: number;
  sourceRowIds: string[]; referenceBatchIds: string[];
  settled: boolean; recordedEdges: 'HIGH' | 'LOW' | 'BOTH' | null;
  marketMemory?: MarketMemory; memoryDays: number;
  auctionContext?:AuctionForecastContext; auctionDays?:number;
  referencePriceBatchIds?:string[];
  remainingEdge?: RemainingEdgeForecast;
  formingWidth?: FormingWidthForecast;
  ibReturn?: IbReturnForecast;
};
const timeCache = new Map<string, number>();
const time = (at: string) => {
  const cached = timeCache.get(at);
  if (cached !== undefined) return cached;
  const result = Temporal.Instant.from(at).epochMilliseconds;
  if (timeCache.size >= 8192) timeCache.clear();
  timeCache.set(at,result); return result;
};
const square = (v: number) => v*v;
function outcome(row: HistoricalIbSession): number | null {
  if (row.dayType==='IBH'&&row.firstBreakSide==='IBH') return 0;
  if (row.dayType==='IBL'&&row.firstBreakSide==='IBL') return 1;
  if (row.dayType==='IBB'&&row.firstBreakSide==='IBH') return 2;
  if (row.dayType==='IBB'&&row.firstBreakSide==='IBL') return 3;
  if (row.dayType==='IBN'&&row.firstBreakSide===null) return 4;
  return null;
}
function jointPrior(estimate: ForecastEstimate) {
  const p=[estimate.dayType.IBH,estimate.dayType.IBL,
    estimate.firstBreak.IBH-estimate.dayType.IBH,estimate.firstBreak.IBL-estimate.dayType.IBL,estimate.dayType.IBN]
    .map(v=>Math.max(0,v));
  const total=p.reduce((s,n)=>s+n,0);
  return p.map(n=>n/total);
}
function percentile(values: Array<{value:number;weight:number}>, p:number) {
  const sorted=[...values].sort((a,b)=>a.value-b.value), target=p*sorted.reduce((n,r)=>n+r.weight,0);
  let sum=0;for(const row of sorted){sum+=row.weight;if(sum>=target)return row.value;}return sorted.at(-1)!.value;
}
/** Current best-fit view only. Never mutates/persists the original forecast or trains on this view. */
export function deriveBestFitOutlook(args: {
  session: JournalSession; current: ReturnType<typeof deriveSessionIbRead>; window: SessionReadWindow;
  historical: HistoricalIbSession[]; batches: HistoricalIbImportBatch[];
  examples?: ForecastExample[]; paths?: BestFitPathLibrary | null; levels?: SignificantLevel[];
  marketMemory?: MarketMemory | null; memoryLibrary?: MarketMemoryLibrary | null;
  auctionContext?:AuctionForecastContext|null; auctionLibrary?:AuctionReferenceLibrary|null;
  referencePriceBatchIds?:string[];
}, researchOmit: ReadonlyArray<'recovery' | 'landmarks' | 'news' | 'auction' | 'calendar'> = []): BestFitOutlook | null {
  // Research-only paired comparisons. App callers keep every existing rule and weight.
  // Removing a group means unavailable evidence, never a contrary/negative observation.
  const omitted = new Set(researchOmit);
  const memoryForResearch = (memory: MarketMemory): MarketMemory => !omitted.size ? memory : ({
    recovery: omitted.has('recovery') ? null : memory.recovery,
    local: omitted.has('recovery') ? null : memory.local,
    landmark: omitted.has('landmarks') ? null : memory.landmark,
    news: omitted.has('news') ? [] : memory.news,
  });
  const {session,current,window,historical,batches}=args, saved=session.forecast;
  if(!current||current.closed||current.phase==='PENDING'||!current.width||
    current.low===null||current.high===null||(saved&&time(window.now)<time(saved.issuedAt)))return null;
  const now=time(window.now), open=time(window.openAt), lock=time(window.ibLockAt), cutoff=time(current.asOf);
  const sessionMinutes=(time(window.closeAt)-open)/60000;
  const currentMinute=Math.max(1,Math.min(sessionMinutes,Math.floor((time(current.rangeKnownAt)-open)/60000)));
  const actualLockMinutes=(lock-open)/60000;
  const pathLibrary=args.paths;
  const sameClock=(a:string,b:string)=>Temporal.PlainTime.compare(a,b)===0;
  const usePaths=pathLibrary?.cohort==='REFERENCE'&&pathLibrary.tickSize===session.market.tickSize&&
    pathLibrary.timeZone===session.market.canonicalTimeZone&&sameClock(pathLibrary.open,session.market.checkpoints.overnightLock)&&
    sameClock(pathLibrary.lock,session.market.checkpoints.ibLock)&&sameClock(pathLibrary.close,session.market.checkpoints.studyClose)&&
    !studyPackCompatibility({instrument:pathLibrary.instrument},session.market).error;
  const paths=new Map((usePaths?pathLibrary!.days:[]).map(d=>[d.date,d]));
  const memoryLibrary=args.memoryLibrary;
  const useMemory=usePaths&&memoryLibrary?.version===1&&memoryLibrary.cohort==='REFERENCE'&&
    memoryLibrary.tickSize===pathLibrary!.tickSize&&memoryLibrary.timeZone===pathLibrary!.timeZone&&
    sameClock(memoryLibrary.open,pathLibrary!.open)&&sameClock(memoryLibrary.lock,pathLibrary!.lock)&&
    sameClock(memoryLibrary.close,pathLibrary!.close)&&!studyPackCompatibility({instrument:memoryLibrary.instrument},session.market).error;
  const memoryDays=new Map((useMemory?memoryLibrary!.days:[]).map(d=>[d.date,d]));
  const auctionLibrary=args.auctionLibrary;
  const useAuction=auctionReferenceCompatible(auctionLibrary,session.market)&&session.contractStatus==='known'&&!!session.contract;
  const auctionContext=useAuction&&args.auctionContext&&validAuctionForecastContext(args.auctionContext,session.rthDate,current.asOf)
    ?args.auctionContext:null;
  const auctionDays=new Map((auctionContext?auctionLibrary!.days:[]).map(d=>[d.date,d]));
  const compatible=new Map(batches.filter(b=>b.cohort==='REFERENCE'&&(b.journalId??'es')===session.journalId&&
    time(b.importedAt)<=now&&!studyPackCompatibility(b.studyPack??{instrument:session.instrument},session.market).error).map(b=>[b.id,b]));
  const dated=new Map<string,HistoricalIbSession[]>();
  for(const row of historical){
    if(row.cohort!=='REFERENCE'||row.rthDate>=session.rthDate||(row.journalId??'es')!==session.journalId||
      !compatible.has(row.batchId)||time(row.importedAt)>now||row.status!=='OK'||outcome(row)===null||
      !Number.isFinite(row.lockedIbWidthPoints)||row.lockedIbWidthPoints<=0||
      Math.abs(row.lockedIbh-row.lockedIbl-row.lockedIbWidthPoints)>1e-8)continue;
    const list=dated.get(row.rthDate)??[];list.push(row);dated.set(row.rthDate,list);
  }
  const examples=new Map((args.examples??[]).map(e=>[e.id,e]));
  const liveContext=captureForecastContext(session,args.levels??[],current.asOf,window.now,current.read.latest?.price,
    {positiveEvidence:true,releasedOnly:true}).context;
  const age=current.read.latest?Math.max(0,(cutoff-time(current.read.latest.at))/60000):null;
  const freshness=age===null?0:1/(1+age/15);
  const matches:Array<{row:HistoricalIbSession;distance:number;weight:number;path:boolean;widthPath:BestFitPathDay|null;width:number;memory:boolean;auction:boolean}>=[];
  const below=current.phase==='LOCKED'&&!!current.read.ib?.belowCount;
  const above=current.phase==='LOCKED'&&!!current.read.ib?.aboveCount;
  const remainingCandidates:RemainingEdgeCandidate[]=[];
  // Without an original input snapshot, use the existing geometry/path fallback.
  // Missing ON/prior-day features are absent evidence, never guessed values.
  const features=saved?{...saved.features}:null;
  if(features&&session.fifteenMinute.high!==null&&session.fifteenMinute.low!==null&&session.overnight.high!==null&&session.overnight.low!==null&&
    session.fifteenMinute.high>session.fifteenMinute.low&&session.overnight.high>session.overnight.low){
    features.fifteenWidth=session.fifteenMinute.high-session.fifteenMinute.low;
    features.onWidth=session.overnight.high-session.overnight.low;
    features.openingPosition=((session.fifteenMinute.high+session.fifteenMinute.low)/2-session.overnight.low)/features.onWidth;
  }
  for(const candidates of dated.values()){
    const signature=(r:HistoricalIbSession)=>JSON.stringify([r.lockedIbh,r.lockedIbl,r.lockedIbWidthPoints,
      r.cp0730,r.forecastInputs,r.dayType,r.firstBreakSide,r.contract]);
    if(candidates.some(r=>signature(r)!==signature(candidates[0]!)))continue;
    const row=[...candidates].sort((a,b)=>a.id.localeCompare(b.id))[0]!, example=examples.get(row.id);
    const candidate=paths.get(row.rthDate), path=candidate&&memoryContractMatches(candidate.contract,row.contract,Number(row.sourceYear))&&
      candidate.low===row.lockedIbl&&candidate.high===row.lockedIbh&&candidate.closes.length===sessionMinutes&&
      candidate.formingHighs.length===actualLockMinutes&&candidate.formingLows.length===actualLockMinutes?candidate:null;
    let low=row.lockedIbl, high=row.lockedIbh, knownMinute=actualLockMinutes;
    if(current.phase==='FORMING'){
      if(path){knownMinute=Math.min(currentMinute,actualLockMinutes);low=path.low+path.formingLows[knownMinute-1]!*session.market.tickSize;
        high=path.low+path.formingHighs[knownMinute-1]!*session.market.tickSize;}
      else if(row.forecastInputs){low=row.forecastInputs.fifteenLow;high=row.forecastInputs.fifteenHigh;}
      else continue;
    }
    const width=high-low;if(width<=0)continue;
    const auctionDay=auctionDays.get(row.rthDate);
    const historicalOpen=auctionDay?.context?Temporal.PlainDate.from(row.rthDate).toZonedDateTime({timeZone:session.market.canonicalTimeZone,
      plainTime:session.market.checkpoints.overnightLock}).toInstant().toString():'';
    const historicalAuction=auctionDay&&memoryContractMatches(auctionDay.contract,row.contract,Number(row.sourceYear))&&auctionDay.context&&
      validAuctionForecastContext(auctionDay.context,row.rthDate,historicalOpen)?auctionDay.context:null;
    const historicFifteen=row.forecastInputs?row.forecastInputs.fifteenHigh-row.forecastInputs.fifteenLow:width;
    const currentFifteen=session.fifteenMinute.high!==null&&session.fifteenMinute.low!==null
      ?session.fifteenMinute.high-session.fifteenMinute.low:current.width;
    let distance=features&&example?.features?forecastSimilarityDistance(features,example.features)*.5:.5;
    distance+=square(Math.log(current.width/currentFifteen)-Math.log(width/historicFifteen));
    if(row.forecastInputs&&session.overnight.high!==null&&session.overnight.low!==null){
      const onWidth=session.overnight.high-session.overnight.low, oldOn=row.forecastInputs.onHigh-row.forecastInputs.onLow;
      if(onWidth>0&&oldOn>0)distance+=square(((current.low-session.overnight.low)/onWidth-(low-row.forecastInputs.onLow)/oldOn)/.75);
    }
    let historicRead: ReturnType<typeof deriveIbRead>|null=null, positionCompared=false;
    if(path){
      const scope=`history:${row.rthDate}`, prices=current.read.observations.flatMap(p=>{
        const minute=Math.floor((time(p.at)-open)/60000);
        const close=path.closes[minute-1];
        return minute>=1&&minute<=path.closes.length&&close!==null&&close!==undefined
          ?[{at:p.at,contract:scope,price:path.low+close*session.market.tickSize}]:[];
      });
      historicRead=deriveIbRead({asOf:current.asOf,windowStart:window.openAt,tickSize:session.market.tickSize,
        sampling:'MANUAL_PRICES',contract:scope,prices,references:[{id:'ib',kind:'IB',low,high,
          knownAt:new Date(open+knownMinute*60000).toISOString(),contract:scope,source:'Learning history sampled at recorded entry times'}]});
    }else if(current.phase==='LOCKED'&&current.lockPrice!==null&&current.read.latest&&time(current.read.latest.at)===lock&&row.cp0730!==null){
      positionCompared=true;
      distance+=freshness*square(((current.lockPrice-current.low)/current.width-(row.cp0730-low)/width)/.35);
    }
    if(historicRead&&current.read.positionPercent!==null&&historicRead.positionPercent!==null){
      positionCompared=true;
      distance+=freshness*square((current.read.positionPercent-historicRead.positionPercent)/35);
      if(current.phase==='LOCKED'&&current.read.ib&&historicRead.ib){
        const a=current.read.ib,b=historicRead.ib;
        distance+=Number((a.aboveCount>0)!==(b.aboveCount>0))+Number((a.belowCount>0)!==(b.belowCount>0));
        distance+=.35*Number((a.aboveThenInside+a.belowThenInside>0)!==(b.aboveThenInside+b.belowThenInside>0));
        if(a.insideCount&&b.insideCount)distance+=.35*Math.min(1,a.insideCount/6)*
          square((a.lowerHalfCount+a.midpointCount/2)/a.insideCount-(b.lowerHalfCount+b.midpointCount/2)/b.insideCount);
      }
    }else if(current.read.latest)distance+=.5; // Broader geometry remains useful when corresponding path evidence is unavailable.
    const context={...example?.context,...path?.earlyContext};
    for(const factor of ['news','fbd','levels'] as const)
      if(example?.packEvidence?.[factor])context[factor]=example.context[factor];
    const oldMemory=memoryDays.get(row.rthDate);
    const snapshot=oldMemory&&memoryContractMatches(oldMemory.contract,row.contract,Number(row.sourceYear))&&oldMemory.low===row.lockedIbl&&oldMemory.high===row.lockedIbh
      ?oldMemory.snapshots.filter(s=>s.minute<=Math.floor((cutoff-open)/60000)).at(-1):undefined;
    const memory=args.marketMemory&&snapshot?marketMemoryDistance(memoryForResearch(args.marketMemory),memoryForResearch(snapshot.memory)):{distance:0,groups:0,recoveryCompared:false,landmarkCompared:false,newsCompared:false};
    distance+=memory.distance;
    for(const factor of ['news','fbd','levels','quarter','weekday'] as const){
      if(factor==='news'&&omitted.has('news')||factor==='fbd'&&omitted.has('recovery')||
        factor==='levels'&&omitted.has('landmarks')||['quarter','weekday'].includes(factor)&&omitted.has('calendar'))continue;
      if(memory.recoveryCompared&&['fbd','levels'].includes(factor)||memory.landmarkCompared&&factor==='levels'||memory.newsCompared&&factor==='news')continue;
      if(liveContext[factor]!=null&&context[factor]!=null)distance+=.25*Number(liveContext[factor]!==context[factor]);
    }
    if(!omitted.has('auction')&&auctionContext&&historicalAuction)distance+=auctionForecastDistance(auctionContext,historicalAuction,
      {low:current.low,high:current.high},{low,high});
    if(path&&current.phase==='LOCKED')remainingCandidates.push({id:row.id,batchId:row.batchId,date:row.rthDate,path,distance,
      freshnessWeight:positionCompared ? .25+.75*freshness : 1,
      position:historicRead?.latest?{price:historicRead.latest.price,priceAt:historicRead.latest.at,low,high,
        typicalRthWidth:historicalAuction?.typicalRthWidth}:null,
      progress:historicRead?recordedPostBreakProgress(historicRead.ib,historicRead.observations,current.asOf):null});
    matches.push({row,distance,weight:1/(1+distance)*(positionCompared ? .25+.75*freshness : 1),path:!!historicRead,widthPath:path??null,
      width:current.phase==='LOCKED'?current.width:Math.max(current.width,current.width*row.lockedIbWidthPoints/width),memory:memory.groups>0,
      auction:!!(auctionContext&&historicalAuction)});
  }
  const nearest=matches.sort((a,b)=>a.distance-b.distance||a.row.rthDate.localeCompare(b.row.rthDate)).slice(0,40);
  if(!nearest.length)return null;
  // An older saved input snapshot may predate an imported library. It does not block a current estimate.
  const broadCounts=[.5,.5,.5,.5,.5];for(const match of matches)broadCounts[outcome(match.row)!]++;
  const broadTotal=broadCounts.reduce((sum,n)=>sum+n,0);
  const prior=saved?.estimate?jointPrior(saved.estimate):broadCounts.map(n=>n/broadTotal);
  const counts=prior.map(p=>p*20+.5), widths=nearest.map(r=>({value:r.width,weight:r.weight}));
  for(const match of nearest)counts[outcome(match.row)!]+=match.weight;
  if(above){counts[1]=0;counts[4]=0;}if(below){counts[0]=0;counts[4]=0;}
  const sum=counts.reduce((s,n)=>s+n,0), p=counts.map(n=>n/sum);
  const remainingEdge=above!==below?deriveRemainingEdgeForecast({recorded:below?'LOW':'HIGH',asOf:current.asOf,
    openAt:window.openAt,lockAt:window.ibLockAt,closeAt:window.closeAt,tickSize:session.market.tickSize,
    candidates:remainingCandidates,progress:recordedPostBreakProgress(current.read.ib,current.read.observations,current.asOf),
    position:current.read.latest?{price:current.read.latest.price,priceAt:current.read.latest.at,low:current.low,high:current.high,
      typicalRthWidth:auctionContext?.typicalRthWidth}:null}):undefined;
  if(remainingEdge?.probability!=null&&remainingEdge.remainingMinutes>0){
    const q=remainingEdge.probability, highFirstShare=(p[2]!+p[3]!)>0?p[2]!/(p[2]!+p[3]!):.5;
    p[0]=above?1-q:0;p[1]=below?1-q:0;p[2]=q*highFirstShare;p[3]=q*(1-highFirstShare);p[4]=0;
  }
  const observedAt=current.read.latest&&time(current.read.latest.at)>time(current.rangeKnownAt)
    ?current.read.latest.at:current.rangeKnownAt;
  const formingWidth=current.phase==='FORMING'?deriveFormingWidthForecast({width:current.width,asOf:current.asOf,
    observedAt,openAt:window.openAt,lockAt:window.ibLockAt,tickSize:session.market.tickSize,
    candidates:matches.flatMap(match=>match.widthPath?[{id:match.row.id,batchId:match.row.batchId,path:match.widthPath,weight:match.weight}]:[]),
    selectedIds:nearest.map(match=>match.row.id)}):undefined;
  const effectiveDays=nearest.reduce((n,r)=>n+r.weight,0), pathDays=nearest.filter(r=>r.path).length;
  const ibReturn=current.phase==='LOCKED'&&current.read.latest?deriveIbReturnForecast({asOf:current.asOf,
    openAt:window.openAt,lockAt:window.ibLockAt,closeAt:window.closeAt,tickSize:session.market.tickSize,
    candidates:remainingCandidates,position:{price:current.read.latest.price,priceAt:current.read.latest.at,
      low:current.low,high:current.high,typicalRthWidth:auctionContext?.typicalRthWidth}}):null;
  const comparableAuctionDays=nearest.filter(r=>r.auction).length;
  return {modelVersion:!saved?'ib-best-fit-observed-v1':remainingEdge?.distance?'ib-best-fit-distance-v1':remainingEdge?'ib-best-fit-time-v1':args.referencePriceBatchIds?.length?'ib-best-fit-packs-v1':comparableAuctionDays?'ib-best-fit-auction-v1':args.marketMemory?'ib-best-fit-memory-v1':'ib-best-fit-v1',asOf:current.asOf,priceAt:current.read.latest?.at??null,
    estimate:{dayType:{IBH:p[0],IBL:p[1],IBB:p[2]+p[3],IBN:p[4]},
      firstBreak:{IBH:p[0]+p[2],IBL:p[1]+p[3],none:p[4]},
      width:current.phase==='LOCKED'?{median:current.width,low:current.width,high:current.width}:
        formingWidth?.estimate??{median:percentile(widths,.5),low:percentile(widths,.1),high:percentile(widths,.9)}},
    support:effectiveDays>=20&&nearest.filter(r=>r.distance<=2).length>=20?'moderate':'limited',
    historicalDays:matches.length,matchingDays:nearest.length,effectiveDays,pathDays,
    sourceRowIds:nearest.map(r=>r.row.id),referenceBatchIds:[...new Set(nearest.map(r=>r.row.batchId))].sort(),
    ...(args.referencePriceBatchIds?.length?{referencePriceBatchIds:[...args.referencePriceBatchIds]}:{}),
    ...(remainingEdge?{remainingEdge}:{}),
    ...(formingWidth?{formingWidth}:{}),
    ...(ibReturn?{ibReturn}:{}),
    settled:above&&below,recordedEdges:above&&below?'BOTH':above?'HIGH':below?'LOW':null,
    ...(args.marketMemory?{marketMemory:args.marketMemory}:{}),memoryDays:nearest.filter(r=>r.memory).length,
    ...(auctionContext?{auctionContext,auctionDays:comparableAuctionDays}:{})};
}
