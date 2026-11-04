// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { forecastActual, type ForecastEstimate } from './forecast';
import type { BestFitOutlook } from './bestFitForecast';
import type { AuctionForecastContext } from './auctionForecast';
import type { RemainingEdgeForecast } from './remainingEdgeForecast';
import type { FormingWidthForecast } from './formingWidthForecast';
import type { IbReturnForecast } from './ibReturnForecast';
import { deriveSessionRecordedIb, type JournalSession } from './index';
import {eventContextForForecast} from './eventPriceMoves';

/** A receipt of an estimate actually displayed during the session, never a training row. */
export type ForecastUpdate = {
  version: 1; id: string; sessionId: string; journalId: string; contract: string | null;
  originalIssuedAt: string; sessionUpdatedAt: string; issuedAt: string; asOf: string;
  modelVersion: BestFitOutlook['modelVersion']; estimate: ForecastEstimate;
  phase: 'FORMING' | 'LOCKED'; high: number; low: number;
  price: number | null; priceAt: string | null;
  recordedEdges: BestFitOutlook['recordedEdges']; settled: boolean;
  support: BestFitOutlook['support']; historicalDays: number; matchingDays: number;
  effectiveDays: number; pathDays: number; memoryDays: number;
  auctionDays?:number; auctionContext?:AuctionForecastContext;
  remainingEdge?: RemainingEdgeForecast;
  formingWidth?: FormingWidthForecast;
  ibReturn?: IbReturnForecast;
  sourceRowIds: string[]; referenceBatchIds: string[];
  contextSources: { levels: string[]; lowBatches: string[]; newsBatches: string[]; priceBatches?: string[] };
};

/** Relevant saved evidence only; clock ticks, view settings and receipt writes do not change it. */
export function forecastUpdateInput(session: JournalSession, sources: unknown = null): string {
  const ordered=(value:unknown):unknown=>Array.isArray(value)?value.map(ordered):
    value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))
      .map(([key,item])=>[key,ordered(item)])):value;
  return JSON.stringify(ordered([session.id, session.market, session.contract, session.forecast?.issuedAt,
    session.overnight, session.fifteenMinute, session.fifteenMinuteHistory,
    session.aPeriod, session.aPeriodHistory, session.bPeriod, session.bPeriodHistory,
    session.bSnapshots, session.cpObservations, session.rthObservations,
    eventContextForForecast(session).items, session.forecastCoverage, sources]));
}

function studyInstant(session: JournalSession, clock: string): number {
  return Temporal.PlainDate.from(session.rthDate).toZonedDateTime({
    timeZone: session.market.canonicalTimeZone, plainTime: clock,
  }).toInstant().epochMilliseconds;
}

export function canRecordForecastUpdate(session: JournalSession, issuedAt: string): boolean {
  const at = Date.parse(issuedAt);
  if (!session.forecast || session.close.finishedAt || !Number.isFinite(at) ||
      at < Date.parse(session.forecast.issuedAt)) return false;
  return at >= studyInstant(session, session.market.checkpoints.overnightLock) &&
    at < studyInstant(session, session.market.checkpoints.studyClose);
}

