// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {carryRangeEdgesForward,latestPreOpenSnapshot,roundPriceToTick,deriveRecordedRthRange,
 withOvernightUpdate,withFifteenMinuteRange,withAPeriodUpdate,withBPeriodUpdate,withRthRangeCorrection,
 withSessionClose,withClosingReview,type JournalSession} from './index';
export type ReviewPeriod='ON'|'15R'|'A'|'B';
type Edges={high:number|null;low:number|null};
export type DayReviewInput={ranges:Record<ReviewPeriod,Edges>;rthHigh:number;rthLow:number;closePrice:number|null;note:string|null};
export type DayReviewWindows=Record<ReviewPeriod|'RTH',{start:string;end:string}>;
export function dayReviewRanges(session:JournalSession):Record<ReviewPeriod|'RTH',Edges>{
 const on=latestPreOpenSnapshot(session),a=carryRangeEdgesForward(session.aPeriod,session.fifteenMinute);
 const b=carryRangeEdgesForward(session.bPeriod,session.fifteenMinute,a,...session.bSnapshots);
 return {ON:{high:session.overnight.high??on?.formingOvernightHigh??null,low:session.overnight.low??on?.formingOvernightLow??null},
  '15R':{high:session.fifteenMinute.high,low:session.fifteenMinute.low},A:{high:a.high,low:a.low},
  B:{high:b.high,low:b.low},RTH:deriveRecordedRthRange(session)};
}
/** One explicit review of the saved facts, not an assertion of an unseen path.
 * Missing period edges/close remain unknown; a last CP is never promoted to close. */
export function withFinalDayReview(session:JournalSession,input:DayReviewInput,now:string,windows:DayReviewWindows):JournalSession{
 if(session.calendarStatus==='CLOSED')throw Error('This date has no trading session.');
 if(Temporal.Instant.compare(now,windows.RTH.end)<0)throw Error('Review the final day after the configured session close. Prices and ranges are already saved.');
 const before=dayReviewRanges(session),tick=session.market.tickSize;
 const validate=(price:number|null,label:string)=>{
  if(price===null)return;
  if(!Number.isFinite(price)||Math.abs(roundPriceToTick(price,tick)-price)>Math.max(1e-10,tick*1e-7))throw Error(`${label}: use valid ${tick} price increments.`);
 };
 for(const period of ['ON','15R','A','B'] as const){
  const range=input.ranges[period];validate(range.high,`${period} high`);validate(range.low,`${period} low`);
  if(range.high!==null&&range.low!==null&&range.high<range.low)throw Error(`${period}: high must be at or above low.`);
  if(range.high===null&&range.low===null&&(before[period].high!==null||before[period].low!==null))throw Error(`${period}: correct or remove mistaken source entries in Day timeline before clearing this range.`);
  const start=period==='A'?windows['15R'].start:windows[period].start,end=windows[period].end;
  const prices=session.cpObservations.filter(p=>Date.parse(p.observedAt)>=Date.parse(start)&&Date.parse(p.observedAt)<Date.parse(end));
  if(prices.some(p=>range.high!==null&&p.price>range.high||range.low!==null&&p.price<range.low))throw Error(`${period}: the range must include its recorded prices. Correct a mistaken price in Day timeline first.`);
 }
 for(const [inner,outer] of [['15R','A'],['A','B']] as const){
  const a=input.ranges[inner],b=input.ranges[outer];
  if(a.high!==null&&b.high!==null&&b.high<a.high||a.low!==null&&b.low!==null&&b.low>a.low)
   throw Error(`${outer}: the range must include ${inner}.`);
 }
 validate(input.rthHigh,'Daily high');validate(input.rthLow,'Daily low');validate(input.closePrice,'RTH close');
 if(input.rthHigh<input.rthLow)throw Error('Daily high must be at or above daily low.');
 if(input.closePrice===null&&session.close.price!==null)throw Error('Keep the recorded close, or correct it in Day timeline.');
 // Existing historical coverage is retained only for an unchanged review.
 const unchanged=JSON.stringify(input.ranges)===JSON.stringify({ON:before.ON,'15R':before['15R'],A:before.A,B:before.B})&&
  input.rthHigh===session.close.rthHigh&&input.rthLow===session.close.rthLow&&input.closePrice===session.close.price;
 let next={...session,close:{...session.close,finishedAt:null,pathComplete:false}} as JournalSession;
 const on=input.ranges.ON;
 if(on.high!==null||on.low!==null)next=withOvernightUpdate(next,{...on,rthOpen:session.overnight.rthOpen,confirm:on.high!==null&&on.low!==null},now);
 for(const [period,save] of [['15R',withFifteenMinuteRange],['A',withAPeriodUpdate],['B',withBPeriodUpdate]] as const){
  const range=input.ranges[period];
  if(range.high===null&&range.low===null)continue;
  const old=period==='15R'?session.fifteenMinute:period==='A'?session.aPeriod:session.bPeriod;
  next=save(next,{...range,cp:null,note:old.note},windows[period].end,now,true,true);
 }
 next=withRthRangeCorrection(next,input.rthHigh,input.rthLow,now);
 if(input.closePrice!==null){
  next=withSessionClose(next,input.closePrice,input.note,windows.RTH.end,now,input.rthHigh,input.rthLow);
  return withClosingReview(next,unchanged&&session.close.pathComplete,now);
 }
 return {...next,close:{...next.close,rthHigh:input.rthHigh,rthLow:input.rthLow,price:null,note:input.note?.trim()||null,
  recordedAt:now,observedAt:null,pathComplete:false,finishedAt:now},updatedAt:now};
}
