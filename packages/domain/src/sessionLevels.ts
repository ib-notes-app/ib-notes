// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { carryRangeEdgesForward, deriveSessionFinalIb, memoryContractMatches,
  type JournalSession, type SignificantLevel } from './index';

export type SessionEdgeCode = 'ONH' | 'ONL' | 'IBH' | 'IBL';
export type SessionEdgeSource = {
  code: SessionEdgeCode; sessionId: string; rthDate: string; contract: string | null;
  status: 'forming' | 'locked'; availableAt: string; recordedAt: string;
};

const sourceCache = new WeakMap<JournalSession, SignificantLevel[]>();
function sourceLevels(day: JournalSession): SignificantLevel[] {
  const cached = sourceCache.get(day); if (cached) return cached;
  const checkpoint = (time: string) => {
    let date = Temporal.PlainDate.from(day.rthDate);
    if (Temporal.PlainTime.compare(time, day.market.checkpoints.overnightLock) < 0) date = date.add({days:1});
    return date.toZonedDateTime({timeZone:day.market.canonicalTimeZone, plainTime:time}).toInstant().toString();
  };
  const preopen = day.preOpenSnapshots.at(-1);
  const a = carryRangeEdgesForward(day.aPeriod, day.fifteenMinute);
  const b = carryRangeEdgesForward(day.bPeriod, a, ...day.bSnapshots);
  const final = deriveSessionFinalIb(day);
  const ib = final ?? b;
  const ibRecordedAt = [...day.fifteenMinuteHistory, ...day.aPeriodHistory, ...day.bPeriodHistory, ...day.bSnapshots]
    .map(range => range.recordedAt).sort((a,b) => Date.parse(a)-Date.parse(b)).at(-1)
    ?? day.bPeriod.confirmedAt ?? day.aPeriod.confirmedAt ?? day.updatedAt;
  const ranges = [
    { codes:['ONH','ONL'] as const, high:day.overnight.high ?? preopen?.formingOvernightHigh ?? null,
      low:day.overnight.low ?? preopen?.formingOvernightLow ?? null, locked:day.overnight.status === 'confirmed',
      availableAt:checkpoint(day.market.checkpoints.overnightLock), recordedAt:day.overnight.confirmedAt ?? preopen?.recordedAt ?? day.updatedAt },
    { codes:['IBH','IBL'] as const, high:ib.high, low:ib.low, locked:!!final,
      availableAt:checkpoint(day.market.checkpoints.ibLock), recordedAt:ibRecordedAt },
  ];
  const result = ranges.flatMap(range => range.codes.flatMap((code,index) => {
    const price = index === 0 ? range.high : range.low;
    if (price === null || !Number.isFinite(price)) return [];
    const availableAt = range.locked ? range.availableAt : range.recordedAt;
    return [{
      id:`level:session-edge:${day.id}:${code}`, instrument:day.instrument,
      createdInSessionId:day.id, createdInRthDate:day.rthDate,
      sessionEdge:{code, sessionId:day.id, rthDate:day.rthDate, contract:day.contract,
        status:range.locked ? 'locked' : 'forming', availableAt, recordedAt:range.recordedAt},
      levelType:index === 0 ? 'high' : 'low', shape:'single_price', price, zoneLow:null, zoneHigh:null,
      originTimePrecision:'unknown', originAt:null, sourceTimeframe:'session', producedTwentyPlus:false,
      qualifyingMoveDirection:null, qualifyingMovePoints:null, label:code, note:null,
      notes:[], marketEvents:[], episodes:[], showOnMap:false, linkedCpObservationId:null,
      createdAt:availableAt, currentStatus:'active', lifecycleEvents:[], revisionHistory:[], updatedAt:range.recordedAt,
    } satisfies SignificantLevel];
  }));
  sourceCache.set(day,result); return result;
}

/** Range prices remain owned by their source day. Stored records hold personal notes,
 * visibility and lifecycle choices. Nothing is duplicated on range saves or imports. */
export function sessionLevelCatalog(stored: SignificantLevel[], days: JournalSession[], current: JournalSession): SignificantLevel[] {
  const overlays = new Map(stored.filter(level => level.sessionEdge).map(level => [level.id,level]));
  const sources = new Map(days.map(day => [day.id,day])); sources.set(current.id,current);
  const edges = [...sources.values()].filter(day => day.journalId === current.journalId && day.instrument === current.instrument &&
    day.rthDate <= current.rthDate && (day.id === current.id || (!day.contract && !current.contract ||
      memoryContractMatches(day.contract,current.contract,Number(current.rthDate.slice(0,4))))))
    .flatMap(day => sourceLevels(day).filter(level => day.id === current.id || level.sessionEdge!.status === 'locked'))
    .map(source => {
      const saved = overlays.get(source.id);
      return { ...source, ...saved, price:source.price, levelType:source.levelType, shape:source.shape,
        label:source.label, sessionEdge:source.sessionEdge, createdAt:source.createdAt,
        showOnMap:saved?.showOnMap ?? source.createdInSessionId === current.id };
    });
  return [...stored.filter(level => !level.sessionEdge), ...edges];
}
