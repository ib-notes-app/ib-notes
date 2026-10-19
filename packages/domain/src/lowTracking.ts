// SPDX-License-Identifier: MPL-2.0
import type { JournalSession, SignificantLevel } from './index';
import { memoryContractMatches } from './marketMemory';
import {lowReclaimTracker,type LowReclaimRead} from './lowReclaim';
export type LowTrackingState = 'waiting' | 'watching' | 'below' | 'reclaimed' | 'active' | 'support' | 'broken' | 'resistance';
export const lowTrackingLabels: Record<LowTrackingState, string> = {
  waiting: 'Waiting for price entries', watching: 'Watching the low',
  below: 'Below low · no reclaim recorded', reclaimed: 'Crossed above the low',
  active: 'Higher price recorded after crossing above', support: 'Recovery zone revisited · floor held',
  broken: 'Recovery low flushed · below zone', resistance: 'Below the recovery zone',
};
type TrackingPath = {
  eligible: JournalSession[];
  prices: Array<{observation: JournalSession['cpObservations'][number]; at:number;sessionId:string;rthDate:string;journalId:string}>;
  conflictingTimes: Set<number>;
};
// Immutable session arrays identify a saved revision. All lows in that revision
// can share timestamp parsing, ordering and same-time conflict detection.
const trackingPaths = new WeakMap<JournalSession[], Map<string,TrackingPath>>();
function eligibleSessions(sessions:JournalSession[],instrument:string,contract:string|null,date:string,sourceScoped:boolean){
  return sessions.filter(s=>s.instrument===instrument&&s.rthDate<=date&&
    (!sourceScoped||!!s.contract&&memoryContractMatches(s.contract,contract,Number(date.slice(0,4)))));
}
function trackingContract(level:SignificantLevel,sessions:JournalSession[],current:JournalSession){
  return level.studyReplay?.contract??sessions.find(s=>s.id===level.createdInSessionId)?.contract??current.contract;
}
function contractGap(level:SignificantLevel,eligible:JournalSession[],contract:string|null,current:JournalSession,
  accepts?: (observation:JournalSession['cpObservations'][number],at:number)=>boolean){
  const createdAt=Date.parse(level.createdAt);
  return eligible.some(s=>s.contract&&contract&&!memoryContractMatches(s.contract,contract,Number(current.rthDate.slice(0,4)))&&
    s.cpObservations.some(p=>{const at=Date.parse(p.observedAt);return at>=createdAt&&(!accepts||accepts(p,at));}));
}
/** The map needs provenance only, not a replay of the low's recovery history. */
export function lowTrackingHasContractGap(level:SignificantLevel,sessions:JournalSession[],current:JournalSession){
  const contract=trackingContract(level,sessions,current);
  return contractGap(level,eligibleSessions(sessions,level.instrument,contract,current.rthDate,!!level.studyReplay),contract,current);
}
function trackingPath(sessions:JournalSession[],instrument:string,contract:string|null,date:string,sourceScoped:boolean):TrackingPath {
  let paths=trackingPaths.get(sessions);
  if(!paths){paths=new Map();trackingPaths.set(sessions,paths);}
  const key=JSON.stringify([instrument,contract,date,sourceScoped]);
  const cached=paths.get(key);if(cached)return cached;
  const same=(other:string)=>memoryContractMatches(other,contract,Number(date.slice(0,4)));
  const eligible=eligibleSessions(sessions,instrument,contract,date,sourceScoped);
  const prices=eligible.filter(s=>!contract||!s.contract||same(s.contract)).flatMap(s=>s.cpObservations
    .map(observation=>({observation,at:Date.parse(observation.observedAt),sessionId:s.id,rthDate:s.rthDate,journalId:s.journalId})))
    .sort((a,b)=>a.at-b.at||a.observation.id.localeCompare(b.observation.id));
  const firstPrice=new Map<number,number>(),conflictingTimes=new Set<number>();
  for(const {observation:p,at}of prices) {
    if(firstPrice.has(at)&&firstPrice.get(at)!==p.price)conflictingTimes.add(at);
    else firstPrice.set(at,p.price);
  }
  const result={eligible,prices,conflictingTimes};paths.set(key,result);return result;
}
export type LowTrackingResult={state:LowTrackingState;floor:number|null;history:{state:LowTrackingState;price:number;at:string}[];
  contractGap:boolean;read?:LowReclaimRead};
