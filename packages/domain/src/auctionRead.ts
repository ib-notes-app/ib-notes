// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { memoryContractMatches } from './marketMemory';
import { priceHistoryCompatibility, type PriceHistoryBatch, type PriceHistoryDay } from './priceHistory';
import type { ReadPrice } from './ibRead';
import type { JournalSession } from './index';
import type { deriveSessionIbRead } from './sessionIbRead';

export type AuctionState = 'BALANCE' | 'IMBALANCE_HIGHER' | 'IMBALANCE_LOWER' | 'TESTING_HIGHER' | 'TESTING_LOWER' | 'DEVELOPING';
export type AuctionRead = { state: AuctionState; title: string; detail: string; observedAt: string | null;
  observations: number; stale: boolean; basis: 'PRICES' | 'RANGES' | 'PENDING'; location:'ABOVE'|'BELOW'|'INSIDE'|'UNKNOWN' };
export type CompletedAuctionRange = { date: string; contract: string; low: number; high: number;
  knownAt: string; availableAt: string; sourceId: string; cohort: 'JOURNAL' | 'REFERENCE' | 'FORWARD_OBSERVATION' };
export type RecentAuctionRead = { state: 'BALANCE' | 'IMBALANCE_HIGHER' | 'IMBALANCE_LOWER' | 'DEVELOPING';
  title: string; detail: string;
  low: number; high: number; typicalRthWidth: number; days: number; dates: string[]; sources: string[]; knownAt: string;
  activity: AuctionRead | null; connection: string | null };
const ms = (at: string) => Temporal.Instant.from(at).epochMilliseconds;
const titles: Record<AuctionState,string> = { BALANCE:'Balance · Ranging', IMBALANCE_HIGHER:'Imbalance · Price discovery higher',
  IMBALANCE_LOWER:'Imbalance · Price discovery lower', TESTING_HIGHER:'Testing higher', TESTING_LOWER:'Testing lower', DEVELOPING:'Developing' };

/** Price-only best-fit description, not profile/value-area detection or forecast weights.
 * The existing reader supplies sorted, deduplicated, unambiguous observations.
 * A sample span is never described as uninterrupted holding or residence time. */
export function describeAuctionFlow(args: { prices: readonly ReadPrice[]; asOf: string; startAt: string;
  low: number; high: number; tickSize: number; rangeName: string }): AuctionRead {
  const {asOf,startAt,low,high,tickSize,rangeName}=args, end=ms(asOf);
  const visible=args.prices.filter(p=>ms(p.at)>=ms(startAt)&&ms(p.at)<=end);
  const latest=visible.at(-1), start=latest?Math.max(ms(startAt),ms(latest.at)-45*60000):end;
  const recent=visible.filter(p=>ms(p.at)>=start);
  const result=(state:AuctionState,detail:string):AuctionRead=>({state,title:titles[state],detail,observedAt:latest?.at??null,
    observations:recent.length,stale:!!latest&&end-ms(latest.at)>30*60000,basis:latest?'PRICES':'PENDING',
    location:!latest?'UNKNOWN':latest.price>high?'ABOVE':latest.price<low?'BELOW':'INSIDE'});
  if(!latest||!(high>low))return result('DEVELOPING','Direction is still developing.');
  const location=latest.price>high?'above':latest.price<low?'below':'inside';
  const testing=()=>result(location==='above'?'TESTING_HIGHER':location==='below'?'TESTING_LOWER':'DEVELOPING',
    `Latest price is ${location} ${rangeName}.`);
  if(recent.length<2)return testing();
  const values=recent.map(p=>p.price), first=values[0]!, last=values.at(-1)!;
  const spread=Math.max(...values)-Math.min(...values), net=last-first;
  const traveled=values.slice(1).reduce((sum,p,i)=>sum+Math.abs(p-values[i]!),0);
  const efficiency=traveled?Math.abs(net)/traveled:0, span=ms(latest.at)-ms(recent[0]!.at);
  const width=high-low, meaningful=Math.max(tickSize*2,width*.25);
  // Two ordinary entries can suggest direction; a one-tick poke cannot.
  if(span>=2*60000&&Math.abs(net)>=meaningful&&efficiency>=.7){
    return result(net>0?'IMBALANCE_HIGHER':'IMBALANCE_LOWER',
      `Moving ${net>0?'higher':'lower'} ${location} ${rangeName}.`);
  }
  // Consolidation can form outside an old range after a directional move.
  if(recent.length>=3&&span>=5*60000&&(spread<=width*.35||efficiency<=.4&&spread<=width*1.25)){
    const area=Math.min(...values)>high?'above':Math.max(...values)<low?'below':location==='inside'?'inside':'around';
    return result('BALANCE',`${spread<=width*.35?'Consolidating':'Rotating'} ${area} ${rangeName}.`);
  }
  return testing();
}

