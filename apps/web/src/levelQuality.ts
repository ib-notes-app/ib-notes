// SPDX-License-Identifier: MPL-2.0
import {deriveLowTracking,deriveSignificantLevelInteractions,deriveLevelBacktestEvidence,formatPriceNumber,memoryContractMatches,type HistoricalLow,type FbdBatch,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import {levelAreaScope} from './levelAreas';

export type LevelQuality = 'common'|'rare'|'legendary'|'ib'|'on';
export type LevelTier = Exclude<LevelQuality,'ib'|'on'>;
export type QualitySources = ReadonlyMap<string,HistoricalLow>;
export const qualityColors:Record<LevelQuality,string>={common:'#e8edf3',rare:'#a8cdf5',legendary:'#f3ce68',ib:'#f5bfd9',on:'#d0d5db'};
export const qualityNames:Record<LevelQuality,string>={common:'T3',rare:'T2',legendary:'T1',ib:'IB',on:'ON'};
const rank:Record<LevelQuality,number>={common:0,rare:1,legendary:2,ib:0,on:0};
export const strongestQuality=(values:LevelQuality[])=>values.length&&['ib','on'].includes(values[0]!)&&values.every(value=>value===values[0])
  ?values[0]!:values.reduce((a,b)=>rank[b]>rank[a]?b:a,'common');
const scopes=new WeakMap<JournalSession[],Map<string,JournalSession[]>>();
const priceScopes=new WeakMap<JournalSession[],Map<string,Array<JournalSession['cpObservations'][number]&{at:number}>>>();
function knownPrices(sessions:JournalSession[],current:JournalSession,contract:string|null|undefined,cutoff:number){
  let scopes=priceScopes.get(sessions);if(!scopes){scopes=new Map();priceScopes.set(sessions,scopes);}
  const key=JSON.stringify([current.journalId,current.instrument,current.rthDate,contract,cutoff]);
  let prices=scopes.get(key);
  if(!prices){
    prices=sessions.filter(day=>day.journalId===current.journalId&&day.instrument===current.instrument&&day.rthDate<=current.rthDate&&
      (!contract||!day.contract||memoryContractMatches(day.contract,contract,Number(current.rthDate.slice(0,4)))))
      .flatMap(day=>day.cpObservations).map(p=>({...p,at:Date.parse(p.observedAt)})).filter(p=>p.at<=cutoff);
    scopes.set(key,prices);
  }
  return prices;
}
function journalDays(sessions:JournalSession[],current:JournalSession,cutoff:number){
  let journals=scopes.get(sessions);if(!journals){journals=new Map();scopes.set(sessions,journals);}
  const key=`${current.journalId}:${cutoff}`;
  let days=journals.get(key);if(!days){days=sessions.filter(day=>day.journalId===current.journalId).map(day=>
    day.cpObservations.some(p=>Date.parse(p.observedAt)>cutoff)?{...day,cpObservations:day.cpObservations.filter(p=>Date.parse(p.observedAt)<=cutoff)}:day);
    journals.set(key,days);}
  return days;
}
const dateFormats=new Map<string,Intl.DateTimeFormat>();
const date=(level:SignificantLevel,current:JournalSession)=>level.originAt
  ? (()=>{const zone=current.market.canonicalTimeZone;let format=dateFormats.get(zone);
    if(!format){format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});dateFormats.set(zone,format);}
    return format.format(new Date(level.originAt));})()
  :level.createdInRthDate;
const scopedContract=(level:SignificantLevel,sessions:JournalSession[]|null,current:JournalSession)=>
  level.studyReplay?.contract??sessions?.find(day=>day.id===level.createdInSessionId)?.contract??current.contract;
const backtestWindows=new WeakMap<JournalSession[],Map<string,Map<string,{start:string;ibLockAt:string;close:string}>>>();
export function levelEvidenceWindows(sessions:JournalSession[],current:JournalSession){
  let scopes=backtestWindows.get(sessions);
  if(!scopes){scopes=new Map();backtestWindows.set(sessions,scopes);}
  const end=current.close.observedAt??current.updatedAt,key=JSON.stringify([current.id,end,current.updatedAt]);
  let windows=scopes.get(key);
  if(!windows){
    windows=new Map(sessions.map(day=>{
      const clock=createSessionClock(day.market),close=clock.checkpointInstant(day.rthDate,day.market.checkpoints.studyClose).toString();
      return [day.id,{start:clock.overnightStart(day.rthDate).toString(),ibLockAt:clock.checkpointInstant(day.rthDate,day.market.checkpoints.ibLock).toString(),
        close:day.id===current.id&&Date.parse(end)<Date.parse(close)?end:close}];
    }));scopes.set(key,windows);
  }
  return windows;
}
function backtestEvidence(level:SignificantLevel,sessions:JournalSession[],current:JournalSession){
  return deriveLevelBacktestEvidence({level,sessions,context:current,asOf:current.updatedAt,windows:levelEvidenceWindows(sessions,current)});
}

