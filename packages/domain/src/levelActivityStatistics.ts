// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { deriveIbRead } from './ibRead';
import { deriveLowTracking } from './lowTracking';
import { levelPriceRole, type LevelPriceRole } from './levelPriceRole';
import { memoryContractMatches } from './marketMemory';
import { replayLevelApplies } from './journalReplay';
import { sessionLevelCatalog } from './sessionLevels';
import {deriveVisitsFromEligibleDays,type LevelVisit,type LevelReclaimCycle} from './levelVisits';
import {qualifiedLowReferences,linkVisitQualifiedLows} from './levelVisitResponses';
import {backtestFromEligibleDays,type LevelBacktestEvidence} from './levelBacktests';
import type {QualifiedLowReference} from './levelVisits';
import {recordedEventsFromEligibleDays,type LevelRecordedEvent} from './levelRecordedEvents';
import { deriveCoreIbStatistics, deriveSignificantLevelInteractions, type JournalSession,
  type SignificantLevel, type SignificantLevelStatisticMeasure } from './index';

export type LevelActivityKind = 'touch'|'cross_above'|'cross_below'|'zone_entered'|'zone_traversed'|
  'low_below'|'low_reclaimed'|'recovery_higher'|'recovery_lost'|'support_retest'|'resistance_retest'|'became_support'|'became_resistance'|'visit'|'reclaim_cycle';
export type LevelActivityFact = {
  id:string; levelId:string; sessionId:string; rthDate:string; at:string; price:number|null;
  kind:LevelActivityKind|string; source:'prices'|'manual'|'confirmed';
  visit?:LevelVisit;cycle?:LevelReclaimCycle;
};
export type LevelActivityStatistics = {
  levels:SignificantLevel[]; sessions:JournalSession[]; facts:LevelActivityFact[];
  measures:Record<LevelActivityKind,SignificantLevelStatisticMeasure>;
  activeDays:SignificantLevelStatisticMeasure; visitedLevels:number; priceInteractions:number; priceCount:number;
  manualInteractions:SignificantLevelStatisticMeasure; confirmedFbd:SignificantLevelStatisticMeasure;
  confirmedFbo:SignificantLevelStatisticMeasure; ib:ReturnType<typeof deriveCoreIbStatistics>;
};
const kinds:LevelActivityKind[]=['touch','cross_above','cross_below','zone_entered','zone_traversed',
  'low_below','low_reclaimed','recovery_higher','recovery_lost','support_retest','resistance_retest','became_support','became_resistance','visit','reclaim_cycle'];
const ms=(at:string)=>Date.parse(at);
const measure=(facts:LevelActivityFact[]):SignificantLevelStatisticMeasure=>({count:facts.length,
  sessionIds:[...new Set(facts.map(fact=>fact.sessionId))].sort()});
type Input={sessions:JournalSession[];levels:SignificantLevel[];context:JournalSession;asOf:string;
  windows:ReadonlyMap<string,{start:string;ibLockAt:string;close:string}>};
type PriceScope=Omit<Input,'levels'>;

function eligibility(level:SignificantLevel,origin:JournalSession|undefined,asOf:string) {
  // Source/contract checks belong to a day, not every price in that day.
  const knownAt=level.sessionEdge?.availableAt??level.studyReplay?.knownAt??level.createdAt,known=ms(knownAt);
  const sourceKnownAt=level.studyReplay?.knownAt,sourceKnown=sourceKnownAt?ms(sourceKnownAt):null;
  const contract=level.sessionEdge?.contract??level.studyReplay?.contract??origin?.contract;
  const lifecycle=level.lifecycleEvents.map(event=>({at:ms(event.occurredAt),status:event.resultingStatus}));
  return (day:JournalSession)=>{
    if(level.sessionEdge?.status==='forming'||!replayLevelApplies(level,day,asOf,asOf)||
      contract&&(!day.contract||!memoryContractMatches(contract,day.contract,Number(day.rthDate.slice(0,4)))))return null;
    const excludeLock=level.sessionEdge?.sessionId===day.id;
    return (time:number,at:string)=>{
      if(time<known||excludeLock&&time===known)return false;
      // Preserve sub-millisecond availability in archival source timestamps.
      if(time===known&&Temporal.Instant.compare(at,knownAt)<0||sourceKnown!==null&&
        (time<sourceKnown||time===sourceKnown&&Temporal.Instant.compare(at,sourceKnownAt!)<0))return false;
      let status:string|null=null;
      for(const event of lifecycle)if(event.at<=time)status=event.status;
      return status===null||status==='active';
    };
  };
}