export function deriveLowRecoveryTracking(level:SignificantLevel,sessions:JournalSession[],current:JournalSession,
  accepts?:(observation:JournalSession['cpObservations'][number],at:number)=>boolean):LowTrackingResult {
  return deriveLowTracking(level,sessions,current,accepts,true);
}
export function deriveLowTracking(level: SignificantLevel, sessions: JournalSession[], current: JournalSession,
  accepts?: (observation:JournalSession['cpObservations'][number],at:number)=>boolean,includeRead=false):LowTrackingResult {
  const boundary = level.price ?? level.zoneLow;
  let state: LowTrackingState = 'waiting';
  let floor: number | null = null;
  let reclaim: number | null = null;
  let failed = false;
  let brokenLow: number | null = null;
  const history: { state: LowTrackingState; price: number; at: string }[] = [];
  const contract = trackingContract(level,sessions,current);
  const {eligible,prices,conflictingTimes}=trackingPath(sessions,level.instrument,contract,current.rthDate,!!level.studyReplay);
  const createdAt = Date.parse(level.createdAt);
  const hasContractGap = contractGap(level,eligible,contract,current,accepts);
  const tick = current.market.tickSize;
  if (hasContractGap || level.levelType !== 'low' || boundary === null || level.sessionEdge?.status === 'forming') return { state, floor, history, contractGap:hasContractGap };
  const recovery=includeRead?lowReclaimTracker(level,tick):null;
  const cutoff=Date.parse(current.close.observedAt??current.updatedAt),known=Date.parse(current.updatedAt);
  const available=Date.parse(level.sessionEdge?.availableAt??level.studyReplay?.knownAt??level.createdAt);
  const sourceKnown=!level.sessionEdge||Date.parse(level.sessionEdge.recordedAt)<=known;
  for (let i = 0; i < prices.length; i++) {
    const {observation:p, at,sessionId,rthDate,journalId} = prices[i]!;
    if(recovery&&journalId===current.journalId&&at>=available&&at<=cutoff&&sourceKnown&&
      (!p.recordedAt||Date.parse(p.recordedAt)<=known)&&(!accepts||accepts(p,at))) {
      if(conflictingTimes.has(at))recovery.interrupt();
      else recovery.observe(p.price,p.observedAt,sessionId,rthDate);
    }
    // Conflicting prices at an identical instant do not establish direction.
    if (at < createdAt || conflictingTimes.has(at) || accepts&&!accepts(p,at)) continue;
    const below = (edge: number) => p.price <= edge - tick + tick * 1e-6;
    const above = (edge: number) => p.price >= edge + tick - tick * 1e-6;
    let next: LowTrackingState = state;
    if (reclaim === null) {
      if (below(boundary)) { floor = Math.min(floor ?? p.price, p.price); next = 'below'; }
      else if (floor !== null && above(boundary)) { reclaim = p.price; next = 'reclaimed'; }
      else if (floor === null) next = 'watching';
    } else if (floor !== null) {
      if (below(floor)) { failed = true; brokenLow = Math.min(brokenLow ?? p.price, p.price); next = 'broken'; }
      else if (failed) {
        if (above(boundary)) { floor = brokenLow ?? floor; brokenLow = null; failed = false;
          reclaim = p.price; next = 'reclaimed';
        } else next = 'resistance';
      } else if (p.price <= boundary) next = 'support';
      else if (above(reclaim)) next = 'active';
      else next = state === 'active' ? 'active' : 'reclaimed';
    }
    if (next !== state) history.push({ state: next, price: p.price, at: p.observedAt });
    state = next;
  }
  return { state, floor, history, contractGap:hasContractGap,...(recovery?{read:recovery.read}:{}) };
}