/** Reading quality only. No stored rank, forecast weight, likelihood or calendar-age penalty. */
export function levelQuality(level:SignificantLevel,sessions:JournalSession[]|null,current:JournalSession,
  sources:QualitySources=new Map(),related:SignificantLevel[]=[]):{quality:LevelQuality;tier:LevelTier;reason:string} {
  const grade=readLevelTier(level,sessions,current,sources,related);
  return {...grade,tier:grade.quality,quality:level.sessionEdge?(level.sessionEdge.code.startsWith('IB')?'ib':'on'):grade.quality};
}

function readLevelTier(level:SignificantLevel,sessions:JournalSession[]|null,current:JournalSession,
  sources:QualitySources,related:SignificantLevel[]):{quality:LevelTier;reason:string} {
  const common=(reason:string)=>({quality:'common' as const,reason});
  if(level.currentStatus!=='active')return common('Archived reference');
  const source=sources.get(level.studyReplay?.sourceId??'');
  const referenceContract=level.sessionEdge?.contract??scopedContract(level,sessions,current);
  if(referenceContract&&current.contract&&!memoryContractMatches(referenceContract,current.contract,Number(current.rthDate.slice(0,4))))
    return common('Contract provenance needs review');
  const matchingSource=source&&source.price===level.price&&memoryContractMatches(source.contract,scopedContract(level,sessions,current),Number(current.rthDate.slice(0,4)))?source:null;
  const cutoff=Date.parse(current.close.observedAt??current.updatedAt);
  // Journal creation is bookkeeping time, often later than the recorded close.
  // Source confirmation and price events still obey the market-time cutoff.
  const available=(candidate:SignificantLevel)=>candidate.studyReplay?Date.parse(candidate.studyReplay.knownAt)<=cutoff
    :candidate.sessionEdge?candidate.createdInRthDate<=current.rthDate&&candidate.sessionEdge.status==='locked'&&Date.parse(candidate.sessionEdge.availableAt)<=cutoff
    :candidate.createdInRthDate<=current.rthDate;
  if(level.sessionEdge?.status==='forming')return common('Forming range reference');
  if(!available(level))return common('Not yet available on this day');
  if(level.studyReplay?.breakoutBacktest?.coverageHasGaps)return common('Backtest coverage is incomplete');
  const structural=()=>structuralTier(level,sessions,current,matchingSource,related,available);
  const manual=level.marketEvents.filter(event=>!event.removedAt&&event.rthDate<=current.rthDate&&Date.parse(event.observedAt)<=cutoff&&
    Date.parse(event.recordedAt)<=Date.parse(current.updatedAt));
  const retained=(reason:string)=>{
    const grade=structural();
    if(grade.quality==='common')return common(`${reason}; structural confirmation remains limited`);
    return {quality:grade.quality==='legendary'?'rare' as const:grade.quality,
      reason:`${reason}; qualified structure remains T2. Activity between entries is unknown`};
  };
  const observedTest=manual.some(event=>event.kind.startsWith('tested_')||event.kind.startsWith('held_'))||
    level.episodes.some(event=>!event.removedAt&&event.rthDate<=current.rthDate&&Date.parse(event.observedAt)<=cutoff&&Date.parse(event.confirmedAt)<=Date.parse(current.updatedAt));
  const oppositeTest=manual.some(event=>level.levelType==='low'?['tested_from_below','held_below'].includes(event.kind)
    :level.levelType==='high'?['tested_from_above','held_above'].includes(event.kind):false);
  const reused=(reason:string)=>{
    if(!sessions||!['low','high'].includes(level.levelType))return retained(reason);
    const evidence=backtestEvidence(level,sessions,current);
    if(structural().quality==='common')return common(reason);
    if(evidence.earlierReturnAt)return common('Opposite-side return already recorded; reference has been used');
    if(!evidence.reversedAt)return retained(reason);
    const away=formatPriceNumber(evidence.maxAway);
    if(evidence.maxAway<20)return retained(`Recorded role reversal; ${away} pt away; 20 pt needed for a pending-backtest grade`);
    const shelf=evidence.defenses.length>=2;
    return {quality:shelf?'legendary' as const:'rare' as const,
      reason:`${shelf?`Defended on ${evidence.defenses.length} sessions with 20+ pt moves; `:'Qualified '}${level.levelType==='low'?'support':'resistance'} became ${evidence.role}; ${away} pt away; no return test recorded`};
  };
  // An explicit observation is evidence, not a blanket structural failure.
  if(oppositeTest)return common('Opposite-side return confirmed by you; reference has been used');
  if(matchingSource?.flushAt&&Date.parse(matchingSource.flushAt)<=cutoff)return reused('Original low already flushed');
  if(sessions){
    if(level.levelType==='low'){
      const tracking=deriveLowTracking(level,journalDays(sessions,current,cutoff),current);
      if(tracking.contractGap)return common('Contract provenance needs review');
      if(!['waiting','watching'].includes(tracking.state))return reused('Original low already flushed');
    }
    const edge=level.levelType==='low'?level.price??level.zoneLow:level.price??level.zoneHigh;
    const contract=scopedContract(level,sessions,current);
    const createdAt=Date.parse(level.createdAt);
    const eligible=knownPrices(sessions,current,contract,cutoff).filter(p=>p.at>createdAt);
    if(['low','high'].includes(level.levelType)) {
      if(edge!==null&&eligible.some(p=>level.levelType==='low'?p.price<=edge:p.price>=edge))return reused('Reference already revisited');
    } else if(deriveSignificantLevelInteractions([level],eligible,current.market.tickSize).length ||
      level.shape==='price_zone'&&eligible.some(p=>p.price>=level.zoneLow!&&p.price<=level.zoneHigh!))return common('Recorded interaction with this reference');
  }
  if(observedTest)return retained('Test or response confirmed by you');
  if(manual.length)return retained('Role change confirmed by you');
  return structural();
}

