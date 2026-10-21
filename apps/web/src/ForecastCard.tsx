// SPDX-License-Identifier: MPL-2.0
import { firstRecordedIbBreak, compareForecast, compareForecastUpdates, deriveSessionIbRead, deriveSessionOvernightRead, deriveCurrentIbCode, deriveLockPositionReference, deriveBestFitOutlook, buildForecastTraining,
  deriveLiveMarketMemory, describeMarketMemory, fbdCompatibility, type ContextBatch, type FbdBatch, type HistoricalLow,
  latestPreOpenSnapshot, formatPriceNumber, deriveRecordedRthRange, type ForecastEstimate,
  deriveSessionAuctionRead, deriveRecentAuctionRead, completedAuctionRangeFromPriceDay, priceHistoryCompatibility,memoryContractMatches,
  type CompletedAuctionRange, type AuctionRead, type RecentAuctionRead, type PriceHistoryBatch,
  type ForecastPriceReference,
  type ForecastUpdate, type SignificantLevel, type ForecastPriorDay, type JournalSession, type HistoricalIbSession, type HistoricalIbImportBatch } from "@ib-field-notes/domain";
import { Temporal } from '@js-temporal/polyfill';
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { journalClock } from './journalClock';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { useForecastUpdateHistory } from './forecastUpdateHistory';
import { IbReturnRead } from './IbReturnRead';
import { PostIbRecap } from './PostIbRecap';
import { DeferredDetails } from './DeferredDetails';
import { loadForecastReferencePrices } from './forecastPreparation';
import { useForecastReferences } from './useForecastReferences';
import { IbCodeBadge } from './IbCodeBadge';
import { OvernightStudyPanel } from './OvernightStudy';
import {SessionPhasePanels,dashboardPhase} from './SessionPhasePanels';
import {PostIbConditions} from './PostIbConditions';
import {PhaseForecast} from './PhaseForecast';
import {formatTickRoundedPrice} from './mapFormatting';

const factorNames = { news: "News", fbd: "Recent LBAF", levels: "Nearby low", quarter: "Time of year", weekday: "Weekday" };
const pct = (value: number) => value > 0 && value < 0.01 ? "<1%" : `${Math.round(value * 100)}%`;
const points = (value: number) => `${formatPriceNumber(Math.round(value * 10) / 10, 1)} pt`;
const tickPoints = (value:number,tickSize:number) => `${formatTickRoundedPrice(value,tickSize)} pt`;
function condition(factor: string, value: string | null): string {
  if (!value) return 'Not recorded';
  if (value === 'NONE') return 'None noted';
  if (factor === 'news') return value.split('+').join(' + ');
  if (factor === 'weekday') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(value)] ?? value;
  if (factor === 'quarter') return ({ Q1: 'Jan–Mar', Q2: 'Apr–Jun', Q3: 'Jul–Sep', Q4: 'Oct–Dec' } as Record<string, string>)[value] ?? value;
  return ({ WITHIN_24H: 'Within the past day', WITHIN_7D: 'Within the past week',
    WITHIN_1_RANGE: 'Low within one 15R width', WITHIN_3_RANGES: 'Low within three 15R widths',
    FARTHER: 'Low farther away' } as Record<string, string>)[value] ?? value;
}

function priorLabel(prior: ForecastPriorDay): string {
  const date = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
    .format(new Date(`${prior.rthDate}T12:00:00Z`));
  const source = prior.source.kind === 'journal' ? 'your journal'
    : prior.source.instrument ? `${prior.source.instrument} IB Pack` : 'imported IB history';
  return `Prior day: ${date} · ${source}`;
}

const noLevels: SignificantLevel[] = [];
const noSessions: JournalSession[] = [], noNews: ContextBatch[] = [], noLowBatches: FbdBatch[] = [];
const noPriceBatches:PriceHistoryBatch[]=[];
export type MemoryInput = { sessions: JournalSession[]; news: ContextBatch[]; lowBatches: FbdBatch[]; priceBatches:PriceHistoryBatch[]; repository: JournalRepository | null; snapshotAt?:string };
// Sharing reuses this read without mounting the dashboard's receipt writer.
export function useCurrentForecast(session: JournalSession, historical: HistoricalIbSession[], batches: HistoricalIbImportBatch[], levels: SignificantLevel[], inputs: MemoryInput) {
  const closed=!!session.close.finishedAt, marketKey=JSON.stringify(session.market);
  const [clockTick, setClockTick] = useState(0);
  const [referencePrices,setReferencePrices]=useState<ForecastPriceReference[]>([]);
  const [referenceReady,setReferenceReady]=useState<string|null>(null);
  const referenceKey=JSON.stringify([session.journalId,session.rthDate,!!session.forecast,closed,marketKey,
    historical.map(r=>[r.id,r.importedAt]),inputs.priceBatches.map(b=>[b.id,b.contentSha256,b.importedAt])]);
  const lowKey=JSON.stringify([session.journalId,closed,marketKey,inputs.lowBatches.map(b=>[b.id,b.importedAt])]);
  const [lowsReady, setLowsReady] = useState<string|null>(null);
  const [lows, setLows] = useState<Array<{batch:FbdBatch;lows:HistoricalLow[]}>>([]);
  const [recentRanges,setRecentRanges]=useState<CompletedAuctionRange[]>([]);
  const recentKey=JSON.stringify([session.journalId,session.contract,session.rthDate,marketKey,inputs.priceBatches.map(b=>[b.id,b.importedAt])]);
  const [recentReady,setRecentReady]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;setReferencePrices([]);setReferenceReady(null);
    if(!inputs.repository||closed){setReferenceReady(referenceKey);return;}
    void loadForecastReferencePrices(inputs.repository,session,historical,inputs.priceBatches,Temporal.Now.instant().toString())
      .then(prices=>{if(active){setReferencePrices(prices);setReferenceReady(referenceKey);}})
      .catch(()=>{if(active)setReferenceReady(referenceKey); /* Bundled history and daily geometry remain usable. */ });
    return ()=>{active=false;};
  },[inputs.repository,referenceKey,!!session.forecast]);
  useEffect(()=>{
    let active=true;setRecentRanges([]);setRecentReady(null);
    if(!inputs.repository||!session.contract){setRecentReady(recentKey);return;}
    const now=Temporal.Now.instant().toString(),oldest=Temporal.PlainDate.from(session.rthDate).subtract({days:20}).toString();
    const candidates=inputs.priceBatches.filter(b=>b.journalId===session.journalId&&Date.parse(b.importedAt)<=Date.parse(now)&&
      !priceHistoryCompatibility(b.info,session.market).error).flatMap(batch=>batch.days
        .filter(day=>day.date<session.rthDate&&day.date>=oldest&&day.rthMissing===0&&Date.parse(day.end)<=Date.parse(now)&&
          memoryContractMatches(day.contract,session.contract,Number(session.rthDate.slice(0,4))))
        .map(day=>({batch,date:day.date})));
    const dates=[...new Set(candidates.map(c=>c.date))].sort().slice(-5);
    void Promise.all(candidates.filter(c=>dates.includes(c.date)).map(async c=>{
      const day=await inputs.repository!.getPriceHistoryDay(c.batch.id,c.date);
      return day?completedAuctionRangeFromPriceDay(c.batch,day,session,now,now):null;
    })).then(r=>{if(active){setRecentRanges(r.filter((v):v is CompletedAuctionRange=>v!==null));setRecentReady(recentKey);}})
      .catch(()=>{if(active)setRecentReady(recentKey); /* Completed journal ranges remain usable. */ });
    return ()=>{active=false;};
  },[inputs.repository,inputs.priceBatches,recentKey]);
  useEffect(() => {
    let active = true;
    setLows([]);
    setLowsReady(null);
    if (!inputs.repository || closed) { setLowsReady(lowKey); return; }
    const eligible = inputs.lowBatches.filter(b => b.journalId === session.journalId &&
      !fbdCompatibility(b.info, session.market).error);
    void Promise.all(eligible.map(async batch => ({ batch, lows: await inputs.repository!.getFbdLows(batch.id) })))
      .then(records => { if (active) { setLows(records); setLowsReady(lowKey); } })
      .catch(() => { if (active) setLowsReady(lowKey); /* Manual context remains usable. */ });
    return () => { active = false; };
  }, [inputs.repository, inputs.lowBatches, lowKey]);
  useEffect(() => {
    if (closed || inputs.snapshotAt) return;
    const refresh = () => setClockTick(tick => tick + 1);
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh); };
  }, [closed, inputs.snapshotAt]);
  const examples = useMemo(() => closed ? [] : buildForecastTraining(historical.filter(row => (row.journalId ?? 'es') === session.journalId), [],
    journalClock(session.market).previousPotentialRthDate), [historical, session.journalId, marketKey, closed]);
  const readWindow = useMemo(() => {
    const clock = journalClock(session.market), cp = session.market.checkpoints;
    const now = inputs.snapshotAt ?? Temporal.Now.instant().toString();
    return { now, overnightStartAt: clock.overnightStart(session.rthDate).toString(),
      openAt: clock.checkpointInstant(session.rthDate, cp.overnightLock).toString(),
      ibLockAt: clock.checkpointInstant(session.rthDate, cp.ibLock).toString(),
      closeAt: clock.checkpointInstant(session.rthDate, cp.studyClose).toString() };
  }, [session,clockTick,inputs.snapshotAt]);
  const current = useMemo(() => deriveSessionIbRead(session,readWindow,{provisional:true}), [session,readWindow]);
  const overnight = useMemo(() => deriveSessionOvernightRead(session,readWindow), [session,readWindow]);
  const sourceKey=JSON.stringify([referenceKey,referencePrices.map(p=>[p.batch.id,p.batch.contentSha256,p.path.date]),
    batches.map(b=>[b.id,b.contentSha256,b.importedAt]),
    inputs.news.map(b=>[b.id,b.contentSha256,b.importedAt]),inputs.lowBatches.map(b=>[b.id,b.contentSha256,b.importedAt])]);
  const prepared=useForecastReferences({session,historical,batches,examples,prices:referencePrices,
    packs:{news:inputs.news,lows,prices:[]},now:readWindow.now,
    minute:current?Math.floor((Date.parse(current.asOf)-Date.parse(readWindow.openAt))/60000):0},sourceKey,
    !closed&&!!current?.width&&historical.length>0&&referenceReady===referenceKey&&lowsReady===lowKey);
  const references=prepared.references;
  return useMemo(() => {
    const window=readWindow, now=window.now;
    const marketMemory = current?.width && !current.closed ? deriveLiveMarketMemory({ session, sessions: inputs.sessions, levels, lows,
      news: inputs.news, asOf: current.asOf, now, price: current.read.latest?.price ?? null, width: current.width, openAt: window.openAt }) : null;
    const referenceRanges=references?.auctionLibrary.ranges??[];
    const imported=[...(recentReady===recentKey?recentRanges:[]),...referenceRanges];
    const broader=deriveRecentAuctionRead({session,sessions:inputs.sessions,imported,current,now});
    const auctionContext=broader?{state:broader.state,low:broader.low,high:broader.high,typicalRthWidth:broader.typicalRthWidth,
      days:broader.days,dates:broader.dates,knownAt:broader.knownAt}:null;
    return { now, current, overnight, ready: prepared.ready&&recentReady===recentKey, historyError:prepared.error, auction:deriveSessionAuctionRead(session,current),
      broader,
      reference: deriveLockPositionReference(session, current, historical, batches, now),
      outlook: references||prepared.error ? deriveBestFitOutlook({ session, current, window, historical, batches, examples:references?.examples??examples,
        paths:references?.paths, levels, marketMemory, memoryLibrary:references?.memoryLibrary,
        auctionContext,auctionLibrary:references?.auctionLibrary,
        referencePriceBatchIds:references?.priceBatchIds }) : null };
  }, [session, current, overnight, readWindow, historical, batches, examples, levels, inputs.sessions, inputs.news, lows,recentRanges,recentReady,recentKey,closed,references,prepared.ready,prepared.error]);
}