export function deriveSessionAuctionRead(session:JournalSession,current:ReturnType<typeof deriveSessionIbRead>):AuctionRead|null {
  if(!current)return null;
  const name=current.phase==='FORMING'?'the forming IB':'the IB';
  const start=current.phase==='LOCKED'?current.rangeKnownAt:current.read.observations[0]?.at??current.rangeKnownAt;
  const prices=current.read.observations.filter(p=>ms(p.at)>=ms(start));
  const latest=prices.at(-1);
  // A new range can precede the next CP. Never relocate an older CP in that range.
  const validLatest=latest&&ms(latest.at)>=ms(current.rangeKnownAt);
  if(current.low!==null&&current.high!==null&&validLatest){
    return describeAuctionFlow({prices,asOf:current.asOf,startAt:start,low:current.low,high:current.high,
      tickSize:session.market.tickSize,rangeName:name});
  }
  const early=session.fifteenMinute, history=session.fifteenMinuteHistory.at(-1);
  const knownAt=history?.observedAt??early.confirmedAt, recordedAt=history?.recordedAt??early.confirmedAt;
  if(current.phase==='FORMING'&&early.high!==null&&early.low!==null&&early.high>early.low&&knownAt&&recordedAt&&
    ms(knownAt)<=ms(current.asOf)&&ms(recordedAt)<=ms(current.asOf)&&current.high!==null&&current.low!==null){
    const up=current.high-early.high,down=early.low-current.low,minimum=Math.max(session.market.tickSize*2,(early.high-early.low)*.25);
    if(Math.max(up,down)>=minimum&&Math.min(up,down)<=Math.max(up,down)*.25){
      const higher=up>down;
      return {state:higher?'IMBALANCE_HIGHER':'IMBALANCE_LOWER',title:`Imbalance · IB expanding ${higher?'higher':'lower'}`,
        detail:`Recorded range updates extend mainly the ${higher?'high':'low'} side.`,observedAt:current.rangeKnownAt,
        observations:0,stale:ms(current.asOf)-ms(current.rangeKnownAt)>30*60000,basis:'RANGES',location:'UNKNOWN'};
    }
  }
  return {state:'DEVELOPING',title:current.phase==='FORMING'?'Developing · IB forming':'Developing',
    detail:latest?'The latest price precedes this range update.':'Direction is still developing.',
    observedAt:latest?.at??null,observations:0,stale:false,basis:'PENDING',location:'UNKNOWN'};
}

/** Complete installed minute days supply full RTH ranges, not just their IBs.
 * Comparison cohorts may describe known past context; they never become training. */
export function completedAuctionRangeFromPriceDay(batch:PriceHistoryBatch,day:PriceHistoryDay,
  session:JournalSession,asOf:string,now:string):CompletedAuctionRange|null {
  const s=day.summary;
  if(batch.journalId!==session.journalId||priceHistoryCompatibility(batch.info,session.market).error||
    ms(batch.importedAt)>ms(now)||s.date>=session.rthDate||ms(s.end)>ms(asOf)||s.rthMissing!==0||
    !memoryContractMatches(s.contract,session.contract,Number(session.rthDate.slice(0,4))))return null;
  const minutes=day.minutes.filter(m=>ms(m.at)>=ms(s.openAt)&&ms(m.at)<ms(s.end));
  const expected=(ms(s.end)-ms(s.openAt))/60000;
  if(minutes.length!==expected||!minutes.length||minutes.some((m,i)=>ms(m.at)!==ms(s.openAt)+i*60000||
    m.high===null||m.low===null||!Number.isFinite(m.high)||!Number.isFinite(m.low)||m.high<m.low))return null;
  return {date:s.date,contract:s.contract,high:Math.max(...minutes.map(m=>m.high!)),low:Math.min(...minutes.map(m=>m.low!)),
    knownAt:s.end,availableAt:batch.importedAt,sourceId:batch.id,cohort:batch.info.cohort};
}