// Immutable saved days recur in live level reads and while browsing dates.
// Reuse their conflict/window projection; a correction creates a new day object.
const activityDays=new WeakMap<JournalSession,{lastRecordedAt:number;reads:Map<string,JournalSession>}>();
function activityDay(day:JournalSession,window:{start:string;ibLockAt:string;close:string},asOf:string) {
  const cutoff=ms(asOf),start=window.start,end=cutoff<ms(window.close)?asOf:window.close;
  let cached=activityDays.get(day);
  if(!cached){
    const recorded=[...day.cpObservations,...day.rthObservations,day.close];
    cached={lastRecordedAt:recorded.reduce((latest,p)=>p.recordedAt&&Number.isFinite(ms(p.recordedAt))
      ?Math.max(latest,ms(p.recordedAt)):latest,-Infinity),reads:new Map()};
    activityDays.set(day,cached);
  }
  // After the last recorded edit, advancing the knowledge clock cannot change
  // this day's eligible prices. Market-window and IB boundaries still apply.
  const key=JSON.stringify([start,window.ibLockAt,end,Math.min(cutoff,cached.lastRecordedAt)]);
  const saved=cached.reads.get(key);if(saved)return saved;
  const prices:JournalSession['cpObservations']=[...day.cpObservations.filter(p=>!p.recordedAt||ms(p.recordedAt)<=cutoff),
    ...day.rthObservations.filter(p=>ms(p.recordedAt)<=cutoff).map(p=>({id:p.id,price:p.price,
      observedAt:p.observedAt,source:'rth-observation' as const,timePrecision:'exact' as const})),
    ...(day.close.price!==null&&day.close.observedAt&&day.close.recordedAt&&ms(day.close.recordedAt)<=cutoff
      ?[{id:'close',price:day.close.price,observedAt:day.close.observedAt,source:'rth-close' as const,timePrecision:'exact' as const}]:[])];
  const read=deriveIbRead({asOf:end,windowStart:start,contract:day.id,tickSize:day.market.tickSize,
    sampling:'MANUAL_PRICES',references:[],prices:prices.map(p=>({at:p.observedAt,price:p.price,contract:day.id}))});
  const unique=new Map(read.observations.map(p=>[ms(p.at),p.price])),seen=new Set<number>();
  const cpObservations=prices.filter(p=>unique.has(ms(p.observedAt))&&unique.get(ms(p.observedAt))===p.price)
    .filter(p=>{const at=ms(p.observedAt);if(seen.has(at))return false;seen.add(at);return true;})
    .sort((a,b)=>ms(a.observedAt)-ms(b.observedAt));
  const closeVisible=day.close.recordedAt&&day.close.observedAt&&ms(day.close.recordedAt)<=cutoff&&ms(day.close.observedAt)<=ms(end);
  // The same observed post-lock prices feed the live IB read; project them for
  // descriptive IB totals without creating stored RTH entries.
  const rthObservations=cpObservations.filter(p=>ms(p.observedAt)>ms(window.ibLockAt)).map(p=>({id:`stats:${p.id}`,
    price:p.price,observedAt:p.observedAt,recordedAt:p.recordedAt??p.observedAt,cpObservationId:p.id,note:null}));
  const result={...day,cpObservations,rthObservations,
    close:closeVisible?day.close:{...day.close,price:null,rthHigh:null,rthLow:null,observedAt:null,recordedAt:null,finishedAt:null,pathComplete:false}};
  if(cached.reads.size>=8)cached.reads.delete(cached.reads.keys().next().value!);
  cached.reads.set(key,result);return result;
}