function ForecastUpdateHistory({session,updates,error,current}:{session:JournalSession;updates:ForecastUpdate[];error:string|null;current:ReturnType<typeof deriveSessionIbRead>}) {
  const [showAll,setShowAll]=useState(false);
  const comparisons=compareForecastUpdates(session,updates);
  const recorded=current?.phase==='LOCKED'?firstRecordedIbBreak(current.read.ib):null;
  const visible=showAll?comparisons:comparisons.length>3?[comparisons[0]!,...comparisons.slice(-2)]:comparisons;
  const clock=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'})
    .format(new Date(at));
  const closed=!!session.close.finishedAt;
  return <div className="forecast-update-history" role="group" aria-label="Forecast through the day">
    <h4>Forecast through the day</h4>
    {error&&<p role="status">{error}</p>}
    {!updates.length?<p className="forecast-caption">Updates are saved automatically as you record prices, ranges and context during a live session. Past days are not filled in later.</p>:<>
      <p className="forecast-caption">{session.studyReplay?'Reconstructed from historical entries using today’s engine.':closed?'How your recorded entries changed the outlook.':'Saved after your entries. The original forecast stays fixed.'}</p>
      {closed&&comparisons[0]?.actual.complete&&<p className="forecast-caption">At close: {outcomeNames[comparisons[0].actual.dayType!]} · {firstBreakName(comparisons[0].actual.firstBreak!)}</p>}
      <ol className="forecast-update-list">{visible.map(({update,outcomeProbability,firstBreakProbability,remainingEdgeProbability,remainingEdgeOutcome,ibReturnOutcome,ibReturnReason,reason})=>{
        const high=Math.max(...Object.values(update.estimate.dayType));
        const leaders=Object.entries(update.estimate.dayType).filter(([,p])=>p===high).map(([type])=>outcomeNames[type]);
        return <li key={update.id}>
          <div><time dateTime={update.issuedAt}>{clock(update.issuedAt)}</time>
            <span>{update.phase==='FORMING'?'IB forming':'IB locked'}</span></div>
          <strong>{update.settled?'Both edges recorded':`${leaders.join(' / ')} · ${pct(high)}`}</strong>
          {update.recordedEdges?<p>{update.recordedEdges==='BOTH'?'Both edges already recorded':`${update.recordedEdges==='HIGH'?'High':'Low'} break already recorded`}</p>
            :<p>First edge forecast: {Object.entries(update.estimate.firstBreak).filter(([,p])=>p===Math.max(...Object.values(update.estimate.firstBreak)))
              .map(([side])=>firstBreakName(side)).join(' / ')} · {pct(Math.max(...Object.values(update.estimate.firstBreak)))}</p>}
          {update.remainingEdge&&<p>{update.remainingEdge.target==='IBH'?'High':'Low'} break before close: {' '}
            <b>{update.remainingEdge.probability===null?'Unavailable':pct(update.remainingEdge.probability)}</b>
            {' '}· {Math.ceil(update.remainingEdge.remainingMinutes)} min left</p>}
          {update.ibReturn&&<p>Return inside IB before close: <b>{update.ibReturn.probability===null?'Unavailable':pct(update.ibReturn.probability)}</b>
            {ibReturnOutcome===true?' · return recorded later':closed?` · ${ibReturnReason}`:''}</p>}
          {!closed&&recorded&&!update.recordedEdges&&Date.parse(update.issuedAt)<Date.parse(recorded.at)&&
            (update.phase!=='LOCKED'||update.high===current?.high&&update.low===current?.low)&&
            <p>Recorded first: {recorded.side==='IBH'?'High':'Low'} · saved chance <b>{pct(update.estimate.firstBreak[recorded.side])}</b></p>}
          {closed&&outcomeProbability!==null&&<p>Actual outcome chance: <b>{pct(outcomeProbability)}</b></p>}
          {closed&&remainingEdgeProbability!==null&&<p>{remainingEdgeOutcome?'Other edge broke later':'Other edge did not break'}
            {' '}· saved chance <b>{pct(remainingEdgeProbability)}</b></p>}
          {closed&&reason&&!update.settled&&<p>{reason}</p>}
          {closed&&firstBreakProbability!==null&&<p>Actual first edge chance: <b>{pct(firstBreakProbability)}</b></p>}
        </li>;
      })}</ol>
      {comparisons.length>3&&<button type="button" className="quiet-button" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer updates':`Show all ${updates.length} updates`}</button>}
      {closed&&<p className="forecast-caption">These are the odds saved at the time. Edges already recorded are not scored as new predictions. Incomplete results or a corrected locked IB stay unscored.</p>}
    </>}
  </div>;
}

function AuctionContextRead({session,auction,broader}:{session:JournalSession;auction:AuctionRead|null;broader:RecentAuctionRead|null}){
  if(!auction&&!broader)return null;
  const latest=broader?.activity, outside=latest&&(latest.location==='ABOVE'||latest.location==='BELOW');
  return <div className="forecast-auction-read" role="group" aria-label="Market read">
    {auction&&<div className="forecast-auction-row" data-state={auction.state}>
      <span className="forecast-auction-scope">{session.close.finishedAt?'This session':'Today'}{auction.stale?' · Last read':''}</span>
      <strong>{auction.title}</strong>
    </div>}
    {broader?<div className="forecast-auction-row" data-state={broader.state}>
      <span className="forecast-auction-scope">Prior {broader.days} regular sessions</span>
      <strong>{broader.title}</strong>
    </div>:<p className="forecast-caption">Recent days · Waiting for completed ranges</p>}
    {outside&&<p className="forecast-auction-activity">{latest.stale?'Last read: ':''}{latest.detail}</p>}
    {broader&&<p className="forecast-auction-range">{formatPriceNumber(broader.low)}–{formatPriceNumber(broader.high)}</p>}
    {broader?.connection&&<p className="forecast-auction-connection">{broader.connection}</p>}
  </div>;
}

const outcomeNames: Record<string,string> = { IBH:'High only', IBL:'Low only', IBB:'Both sides', IBN:'Neither side' };
const outcomeSymbols: Record<string,string> = { IBH:'↑', IBL:'↓', IBB:'↕', IBN:'—' };
const firstBreakName = (side:string) => side==='none'?'Neither':side==='IBH'?'High first':'Low first';

function LatestSavedUpdate({session,update}:{session:JournalSession;update:ForecastUpdate}) {
  const highest=Math.max(...Object.values(update.estimate.dayType));
  const leaders=Object.entries(update.estimate.dayType).filter(([,p])=>p===highest).map(([type])=>outcomeNames[type]);
  const settled=update.settled||update.recordedEdges==='BOTH';
  const clock=new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'})
    .format(new Date(update.issuedAt));
  return <div className="forecast-latest-saved" role="group" aria-label="Latest saved forecast update">
    <div><span>Latest saved update</span><time dateTime={update.issuedAt}>{clock}</time></div>
    <strong>{settled?'Both edges recorded':`${leaders.join(' / ')} · ${pct(highest)}`}</strong>
    {update.recordedEdges&&<p>{settled?'Observed outcome: both edges had broken.'
      :`Includes the ${update.recordedEdges==='HIGH'?'high':'low'} break already recorded.`}</p>}
  </div>;
}

function Probabilities({ estimate, showFirst = true }: { estimate: ForecastEstimate; showFirst?: boolean }) {
  const highest = Math.max(...Object.values(estimate.dayType));
  return <div className="forecast-probabilities">
    <div className="forecast-outcomes" role="group" aria-label="IB outcome chances">
      <dl>{Object.entries(estimate.dayType).map(([type, probability]) =>
        <div key={type} data-ib-type={type} data-leading={probability===highest}>
          <dt><span aria-hidden="true">{outcomeSymbols[type]}</span>{outcomeNames[type]}</dt>
          <dd>{pct(probability)}<span className="forecast-chance-track" aria-hidden="true"><span style={{width:`${probability*100}%`}}/></span></dd>
        </div>)}</dl>
    </div>
    {showFirst&&<div className="forecast-first-break"><h4>First edge to break</h4><dl>{Object.entries(estimate.firstBreak).map(([side, probability]) =>
      <div key={side}><dt>{firstBreakName(side)}</dt><dd>{pct(probability)}</dd></div>)}</dl></div>}
  </div>;
}

function RecordedIbBreaks({session,current}:{session:JournalSession;current:ReturnType<typeof deriveSessionIbRead>}){
  const read=current?.phase==='LOCKED'?current.read.ib:null,first=firstRecordedIbBreak(read);
  if(!read||!first)return null;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  return <div className="forecast-recorded-breaks" role="group" aria-label="Recorded IB breaks">
    <strong>{read.aboveCount&&read.belowCount?'Both IB edges have breaks recorded':`${first.side} break recorded`}</strong>
    <p>First recorded: {first.side} · {time(first.at)}</p>
    {read.latestSide==='INSIDE'&&<p>Latest price is back inside the IB. The break remains recorded.</p>}
  </div>;
}

function CurrentIbRead({ session, current }: { session: JournalSession;
  current: ReturnType<typeof deriveSessionIbRead> }) {
  if (!current) return null;
  const time = (at: string) => new Intl.DateTimeFormat('en-US', { timeZone: session.displayTimeZone,
    hour: 'numeric', minute: '2-digit' }).format(new Date(at));
  const read = current.read, latest = read.latest;
  const position = { LOWER_HALF: 'Lower half', UPPER_HALF: 'Upper half', MIDPOINT: 'At midpoint',
    BELOW_IB: 'Below the low', ABOVE_IB: 'Above the high', UNKNOWN: null }[read.position];
  const counts = current.phase === 'LOCKED' ? read.ib : null;
  const edgeDistance=latest&&current.high!==null&&current.low!==null
    ?latest.price>current.high?latest.price-current.high:latest.price<current.low?current.low-latest.price:null:null;
  return <div className="forecast-current-read" role="group" aria-label="Current IB read" data-phase={current.phase}>
    {position && latest ? <div className="forecast-price-now"><strong>{formatPriceNumber(latest.price)}</strong>
      <span>{position}{edgeDistance!==null&&` · ${formatPriceNumber(edgeDistance)} pt`}{read.positionPercent !== null && read.positionPercent >= 0 && read.positionPercent <= 100 &&
        ` · ${Math.round(read.positionPercent)}% of IB`}<small>{time(latest.at)}</small></span></div>
      : <p>{current.phase === 'PENDING' ? 'Record the IB range to classify post-IB prices.'
        : current.phase === 'FORMING' ? 'Record a price after your latest range update to see its position.'
        : 'Record a price at or after IB close to see its position.'}</p>}
    {current.high!==null&&current.low!==null&&current.high>current.low&&<div className="forecast-ib-location" aria-label="Recorded IB range">
      <div className="forecast-ib-track" aria-hidden="true">{position&&latest&&read.positionPercent!==null&&<span
        className="forecast-price-marker" style={{left:`${Math.max(0,Math.min(100,read.positionPercent))}%`}}/>}</div>
      <div className="forecast-ib-edges"><span>IBL {formatPriceNumber(current.low)}</span><span>IBH {formatPriceNumber(current.high)}</span></div>
    </div>}
    {current.width !== null && <p className="forecast-current-width">{current.phase === 'FORMING' ? 'Recorded IB so far' : current.provisional?'Recorded IB':'Locked IB'}: <strong>{points(current.width)}</strong></p>}
    {counts && (counts.aboveCount || counts.belowCount) ? <p className="forecast-read-break">
      {counts.aboveCount && counts.belowCount ? 'Both edges broke in your entries.'
        : counts.aboveCount ? 'IBH break recorded.' : 'IBL break recorded.'}
      {counts.latestSide === 'INSIDE' && (counts.aboveThenInside || counts.belowThenInside) ? ' Back inside.' : ''}
      {firstRecordedIbBreak(counts)&&<> First recorded at {time(firstRecordedIbBreak(counts)!.at)}.</>}
    </p> : null}
  </div>;
}

/** RTH includes the IB hour. Its observed range can expand without changing the locked IB. */
function CurrentRthRead({session,current}:{session:JournalSession;current:ReturnType<typeof deriveSessionIbRead>}) {
  const range=deriveRecordedRthRange(session),latest=current?.read.latest;
  const width=range.high!==null&&range.low!==null?range.high-range.low:null;
  const position=latest&&range.low!==null&&width!==null&&width>0?100*(latest.price-range.low)/width:null;
  const location=position===null?'Last recorded price':position===0?'At the RTH low':position===100?'At the RTH high':
    position===50?'At the RTH midpoint':position<50?'Lower half of RTH':'Upper half of RTH';
  const ibPosition=latest&&current&&current.high!==null&&current.low!==null?
    latest.price>current.high?`${formatPriceNumber(latest.price-current.high)} pt above IBH`:
    latest.price<current.low?`${formatPriceNumber(current.low-latest.price)} pt below IBL`:'Inside the IB':null;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  return <div className="forecast-current-read" role="group" aria-label="Current RTH read" data-phase="RTH">
    <p className="forecast-caption">RTH · Regular session including IB</p>
    {latest?<div className="forecast-price-now"><strong>{formatPriceNumber(latest.price)}</strong>
      <span>{location}{position!==null&&` · ${Math.round(position)}% of RTH`}<small>Last recorded CP · {time(latest.at)}</small></span></div>
      :<p>Record a price to see its RTH position.</p>}
    {range.high!==null&&range.low!==null&&<div className="forecast-ib-location" aria-label="Recorded RTH range">
      {width!==null&&width>0&&<div className="forecast-ib-track" aria-hidden="true">{position!==null&&<span
        className="forecast-price-marker" style={{left:`${Math.max(0,Math.min(100,position))}%`}}/>}</div>}
      <div className="forecast-ib-edges"><span>RTHL {formatPriceNumber(range.low)}</span><span>RTHH {formatPriceNumber(range.high)}</span></div>
    </div>}
    {width!==null&&<p className="forecast-current-width">Recorded RTH range: <strong>{tickPoints(width,session.market.tickSize)}</strong></p>}
    {current&&current.high!==null&&current.low!==null?<div aria-label="IB reference">
      <p className="forecast-caption">{current.provisional?'Recorded':'Locked'} IB reference · IBL {formatPriceNumber(current.low)} · IBH {formatPriceNumber(current.high)}</p>
      {ibPosition&&<p className="forecast-caption">{ibPosition}</p>}
    </div>:<p className="forecast-caption">IB reference pending · Record the IB range to classify post-IB prices.</p>}
    <RecordedIbBreaks session={session} current={current}/>
  </div>;
}

function IbReadDetails({session,current,reference,auction,broader}:{session:JournalSession;
  current:ReturnType<typeof deriveSessionIbRead>;reference:ReturnType<typeof deriveLockPositionReference>;
  auction:AuctionRead|null;broader:RecentAuctionRead|null}){
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const read=current?.read,counts=current?.phase==='LOCKED'?read?.ib:null;
  return <div className="forecast-read-method" role="group" aria-label="Current IB read details">
    <h4>About the current conditions</h4>
    {auction&&<p>{auction.detail}{auction.observedAt&&` From your ${auction.basis==='RANGES'?'range update':'prices'} at ${time(auction.observedAt)}.`}</p>}
    {broader&&<>
      <p>Prior {broader.days} RTH sessions: {formatPriceNumber(broader.low)}–{formatPriceNumber(broader.high)}. {broader.detail}</p>
      <p>Dates included: {broader.dates.join(', ')}. Only available completed ranges are used; unfinished or conflicting ranges are left out.</p>
    </>}
    {counts && counts.insideCount > 0 && <p className="forecast-caption">Inside-IB entries since lock: {counts.upperHalfCount} upper · {counts.lowerHalfCount} lower
      {counts.midpointCount > 0 && ` · ${counts.midpointCount} midpoint`}</p>}
    {read&&read.quality.conflictingInstants > 0 && <p className="forecast-caption">Conflicting prices at the same time are left out of this read.</p>}
    <p className="forecast-caption">Based on your recorded prices. Original forecast kept.</p>
    {current&&reference && reference.matchingDays >= 30 && <div className="forecast-lock-reference">
      <strong>IB-close history</strong>
      <span>{time(current.rangeKnownAt)} · {['Bottom', 'Lower middle', 'Upper middle', 'Top'][reference.quartile]} quarter</span>
      <span>Earlier days with this placement:</span>
      <span>IBH first {reference.firstBreak.IBH}/{reference.matchingDays} ({pct(reference.firstBreak.IBH / reference.matchingDays)})</span>
      <span>IBL first {reference.firstBreak.IBL}/{reference.matchingDays} ({pct(reference.firstBreak.IBL / reference.matchingDays)})</span>
      {reference.firstBreak.none > 0 && <span>Neither {reference.firstBreak.none}/{reference.matchingDays} ({pct(reference.firstBreak.none / reference.matchingDays)})</span>}
    </div>}
      <p>This read follows your recorded ranges and prices. Half counts describe entries after IB lock, not minutes spent there.
        Gaps cannot establish the true first break. Range snapshots do not create price observations.
        IB position runs from 0% at IBL to 100% at IBH. After IB lock, the RTH position uses the recorded full regular-session low and high, including the IB hour.</p>
      <p>Balance means ranging or consolidation. Imbalance means a directional search for higher or lower prices.
        These are best-fit descriptions of your recorded path, not volume-profile value areas or forecast confidence.
        A brief edge test can return to balance, and consolidation can form above or below an older range.
        Recent sessions use completed RTH ranges from your journal or compatible Price Action Packs;
        an IB Pack alone does not contain full-session highs and lows. Sparse prices do not prove continuous holding.</p>
      {reference && reference.matchingDays > 0 && <>
      <p>This is a historical first-break frequency, not an updated forecast. It uses the price recorded at IB close;
        later prices do not replace that input. It does not estimate the final IB type or the five-point edge-touch race.</p>
      {reference.matchingDays < 30 && <p>{reference.matchingDays} matching days; at least 30 are needed to display this comparison.</p>}
      {reference.years.map(year => <p key={year.year}>{year.year}: IBH first {year.firstBreak.IBH}/{year.matchingDays}, IBL first {year.firstBreak.IBL}/{year.matchingDays}, neither {year.firstBreak.none}/{year.matchingDays}.</p>)}
      <p>Uses earlier learning IB Pack dates from {reference.sources.length} imported {reference.sources.length === 1 ? 'batch' : 'batches'}.
        Comparison packs, future dates and conflicting duplicate dates are excluded. Pack changes can change this reference; they cannot rewrite your saved forecast.</p>
      </>}
  </div>;
}

function CurrentOvernightRead({session,overnight}:{session:JournalSession;
  overnight:NonNullable<ReturnType<typeof deriveSessionOvernightRead>>}) {
  const {high,low,width,positionPercent,read}=overnight,latest=read.latest;
  const position=positionPercent===null?null:positionPercent<0?'Below ONL':positionPercent>100?'Above ONH':
    positionPercent===0?'At ONL':positionPercent===100?'At ONH':positionPercent===50?'At ON midpoint':
    positionPercent<50?'Lower half of ON':'Upper half of ON';
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,
    hour:'numeric',minute:'2-digit'}).format(new Date(at));
  return <div className="forecast-current-read forecast-on-read" role="group" aria-label="Current overnight read">
    {latest&&<div className="forecast-price-now"><strong>{formatPriceNumber(latest.price)}</strong>
      <span>{position??'Last recorded price'}<small>{time(latest.at)}</small></span></div>}
    <div className="forecast-ib-location" aria-label="Recorded overnight range">
      {width!==null&&width>0&&<div className="forecast-ib-track" aria-hidden="true">
        {positionPercent!==null&&<span className="forecast-price-marker"
          style={{left:`${Math.max(0,Math.min(100,positionPercent))}%`}}/>}</div>}
      <div className="forecast-ib-edges"><span>ONL {low===null?'Pending':formatPriceNumber(low)}</span>
        <span>ONH {high===null?'Pending':formatPriceNumber(high)}</span></div>
    </div>
    {width!==null&&<p className="forecast-current-width">Recorded ON so far: <strong>{points(width)}</strong></p>}
    {!latest&&<p className="forecast-caption">Record a price to see its overnight position.</p>}
    {latest&&positionPercent===null&&<p className="forecast-caption">{width!==null&&width>0
      ?'Record a price after the latest ON update to see its position.'
      :width===0?'ON has no recorded width yet.':'Add both ON edges to see the price in its range.'}</p>}
  </div>;
}

