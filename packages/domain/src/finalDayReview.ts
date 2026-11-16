// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {carryRangeEdgesForward,latestPreOpenSnapshot,roundPriceToTick,deriveRecordedRthRange,
 withOvernightUpdate,withFifteenMinuteRange,withAPeriodUpdate,withBPeriodUpdate,withRthRangeCorrection,
 withSessionClose,withClosingReview,deriveSessionMissingFields,type JournalSession} from './index';
export type ReviewPeriod='ON'|'15R'|'A'|'B';
type Edges={high:number|null;low:number|null};
export type DayReviewInput={ranges:Record<ReviewPeriod,Edges>;rthHigh:number;rthLow:number;closePrice:number|null;note:string|null};
export type DayReviewWindows=Record<ReviewPeriod|'RTH',{start:string;end:string}>;
export type DayReviewIssue={period:ReviewPeriod|'RTH';edge:'high'|'low'|'close';kind:'missing'|'invalid'|'recorded'|'nested'|'order';message:string;price?:number;observedAt?:string;observationId?:string};
type ReviewDraft=Omit<DayReviewInput,'rthHigh'|'rthLow'>&{rthHigh:number|null;rthLow:number|null};
const reviewPeriods=['ON','15R','A','B','RTH'] as const;
const priceText=(n:number)=>new Intl.NumberFormat('en-US',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:8}).format(n);
function periodPrices(session:JournalSession,period:ReviewPeriod|'RTH',windows:DayReviewWindows){
 const start=period==='A'||period==='B'||period==='RTH'?windows['15R'].start:windows[period].start,end=windows[period].end;
 return session.cpObservations.filter(p=>Number.isFinite(p.price)&&Date.parse(p.observedAt)>=Date.parse(start)&&
  (period==='RTH'?Date.parse(p.observedAt)<=Date.parse(end):Date.parse(p.observedAt)<Date.parse(end)));
}
/** Read-only proposal from saved facts. Confirmation remains the only write. */
export function dayReviewRanges(session:JournalSession,windows?:DayReviewWindows):Record<ReviewPeriod|'RTH',Edges>{
 const on=latestPreOpenSnapshot(session),a=carryRangeEdgesForward(session.aPeriod,session.fifteenMinute);
 const b=carryRangeEdgesForward(session.bPeriod,session.fifteenMinute,a,...session.bSnapshots);
 const ranges={ON:{high:session.overnight.high??on?.formingOvernightHigh??null,low:session.overnight.low??on?.formingOvernightLow??null},
  '15R':{high:session.fifteenMinute.high,low:session.fifteenMinute.low},A:{high:a.high,low:a.low},
  B:{high:b.high,low:b.low},RTH:deriveRecordedRthRange(session)};
 if(windows)for(const period of reviewPeriods){
  const values=periodPrices(session,period,windows).map(p=>p.price),r=ranges[period];
  if(values.length){r.high=Math.max(r.high??-Infinity,...values);r.low=Math.min(r.low??Infinity,...values);}
 }
 if(windows)for(const [inner,outer]of [['15R','A'],['A','B'],['B','RTH']] as const){
  const a=ranges[inner],b=ranges[outer];
  if(a.high!==null)b.high=Math.max(b.high??a.high,a.high);
  if(a.low!==null)b.low=Math.min(b.low??a.low,a.low);
 }
 return ranges;
}
/** All field-level repairs in one place; prices retain their actual timestamps. */
export function dayReviewIssues(session:JournalSession,input:ReviewDraft,windows:DayReviewWindows):DayReviewIssue[]{
 const issues:DayReviewIssue[]=[],tick=session.market.tickSize;
 const ranges={...input.ranges,RTH:{high:input.rthHigh,low:input.rthLow}};
 const name=(p:typeof reviewPeriods[number])=>p==='RTH'?'Daily / RTH':p;
 const valid=(n:number|null):n is number=>n!==null&&Number.isFinite(n)&&Math.abs(roundPriceToTick(n,tick)-n)<=Math.max(1e-10,tick*1e-7);
 const at=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(value));
 for(const period of reviewPeriods){
  const r=ranges[period];
  for(const edge of ['high','low'] as const){
   const n=r[edge];
   if(n===null){issues.push({period,edge,kind:'missing',message:`${name(period)} ${edge} is missing. Enter the ${edge} here.`});continue;}
   if(!valid(n)){issues.push({period,edge,kind:'invalid',message:`${name(period)} ${edge}: enter a number in ${tick} increments.`});continue;}
   const outside=periodPrices(session,period,windows).filter(p=>edge==='high'?p.price>n:p.price<n)
    .sort((a,b)=>(edge==='high'?b.price-a.price:a.price-b.price)||a.observedAt.localeCompare(b.observedAt))[0];
   if(outside)issues.push({period,edge,kind:'recorded',price:outside.price,observedAt:outside.observedAt,observationId:outside.id,
    message:`${name(period)} ${edge} ${priceText(n)} excludes recorded ${priceText(outside.price)} at ${at(outside.observedAt)}. Enter ${priceText(outside.price)} or ${edge==='high'?'higher':'lower'} here, or correct that entry.`});
  }
  if(valid(r.high)&&valid(r.low)&&r.high<r.low)issues.push({period,edge:'high',kind:'order',message:`${name(period)} high ${priceText(r.high)} must be at or above its low ${priceText(r.low)}.`});
 }
 for(const [inner,outer]of [['15R','A'],['A','B'],['B','RTH']] as const)for(const edge of ['high','low'] as const){
  const a=ranges[inner][edge],b=ranges[outer][edge];
  if(valid(a)&&valid(b)&&(edge==='high'?b<a:b>a)&&!issues.some(i=>i.period===outer&&i.edge===edge&&i.kind==='recorded'))
   issues.push({period:outer,edge,kind:'nested',message:`${name(outer)} ${edge} must include ${name(inner)} ${edge} ${priceText(a)}. Enter ${priceText(a)} or ${edge==='high'?'higher':'lower'} here.`});
 }
 const close=input.closePrice;
 if(close!==null&&!valid(close))issues.push({period:'RTH',edge:'close',kind:'invalid',message:`RTH close: enter a number in ${tick} increments, or leave it blank if unknown.`});
 else if(close!==null&&valid(input.rthHigh)&&valid(input.rthLow)&&(close>input.rthHigh||close<input.rthLow))
  issues.push({period:'RTH',edge:'close',kind:'order',message:`RTH close ${priceText(close)} must be between daily low ${priceText(input.rthLow)} and high ${priceText(input.rthHigh)}.`});
 return issues;
}
/** An explicit after-close period Save can finish the H/L review in one action. */
export function withCompletedPeriodReview(session:JournalSession,now:string,windows:DayReviewWindows):JournalSession{
 if(session.calendarStatus==='CLOSED'||Temporal.Instant.compare(now,windows.RTH.end)<0||deriveSessionMissingFields(session).length)return session;
 const r=dayReviewRanges(session,windows);
 return withFinalDayReview(session,{ranges:{ON:r.ON,'15R':r['15R'],A:r.A,B:r.B},rthHigh:r.RTH.high!,rthLow:r.RTH.low!,closePrice:session.close.price,note:session.close.note},now,windows);
}
/** One explicit review of the saved facts, not an assertion of an unseen path.
 * Missing period edges/close remain unknown; a last CP is never promoted to close. */