/** Storage uses the latest session, so a stale calculation cannot overwrite new entries. */
export function appendForecastUpdate(session: JournalSession, update: ForecastUpdate): JournalSession {
  if (!canRecordForecastUpdate(session, update.issuedAt) ||
      update.version !== 1 || !/^[a-f0-9]{64}$/.test(update.id) ||
      update.sessionId !== session.id || update.journalId !== session.journalId ||
      update.contract !== session.contract || update.originalIssuedAt !== session.forecast!.issuedAt ||
      update.sessionUpdatedAt !== session.updatedAt || update.asOf !== update.issuedAt ||
      (session.forecastUpdates ?? []).some(row => row.id === update.id)) return session;
  const day = Object.values(update.estimate.dayType), first = Object.values(update.estimate.firstBreak);
  const probabilities = [...day, ...first];
  if (day.length !== 4 || first.length !== 3 || probabilities.some(p => !Number.isFinite(p) || p < 0 || p > 1) ||
      Math.abs(day.reduce((s, p) => s + p, 0) - 1) > 1e-6 ||
      Math.abs(first.reduce((s, p) => s + p, 0) - 1) > 1e-6 ||
      !Number.isFinite(update.high) || !Number.isFinite(update.low) || update.high <= update.low ||
      (update.priceAt && (!Number.isFinite(Date.parse(update.priceAt)) || Date.parse(update.priceAt) > Date.parse(update.issuedAt)))) return session;
  const future=update.remainingEdge;
  if(future&&(future.version!==1||update.phase!=='LOCKED'||future.asOf!==update.asOf||
    Date.parse(future.until)!==studyInstant(session,session.market.checkpoints.studyClose)||
    future.target!==(update.recordedEdges==='LOW'?'IBH':update.recordedEdges==='HIGH'?'IBL':null)||
    [future.probability,future.baselineProbability].some(p=>p!==null&&(!Number.isFinite(p)||p<0||p>1))||
    !Number.isFinite(future.remainingMinutes)||future.remainingMinutes<0||
    Math.abs(future.remainingMinutes-(Date.parse(future.until)-Date.parse(future.asOf))/60000)>1e-6||
    !Number.isInteger(future.eligibleDays)||!Number.isInteger(future.matchingDays)||future.matchingDays<0||
    future.eligibleDays<future.matchingDays||!Number.isFinite(future.effectiveDays)||future.effectiveDays<0||
    future.effectiveDays>future.matchingDays+1e-6))return session;
  const reach=future?.distance;
  if(reach&&(!future||update.modelVersion!=='ib-best-fit-distance-v1'||update.price===null||!update.priceAt||
    !Number.isFinite(Date.parse(reach.priceAt))||Temporal.Instant.compare(reach.priceAt,update.priceAt)!==0||
    !Number.isFinite(reach.points)||reach.points<=0||!Number.isFinite(reach.ibWidths)||reach.ibWidths<=0||
    Math.abs(reach.points-(future.target==='IBH'?update.high+session.market.tickSize-update.price:
      update.price-update.low+session.market.tickSize))>1e-6||
    Math.abs(reach.ibWidths-reach.points/(update.high-update.low))>1e-6||
    reach.recentRangeWidths!==null&&(!Number.isFinite(reach.recentRangeWidths)||reach.recentRangeWidths<=0)||
    !Number.isFinite(reach.baselineEffectiveDays)||reach.baselineEffectiveDays<0||reach.baselineEffectiveDays>future.eligibleDays+1e-6||
    !Number.isFinite(reach.unconditionedProbability)||reach.unconditionedProbability<0||reach.unconditionedProbability>1))return session;
  if(update.modelVersion==='ib-best-fit-distance-v1'&&!reach)return session;
  const returning=update.ibReturn;
  if(returning){
    const distance=returning.distance,from=update.price!==null&&update.price<update.low?'BELOW':'ABOVE';
    const points=update.price===null?NaN:from==='BELOW'?update.low+session.market.tickSize-update.price:
      update.price-update.high+session.market.tickSize;
    if(returning.version!==1||returning.modelVersion!=='ib-return-v1'||update.phase!=='LOCKED'||
      returning.asOf!==update.asOf||returning.from!==from||update.price===null||!update.priceAt||
      Date.parse(update.priceAt)<=studyInstant(session,session.market.checkpoints.ibLock)||
      update.price>=update.low&&update.price<=update.high||
      Date.parse(returning.until)!==studyInstant(session,session.market.checkpoints.studyClose)||
      !Number.isFinite(returning.remainingMinutes)||returning.remainingMinutes<=0||
      Math.abs(returning.remainingMinutes-(Date.parse(returning.until)-Date.parse(update.asOf))/60000)>1e-6||
      [returning.probability,returning.baselineProbability].some(p=>p!==null&&(!Number.isFinite(p)||p<0||p>1))||
      !Number.isInteger(returning.eligibleDays)||!Number.isInteger(returning.matchingDays)||returning.matchingDays<0||
      returning.eligibleDays<returning.matchingDays||returning.matchingDays>40||
      !Number.isFinite(returning.effectiveDays)||returning.effectiveDays<0||returning.effectiveDays>returning.matchingDays+1e-6||
      !distance||Date.parse(distance.priceAt)!==Date.parse(update.priceAt)||
      !Number.isFinite(distance.points)||Math.abs(distance.points-points)>1e-6||
      !Number.isFinite(distance.ibWidths)||Math.abs(distance.ibWidths-points/(update.high-update.low))>1e-6||
      distance.recentRangeWidths!==null&&(!Number.isFinite(distance.recentRangeWidths)||distance.recentRangeWidths<=0)||
      !Number.isFinite(distance.baselineEffectiveDays)||distance.baselineEffectiveDays<0||distance.baselineEffectiveDays>returning.eligibleDays+1e-6||
      !Number.isFinite(distance.unconditionedProbability)||distance.unconditionedProbability<0||distance.unconditionedProbability>1)return session;
  }
  return { ...session, forecastUpdates: [...(session.forecastUpdates ?? []), structuredClone(update)] };
}