function CurrentConditions({session,current,overnight,auction,broader,showOvernightStudy=true,heading}:{session:JournalSession;
  current:ReturnType<typeof deriveSessionIbRead>;
  overnight:ReturnType<typeof deriveSessionOvernightRead>;
  auction:AuctionRead|null;broader:RecentAuctionRead|null;showOvernightStudy?:boolean;heading?:'h3'|'h4'}){
  if(!current&&!overnight&&!auction&&!broader)return null;
  const postIb=!!current&&current.phase!=='FORMING';
  const phase=overnight?'ON forming':current?.closed?'Day closed':postIb?'RTH':current?.phase==='FORMING'?'Forming':'Before the open';
  const code=deriveCurrentIbCode(session,current);
  const Heading=heading??(overnight&&!session.forecast?'h3':'h4');
  return <div className="forecast-conditions" role="group" aria-label="Current conditions">
    <div className="forecast-conditions-heading"><Heading>{current?.closed?'Closing conditions':'Current conditions'}</Heading>
      {code?<IbCodeBadge code={code} closed={!!current?.closed}/>:<span>{phase}</span>}</div>
    {overnight?<CurrentOvernightRead session={session} overnight={overnight}/>:postIb?<CurrentRthRead session={session} current={current}/>:<CurrentIbRead session={session} current={current}/>}
    {overnight&&showOvernightStudy&&<OvernightStudyPanel session={session}/>}
    <AuctionContextRead session={session} auction={auction} broader={broader}/>
  </div>;
}