export function withFinalDayReview(session:JournalSession,input:DayReviewInput,now:string,windows:DayReviewWindows):JournalSession{
 if(session.calendarStatus==='CLOSED')throw Error('This date has no trading session.');
 if(Temporal.Instant.compare(now,windows.RTH.end)<0)throw Error('Review the final day after the configured session close. Prices and ranges are already saved.');
 const before=dayReviewRanges(session),tick=session.market.tickSize;
 const blocking=dayReviewIssues(session,input,windows).find(i=>i.kind!=='missing'||i.period==='RTH');
 if(blocking)throw Error(blocking.message);
 const validate=(price:number|null,label:string)=>{
  if(price===null)return;
  if(!Number.isFinite(price)||Math.abs(roundPriceToTick(price,tick)-price)>Math.max(1e-10,tick*1e-7))throw Error(`${label}: use valid ${tick} price increments.`);
 };
 for(const period of ['ON','15R','A','B'] as const){
  const range=input.ranges[period];validate(range.high,`${period} high`);validate(range.low,`${period} low`);
  if(range.high!==null&&range.low!==null&&range.high<range.low)throw Error(`${period}: high must be at or above low.`);
  if(range.high===null&&range.low===null&&(before[period].high!==null||before[period].low!==null))throw Error(`${period}: correct or remove mistaken source entries in Day timeline before clearing this range.`);

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