/** Later corrections change the comparison, never the saved probabilities. */
export function compareForecastUpdates(session: JournalSession, updates = session.forecastUpdates ?? []) {
  const actual = forecastActual(session);
  const ib = deriveSessionRecordedIb(session);
  const tick=session.forecast?.tickSize??session.market.tickSize;
  const prices=[...session.rthObservations,
    ...session.cpObservations,
    ...(session.close.price!==null&&session.close.observedAt?[{price:session.close.price,observedAt:session.close.observedAt}]:[])];
  const lock=studyInstant(session,session.market.checkpoints.ibLock);
  const breaks=ib?prices.filter(p=>Date.parse(p.observedAt)>lock&&
    (p.price>=ib.high!+tick-1e-9||p.price<=ib.low!-tick+1e-9)).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)):[];
  const firstAt=breaks[0]?Date.parse(breaks[0].observedAt):null;
  return updates.map(update => {
    const correctedIb = update.phase === 'LOCKED' && ib &&
      (Math.abs(update.high - ib.high!) > 1e-8 || Math.abs(update.low - ib.low!) > 1e-8);
    const eligible = actual.complete && !correctedIb;
    const at=Date.parse(update.issuedAt);
    const past=breaks.filter(p=>Date.parse(p.observedAt)<=at);
    const settled=update.settled||!!ib&&past.some(p=>p.price>ib.high!)&&past.some(p=>p.price<ib.low!);
    const future=update.remainingEdge;
    const targetDeadline=future?Date.parse(future.until):studyInstant(session,session.market.checkpoints.studyClose);
    const targetPrices=prices.filter(p=>Date.parse(p.observedAt)>lock&&Date.parse(p.observedAt)<=targetDeadline);
    const targetHit=(price:number)=>!!ib&&(future?.target==='IBH'?price>=ib.high!+tick-1e-9:price<=ib.low!-tick+1e-9);
    const alreadyReached=!!future&&targetPrices.some(p=>Date.parse(p.observedAt)<=at&&targetHit(p.price));
    const reachedLater=!!future&&targetPrices.some(p=>Date.parse(p.observedAt)>at&&targetHit(p.price));
    const otherOnly=!!future&&actual.dayType===(future.target==='IBH'?'IBL':'IBH');
    const remainingEdgeOutcome=eligible&&future&&future.probability!==null&&!alreadyReached&&!settled
      ?reachedLater?true:otherOnly?false:null:null;
    const returning=update.ibReturn;
    const before=prices.filter(p=>Date.parse(p.observedAt)>lock&&Date.parse(p.observedAt)<=at)
      .sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).at(-1);
    const quoteUnchanged=before&&before.price===update.price&&Date.parse(before.observedAt)===Date.parse(update.priceAt??'');
    const laterReturn=returning&&prices.some(p=>Date.parse(p.observedAt)>at&&Date.parse(p.observedAt)<=Date.parse(returning.until)&&
      p.price>=update.low+tick-1e-9&&p.price<=update.high-tick+1e-9);
    // Missing manual entries cannot prove that a return never happened, even
    // when the user confirms the overall day's break classification.
    const ibReturnOutcome=!correctedIb&&returning?.probability!==null&&returning&&quoteUnchanged&&laterReturn?true:null;
    return { update, actual,
      outcomeProbability: eligible && actual.dayType && !settled && !future ? update.estimate.dayType[actual.dayType] : null,
      remainingEdgeOutcome,
      remainingEdgeProbability:remainingEdgeOutcome===null?null:remainingEdgeOutcome?future!.probability:1-future!.probability!,
      ibReturnOutcome,
      ibReturnProbability:ibReturnOutcome===true?returning!.probability:null,
      ibReturnReason:!returning||ibReturnOutcome===true?null:correctedIb?'IB corrected':!quoteUnchanged?'Price at estimate was corrected':
        returning.probability===null?'Estimate unavailable':'No later inside price recorded; sparse entries leave result unknown',
      firstBreakProbability: eligible && actual.firstBreak && !update.recordedEdges && (firstAt===null||firstAt>at)
        ? update.estimate.firstBreak[actual.firstBreak] : null,
      widthError: actual.closed && actual.width !== null && update.phase === 'FORMING'
        ? actual.width - update.estimate.width.median : null,
      reason: correctedIb ? 'IB corrected' : settled ? 'Both edges already recorded'
        : !actual.complete ? 'Result not confirmed' : alreadyReached?'Other edge already recorded'
        :future&&remainingEdgeOutcome===null?'Other-edge result or timing not confirmed':null,
    };
  });
}