function structuralTier(level:SignificantLevel,sessions:JournalSession[]|null,current:JournalSession,matchingSource:HistoricalLow|null,
  related:SignificantLevel[],available:(level:SignificantLevel)=>boolean):{quality:LevelTier;reason:string} {
  const cutoff=Date.parse(current.close.observedAt??current.updatedAt);
  const move=level.producedTwentyPlus||!!matchingSource;
  const strongFrame=['3h','1h+3h','4h','daily'].includes(level.sourceTimeframe);
  const scope=levelAreaScope(level.instrument,scopedContract(level,sessions,current),Number(current.rthDate.slice(0,4)));
  const family=related.filter(other=>other.levelType===level.levelType&&other.price===level.price&&other.shape===level.shape&&available(other)&&
    other.zoneLow===level.zoneLow&&other.zoneHigh===level.zoneHigh&&date(other,current)===date(level,current)&&
    levelAreaScope(other.instrument,scopedContract(other,sessions,current),Number(current.rthDate.slice(0,4)))===scope);
  const daily=level.sourceTimeframe==='daily'||family.some(other=>other.sourceTimeframe==='daily');
  const verifiedMove=move||family.some(other=>other.producedTwentyPlus);
  const threeHour=!!matchingSource?.threeHourKnownAt&&Date.parse(matchingSource.threeHourKnownAt)<=cutoff;
  const reference=level.studyReplay?.levelReference?.reference;
  const shelf=reference?.kind==='RESISTANCE_SHELF'&&reference.evidence.dates.length>=2;
  if(level.studyReplay?.breakoutBacktest||shelf||threeHour||verifiedMove&&(strongFrame||daily))
    return {quality:'legendary',reason:level.studyReplay?.breakoutBacktest?'Confirmed breakout and backtest; later activity may be missing'
      :shelf?'Shelf supported by multiple dates; later activity may be missing':'Confirmed broader structure and qualifying move; later activity may be missing'};
  if(verifiedMove||daily||['3h','1h+3h','4h'].includes(level.sourceTimeframe)||reference?.kind==='RANGE_HIGH')
    return {quality:'rare',reason:'Qualified structural reference; later activity may be missing'};
  return {quality:'common',reason:'Ordinary reference or limited recorded structure'};
}

export function historicalLowLevel(low:HistoricalLow,batch:FbdBatch,current:JournalSession):SignificantLevel {
  return {id:`quality:${low.id}`,instrument:current.instrument,createdInSessionId:'pack',createdInRthDate:low.originAt.slice(0,10),
    levelType:'low',shape:'single_price',price:low.price,zoneLow:null,zoneHigh:null,originTimePrecision:'approximate',originAt:low.originAt,
    sourceTimeframe:'1h',producedTwentyPlus:low.confirmationPrice-low.price>=20,qualifyingMoveDirection:'up',qualifyingMovePoints:low.confirmationPrice-low.price,
    label:null,note:null,notes:[],marketEvents:[],episodes:[],showOnMap:false,linkedCpObservationId:null,currentStatus:'active',lifecycleEvents:[],
    createdAt:low.qualifiedAt,updatedAt:low.cutoffAt,
    studyReplay:{packId:batch.id,sourceId:low.id,knownAt:low.qualifiedAt,contract:low.contract,scope:'CONTRACT',kind:'SIGNIFICANT_LOW',sourceStatus:'Pack',
      ...(low.breakoutBacktest?{breakoutBacktest:low.breakoutBacktest}:{} )}};
}