function ForecastDetails({focused,children}:{focused:boolean;children:ReactNode}) {
  return focused?<div className="workspace-forecast-evidence" aria-label="Forecast details">{children}</div>
    :<DeferredDetails className="forecast-details" summary="Details">{children}</DeferredDetails>;
}

export function ForecastCard({ session, prior, historical = [], batches = [], levels = noLevels,
  sessions = noSessions, news = noNews, lowBatches = noLowBatches,priceBatches=noPriceBatches, repository = null,
  dashboard=false,focused=false,visible=true,presentation='forecast',children,contextLevels=levels,levelDistance=100,onOpenLevel }: { session: JournalSession;
  prior?: ForecastPriorDay | null; onPrepare?: () => Promise<void>; historical?: HistoricalIbSession[]; batches?: HistoricalIbImportBatch[]; levels?: SignificantLevel[];
  sessions?: JournalSession[]; news?: ContextBatch[]; lowBatches?: FbdBatch[];priceBatches?:PriceHistoryBatch[]; repository?: JournalRepository | null;
  dashboard?:boolean;focused?:boolean;visible?:boolean;presentation?:'forecast'|'structure';children?:ReactNode;contextLevels?:SignificantLevel[];levelDistance?:number;onOpenLevel?:(id:string)=>void }) {
  const saved = session.forecast;
  const { now, current, overnight, reference, outlook,auction,broader,ready,historyError } = useCurrentForecast(session, historical, batches, levels, {sessions,news,lowBatches,priceBatches,repository});
  const history=useForecastUpdateHistory({session,repository,current,outlook,ready,levels,batches,news,lowBatches,priceBatches});
  const closed=!!session.close.finishedAt;
  const recap=useMemo(()=>{
    if(!closed||!saved)return null;
    const cutoff=Date.parse(session.close.observedAt??session.close.finishedAt!);
    const updates=history.updates.filter(row=>row.sessionId===session.id&&row.journalId===session.journalId&&
      row.contract===session.contract&&row.originalIssuedAt===saved.issuedAt&&
      Date.parse(row.issuedAt)>=Date.parse(saved.issuedAt)&&Date.parse(row.issuedAt)<=cutoff)
      .sort((a,b)=>Date.parse(a.issuedAt)-Date.parse(b.issuedAt)||a.id.localeCompare(b.id));
    const opening=updates[0];
    return opening?{opening,latest:updates.length>1?updates.at(-1)!:null}:null;
  },[closed,saved,session.id,session.journalId,session.contract,session.close.observedAt,session.close.finishedAt,history.updates]);
  // Keep live estimates and receipt capture mounted on Today. Detailed level
  // history and presentation are needed only while their destination is open.
  if(!visible)return null;
  const memoryNote = outlook?.marketMemory ? describeMarketMemory(outlook.marketMemory,session.displayTimeZone,session.rthDate) : null;
  // Reuse the mounted read and receipt writer for both destinations. Structure
  // changes presentation only; opening it must not start a second forecast.
  const conditionsSummary=(!current&&!overnight&&!auction&&!broader?<><h3>Current conditions</h3><p className="forecast-caption">Waiting for this session to begin.</p></>
    :<CurrentConditions session={session} current={current} overnight={overnight} auction={auction} broader={broader} showOvernightStudy={false} heading={presentation==='structure'?'h3':undefined}/>);
  const levelConditions=dashboardPhase(session,now)==='POST_IB'&&current?.read.latest&&<PostIbConditions session={session} sessions={sessions}
    levels={contextLevels} price={current.read.latest.price} asOf={current.asOf} proximity={levelDistance} onOpenLevel={onOpenLevel}/>;
  const contextNote=memoryNote&&<p className="forecast-context-note" aria-label="Recorded market context">{memoryNote}</p>;
  const formingOn=latestPreOpenSnapshot(session);
  const onHigh=session.overnight.high??formingOn?.formingOvernightHigh??null,onLow=session.overnight.low??formingOn?.formingOvernightLow??null;
  const gaps=[onHigh===null?'ON high':null,onLow===null?'ON low':null,
    session.fifteenMinute.high===null?'15R high':null,session.fifteenMinute.low===null?'15R low':null,
    dashboardPhase(session,now)==='POST_IB'&&session.bPeriod.high===null&&session.bPeriod.low===null&&!session.bSnapshots.length?'B range':null,
    !saved&&prior===null?'prior-session IB / close':null].filter((value):value is string=>value!==null);
  const provisionalIb=dashboardPhase(session,now)==='POST_IB'&&(current?.provisional||current?.phase==='PENDING');
  const partialNotice=<div className="forecast-input-notice" aria-label="Forecast input status">
    {(!!gaps.length||provisionalIb)&&<strong>Partial forecast</strong>}
    {!!gaps.length&&<p>Missing {gaps.join(' · ')}.</p>}
    {provisionalIb&&<p>IB edges use saved period prices. Coverage may be partial.</p>}
    <small>Check session prices for accuracy. Recorded observations may miss movement between entries.</small>
  </div>;
  if(presentation==='structure')return <div className="workspace-structure-content">
    <section className="forecast-card standalone-conditions" aria-label="Session conditions">{conditionsSummary}</section>
    {children}
    <DeferredDetails key={session.id} className="workspace-forecast-disclosure" summary="Conditions explained">
      <p>The IB code follows recorded post-lock breaks and the latest price. A plus number is points outside the broken edge; a minus means price returned inside or onto the IB. The code stays provisional until the day is finished.</p>
      <IbReadDetails session={session} current={current} reference={reference} auction={auction} broader={broader}/>
      {levelConditions}{contextNote}
    </DeferredDetails>
  </div>;
  const wrapForecast=(forecast:ReactNode)=>!dashboard?forecast:<SessionPhasePanels session={session} now={now} forecast={forecast} focused={focused}
    focusedForecast={focused?<PhaseForecast session={session} now={now} current={current} outlook={outlook} ready={ready} historyAvailable={historical.length>0}
      updates={history.updates} gaps={gaps} partial={!!provisionalIb} inputStatus={partialNotice} details={forecast}/>:undefined}
    postIbForecast={closed?<PostIbRecap session={session} updates={history.updates}/>:
      <IbReturnRead session={session} current={current} forecast={outlook?.ibReturn} now={now} ready={ready}/>}
    conditions={<section className="forecast-card standalone-conditions" aria-label="Session conditions">
      {conditionsSummary}{levelConditions}{contextNote}
    </section>}/>;
  if (!saved) {
    if(dashboard&&dashboardPhase(session,now)==='ON')return wrapForecast(null);
    if (overnight) return <section className="forecast-card forecast-overnight-card" aria-label="Overnight conditions">
      <CurrentConditions session={session} current={current} overnight={overnight} auction={auction} broader={broader}/>
      <p className="forecast-caption">IB forecast begins after the first 15 minutes of RTH.</p>
    </section>;
    if (!dashboard&&session.fifteenMinute.high === null && session.fifteenMinute.low === null&&!broader) return null;
    return wrapForecast(<section className="forecast-card" aria-label={focused?'Detailed IB estimates':'IB Forecast'}>
      <div className="forecast-heading"><h3>IB Forecast</h3><span>Experimental</span></div>
      <RecordedIbBreaks session={session} current={current}/>
      {partialNotice}
      {outlook?<div className="forecast-estimate" aria-label="Current best-fit estimate">
        <div className="forecast-outlook"><span className="forecast-outlook-symbol" aria-hidden="true">↔</span>
          <div className="forecast-leading"><span>Most likely IB outcome</span><strong>{Object.entries(outlook.estimate.dayType).filter(([,p])=>p===Math.max(...Object.values(outlook.estimate.dayType))).map(([type])=>outcomeNames[type]).join(' / ')} <b>{pct(Math.max(...Object.values(outlook.estimate.dayType)))}</b></strong></div></div>
        <p className="forecast-caption">Best fit from your entries · {new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(outlook.asOf))}</p>
        <Probabilities estimate={outlook.estimate} showFirst={!firstRecordedIbBreak(current?.read.ib)}/>
        <details className="forecast-support"><summary>Historical matches: {outlook.support}</summary><p>{outlook.matchingDays} matched sessions out of {outlook.historicalDays} reviewed. Closer matches count more.</p></details>
      </div>:<div className="forecast-pending"><strong>Forecast getting ready</strong>
        <p>{!current?.width?'Record a nonzero opening range to compare with earlier sessions.':!historical.length?'Earlier compatible IB history is needed for odds.':ready?'No compatible historical matches are available for these entries.':'Comparing your entries with earlier sessions…'}</p></div>}
      {!dashboard&&<CurrentConditions session={session} current={current} overnight={overnight} auction={auction} broader={broader}/>}
      <details className="forecast-details"><summary>Details</summary>
        <p>Updates automatically from recorded prices and ranges. Missing inputs use broader comparisons; no missing price is assumed. Period confirmation is not required.</p>
        <p>Recorded IB edges are the reference for these odds. Sparse entries may miss part of the range or path. This display does not replace an original saved forecast.</p>
        {prior&&<p className="forecast-caption">{priorLabel(prior)}</p>}
        {!focused&&<IbReadDetails session={session} current={current} reference={reference} auction={auction} broader={broader}/>}
      </details>
    </section>);
  }
  const recordedFirst=current?.phase==='LOCKED'?firstRecordedIbBreak(current.read.ib):null;
  const recordedBoth=!!current?.read.ib?.aboveCount&&!!current?.read.ib?.belowCount&&current.phase==='LOCKED';
  const comparison = compareForecast(session), estimate = outlook?.estimate ?? recap?.opening.estimate ?? saved.estimate;
  const openingComparison=recap?compareForecastUpdates(session,[recap.opening])[0]:null;
  const openingLabel=recap?.opening.phase==='FORMING'&&!recap.opening.recordedEdges?'Opening estimate':'First saved estimate';
  const originalLabel=saved.validation.probabilityModel==='historical'&&!saved.factors.some(f=>f.probabilityUsed)
    ?'Broad historical average':'Original reference estimate';
  const estimateAt=recap?.opening.issuedAt??saved.issuedAt;
  const highest = estimate ? Math.max(...Object.values(estimate.dayType)) : null;
  const leaders = estimate ? Object.entries(estimate.dayType).filter(([, probability]) => probability === highest).map(([type]) => type) : [];
  const firstHighest = estimate ? Math.max(...Object.values(estimate.firstBreak)) : null;
  const firstLeaders = estimate ? Object.entries(estimate.firstBreak).filter(([, probability])=>probability===firstHighest)
    .map(([side])=>side==='IBH'?'High':side==='IBL'?'Low':'Neither') : [];
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: session.displayTimeZone, hour: "numeric", minute: "2-digit" }).format(new Date(saved.issuedAt));
  const estimateClock=new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(estimateAt));
  const updatedClock = outlook && new Intl.DateTimeFormat('en-US', { timeZone: session.displayTimeZone,
    hour: 'numeric', minute: '2-digit' }).format(new Date(outlook.asOf));
  const remaining=outlook?.remainingEdge;
  const formingWidth=outlook?.formingWidth;
  const support=remaining?.probability!=null?{...remaining,historicalDays:remaining.eligibleDays}:outlook??recap?.opening;
  return wrapForecast(<section className="forecast-card" aria-label={focused?'Detailed IB estimates':'IB Forecast'} aria-busy={!closed&&!!current&&!ready}>
    <div className="forecast-heading"><h3>IB Forecast</h3><span>Experimental</span></div>
    <small className="forecast-disclaimer">Experimental · Not financial advice</small>
    <RecordedIbBreaks session={session} current={current}/>
    {partialNotice}
    {estimate ? <div className="forecast-estimate" aria-label={outlook ? 'Current best-fit estimate' : recap ? 'Saved opening IB estimate' : 'Original IB estimate'}>
      <div className="forecast-outlook">
        <span className="forecast-outlook-symbol" aria-hidden="true">{leaders.length===1?outcomeSymbols[leaders[0]!]:'↔'}</span>
        <div className="forecast-leading"><span>{outlook?.settled ? 'Both edges recorded' : recap?openingLabel:closed?'Saved original estimate':'Most likely IB outcome'}</span>
          <strong>{recap?.opening.settled||recap?.opening.recordedEdges==='BOTH'?'Both edges recorded':<>{leaders.map(type=>outcomeNames[type]).join(' / ')} <b>{pct(highest!)}</b></>}</strong></div>
      </div>
      <p className="forecast-caption">{outlook ? `Best fit from your entries · ${updatedClock}`
        : `${session.studyReplay ? 'Historical replay' : saved.mode === 'live' ? 'Saved forecast' : 'Entered later · for review'} · ${estimateClock}`}</p>
      {recordedFirst?<p className="forecast-first-summary forecast-recorded-first" aria-label="First recorded IB break">
        <span>First recorded break<small>{new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(recordedFirst.at))}</small></span>
        <strong>{recordedFirst.side==='IBH'?'High':'Low'} · 100% <small>recorded</small></strong></p>
        :recap?.opening.recordedEdges?<p className="forecast-first-summary"><span>Already recorded</span>
        <strong>{recap.opening.recordedEdges==='BOTH'?'Both edges':recap.opening.recordedEdges==='HIGH'?'High break':'Low break'}</strong></p>
        :<p className="forecast-first-summary"><span>First edge to break</span><strong>{firstLeaders.join(' / ')} · {pct(firstHighest!)}</strong></p>}
      {!closed&&recordedFirst&&!recordedBoth&&outlook&&<p className="forecast-first-summary" aria-label="Other edge outlook">
        <span>Chance {recordedFirst.side==='IBH'?'low':'high'} also breaks<small>Before close · {Math.ceil(remaining?.remainingMinutes??0)} min left</small></span>
        <strong>{remaining?.probability!=null?pct(remaining.probability):'Unavailable'}</strong></p>}
      {!closed&&current?.phase!=='LOCKED'&&<p className="forecast-width" aria-label="Estimated IB width">
        <span>Estimated IB width</span><strong>{tickPoints(estimate.width.median,session.market.tickSize)}</strong>
        <small>Band {tickPoints(estimate.width.low,session.market.tickSize)}–{tickPoints(estimate.width.high,session.market.tickSize)}{formingWidth?.estimate
          ? ` · ${Math.ceil(formingWidth.remainingMinutes)} min left` : ' · Broad estimate'}</small>
      </p>}
      {(outlook||recap)&&<details className="forecast-support">
        <summary>Historical matches: {support!.support}</summary>
        <p>{support!.matchingDays} matched sessions out of {support!.historicalDays} reviewed.</p>
        <p>Closer matches count more. After weighting, these matches contribute the equivalent of {support!.effectiveDays.toFixed(1)} sessions.</p>
        {remaining?.probability!=null&&<p>These matches have minute price history, the same edge still unbroken at the comparable time, and outcomes through close.</p>}
        <p>Limited means fewer than 20 equivalent sessions after weighting, or fewer than 20 close matches. It describes how well the past sessions fit, not a measured accuracy rate or the size of your library.</p>
      </details>}
      {closed&&!recap&&<p className="forecast-caption">{originalLabel}. No day-specific updates saved for this estimate.</p>}
      {!focused&&recap?.latest&&<LatestSavedUpdate session={session} update={recap.latest}/>}
    </div> : <div className="forecast-pending"><strong>Building the forecast</strong><p>Your inputs are saved. More earlier IB history is needed for odds.</p></div>}
    {comparison&&<div className="forecast-result" aria-label="Forecast compared with actual">
      <h4>What happened</h4><dl>
        <div><dt>IB outcome</dt><dd>{comparison.actual.dayType?<>{outcomeNames[comparison.actual.dayType]} <small>{comparison.actual.dayType}</small></>:'Not confirmed'}</dd></div>
        <div><dt>First edge</dt><dd>{comparison.actual.firstBreak?firstBreakName(comparison.actual.firstBreak):'Not confirmed'}</dd></div>
        <div><dt>Actual IB width</dt><dd>{comparison.actual.width===null?'Not confirmed':points(comparison.actual.width)}</dd></div>
        {typeof openingComparison?.outcomeProbability==='number'&&<div><dt>{openingLabel==='Opening estimate'?'Opening':'First saved'} odds for outcome</dt><dd>{pct(openingComparison.outcomeProbability)}</dd></div>}
      </dl>
      {!comparison.actual.complete&&<p className="forecast-caption">Incomplete price path · result still provisional</p>}
    </div>}
    {!dashboard&&<CurrentConditions session={session} current={current} overnight={overnight} auction={auction} broader={broader}/>}
    {!dashboard&&memoryNote && <p className="forecast-context-note" aria-label="Recorded market context">{memoryNote}</p>}
    <ForecastDetails key={session.id} focused={focused}>
    {focused?<DeferredDetails className="forecast-subdetails" summary="Saved estimates">
      {recap?.latest&&<LatestSavedUpdate session={session} update={recap.latest}/>}
      <ForecastUpdateHistory session={session} updates={history.updates} error={history.error} current={current}/>
    </DeferredDetails>:<ForecastUpdateHistory session={session} updates={history.updates} error={history.error} current={current}/>}
    <DeferredDetails className="forecast-subdetails" summary="Outcome chances">
      {estimate&&<><h4>{outlook?'Current outcome chances':recap?`${openingLabel} · outcome chances`:'Saved outcome chances'}</h4><Probabilities estimate={estimate} showFirst={!recordedFirst}/></>}
      {recordedFirst&&<p>First recorded break: {recordedFirst.side==='IBH'?'High':'Low'} · 100% recorded. Earlier forecasts remain in the history. Sparse entries can miss an earlier break.</p>}
      {remaining&&<p>{remaining.probability===null?'The remaining-edge estimate needs compatible learning price history. The displayed IB outcome uses broader history.':
        'After one recorded break, the current IB outcome uses the remaining-edge estimate through close. It is conditional on the other edge remaining unbroken in your entries.'}</p>}
      <p>The largest percentage is the leading outcome, even below 50%. High only (IBH), low only (IBL), both sides (IBB) and neither side (IBN) describe which edges break after IB lock. After one break, the current outlook estimates whether the other edge also breaks.</p>
    </DeferredDetails>
    {!focused&&<DeferredDetails className="forecast-subdetails" summary="Current conditions explained">
      <p>The pink IB code follows recorded post-lock breaks and the latest price. A plus number is points outside the broken edge; a minus means price returned inside or onto the IB. During the session, IBN means no break recorded yet. The code stays provisional until the day is finished.</p>
      <IbReadDetails session={session} current={current} reference={reference} auction={auction} broader={broader}/>
    </DeferredDetails>}
    {(outlook||recap)&&<DeferredDetails className="forecast-subdetails" summary="Original forecast">
    {(outlook||recap) && <div className="forecast-original" aria-label="Original IB forecast">
      <h4>Original forecast · {clock}</h4>
      <p className="forecast-caption">{originalLabel}. Preserved separately from the day-specific estimates.</p>
      {saved.estimate ? <><Probabilities estimate={saved.estimate} />
        <p className="forecast-caption">Estimated width {tickPoints(saved.estimate.width.median,session.market.tickSize)}. Saved for the end-of-day comparison.</p></>
        : <p className="forecast-caption">Your original inputs were saved before enough history was available. No original probabilities were recorded.</p>}
      <p className="forecast-caption">{saved.referenceDays} historical + {saved.localDays} completed local days</p>
    </div>}
    </DeferredDetails>}
    <DeferredDetails className="forecast-subdetails" summary="History & method">
    {outlook&&<p className="forecast-fit-support">Historical matches: {support!.support} · {support!.matchingDays} matched sessions
      <span>{remaining?.probability!=null?'Uses timed price paths through close.':outlook.pathDays?'Uses formation and available price history.':'Uses broader IB history.'}</span></p>}
    {estimate&&<p className="forecast-width">{outlook&&current?.phase==='LOCKED'?'Recorded IB width':'Estimated IB width'}: <strong>{tickPoints(estimate.width.median,session.market.tickSize)}</strong>
      {!(outlook&&current?.phase==='LOCKED')&&<><br/>Estimated band {tickPoints(estimate.width.low,session.market.tickSize)}–{tickPoints(estimate.width.high,session.market.tickSize)}</>}</p>}
    {!estimate&&<p>At least 30 eligible earlier days are needed for an estimate. Re-select the original reference CSV to add missing ON/15R fields to an older import.</p>}
    <p className="forecast-caption">{saved.referenceDays} historical + {saved.localDays} completed local days</p>
    {saved.priorDay && <p className="forecast-caption">{priorLabel(saved.priorDay)}</p>}
    {saved.packSupport && saved.packSupport.enrichedDays > 0 && <p className="forecast-pack-note">
      Original forecast: Study Packs add context to {saved.packSupport.enrichedDays} historical days.
      {!saved.factors.some(f => ['news', 'fbd', 'levels'].includes(f.factor) && (f.probabilityUsed || f.widthUsed)) &&
        ' Its estimate uses the broader history.'}
    </p>}
    <div className="forecast-method"><h4>How this estimate was made</h4>
      {formingWidth&&<>{formingWidth.estimate?<>
        <p>The width estimate starts with your recorded range and uses historical expansion with the same IB time remaining. Its band covers the middle 80% of those weighted projections; it is an estimate, not a limit on a late move.</p>
        <p>{formingWidth.eligibleDays} earlier days have compatible timed formation history; {formingWidth.matchingDays} of the selected matches contribute extra weight. The broader width baseline uses the same remaining time, without carrying forward the original width estimate.</p>
        {formingWidth.evidenceAgeMinutes>=1&&<p>The latest range or price entry is {Math.floor(formingWidth.evidenceAgeMinutes)} minutes old. Older entries widen the upper band to allow for expansion between observations.</p>}
      </>:<p>Compatible timed formation history is unavailable for this checkpoint. Width uses a broad historical projection; it cannot account for the exact minutes left.</p>}</>}
      {remaining&&<>
        <p>The remaining-edge estimate compares earlier learning paths at the same elapsed session time. It counts a one-tick break after that time through the configured close, using minute highs and lows. A historical edge already broken before that time cannot count as a new future break.</p>
        <p>Available prices, IB width, context and recorded progress toward the 25% and midpoint thresholds influence the match. The clock updates between entries; the last recorded price stays timestamped, and older position evidence has less weight. Entry gaps do not prove continuous time in a band.</p>
        <p>{remaining.matchingDays} matched sessions out of {remaining.eligibleDays} reviewed; the equivalent of {remaining.effectiveDays.toFixed(1)} sessions after weighting. The estimate blends these with 20 days of broader history for the same time and future target. {remaining.distance
          ?`That baseline also compares the required ${formatPriceNumber(remaining.distance.points)} pt move from the last recorded price, relative to IB width and recent range size when available. Older prices weaken that comparison.`
          :'This saved method uses a time-matched baseline.'} No fixed percentage is subtracted each minute.</p>
      </>}
      {historyError&&<p role="status">{historyError}</p>}
      {!closed&&!ready&&current&&<p role="status">Preparing your forecast history…</p>}
      {!!outlook?.referencePriceBatchIds?.length&&<p>Price paths from {outlook.referencePriceBatchIds.length} installed learning
        {outlook.referencePriceBatchIds.length===1?' pack':' packs'} are available for these comparisons.</p>}
      {outlook && <p>The current best fit compares earlier learning days with your available IB geometry, context and prices.
        Historical prices are sampled at your entry times where the corresponding history is available.
        Approximate matches contribute with less weight; {remaining?.probability!=null?'time-matched path history supports the remaining edge.':'broader saved odds keep the estimate grounded.'}
        {support!.matchingDays} matched sessions out of {support!.historicalDays} reviewed; the equivalent of {support!.effectiveDays.toFixed(1)} sessions after weighting.
        {' '}Support describes matching history, not a promised accuracy. Early historical context is an approximation for later reads.
        The current view updates locally; the original forecast is the one scored at the close.</p>}
      {outlook?.marketMemory && <p>Recovery strength, recorded floor losses and nearby level reactions help compare connected market context.
        {outlook.memoryDays ? ` ${outlook.memoryDays} selected days have comparable context.` : ' Broader matching is used where comparable context is missing.'}
        {' '}Bundled memory uses its last available snapshot; installed learning packs are read up to the corresponding minute. Sparse entries do not prove continuous holding.
        Scheduled events and released events are separate. Archive results never enter a pre-release read.
        These updates do not confirm LBAF patterns or change your saved original.</p>}
      {outlook&&<p>Eligible installed IB, Price Action, Low and Context Packs participate alongside the history included with the app.
        New price paths and released events can refine the comparisons without an app rebuild. Missing detail uses broader history;
        conflicting paths are left out. Comparison packs never supply historical learning examples.</p>}
      {!!outlook?.auctionDays&&<p>Uses the recent {outlook.auctionContext!.days} completed sessions to compare balance or directional expansion,
        IB location within that broader range and IB width relative to typical RTH movement.
        {' '}{outlook.auctionDays} selected historical days have comparable prior context. No directional outcome is forced.</p>}
      {recap&&<p>The opening and latest estimates above were saved using the best-fit engine at those times.
        {session.studyReplay?' They are historical reconstructions, not live predictions.':' Later entries do not rewrite those odds.'}
        {' '}The first estimate compared {recap.opening.matchingDays} similar days from {recap.opening.historicalDays} eligible earlier days.
        {' '}Support describes matching history, not a promised accuracy.</p>}
      {(outlook||recap) && <p>The details below describe the saved original forecast.</p>}
      {saved.priorDay?.source.kind === 'import' && <p>Prior-day IB and close came from {saved.priorDay.source.sourceFileName}.
        {saved.priorDay.source.cohort === 'FORWARD_OBSERVATION' && ' This comparison day supplies prior-day inputs only; its outcome is excluded from historical learning.'}</p>}
      {saved.mode === "replay" && <p>{session.studyReplay?'Reconstructed from historical data. These estimates were not made live.':'This was entered after the 15R window.'} It is excluded from live learning and live forecast accuracy.</p>}
      <p>The band is the middle 80% of historical IB expansion ratios scaled to today’s 15R. These are experimental estimates; displayed percentages are rounded.</p>
      {saved.contextWarnings.map((warning) => <p key={warning}>{warning}</p>)}
      <p>Only earlier dates are eligible. Days reserved for comparison are excluded. Similar-day matching uses ON and 15R geometry plus prior-day IB type, width and close position when chronological checks show improvement.</p>
      {estimate && <p>Base probabilities: {saved.validation.probabilityModel === "analog" ? "similar days" : "historical frequencies"}. Width: {saved.validation.widthModel === "analog" ? "similar-day expansion" : "historical expansion"}. Each falls back to the broader history until matching demonstrates improvement.</p>}
      {session.journalId === "es" ? <p>Historical reference provenance is MES; the current journal template is ES. This is not a separately validated ES model.</p>
        : <p>Uses this {session.instrument} journal’s records and imported history. Imported files rely on your confirmation that the instrument and study hours match.</p>}
      <ul className="forecast-factor-list">{saved.factors.length ? saved.factors.map((factor) => <li key={factor.factor}>
        <strong>{factorNames[factor.factor]} · {condition(factor.factor, saved.context[factor.factor])}</strong>
        <span>{saved.context[factor.factor] === null ? "Add or review this context before your next forecast." : factor.probabilityUsed || factor.widthUsed
          ? `Included in ${[factor.probabilityUsed ? "probabilities" : "", factor.widthUsed ? "width" : ""].filter(Boolean).join(" and ")}`
          : factor.matchingDays < 10 || factor.evaluatedDays < 20 ? "Limited matching history · not applied" : "No clear improvement yet · not applied"}</span>
        {saved.context[factor.factor] !== null && <small>{factor.matchingDays} matching days · {factor.evaluatedDays} earlier-date checks</small>}
      </li>) : <li>News, LBAF and level context will be evaluated as completed live records accumulate.</li>}</ul>
      {saved.validation.days > 0 && <p>Base-model development check: {saved.validation.days} chronological predictions;
        mean Brier score {saved.validation.brier?.toFixed(3)} versus {saved.validation.baselineBrier?.toFixed(3)} for unconditional frequencies. Lower is better. These checks are not a claim of calibration.</p>}
      {saved.packSupport && <p>Historical context includes {saved.packSupport.newsDays} release days,
        {' '}{saved.packSupport.fbdDays} days with qualified flush/reclaim evidence and {saved.packSupport.lowDays} days with a nearby or more distant low.
        {' '}{saved.packSupport.priceDays ? `${saved.packSupport.priceDays} low-distance checks use a completed 15R minute close.`
          : 'Historical low distances use the 15R midpoint when an eligible minute pack is unavailable.'}
        {' '}A missing pack entry stays unknown. Release results and later price moves are excluded.</p>}
      {saved.validation.contextCheck ? <p>Combined context must also improve earlier-date checks before it is used.
        {' '}{saved.validation.contextCheck.probabilityDays} probability checks and {saved.validation.contextCheck.widthDays} width checks.
        {' '}Future saved forecasts will provide further comparisons.</p>
        : <p>Context adjustments were screened individually in this saved forecast. Their combined estimate still needs prospective evaluation.</p>}
      <p>Original probabilities stay fixed. Corrections and Trash affect future training. Commentary and notes never become model inputs.</p>
    </div>
    </DeferredDetails>
    {comparison&&<DeferredDetails className="forecast-subdetails" summary="Original forecast vs actual">
    {comparison && <div className="forecast-comparison" aria-label="Saved forecast comparison">
      <h4>Original estimate vs actual</h4>
      <dl>
        <div><dt>IB type</dt><dd>{comparison.actual.dayType ?? "Pending complete path"}
          {comparison.dayTypeProbability !== null && ` · saved odds ${pct(comparison.dayTypeProbability)}`}</dd></div>
        <div><dt>First break</dt><dd>{comparison.actual.firstBreak === "none" ? "Neither" : comparison.actual.firstBreak ?? "Pending complete path"}
          {comparison.firstBreakProbability !== null && ` · saved odds ${pct(comparison.firstBreakProbability)}`}</dd></div>
        <div><dt>Final IB width</dt><dd>{comparison.actual.width === null ? "Pending final IB" : points(comparison.actual.width)}</dd></div>
        {comparison.widthError !== null && <div><dt>Actual minus estimate</dt><dd>{comparison.widthError >= 0 ? "+" : ""}{points(comparison.widthError)} · {comparison.widthInside ? "inside" : "outside"} estimated band</dd></div>}
      </dl>
      {!comparison.actual.complete && <p>Confirm Path complete to evaluate IB type and first break. This provisional result does not train future estimates.</p>}
    </div>}
    </DeferredDetails>}
    </ForecastDetails>
  </section>);
}
