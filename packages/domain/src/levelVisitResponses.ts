// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,SignificantLevel,SignificantLevelRevisionSnapshot} from './index';
import type {LevelVisitHistory,QualifiedLowReference} from './levelVisits';
import {memoryContractMatches} from './marketMemory';
import {Temporal} from '@js-temporal/polyfill';

const compare=(a:string,b:string)=>Date.parse(a)-Date.parse(b)||Temporal.Instant.compare(a,b);

const qualified=(level:SignificantLevel|SignificantLevelRevisionSnapshot)=>level.levelType==='low'&&level.shape==='single_price'&&
  level.producedTwentyPlus&&level.qualifyingMoveDirection==='up'&&
  (level.qualifyingMovePoints===null||level.qualifyingMovePoints>=20);

/** Existing qualification statements only; no pivot is inferred from CP. */
export function qualifiedLowReferences(levels:SignificantLevel[],sessions:JournalSession[],asOf:string):QualifiedLowReference[] {
  const days=new Map(sessions.map(day=>[day.id,day])),cutoff=Date.parse(asOf),sources=new Map<string,QualifiedLowReference[]>(),result:QualifiedLowReference[]=[];
  for(const level of levels) {
    if(level.currentStatus==='removed'||level.sessionEdge||!qualified(level)||!level.originAt||level.originTimePrecision==='unknown')continue;
    const contract=level.studyReplay?.contract??days.get(level.createdInSessionId)?.contract;
    if(!contract||level.studyReplay?.importedAt&&Date.parse(level.studyReplay.importedAt)>cutoff)continue;
    let knownAt=level.studyReplay?.knownAt??level.createdAt;
    if(!level.studyReplay&&level.revisionHistory?.length) {
      const revisions=[...level.revisionHistory].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
      if(!revisions[0]!.prior||!qualified(revisions[0]!.prior))knownAt=level.updatedAt;
      for(const revision of revisions)if(revision.resulting&&qualified(revision.resulting)&&
        (!revision.prior||!qualified(revision.prior)||revision.resulting.price!==revision.prior.price||revision.resulting.originAt!==revision.prior.originAt))knownAt=revision.occurredAt;
    }
    if(compare(knownAt,asOf)>0||compare(level.originAt,knownAt)>0)continue;
    let active=true;
    for(const event of [...level.lifecycleEvents].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)))
      if(Date.parse(event.occurredAt)<=Date.parse(knownAt))active=event.resultingStatus==='active';
    if(!active)continue;
    const reference:QualifiedLowReference={id:level.id,sourceId:level.studyReplay?.sourceId??level.id,price:level.price!,
      originAt:level.originAt,knownAt,contract,timeframe:level.sourceTimeframe,basis:level.studyReplay?'pack':'recorded'};
    const key=JSON.stringify([reference.sourceId,reference.price,Temporal.Instant.from(reference.originAt).toString()]),copies=sources.get(key)??[];
    if(copies.some(copy=>memoryContractMatches(copy.contract,contract,Number(level.createdInRthDate.slice(0,4)))))continue;
    copies.push(reference);sources.set(key,copies);result.push(reference);
  }
  return result.sort((a,b)=>compare(a.originAt,b.originAt)||a.id.localeCompare(b.id));
}

/** Link a lower independently qualified low formed during a recorded loss.
 * This is a temporal association, never automatic replacement or retirement. */
export function linkVisitQualifiedLows(level:SignificantLevel,history:LevelVisitHistory,references:QualifiedLowReference[],
  sessions:JournalSession[]) {
  if(level.levelType!=='low')return;
  const contract=level.studyReplay?.contract??sessions.find(day=>day.id===level.createdInSessionId)?.contract;
  if(!contract)return;
  const boundary=level.price??level.zoneLow!;
  const matches=new Map<string,boolean>();
  for(const visit of history.visits) {
    const response=visit.response,day=sessions.find(day=>day.id===visit.sessionId);
    if(!response?.firstBelowAt||!day)continue;
    const stop=response.endAt;
    let left=0,right=references.length;
    while(left<right){const middle=(left+right)>>1;if(compare(references[middle]!.originAt,visit.lastContactAt)<=0)left=middle+1;else right=middle;}
    for(let i=left;i<references.length&&compare(references[i]!.originAt,stop)<=0;i++) {
      const ref=references[i]!;
      if(ref.id===level.id||ref.sourceId===level.studyReplay?.sourceId||ref.price>boundary-day.market.tickSize+1e-9||
        compare(ref.knownAt,stop)>0)continue;
      const key=JSON.stringify([ref.contract,day.rthDate.slice(0,4)]);
      if(!matches.has(key))matches.set(key,memoryContractMatches(ref.contract,contract,Number(day.rthDate.slice(0,4))));
      if(matches.get(key))response.newerLows.push(ref);
    }
  }
}