/** Three to five recent completed sessions; local and broader states can differ. */
export function deriveRecentAuctionRead(args:{session:JournalSession;sessions:JournalSession[];
  imported?:CompletedAuctionRange[];current:ReturnType<typeof deriveSessionIbRead>;now:string}):RecentAuctionRead|null {
  const {session,current,now}=args;
  const cutoff=ms(current?.asOf??now),oldest=Temporal.PlainDate.from(session.rthDate).subtract({days:20}).toString();
  const manual:CompletedAuctionRange[]=args.sessions.flatMap(s=>{
    const c=s.close;
    if(s.journalId!==session.journalId||s.instrument!==session.instrument||s.market.canonicalTimeZone!==session.market.canonicalTimeZone||
      s.market.checkpoints.overnightLock!==session.market.checkpoints.overnightLock||s.market.checkpoints.studyClose!==session.market.checkpoints.studyClose||
      !c.finishedAt||!c.recordedAt||!c.observedAt||c.rthHigh===null||c.rthLow===null||!s.contract)return [];
    return [{date:s.rthDate,contract:s.contract,high:c.rthHigh,low:c.rthLow,knownAt:c.observedAt,
      availableAt:ms(c.recordedAt)>ms(c.finishedAt)?c.recordedAt:c.finishedAt,sourceId:s.id,cohort:'JOURNAL'}];
  });
  const byDate=new Map<string,CompletedAuctionRange[]>();
  for(const r of [...manual,...args.imported??[]]){
    if(r.date>=session.rthDate||r.date<oldest||ms(r.knownAt)>cutoff||ms(r.availableAt)>ms(now)||
      !Number.isFinite(r.high)||!Number.isFinite(r.low)||r.high<=r.low||
      !memoryContractMatches(r.contract,session.contract,Number(session.rthDate.slice(0,4))))continue;
    const values=byDate.get(r.date)??[];values.push(r);byDate.set(r.date,values);
  }
  // Keep date conflicts visible as unavailable instead of picking a preferred source.
  const dates=[...byDate].filter(([,v])=>v.every(r=>r.high===v[0]!.high&&r.low===v[0]!.low))
    .sort(([a],[b])=>a.localeCompare(b)).slice(-5).map(([,v])=>v[0]!);
  if(dates.length<3)return null;
  const first=dates[0]!,last=dates.at(-1)!,low=Math.min(...dates.map(d=>d.low)),high=Math.max(...dates.map(d=>d.high));
  const meanWidth=dates.reduce((sum,d)=>sum+d.high-d.low,0)/dates.length;
  const widths=dates.map(d=>d.high-d.low).sort((a,b)=>a-b),middle=Math.floor(widths.length/2);
  const typicalRthWidth=widths.length%2?widths[middle]!:(widths[middle-1]!+widths[middle]!)/2;
  const displacement=(last.high+last.low-first.high-first.low)/2;
  const overlap=dates.slice(1).reduce((sum,d,i)=>sum+Math.max(0,Math.min(d.high,dates[i]!.high)-Math.max(d.low,dates[i]!.low))/
    Math.min(d.high-d.low,dates[i]!.high-dates[i]!.low),0)/(dates.length-1);
  const rising=dates.slice(1).every((d,i)=>d.low>=dates[i]!.low&&(d.high+d.low)>dates[i]!.high+dates[i]!.low);
  const falling=dates.slice(1).every((d,i)=>d.high<=dates[i]!.high&&(d.high+d.low)<dates[i]!.high+dates[i]!.low);
  const state=rising&&displacement>meanWidth*.75?'IMBALANCE_HIGHER':falling&&displacement<-meanWidth*.75?'IMBALANCE_LOWER':
    overlap>=.5?'BALANCE':'DEVELOPING';
  const activity=state==='BALANCE'&&current?describeAuctionFlow({prices:current.read.observations,asOf:current.asOf,
    startAt:last.knownAt,low,high,tickSize:session.market.tickSize,rangeName:'the prior RTH range'}):null;
  const points=(value:number)=>`${Number(value.toFixed(8))} pt`;
  let connection:string|null=null;
  if(current&&current.low!==null&&current.high!==null){
    const ib=current.phase==='FORMING'?'Forming IB':'IB';
    if(current.low>high)connection=`${ib} is ${points(current.low-high)} above this range.`;
    else if(current.high<low)connection=`${ib} is ${points(low-current.high)} below this range.`;
    else if(current.high>high&&current.low<low)connection=`${ib} extends ${points(current.high-high)} above and ${points(low-current.low)} below this range.`;
    else if(current.high>high)connection=`${ib} extends ${points(current.high-high)} above this range.`;
    else if(current.low<low)connection=`${ib} extends ${points(low-current.low)} below this range.`;
    else connection=`${ib} is inside this range.`;
  }
  // The model's overlap category stays fixed. Public wording describes what the
  // latest completed range actually did, without declaring today's market balanced.
  const earlier=dates.slice(0,-1),earlierHigh=Math.max(...earlier.map(d=>d.high)),earlierLow=Math.min(...earlier.map(d=>d.low));
  const up=last.high>earlierHigh,down=last.low<earlierLow;
  const title=up&&down?'Range widened both ways':up?'Range expanded higher':down?'Range expanded lower':
    state==='BALANCE'?'Overlapping ranges':state==='IMBALANCE_HIGHER'?'Ranges shifting higher':state==='IMBALANCE_LOWER'?'Ranges shifting lower':
    displacement>meanWidth*.25?'Ranges shifting higher':
    displacement<-meanWidth*.25?'Ranges shifting lower':last.high>first.high&&last.low<first.low?'Range widening':
    last.high<first.high&&last.low>first.low?'Range narrowing':'Two-way movement';
  const change=up&&down?'The latest completed session extended both ends of the earlier ranges.':
    up?`The latest completed session reached ${points(last.high-earlierHigh)} above the earlier highs.`:
    down?`The latest completed session reached ${points(earlierLow-last.low)} below the earlier lows.`:
    'The latest completed session stayed within the earlier high and low.';
  const detail=`${change} RTH means regular trading hours; overnight prices and this session are excluded.`;
  return {state,low,high,typicalRthWidth,days:dates.length,dates:dates.map(d=>d.date),sources:[...new Set(dates.map(d=>d.sourceId))],
    knownAt:last.knownAt,activity,connection,title,detail};
}