function* activitySessions(input:PriceScope):Generator<JournalSession> {
  const {context,asOf}=input,cutoff=ms(asOf);
  for(const day of input.sessions.filter(day=>day.journalId===context.journalId&&day.instrument===context.instrument)
    .sort((a,b)=>a.rthDate.localeCompare(b.rthDate))) {
    const window=input.windows.get(day.id);
    if(!window)throw new Error('A journal day is missing its study window.');
    if(ms(window.start)>cutoff)continue;
    yield activityDay(day,window,asOf);
  }
}

const backtestScopes=new WeakMap<JournalSession[],WeakMap<Input['windows'],Map<string,JournalSession[]>>>();
/** The same observed-price/window/conflict projection used by level activity. */
export function levelActivityPriceDays(input:PriceScope):JournalSession[] { return [...activitySessions(input)]; }
const backtestResults=new WeakMap<SignificantLevel,WeakMap<JournalSession[],LevelBacktestEvidence>>();
const eligibleScopes=new WeakMap<SignificantLevel,WeakMap<JournalSession[],JournalSession[]>>();
function eligibleLevelDays(input:PriceScope&{level:SignificantLevel}) {
  const {level,context,asOf}=input;
  const origin=input.sessions.find(day=>day.id===level.createdInSessionId);
  if(level.currentStatus==='removed'||level.instrument!==context.instrument||
    level.studyReplay?.importedAt&&ms(level.studyReplay.importedAt)>ms(asOf)||
    level.sessionEdge&&ms(level.sessionEdge.recordedAt)>ms(asOf))return [];
  let windows=backtestScopes.get(input.sessions);
  if(!windows){windows=new WeakMap();backtestScopes.set(input.sessions,windows);}
  let scopes=windows.get(input.windows);
  if(!scopes){scopes=new Map();windows.set(input.windows,scopes);}
  const key=JSON.stringify([context.journalId,context.instrument,context.rthDate,asOf]);
  let sessions=scopes.get(key);
  if(!sessions){
    sessions=[...activitySessions({...input,sessions:input.sessions.filter(day=>day.rthDate<=context.rthDate)})];scopes.set(key,sessions);
  }
  let results=eligibleScopes.get(level);
  if(!results){results=new WeakMap();eligibleScopes.set(level,results);}
  const saved=results.get(sessions);if(saved)return saved;
  const forDay=eligibility(level,origin,asOf);
  const result=sessions.map(day=>{
    const accepts=forDay(day);
    return {...day,cpObservations:accepts?day.cpObservations.filter(p=>accepts(ms(p.observedAt),p.observedAt)):[]};
  });
  results.set(sessions,result);return result;
}

/** The tier reader reuses Stats' eligibility and shares preparation across references. */
export function deriveLevelBacktestEvidence(input:PriceScope&{level:SignificantLevel}) {
  const contract=input.level.sessionEdge?.contract??input.level.studyReplay?.contract??input.sessions.find(day=>day.id===input.level.createdInSessionId)?.contract;
  if(!contract||input.level.currentStatus!=='active')return backtestFromEligibleDays(input.level,[]);
  const days=eligibleLevelDays(input);
  let results=backtestResults.get(input.level);
  if(!results){results=new WeakMap();backtestResults.set(input.level,results);}
  let result=results.get(days);
  if(!result){result=backtestFromEligibleDays(input.level,days);results.set(days,result);}
  return result;
}

const recordedResults=new WeakMap<SignificantLevel,WeakMap<JournalSession[],LevelRecordedEvent[]>>();
/** One projection for selected activity, confirmation matching and backfills. */
export function deriveLevelRecordedEvents(input:PriceScope&{level:SignificantLevel}) {
  const days=eligibleLevelDays(input),{level,asOf,context}=input;
  let results=recordedResults.get(level);
  if(!results){results=new WeakMap();recordedResults.set(level,results);}
  const saved=results.get(days);if(saved)return saved;
  const origin=input.sessions.find(day=>day.id===level.createdInSessionId),forDay=eligibility(level,origin,asOf);
  const manual=level.marketEvents.filter(event=>!event.removedAt&&ms(event.recordedAt)<=ms(asOf)&&ms(event.observedAt)<=ms(asOf)&&event.rthDate<=context.rthDate&&
    days.some(day=>day.id===event.sessionId&&forDay(day)?.(ms(event.observedAt),event.observedAt)&&
      ms(event.observedAt)>=ms(input.windows.get(day.id)!.start)&&ms(event.observedAt)<=ms(input.windows.get(day.id)!.close)));
  const result=recordedEventsFromEligibleDays(level,days,manual);results.set(days,result);return result;
}

