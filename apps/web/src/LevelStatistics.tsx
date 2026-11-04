// SPDX-License-Identifier: MPL-2.0
import {useEffect,useMemo,useRef,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {fbdCompatibility,formatPriceNumber,type LevelActivityStatistics,
  type LevelActivityFact,type LevelActivityKind,type JournalSession,type SignificantLevel,type FbdBatch} from '@ib-field-notes/domain';
import type {JournalRepository} from '@ib-field-notes/storage-port';
import {loadLowPackRows} from './lowPackRows';
import {historicalLowLevel} from './levelQuality';
import {displayLevelLabel,levelTypeLabels,levelTimeframeLabels} from './LevelChoices';
import {journalClock} from './journalClock';
import type {LevelStatisticsInput,LevelStatisticsReply} from './levelStatistics.worker';
import {useReviewHome,useReviewScroll} from './ReviewNavigation';
import {visitDescription,visitResponseDescription,visitMoveDescription} from './LevelVisits';

const labels:Record<string,string>={touch:'Touched a level',cross_above:'Crossed above',cross_below:'Crossed below',
  zone_entered:'Entered a zone',zone_traversed:'Crossed a zone',low_below:'Recorded below a low',
  low_reclaimed:'Low reclaimed',recovery_higher:'Recovery followed higher',recovery_lost:'Recovery floor lost',
  support_retest:'Recovery zone revisited',resistance_retest:'Lost recovery zone revisited',tested_from_above:'Tested from above',
  tested_from_below:'Tested from below',held_above:'Held above',held_below:'Held below',crossed_above:'Crossed above',
  crossed_below:'Crossed below',became_support:'Changed to support',became_resistance:'Changed to resistance',visit:'Recorded visit',reclaim_cycle:'Reclaim cycle',FBD:'Look below and fail (LBAF)',FBO:'Look above and fail (LAAF)'};
const priceKinds:LevelActivityKind[]=['touch','cross_above','cross_below','zone_entered','zone_traversed'];
const recoveryKinds:LevelActivityKind[]=['became_support','became_resistance','low_below','low_reclaimed','recovery_higher','recovery_lost','support_retest','resistance_retest'];
const number=(value:number)=>formatPriceNumber(value);
const levelPrice=(level:SignificantLevel)=>level.price!==null?number(level.price):`${number(level.zoneLow!)}–${number(level.zoneHigh!)}`;
const referenceLabel=(level:SignificantLevel)=>level.sessionEdge
  ?({IBH:'Initial Balance high',IBL:'Initial Balance low',ONH:'Overnight high',ONL:'Overnight low'}[level.sessionEdge.code])
  :displayLevelLabel(level)??levelTypeLabels[level.levelType];

function useActivity(sessions:JournalSession[],levels:SignificantLevel[],context:JournalSession,
  batches:FbdBatch[],repository:JournalRepository|null,active:boolean) {
  const [result,setResult]=useState<LevelActivityStatistics|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const scope=JSON.stringify([context.journalId,context.instrument,context.market]),previousScope=useRef(scope);
  useEffect(()=>{
    if(previousScope.current!==scope){previousScope.current=scope;setResult(null);}
    if(!active){setLoading(false);return;}
    let cancelled=false,worker:Worker|null=null;setError('');setLoading(true);
    const asOf=Temporal.Now.instant().toString();
    const prepare=async()=>{
      const compatible=batches.filter(batch=>batch.journalId===context.journalId&&
        Date.parse(batch.importedAt)<=Date.parse(asOf)&&!fbdCompatibility(batch.info,context.market).error);
      const loaded=repository?await Promise.allSettled(compatible.map(async batch=>(await loadLowPackRows(repository,batch))
        .map(low=>{const level=historicalLowLevel(low,batch,context);return {...level,
          id:`level-stats:${batch.id}:${low.id}`,label:low.breakoutBacktest?'Breakout backtest':'1H low',
          studyReplay:{...level.studyReplay!,importedAt:batch.importedAt}};}))):[];
      if(cancelled)return;
      const packLevels=loaded.flatMap(row=>row.status==='fulfilled'?row.value:[]);
      if(loaded.some(row=>row.status==='rejected'))setError('Some pack references could not load. Journal activity is still shown.');
      const windows=new Map(sessions.map(day=>{const clock=journalClock(day.market);return [day.id,
        {start:clock.overnightStart(day.rthDate).toString(),ibLockAt:clock.checkpointInstant(day.rthDate,day.market.checkpoints.ibLock).toString(),
          close:clock.checkpointInstant(day.rthDate,day.market.checkpoints.studyClose).toString()}];}));
      worker=new Worker(new URL('./levelStatistics.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent<LevelStatisticsReply>)=>{
        if(cancelled)return;
        if(event.data.result)setResult(event.data.result);else setError(event.data.error);
        setLoading(false);worker?.terminate();worker=null;
      };
      worker.onerror=()=>{
        if(cancelled)return;
        setError('Level activity could not be calculated. Reopen Level stats to try again.');
        setLoading(false);worker?.terminate();worker=null;
      };
      worker.postMessage({sessions,levels:[...levels,...packLevels],context,asOf,windows} satisfies LevelStatisticsInput);
    };
    void prepare().catch(err=>{if(!cancelled){setError(err instanceof Error?err.message:String(err));setLoading(false);worker?.terminate();worker=null;}});
    return()=>{cancelled=true;worker?.terminate();};
  },[sessions,levels,scope,batches,repository,active]);
  return {result,error,loading};
}

export function LevelStatistics({sessions,levels,session,batches,repository,onOpenSession,active=true,homeRequest=0}:{
  sessions:JournalSession[];levels:SignificantLevel[];session:JournalSession;batches:FbdBatch[];
  repository:JournalRepository|null;onOpenSession:(date:string)=>void;
  active?:boolean;homeRequest?:number;
}) {
  const {result:stats,error,loading}=useActivity(sessions,levels,session,batches,repository,active);
  const [view,setView]=useState<'activity'|'ib'|'details'>('activity');
  const [inspection,setInspection]=useState<{title:string;select:(stats:LevelActivityStatistics)=>LevelActivityFact[]}|null>(null);
  const [query,setQuery]=useState(''),[page,setPage]=useState(0);
  useReviewHome(homeRequest,()=>setInspection(null));
  const scroll=useReviewScroll(`level-stats:${session.journalId}:${inspection?.title??view}`,active);
  useEffect(()=>{setInspection(null);},[session.journalId,session.instrument]);
  const levelsById=useMemo(()=>new Map(stats?.levels.map(level=>[level.id,level])??[]),[stats]);
  const date=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'})
    .format(new Date(`${value}T12:00:00Z`));
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'})
    .format(new Date(at));
  const open=(title:string,select:(stats:LevelActivityStatistics)=>LevelActivityFact[])=>{setInspection({title,select});setQuery('');setPage(0);};
  const inspectDays=(title:string,selectIds:(stats:LevelActivityStatistics)=>string[])=>open(title,stats=>{
    const ids=new Set(selectIds(stats));return stats.facts.filter(fact=>ids.has(fact.sessionId));
  });
  const row=(kind:LevelActivityKind)=>{
    const count=stats!.measures[kind].count;
    return <button className="level-stat-metric" key={kind} type="button" disabled={!count}
      onClick={()=>open(labels[kind]!,stats=>stats.facts.filter(fact=>fact.source==='prices'&&fact.kind===kind))}>
      <span>{labels[kind]}</span><strong>{count||'None recorded'}</strong></button>;
  };
  if(inspection&&stats) {
    const search=query.trim().toLowerCase();
    const facts=inspection.select(stats).filter(fact=>{
      const level=levelsById.get(fact.levelId);
      return !search||`${fact.rthDate} ${date(fact.rthDate)} ${level?levelPrice(level):''} ${level?referenceLabel(level):''} ${labels[fact.kind]??fact.kind} ${fact.source}`.toLowerCase().includes(search);
    });
    const pages=Math.max(1,Math.ceil(facts.length/8)),currentPage=Math.min(page,pages-1);
    return <section ref={scroll} className="history-card level-statistics" aria-label="Level statistic details" aria-busy={loading}>
      <button type="button" className="research-overview-back" onClick={()=>setInspection(null)}>← Back to Level stats</button>
      <h2>{inspection.title}</h2>
      {loading&&<p className="history-helper" role="status">Refreshing saved prices…</p>}{error&&<p role="status">{error}</p>}
      <p className="history-helper">{facts.length} observation{facts.length===1?'':'s'} · Tap a date to open its day.</p>
      <label className="level-stat-search">Find a level or date<input type="search" value={query}
        onChange={event=>{setQuery(event.target.value);setPage(0);}} placeholder="Price, name or date"/></label>
      <ol className="level-stat-facts" aria-label="Observations behind this stat">
        {facts.slice(currentPage*8,currentPage*8+8).map(fact=>{
          const level=levelsById.get(fact.levelId),day=stats.sessions.find(day=>day.id===fact.sessionId);
          return <li key={`${fact.levelId}:${fact.id}`} data-review-item={`${fact.levelId}:${fact.id}`}><div className="level-stat-fact-heading" data-edge={level?.sessionEdge?.code.startsWith('IB')?'ib':level?.sessionEdge?'on':undefined}>
            <strong>{level?.sessionEdge?.code} {level?levelPrice(level):'Level'}</strong>
            <span>{level&&referenceLabel(level)}</span></div>
            <p>{labels[fact.kind]??fact.kind}{fact.price!==null&&` · Price ${number(fact.price)}`}</p>
            {fact.visit&&<p>{visitDescription(fact.visit)} · {fact.visit.entries} {fact.visit.entries===1?'entry':'entries'}
              {fact.visit.departureAt&&` · departure ${time(fact.visit.departureAt)} at ${number(fact.visit.departurePrice!)}`}</p>}
            {fact.visit?.response&&<>
              <p>{visitResponseDescription(fact.visit,level?.levelType)} · {visitMoveDescription(fact.visit)}</p>
              <small>{fact.visit.response.end==='return'?'Next visit':fact.visit.response.end==='archived'?'Archived':'Last saved price'} · {time(fact.visit.response.endAt)}</small>
              {!!fact.visit.response.newerLows.length&&<p>Later qualified low{fact.visit.response.newerLows.length>1?'s':''} · {fact.visit.response.newerLows.map(low=>
                `${number(low.price)} (${levelTimeframeLabels[low.timeframe]}; qualified ${time(low.knownAt)})`).join(', ')}</p>}
            </>}
            {fact.cycle&&<p>Below at {time(fact.cycle.belowAt)} · recorded low {number(fact.cycle.lowestPrice)}
              {fact.cycle.priorAboveAt===null&&' · earlier above price not recorded'}</p>}
            <div className="level-stat-fact-footer"><button type="button" onClick={()=>onOpenSession(fact.rthDate)}>
              {date(fact.rthDate)} · {time(fact.at)}</button><small>{level?.studyReplay&&'Pack level · '}{fact.source==='confirmed'?'Confirmed by you':fact.source==='manual'?'Added by you':day?.studyReplay?'Replay prices':'Saved prices'}</small></div>
          </li>;
        })}
      </ol>
      {!facts.length&&<p className="empty-state">No matching observations.</p>}
      {pages>1&&<div className="levels-pagination"><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button>
        <span>{currentPage+1} / {pages}</span><button type="button" disabled={currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>More</button></div>}
    </section>;
  }
  return <section ref={scroll} className="history-card statistics-card level-statistics" aria-label="Level stats" aria-busy={loading}>
    <h2>Level stats</h2><p className="history-helper">How recorded prices interacted with your levels.</p>
    {error&&<p role="status">{error}</p>}
    {!stats?<p role="status">{loading?'Reading your saved prices…':'Activity is unavailable. Reopen Level stats to try again.'}</p>:<>
      {loading&&<p className="history-helper" role="status">Refreshing saved prices…</p>}
      <div className="level-stat-overview">
        <span><strong>{stats.visitedLevels}</strong><small>Levels with activity</small></span>
        <span><strong>{stats.activeDays.count}</strong><small>Days with activity</small></span>
        <span><strong>{stats.priceInteractions}</strong><small>Price events</small></span>
      </div>
      <div className="level-stat-views" role="group" aria-label="Level stats views">
        {([['activity','Activity'],['ib','IB results'],['details','Details']] as const).map(([key,label])=><button key={key} type="button"
          aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}
      </div>
      {view==='activity'&&<div aria-label="Level activity">
        <h3>What prices did</h3><p className="history-helper">Detected automatically from your entries.</p>
        <div className="level-stat-metrics">{priceKinds.filter(kind=>!kind.startsWith('zone_')||stats.levels.some(level=>level.shape==='price_zone')).map(row)}</div>
        <details className="stat-disclosure level-stat-section"><summary>Distinct visits and retests</summary>
          <p>Consecutive entries at a level or inside its zone count as one visit. A saved price a tick outside ends it. Session boundaries start fresh.</p>
          <div className="level-stat-metrics">{row('visit')}
            {([['Support tests','above',false],['Returned above','above',true],['Resistance tests','below',false],['Returned below','below',true]] as const).map(([label,side,returned])=>{
              const select=(stats:LevelActivityStatistics)=>stats.facts.filter(fact=>fact.visit?.approach===side&&(!returned||fact.visit.departure===side)&&
                ['low','high'].includes(levelsById.get(fact.levelId)?.levelType??''));
              const count=select(stats).length;
              return <button className="level-stat-metric" type="button" key={label} disabled={!count} onClick={()=>open(label,select)}><span>{label}</span><strong>{count||'None recorded'}</strong></button>;
            })}{row('reclaim_cycle')}</div>
          <p>Returns describe the next saved departure, not a measured reaction size. Reclaim cycles mean recorded below then above a low in one session; they do not confirm an LBAF.</p>
          {([['Recorded move away',false],['Later qualified lows',true]] as const).map(([label,newer])=>{
            const select=(stats:LevelActivityStatistics)=>stats.facts.filter(fact=>fact.visit?.response&&(!newer||fact.visit.response.newerLows.length));
            const count=select(stats).length;
            return <button className="level-stat-metric" key={label} type="button" disabled={!count} onClick={()=>open(label,select)}><span>{label}</span><strong>{count||'None recorded'}</strong></button>;
          })}
          <p>Moves are recorded maxima from the original level or zone edge until the next visit. Later lows require existing independent 20+ qualification; they do not replace a level automatically.</p>
        </details>
        <details className="stat-disclosure level-stat-section"><summary>Role changes and recoveries</summary>
          <p>Highs and lows can change between support and resistance. After a low is crossed, the tracker follows its reclaim and recovery floor.</p>
          <div className="level-stat-metrics">{recoveryKinds.map(row)}</div>
        </details>
        <details className="stat-disclosure level-stat-section"><summary>Added or confirmed by you</summary>
          <p>These remain separate from automatic price tracking. LBAF means look below and fail; LAAF means look above and fail.</p>
          {!stats.manualInteractions.count&&!stats.confirmedFbd.count&&!stats.confirmedFbo.count?<p>No interactions or LBAF/LAAF confirmations added by you yet.</p>
            :[['Saved interactions',stats.manualInteractions,'manual'],['Confirmed LBAF',stats.confirmedFbd,'FBD'],['Confirmed LAAF',stats.confirmedFbo,'FBO']].map(([label,measure,key])=>{
            const count=(measure as LevelActivityStatistics['manualInteractions']).count;
            return <button className="level-stat-metric" type="button" key={key as string} disabled={!count}
              onClick={()=>open(label as string,stats=>stats.facts.filter(fact=>key==='manual'?fact.source==='manual':fact.source==='confirmed'&&fact.kind===key))}>
              <span>{label as string}</span><strong>{count||'None recorded'}</strong></button>;
          })}
        </details>
        <button className="secondary-action" type="button" disabled={!stats.facts.length} onClick={()=>open('All level activity',stats=>stats.facts)}>View all activity</button>
        {!stats.facts.length&&<p className="empty-state">No activity recorded yet. Save prices while tracking levels to build this view.</p>}
        <p className="history-helper">A crossing is between saved prices. Unrecorded moves and exact crossing times remain unknown.</p>
      </div>}
      {view==='ib'&&<div aria-label="IB outcomes on active days">
        <h3>IB on days with level activity</h3><p className="history-helper">Each day counts once, even if several levels were visited.</p>
        <h4>First recorded IB break</h4>
        {stats.ib.recordedFirstBreakDays?<><p className="history-helper">{stats.ib.recordedFirstBreakDays} {stats.ib.recordedFirstBreakDays===1?'day':'days'} with a recorded first break.</p>
          {([['High first',stats.ib.firstBreakRates.high],['Low first',stats.ib.firstBreakRates.low]] as const).map(([label,rate])=><button className="level-stat-metric" key={label} type="button" disabled={!rate.count}
            onClick={()=>inspectDays(label,stats=>stats.ib.days.filter(day=>day.firstBreakSide===(label==='High first'?'IBH':'IBL')).map(day=>day.sessionId))}>
            <span>{label}</span><strong>{rate.count} of {rate.denominator} · {rate.ratePct!.toFixed(0)}%</strong></button>)}</>
          :<p className="empty-state">No first IB break recorded on these days yet.</p>}
        {!!stats.ib.noRecordedFirstBreakDays&&<p className="history-helper">First break missing on {stats.ib.noRecordedFirstBreakDays} {stats.ib.noRecordedFirstBreakDays===1?'day':'days'}.</p>}
        <h4>Which IB breaks were recorded?</h4>
        {stats.ib.classifiedDayTypeDays?<>{([['High only','IBH'],['Low only','IBL'],['Both edges','IBB'],['Neither edge','IBN']] as const).map(([label,type])=>{
          const rate=stats.ib.dayTypeRates[type];return <button className="level-stat-metric" type="button" key={type} disabled={!rate.count}
            onClick={()=>inspectDays(label,stats=>stats.ib.days.filter(day=>day.dayType===type).map(day=>day.sessionId))}>
            <span>{label}</span><strong>{rate.count} of {rate.denominator} · {rate.ratePct!.toFixed(0)}%</strong></button>;
        })}</>:<p className="empty-state">No classified IB outcome on these days yet.</p>}
        {!!stats.ib.unclassifiedDayTypeDays&&<p className="history-helper">IB outcome pending on {stats.ib.unclassifiedDayTypeDays} {stats.ib.unclassifiedDayTypeDays===1?'day':'days'}.</p>}
        <p className="history-helper">Level activity can occur before or after the IB break. Unfinished days can change.</p>
      </div>}
      {view==='details'&&<div aria-label="Level stats coverage">
        <h3>What is included?</h3><dl className="level-stat-coverage">
          <div><dt>Journal days</dt><dd>{stats.sessions.length}</dd></div>
          <div><dt>Saved prices</dt><dd>{stats.priceCount}</dd></div>
          <div><dt>Available level references</dt><dd>{stats.levels.length}</dd></div>
          <div><dt>Study replay days</dt><dd>{stats.sessions.filter(day=>day.studyReplay).length}</dd></div>
        </dl>
        <p className="history-helper">Includes manual levels, eligible pack references and your recorded IB/ON edges. Pack price history is not counted as extra journal days.</p>
        <details className="stat-disclosure level-stat-section"><summary>Level types</summary><dl className="level-stat-coverage">
          {Object.entries(levelTypeLabels).map(([type,label])=><div key={type}><dt>{label}</dt><dd>{stats.levels.filter(level=>level.levelType===type&&!level.sessionEdge).length}</dd></div>)}
          <div><dt>IB edges</dt><dd>{stats.levels.filter(level=>level.sessionEdge?.code.startsWith('IB')).length}</dd></div>
          <div><dt>Overnight edges</dt><dd>{stats.levels.filter(level=>level.sessionEdge?.code.startsWith('ON')).length}</dd></div>
        </dl></details>
        <details className="stat-disclosure level-stat-section"><summary>How to read these counts</summary>
          <p>Activity starts after a level becomes available. Forming IB/ON edges wait until they lock. Matching replay and pack copies count once; nearby independent levels stay separate.</p>
          <p>Several descriptions can come from one price entry. The overview counts each level/time once. Missing or conflicting prices do not establish an interaction.</p>
          <p>Visit and reclaim-cycle counts group those entries separately. Raw Price events and manual confirmations keep their own totals.</p>
          <p>Automatic tracking does not confirm a manual LBAF/LAAF. Corrections and removals recalculate the counts from current records.</p>
        </details>
      </div>}
    </>}
  </section>;
}
