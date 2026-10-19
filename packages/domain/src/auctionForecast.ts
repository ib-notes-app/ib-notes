// SPDX-License-Identifier: MPL-2.0
import type { CompletedAuctionRange, RecentAuctionRead } from './auctionRead';
import type { JournalSession } from './index';
import { Temporal } from '@js-temporal/polyfill';
import { studyPackCompatibility } from './studyPack';

export type AuctionForecastContext = Pick<RecentAuctionRead,
  'state'|'low'|'high'|'typicalRthWidth'|'days'|'dates'|'knownAt'>;
/** Prefix-only context from audited REFERENCE prices; no target outcomes. */
export type AuctionReferenceLibrary = {
  version:1; instrument:string; cohort:'REFERENCE'; tickSize:number; timeZone:string;
  open:string; lock:string; close:string; sources:Array<{file:string;sha256:string}>;
  ranges:CompletedAuctionRange[];
  days:Array<{date:string;contract:string;context:AuctionForecastContext|null}>;
};

export function auctionReferenceCompatible(library:AuctionReferenceLibrary|null|undefined,market:JournalSession['market']):boolean {
  const sameClock=(a:string,b:string)=>Temporal.PlainTime.compare(a,b)===0;
  return !!library&&library.version===1&&library.cohort==='REFERENCE'&&library.tickSize===market.tickSize&&
    library.timeZone===market.canonicalTimeZone&&sameClock(library.open,market.checkpoints.overnightLock)&&
    sameClock(library.lock,market.checkpoints.ibLock)&&sameClock(library.close,market.checkpoints.studyClose)&&
    !studyPackCompatibility({instrument:library.instrument},market).error;
}

export function validAuctionForecastContext(context:AuctionForecastContext,date:string,asOf:string):boolean {
  return context.days>=3&&context.days<=5&&context.dates.length===context.days&&
    new Set(context.dates).size===context.days&&context.dates.every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<date)&&
    Number.isFinite(Date.parse(context.knownAt))&&Date.parse(context.knownAt)<=Date.parse(asOf)&&
    Number.isFinite(context.low)&&Number.isFinite(context.high)&&context.high>context.low&&
    Number.isFinite(context.typicalRthWidth)&&context.typicalRthWidth>0;
}

/** Small bounded contributions to the existing distance, never outcome multipliers. */
export function auctionForecastDistance(current:AuctionForecastContext,historical:AuctionForecastContext,
  live:{low:number;high:number},past:{low:number;high:number}):number {
  const square=(n:number)=>n*n,cap=(n:number)=>Math.min(1,n);
  const state=current.state==='DEVELOPING'||historical.state==='DEVELOPING'?0:
    .25*Number(current.state!==historical.state);
  const relativeWidth=.25*cap(square(Math.log((live.high-live.low)/current.typicalRthWidth)-
    Math.log((past.high-past.low)/historical.typicalRthWidth)));
  const position=(range:{low:number;high:number},context:AuctionForecastContext)=>
    ((range.high+range.low)/2-context.low)/(context.high-context.low);
  return state+relativeWidth+.25*cap(square((position(live,current)-position(past,historical))/.75));
}