export type LevelSupersession={levelId:string;replacement:QualifiedLowReference;lossAt:string;lastContactAt:string|null;throughAt:string};
/** Current descriptive links. Callers select T3 parents and fresh nearby support
 * replacements. Preserve original records and never infer a pivot from CP. */
export function deriveLevelSupersessionLinks(input:PriceScope&{parents:SignificantLevel[];replacements:SignificantLevel[]}) {
  const result=new Map<string,LevelSupersession>();
  const references=qualifiedLowReferences(input.replacements.filter(level=>level.currentStatus==='active'&&level.instrument===input.context.instrument),input.sessions,input.asOf);
  if(!references.length)return result;
  for(const level of input.parents){
    if(level.levelType!=='low'||level.sessionEdge?.sessionId===input.context.id)continue;
    const evidence=deriveLevelBacktestEvidence({...input,level});
    if(evidence.role!=='resistance'||!evidence.reversedAt||!evidence.lastOriginalAt||evidence.throughPrice===null||!evidence.throughAt)continue;
    const boundary=level.price??level.zoneLow;
    const contract=level.studyReplay?.contract??input.sessions.find(day=>day.id===level.createdInSessionId)?.contract;
    if(boundary===null||!contract)continue;
    const start=evidence.lastContactAt&&ms(evidence.lastContactAt)>ms(evidence.lastOriginalAt)?evidence.lastContactAt:evidence.lastOriginalAt;
    for(let i=references.length-1;i>=0;i--){
      const reference=references[i]!;
      if(Temporal.Instant.compare(reference.originAt,start)<=0||Temporal.Instant.compare(reference.originAt,evidence.throughAt)>0||
        reference.id===level.id||reference.sourceId===level.studyReplay?.sourceId||reference.price>boundary-input.context.market.tickSize+1e-9||
        evidence.throughPrice<reference.price+input.context.market.tickSize-1e-9||
        !memoryContractMatches(reference.contract,contract,Number(input.context.rthDate.slice(0,4))))continue;
      result.set(level.id,{levelId:level.id,replacement:reference,lossAt:evidence.reversedAt,lastContactAt:evidence.lastContactAt,throughAt:evidence.throughAt});break;
    }
  }
  return result;
}

/** Selected-level details reuse the same saved-price and eligibility rules as Stats. */
export function deriveLevelVisitHistory(input:PriceScope&{level:SignificantLevel;levels?:SignificantLevel[]}) {
  const {level,context,asOf}=input;
  if(level.currentStatus==='removed'||level.instrument!==context.instrument||
    level.studyReplay?.importedAt&&ms(level.studyReplay.importedAt)>ms(asOf)||
    level.sessionEdge&&ms(level.sessionEdge.recordedAt)>ms(asOf))return {visits:[],cycles:[]};
  const sessions=[...activitySessions({...input,sessions:input.sessions.filter(day=>day.rthDate<=context.rthDate)})];
  const forDay=eligibility(level,input.sessions.find(day=>day.id===level.createdInSessionId),asOf);
  const history=deriveVisitsFromEligibleDays(level,sessions.map(day=>{
    const accepts=forDay(day);
    return {...day,cpObservations:accepts?day.cpObservations.filter(p=>accepts(ms(p.observedAt),p.observedAt)):[]};
  }));
  const references=qualifiedLowReferences((input.levels??[]).filter(candidate=>candidate.instrument===context.instrument),input.sessions,asOf);
  linkVisitQualifiedLows(level,history,references,sessions);
  return history;
}

