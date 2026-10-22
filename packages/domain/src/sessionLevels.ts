// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { carryRangeEdgesForward, deriveSessionFinalIb, deriveSessionRecordedIb, memoryContractMatches,
  dailyLowSignificantLevelId, upsertFinishedSessionDailyLow,
  type JournalSession, type SignificantLevel } from './index';

export type SessionEdgeCode = 'ONH' | 'ONL' | 'IBH' | 'IBL';
export type SessionEdgeSource = {
  code: SessionEdgeCode; sessionId: string; rthDate: string; contract: string | null;
  status: 'forming' | 'locked'; availableAt: string; recordedAt: string;
  /** Clock-locked recorded bounds do not assert complete market coverage. */
  confirmed?: boolean;
};

const sourceCache = new WeakMap<JournalSession, {phase:string;levels:SignificantLevel[]}>();
function sourceLevels(day: JournalSession, asOf:string): SignificantLevel[] {
  const checkpoint = (time: string) => {
    let date = Temporal.PlainDate.from(day.rthDate);
    if (Temporal.PlainTime.compare(time, day.market.checkpoints.overnightLock) < 0) date = date.add({days:1});
    return date.toZonedDateTime({timeZone:day.market.canonicalTimeZone, plainTime:time}).toInstant().toString();
  };
  const onLock=checkpoint(day.market.checkpoints.overnightLock),ibLock=checkpoint(day.market.checkpoints.ibLock);
  const onEnded=Date.parse(asOf)>=Date.parse(onLock),ibEnded=Date.parse(asOf)>=Date.parse(ibLock);
  const phase=`${onEnded}:${ibEnded}`;
  const cached=sourceCache.get(day);if(cached?.phase===phase)return cached.levels;
  const preopen = day.preOpenSnapshots.at(-1);
  const a = carryRangeEdgesForward(day.aPeriod, day.fifteenMinute);
  const b = carryRangeEdgesForward(day.bPeriod, a, ...day.bSnapshots);
  const final = deriveSessionFinalIb(day);
  const recorded=deriveSessionRecordedIb(day,asOf);
  const ib = recorded ?? final ?? b;
  const ibRecordedAt = [...day.fifteenMinuteHistory, ...day.aPeriodHistory, ...day.bPeriodHistory, ...day.bSnapshots]
    .map(range => range.recordedAt).sort((a,b) => Date.parse(a)-Date.parse(b)).at(-1)
    ?? day.bPeriod.confirmedAt ?? day.aPeriod.confirmedAt ?? day.updatedAt;
  const ranges = [
    { codes:['ONH','ONL'] as const, high:day.overnight.high ?? preopen?.formingOvernightHigh ?? null,
      low:day.overnight.low ?? preopen?.formingOvernightLow ?? null, locked:onEnded,
      confirmed:day.overnight.status === 'confirmed',
      availableAt:onLock, recordedAt:day.overnight.confirmedAt ?? preopen?.recordedAt ?? day.updatedAt },
    { codes:['IBH','IBL'] as const, high:ib.high, low:ib.low, locked:ibEnded&&!!recorded,confirmed:!!final,
      availableAt:ibLock, recordedAt:ibRecordedAt },
  ];
  const result = ranges.flatMap(range => range.codes.flatMap((code,index) => {
    const price = index === 0 ? range.high : range.low;
    if (price === null || !Number.isFinite(price)) return [];
    const availableAt = range.locked ? range.availableAt : range.recordedAt;
    return [{
      id:`level:session-edge:${day.id}:${code}`, instrument:day.instrument,
      createdInSessionId:day.id, createdInRthDate:day.rthDate,
      sessionEdge:{code, sessionId:day.id, rthDate:day.rthDate, contract:day.contract,
        status:range.locked ? 'locked' : 'forming', confirmed:range.confirmed, availableAt, recordedAt:range.recordedAt},
      levelType:index === 0 ? 'high' : 'low', shape:'single_price', price, zoneLow:null, zoneHigh:null,
      originTimePrecision:'unknown', originAt:null, sourceTimeframe:'session', producedTwentyPlus:false,
      qualifyingMoveDirection:null, qualifyingMovePoints:null, label:code, note:null,
      notes:[], marketEvents:[], episodes:[], showOnMap:false, linkedCpObservationId:null,
      createdAt:availableAt, currentStatus:'active', lifecycleEvents:[], revisionHistory:[], updatedAt:range.recordedAt,
    } satisfies SignificantLevel];
  }));
  sourceCache.set(day,{phase,levels:result}); return result;
}

/** Range prices remain owned by their source day. Stored records hold personal notes,
 * visibility and lifecycle choices. Nothing is duplicated on range saves or imports. */
export function sessionLevelCatalog(stored: SignificantLevel[], days: JournalSession[], current: JournalSession, asOf=current.updatedAt): SignificantLevel[] {
  const overlays = new Map(stored.filter(level => level.sessionEdge).map(level => [level.id,level]));
  const sources = new Map(days.map(day => [day.id,day])); sources.set(current.id,current);
  const eligibleDays = [...sources.values()].filter(day => day.journalId === current.journalId && day.instrument === current.instrument &&
    day.rthDate <= current.rthDate && (day.id === current.id || (!day.contract && !current.contract ||
      memoryContractMatches(day.contract,current.contract,Number(current.rthDate.slice(0,4))))))
    .filter(day=>day.calendarStatus!=='CLOSED');
  const edges = eligibleDays.flatMap(day => sourceLevels(day,asOf).filter(level => day.id === current.id || level.sessionEdge!.status === 'locked'))
    .map(source => {
      const saved = overlays.get(source.id);
      return { ...source, ...saved, price:source.price, levelType:source.levelType, shape:source.shape,
        label:source.label, sessionEdge:source.sessionEdge, createdAt:source.createdAt,
        showOnMap:saved?.showOnMap ?? source.createdInSessionId === current.id };
    });
  // Older confirmations could save the final low while skipping its library
  // record when the optional close was blank. Project that saved fact read-only;
  // existing records, notes and removal choices always keep their identity.
  const storedIds=new Set(stored.map(level=>level.id));
  const daily=eligibleDays.flatMap(day=>{
    if(!day.close.finishedAt||day.close.rthLow===null||
      Date.parse(day.close.finishedAt)>Date.parse(asOf)||storedIds.has(dailyLowSignificantLevelId(day.id)))return [];
    const level=upsertFinishedSessionDailyLow(day,null,day.close.recordedAt??day.close.finishedAt,day.market.tickSize);
    return level?[level]:[];
  });
  return [...stored.filter(level => !level.sessionEdge), ...daily, ...edges];
}
