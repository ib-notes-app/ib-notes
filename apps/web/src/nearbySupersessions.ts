// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {deriveLevelSupersessionLinks,latestCpObservation,replayLevelApplies,significantLevelDistanceFromPrice,
  deriveLevelRecordedEvents,
  type LevelSupersession,type SignificantLevel,type JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import {levelQuality,levelEvidenceWindows,type QualitySources} from './levelQuality';
import {levelMapRole} from './mapLevelReferences';

export type NearbySupersession=LevelSupersession&{hidden:boolean};
/** Only current nearby references can replace a row in Nearby. No new pack reads,
 * grade/lifecycle mutations, inferred lows or removal of explicit map choices. */
export function nearbyLevelSupersessions(levels:SignificantLevel[],sessions:JournalSession[]|null,current:JournalSession,
  sources:QualitySources,distance:number,now:string):ReadonlyMap<string,NearbySupersession> {
  const price=latestCpObservation(current)?.price;
  if(!sessions||price===undefined)return new Map();
  const clock=createSessionClock(current.market),close=clock.checkpointInstant(current.rthDate,current.market.checkpoints.studyClose).toString();
  const end=current.close.observedAt??close,asOf=Temporal.Instant.compare(now,end)<0?now:end;
  const nearby=levels.filter(level=>level.currentStatus==='active'&&level.instrument===current.instrument&&level.createdInRthDate<=current.rthDate&&
    replayLevelApplies(level,current,asOf,now)&&significantLevelDistanceFromPrice(level,price)<=distance);
  // Most days have no fresh qualified replacement. Check those candidates first
  // instead of replaying every nearby native/high/used reference on each save.
  const candidates=nearby.filter(level=>level.levelType==='low'&&!level.sessionEdge&&level.originAt&&level.originTimePrecision!=='unknown'&&
    !(sources.get(level.studyReplay?.sourceId??'')?.flushAt&&Date.parse(sources.get(level.studyReplay?.sourceId??'')!.flushAt!)<=Date.parse(asOf)));
  if(!candidates.length)return new Map();
  const readings=new Map<string,ReturnType<typeof levelQuality>>();
  const tier=(level:SignificantLevel)=>{
    let read=readings.get(level.id);
    if(!read){read=levelQuality(level,sessions,current,sources,levels);readings.set(level.id,read);}
    return read.tier;
  };
  const qualified=candidates.filter(level=>levelMapRole(level,sessions,current)==='support'&&tier(level)!=='common');
  if(!qualified.length)return new Map();
  const windows=levelEvidenceWindows(sessions,current);
  const replacements=qualified.filter(level=>!deriveLevelRecordedEvents({level,sessions,context:current,asOf:now,windows}).length);
  if(!replacements.length)return new Map();
  const parents=nearby.filter(level=>level.levelType==='low'&&level.sessionEdge?.sessionId!==current.id&&
    levelMapRole(level,sessions,current)==='resistance'&&tier(level)==='common');
  const links=deriveLevelSupersessionLinks({parents,replacements,sessions,context:current,asOf,windows});
  return new Map([...links].map(([id,link])=>[id,{...link,hidden:!parents.find(level=>level.id===id)!.showOnMap}]));
}
