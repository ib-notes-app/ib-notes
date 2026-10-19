// SPDX-License-Identifier: MPL-2.0
import { lowTrackingHasContractGap, levelPriceRole, memoryContractMatches, type JournalSession, type SignificantLevel } from '@ib-field-notes/domain';
import {levelQuality,type LevelQuality,type QualitySources} from './levelQuality';

export type MapLevelRole = 'support' | 'resistance' | 'reference';
export type MapLevelReference = { id: string; code: string; low: number; high: number; role: MapLevelRole; quality?:LevelQuality };

const journalScopes = new WeakMap<JournalSession[], Map<string, JournalSession[]>>();
function journalDays(sessions: JournalSession[], current: JournalSession) {
  let scopes = journalScopes.get(sessions);
  if (!scopes) { scopes = new Map(); journalScopes.set(sessions, scopes); }
  const key = JSON.stringify([current.journalId, current.instrument]);
  let days = scopes.get(key);
  if (!days) { days = sessions.filter(day => day.journalId === current.journalId && day.instrument === current.instrument); scopes.set(key, days); }
  return days;
}

type RolePath = { ids: Set<string>; prices: Array<{at: number; price: number}> };
const rolePaths = new WeakMap<JournalSession[], Map<string, RolePath>>();
function rolePath(days: JournalSession[], current: JournalSession, contract: string | null, sourceScoped: boolean): RolePath {
  let paths = rolePaths.get(days);
  if (!paths) { paths = new Map(); rolePaths.set(days, paths); }
  const cutoff = Date.parse(current.close.observedAt ?? current.updatedAt), knownCutoff = Date.parse(current.updatedAt);
  const key = JSON.stringify([current.rthDate, contract, sourceScoped, cutoff, knownCutoff]);
  const cached = paths.get(key); if (cached) return cached;
  const compatible = days.filter(day => day.rthDate <= current.rthDate &&
    (!contract || !day.contract && !sourceScoped || !!day.contract && memoryContractMatches(day.contract, contract, Number(current.rthDate.slice(0, 4)))));
  const atPrices = new Map<number, Set<number>>();
  for (const day of compatible) for (const observation of day.cpObservations) {
    const at = Date.parse(observation.observedAt);
    if (at > cutoff || observation.recordedAt && Date.parse(observation.recordedAt) > knownCutoff) continue;
    const values = atPrices.get(at) ?? new Set<number>();
    values.add(observation.price); atPrices.set(at, values);
  }
  const result = { ids: new Set(compatible.map(day => day.id)),
    prices: [...atPrices].filter(([, values]) => values.size === 1)
      .map(([at, values]) => ({at, price: [...values][0]!})).sort((a, b) => a.at - b.at) };
  paths.set(key, result); return result;
}

/** A reading aid, not a strength score, lifecycle change or forecast input. */
export function levelMapRole(level: SignificantLevel, sessions: JournalSession[] | null, current: JournalSession): MapLevelRole {
  if (level.sessionEdge?.status === 'forming') return 'reference';
  const original: MapLevelRole = level.levelType === 'high' ? 'resistance' : level.levelType === 'low' ? 'support' : 'reference';
  if (!sessions) return original;
  // Preserve array identity so all lows reuse the domain tracker's saved-path cache.
  const days = journalDays(sessions, current);
  const contract = level.studyReplay?.contract ?? days.find(day => day.id === level.createdInSessionId)?.contract ?? current.contract;
  if (contract && current.contract && !memoryContractMatches(contract, current.contract, Number(current.rthDate.slice(0, 4)))) return 'reference';
  if (level.levelType === 'low') {
    if (lowTrackingHasContractGap(level,days,current)) return 'reference';
  }
  // Lows and highs follow price at their own boundary, independently of the
  // broader low-recovery tracker. Cache ordering/conflicts across all levels.
  const {ids, prices} = rolePath(days, current, contract, !!level.studyReplay);
  const knownAt = Date.parse(level.sessionEdge?.availableAt ?? level.studyReplay?.knownAt ?? level.createdAt);
  const cutoff = Date.parse(current.close.observedAt ?? current.updatedAt), knownCutoff = Date.parse(current.updatedAt);
  if (level.sessionEdge && (knownAt > cutoff || Date.parse(level.sessionEdge.recordedAt) > knownCutoff)) return 'reference';
  const low = level.price ?? level.zoneLow, high = level.price ?? level.zoneHigh;
  if (low === null || high === null) return 'reference';
  const facts: Array<{ at: string; role: MapLevelRole }> = level.marketEvents.filter(event =>
    !event.removedAt && ids.has(event.sessionId) && event.rthDate <= current.rthDate &&
    Date.parse(event.observedAt) >= knownAt && Date.parse(event.observedAt) <= cutoff && Date.parse(event.recordedAt) <= knownCutoff &&
    ['held_above', 'crossed_above', 'held_below', 'crossed_below'].includes(event.kind))
    .map(event => ({ at: event.observedAt, role: ['held_above', 'crossed_above'].includes(event.kind) ? 'support' : 'resistance' }));
  // Unclassified gaps/other artifacts stay references until an explicit role is recorded.
  const hasOriginalRole = level.levelType === 'high' || level.levelType === 'low';
  if (!hasOriginalRole && !facts.length) return 'reference';
  const firstRoleAt = hasOriginalRole ? knownAt : Date.parse(facts.reduce((first, fact) =>
    Date.parse(fact.at) < Date.parse(first) ? fact.at : first, facts[0]!.at));
  let latestAt = -Infinity, role = original;
  for (const fact of facts) if (Date.parse(fact.at) >= latestAt) { latestAt = Date.parse(fact.at); role = fact.role; }
  // Role is determined by the latest eligible outside price. Older crossings
  // belong to activity history; they cannot change this final side.
  for (let index=prices.length-1;index>=0;index--) {
    const price=prices[index]!;
    if(price.at<firstRoleAt||price.at<latestAt)break;
    if (level.sessionEdge && price.at === knownAt) continue;
    const next = levelPriceRole(level, price.price, current.market.tickSize, 'reference');
    if (next !== 'reference') { role = next;break; }
  }
  return role;
}

/** Number enabled, date/contract-eligible levels before proximity filtering.
 * CP movement and a role change cannot renumber the remaining map markers. */
export function mapLevelReferences(levels: SignificantLevel[], sessions: JournalSession[] | null, current: JournalSession,sources?:QualitySources) {
  const enabled = levels.filter(level => level.showOnMap && level.currentStatus === 'active')
    .filter(level => level.sessionEdge?.sessionId !== current.id)
    .filter(level => (level.price ?? level.zoneLow) !== null && (level.price ?? level.zoneHigh) !== null)
    .sort((a, b) => (b.price ?? b.zoneHigh!) - (a.price ?? a.zoneHigh!) || a.id.localeCompare(b.id));
  return new Map(enabled.map((level, index) => [level.id, { id: level.id, code: `L${index + 1}`,
    low: level.price ?? level.zoneLow!, high: level.price ?? level.zoneHigh!, role: levelMapRole(level, sessions, current),
    quality:levelQuality(level,sessions,current,sources,levels).quality } satisfies MapLevelReference]));
}