/** Read-only replay of saved prices, usable in batches or a background worker. */
export function* levelActivityStatisticsJob(input:Input):Generator<void,LevelActivityStatistics> {
  const {context,asOf}=input,cutoff=ms(asOf),sessions:JournalSession[]=[];
  for(const day of activitySessions(input)){sessions.push(day);yield;}
  const daysById=new Map(sessions.map(day=>[day.id,day]));
  const pricesByDay=new Map(sessions.map(day=>[day.id,day.cpObservations.map(observation=>({observation,at:ms(observation.observedAt)}))]));
  const priceDays=new WeakMap<JournalSession['cpObservations'][number],JournalSession>();
  const daysByTime=new Map<string,JournalSession>();
  for(const day of sessions)for(const price of day.cpObservations){
    priceDays.set(price,day);if(!daysByTime.has(price.observedAt))daysByTime.set(price.observedAt,day);
  }
  const candidates=new Map(input.levels.filter(level=>level.instrument===context.instrument).map(level=>[level.id,level]));
  // Include all contracts' native edges, while preserving saved notes/lifecycle overlays.
  for(const day of sessions) {
    for(const level of sessionLevelCatalog(input.levels,[],day,asOf).filter(level=>level.sessionEdge))candidates.set(level.id,level);
    yield;
  }
  const sources=new Map<string,SignificantLevel[]>(),levels:SignificantLevel[]=[];
  for(const level of candidates.values()) {
    // Mirrored replay/pack lows vote once; nearby independent levels remain distinct.
    if(level.studyReplay&&level.originAt&&level.levelType==='low'&&level.shape==='single_price') {
      const key=JSON.stringify([level.studyReplay.sourceId,level.price,Temporal.Instant.from(level.originAt).toString()]);
      const copies=sources.get(key)??[];
      if(copies.some(copy=>memoryContractMatches(copy.studyReplay!.contract,level.studyReplay!.contract,
        Number(level.createdInRthDate.slice(0,4)))))continue;
      copies.push(level);sources.set(key,copies);
    }
    const known=level.sessionEdge?.availableAt??level.studyReplay?.knownAt??level.createdAt;
    if(level.currentStatus!=='removed'&&ms(known)<=cutoff&&
      (!level.sessionEdge||ms(level.sessionEdge.recordedAt)<=cutoff)&&
      (!level.studyReplay?.importedAt||ms(level.studyReplay.importedAt)<=cutoff))levels.push(level);
  }
  const facts:LevelActivityFact[]=[];
  const qualifiedLows=qualifiedLowReferences(levels,sessions,asOf);
  for(const level of levels) {
    const origin=daysById.get(level.createdInSessionId);
    const forDay=eligibility(level,origin,asOf);
    const acceptsByDay=new Map(sessions.map(day=>[day.id,forDay(day)]));
    const eligible=sessions.map(day=>{
      const accepts=acceptsByDay.get(day.id);
      return {...day,cpObservations:accepts?pricesByDay.get(day.id)!.filter(p=>accepts(p.at,p.observation.observedAt)).map(p=>p.observation):[]};
    });
    const visits=deriveVisitsFromEligibleDays(level,eligible);
    linkVisitQualifiedLows(level,visits,qualifiedLows,sessions);
    for(const visit of visits.visits)facts.push({id:visit.id,levelId:level.id,sessionId:visit.sessionId,rthDate:visit.rthDate,
      at:visit.at,price:visit.price,kind:'visit',source:'prices',visit});
    for(const cycle of visits.cycles)facts.push({id:cycle.id,levelId:level.id,sessionId:cycle.sessionId,rthDate:cycle.rthDate,
      at:cycle.reclaimAt,price:cycle.reclaimPrice,kind:'reclaim_cycle',source:'prices',cycle});
    for(const day of eligible) {
      const events=deriveSignificantLevelInteractions([{...level,currentStatus:'active'}],day.cpObservations,day.market.tickSize);
      for(const event of events)facts.push({id:`prices:${event.id}:${day.id}`,levelId:level.id,sessionId:day.id,
        rthDate:day.rthDate,at:event.laterObservedAt,price:event.laterCp,source:'prices',
        kind:event.kind==='crossover'?event.direction==='below_to_above'?'cross_above':'cross_below':event.kind});
    }
    if(level.levelType==='low'&&eligible.length) {
      const current=eligible.at(-1)!;
      // Share the ordered, conflict-checked price path across lows. Filter
      // availability without cloning/reparsing/sorting history for each low.
      const tracking=deriveLowTracking(level,sessions,current,(price,at)=>
        acceptsByDay.get(priceDays.get(price)!.id)?.(at,price.observedAt)??false);
      if(!tracking.contractGap)for(const event of tracking.history) {
        const states:Partial<Record<typeof event.state,LevelActivityKind>>={below:'low_below',reclaimed:'low_reclaimed',active:'recovery_higher',
          broken:'recovery_lost',support:'support_retest',resistance:'resistance_retest'};
        const kind=states[event.state];
        if(!kind)continue;
        const day=daysByTime.get(event.at);
        if(day) {
          facts.push({id:`tracking:${level.id}:${event.state}:${event.at}`,levelId:level.id,sessionId:day.id,
            rthDate:day.rthDate,at:event.at,price:event.price,kind,source:'prices'});
        }
      }
    }
    if(level.levelType==='high'||level.levelType==='low') {
      let role:LevelPriceRole=level.levelType==='high'?'resistance':'support';
      for(const day of eligible)for(const price of day.cpObservations) {
        const next=levelPriceRole(level,price.price,day.market.tickSize,role);
        if(next!==role)facts.push({id:`role:${level.id}:${price.observedAt}`,levelId:level.id,sessionId:day.id,rthDate:day.rthDate,
          at:price.observedAt,price:price.price,kind:next==='support'?'became_support':'became_resistance',source:'prices'});
        role=next;
      }
    }
    for(const event of level.marketEvents.filter(event=>!event.removedAt&&ms(event.recordedAt)<=cutoff&&ms(event.observedAt)<=cutoff&&daysById.has(event.sessionId)))
      facts.push({id:event.id,levelId:level.id,sessionId:event.sessionId,rthDate:event.rthDate,at:event.observedAt,
        price:event.observedPrice,kind:event.kind,source:'manual'});
    for(const event of level.episodes.filter(event=>!event.removedAt&&ms(event.confirmedAt)<=cutoff&&ms(event.observedAt)<=cutoff&&daysById.has(event.sessionId)))
      facts.push({id:event.id,levelId:level.id,sessionId:event.sessionId,rthDate:event.rthDate,at:event.observedAt,
        price:event.laterCp,kind:event.classification,source:'confirmed'});
    yield;
  }
  facts.sort((a,b)=>ms(b.at)-ms(a.at)||a.id.localeCompare(b.id));
  const activeIds=new Set(facts.map(fact=>fact.sessionId));
  return {levels,sessions,facts,measures:Object.fromEntries(kinds.map(kind=>[kind,measure(facts.filter(fact=>fact.source==='prices'&&fact.kind===kind))])) as LevelActivityStatistics['measures'],
    activeDays:{count:activeIds.size,sessionIds:[...activeIds].sort()},visitedLevels:new Set(facts.map(fact=>fact.levelId)).size,
    priceInteractions:new Set(facts.filter(fact=>fact.source==='prices'&&fact.kind!=='visit'&&fact.kind!=='reclaim_cycle').map(fact=>`${fact.levelId}:${fact.sessionId}:${fact.at}`)).size,
    priceCount:sessions.reduce((count,day)=>count+day.cpObservations.length,0),manualInteractions:measure(facts.filter(fact=>fact.source==='manual')),
    confirmedFbd:measure(facts.filter(fact=>fact.source==='confirmed'&&fact.kind==='FBD')),
    confirmedFbo:measure(facts.filter(fact=>fact.source==='confirmed'&&fact.kind==='FBO')),
    ib:deriveCoreIbStatistics(sessions.filter(day=>activeIds.has(day.id)),context.market.tickSize)};
}

export function deriveLevelActivityStatistics(input:Input):LevelActivityStatistics {
  const job=levelActivityStatisticsJob(input);let step=job.next();
  while(!step.done)step=job.next();return step.value;
}
