// SPDX-License-Identifier: MPL-2.0
import {useMemo,useState,type ReactNode} from 'react';
import {useReviewScroll} from './ReviewNavigation';
import {formatPriceNumber,historicalIbBreakCode,type CoreIbStatistics,type HistoricalIbSession,
  type StatisticRate,type WeeklyDaySummary,type HistoricalBreakCodeStatistics} from '@ib-field-notes/domain';

export type IbStatsView='outcomes'|'returns'|'details';
export type IbDaySelector=(stats:CoreIbStatistics)=>string[];
type DaySelection={ids:string[];select:IbDaySelector};
const outcomes={IBH:'High only',IBL:'Low only',IBB:'Both edges',IBN:'Neither edge'};
const closes={ABOVE_IBH:'Above the IB',INSIDE_OR_ON_IB:'Inside or on the IB',BELOW_IBL:'Below the IB'};
const codes={IBN:'Neither edge broke','IBH+':'High only · closed above','IBH-':'High only · closed inside',
  'IBL+':'Low only · closed below','IBL-':'Low only · closed inside','IBBH+':'Both · closed above',
  'IBBL+':'Both · closed below','IBB-':'Both · closed inside'};
const depths=[['EDGE','Retested the broken edge'],['QUARTER','Reached 25% into the IB'],
  ['MIDPOINT','Reached the midpoint'],['THREE_QUARTER','Reached 75% into the IB'],['OPPOSITE_EDGE','Reached the opposite edge']] as const;
const number=(value:number|null)=>value===null?'Not recorded':formatPriceNumber(value);
const date=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'})
  .format(new Date(`${value}T12:00:00Z`));
const ids=(days:WeeklyDaySummary[],predicate:(day:WeeklyDaySummary)=>boolean):DaySelection=>({
  ids:days.filter(predicate).map(day=>day.sessionId),select:stats=>stats.days.filter(predicate).map(day=>day.sessionId)});

/** Preserve the imported finder across dates, contracts, outcomes and source metadata. */
export function historicalSessionSearchMatches(session:HistoricalIbSession,query:string):boolean {
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const [year,month,day]=session.rthDate.split('-');
  const searchText=[session.rthDate,date(session.rthDate),`${Number(month)}/${Number(day)}/${year}`,session.sourceYear,
    session.contract,session.dayType,historicalIbBreakCode(session),session.firstBreakSide,session.closeDisposition,
    session.status,session.missingDataDetails,session.sourceFileName].filter(Boolean).join(' ').toLocaleLowerCase();
  return terms.every(term=>searchText.includes(term));
}

export function IbStatistics({statistics:stats,annualStatistics,view,onViewChange,onInspect,historicalBreakCodes,
  onInspectCode,detailsTools,onBrowseAll}:{
  statistics:CoreIbStatistics;annualStatistics:Array<{year:string;statistics:CoreIbStatistics}>;
  view:IbStatsView;onViewChange:(view:IbStatsView)=>void;onInspect:(title:string,select:IbDaySelector)=>void;
  historicalBreakCodes?:HistoricalBreakCodeStatistics|null;
  onInspectCode?:(family:keyof typeof codes)=>void;detailsTools?:ReactNode;onBrowseAll?:()=>void;
}) {
  const row=(label:string,rate:StatisticRate,dayIds:DaySelection,code?:string)=>
    <button key={label} type="button" className="level-stat-metric ib-stat-metric" disabled={!rate.count}
      onClick={()=>onInspect(`${label} days`,dayIds.select)}>
      <span>{label}{code&&<small className="ib-stat-code"> {code}</small>}</span>{' '}
      <strong>{rate.denominator?`${rate.ratePct!.toFixed(1)}%`:'Not recorded'}
        {!!rate.denominator&&<small> {rate.count} of {rate.denominator} days</small>}</strong>
      {!!rate.denominator&&<span className="stat-rate-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,rate.ratePct??0))}%`}}/></span>}
    </button>;
  const missing=(label:string,dayIds:DaySelection,caption=label.toLowerCase())=>dayIds.ids.length>0&&<button className="ib-stat-missing" type="button"
    aria-label={`${dayIds.ids.length} ${dayIds.ids.length===1?'day':'days'}: ${label}`}
    onClick={()=>onInspect(label,dayIds.select)}>{dayIds.ids.length} {dayIds.ids.length===1?'day':'days'} {caption} ›</button>;
  return <div className="level-statistics ib-statistics" aria-label="IB results">
    <div className="level-stat-overview" aria-label="IB summary">
      <span><strong>{stats.journaledDays}</strong><small>Recorded days</small></span>
      <span><strong>{stats.completedDays}</strong><small>Complete days</small></span>
      <span><strong>{stats.ibWidth.median===null?'—':stats.ibWidth.median.toFixed(1)}</strong><small>Typical IB · points</small></span>
    </div>
    <div className="level-stat-views" role="group" aria-label="IB stats views">
      {([['outcomes','Results'],['returns','Returns'],['details','Details']] as const).map(([key,label])=>
        <button key={key} type="button" aria-pressed={view===key} onClick={()=>onViewChange(key)}>{label}</button>)}
    </div>
    {view==='outcomes'&&<div aria-label="Recorded IB outcomes">
      <h3>Which IB edges broke?</h3><p className="history-helper">IB is the session's opening range. A break moves at least one tick beyond an edge.</p>
      <div className="level-stat-metrics">{(['IBH','IBL','IBB','IBN'] as const).map(code=>
        row(outcomes[code],stats.dayTypeRates[code],ids(stats.days,day=>day.dayType===code),code))}</div>
      {missing('Without a recorded outcome',ids(stats.days,day=>day.dayType===null))}
      <details className="stat-disclosure level-stat-section"><summary>First edge to break</summary>
        <p>Which edge broke first, on days with a recorded first break.</p>
        {row('High first',stats.firstBreakRates.high,ids(stats.days,day=>day.firstBreakSide==='IBH'))}
        {row('Low first',stats.firstBreakRates.low,ids(stats.days,day=>day.firstBreakSide==='IBL'))}
        {missing('Without a recorded first break',ids(stats.days,day=>day.firstBreakSide===null))}
      </details>
      <details className="stat-disclosure level-stat-section"><summary>Where the day closed</summary>
        <p>The recorded close compared with the locked IB range.</p>
        {(['ABOVE_IBH','INSIDE_OR_ON_IB','BELOW_IBL'] as const).map(key=>
          row(closes[key],stats.closeDispositionRates[key],ids(stats.days,day=>day.closeDisposition===key)))}
        {missing('Without a recorded close',ids(stats.days,day=>day.closeDisposition===null))}
      </details>
      <p className="history-helper">These are recorded results. Unfinished days can change.</p>
    </div>}
    {view==='returns'&&<div aria-label="Post-break returns">
      <h3>After the first break</h3><p className="history-helper">How far price came back through the IB after breaking an edge.</p>
      {depths.map(([key,label])=>{
        const depth=stats.returnDepth[key];
        return <div key={key}>{row(label,{count:depth.yes,denominator:depth.knownDenominator,ratePct:depth.yesRatePct},
          ids(stats.days,day=>day.returnDepthStatus[key]==='YES'))}
          {missing(`${label}: result unknown`,ids(stats.days,day=>day.returnDepthStatus[key]==='UNKNOWN'),'with an unknown result')}</div>;
      })}
      <details className="stat-disclosure level-stat-section"><summary>How returns are counted</summary>
        <p>Each percentage uses only days with a recorded yes or no for that depth. Tap a percentage to see days that reached it.</p>
        <p>A missing observation stays unknown unless the recorded path is marked complete. Days without a first break do not contribute.</p>
        <p>Retesting an edge does not establish a sustained rejection. A midpoint return is halfway across the IB.</p>
      </details>
    </div>}
    {view==='details'&&<div aria-label="IB stats coverage">
      {detailsTools}
      <h3>What is included?</h3><dl className="level-stat-coverage">
        {([['Recorded days',stats.journaledDays],['Complete days',stats.completedDays],['Recorded IB ranges',stats.finalIbAvailableDays],
          ['Recorded outcomes',stats.classifiedDayTypeDays],['Recorded first breaks',stats.recordedFirstBreakDays],['Recorded closes',stats.availableCloseDays]] as const)
          .map(([label,count])=><div key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
      </dl>
      {!!stats.incompleteDays&&<p className="history-helper">{stats.incompleteDays} unfinished {stats.incompleteDays===1?'day':'days'}. Missing observations remain unknown.</p>}
      <details className="stat-disclosure level-stat-section" aria-label="IB width distribution"><summary>IB width</summary>
        <p>Width is the high minus the low. Typical width is the median of {stats.ibWidth.n} recorded {stats.ibWidth.n===1?'range':'ranges'}.</p>
        <dl className="level-stat-coverage">{([['Smallest',stats.ibWidth.minimum],['Lower quarter (25%)',stats.ibWidth.p25],['Typical (median)',stats.ibWidth.median],
          ['Average',stats.ibWidth.mean],['Upper quarter (75%)',stats.ibWidth.p75],['Largest',stats.ibWidth.maximum]] as const)
          .map(([label,value])=><div key={label}><dt>{label}</dt><dd>{number(value)}{value!==null?' pt':''}</dd></div>)}</dl>
        <p>The lower and upper quarter values mark where 25% and 75% of recorded widths fall.</p>
        <button className="secondary-action" type="button" disabled={!stats.ibWidth.n}
          onClick={()=>onInspect('Days with a recorded IB width',ids(stats.days,day=>day.finalIbWidth!==null).select)}>View these days</button>
      </details>
      {historicalBreakCodes&&<details className="stat-disclosure level-stat-section" aria-label="Final break code rates"><summary>Final IB codes</summary>
        <p>The code combines which edges broke with where the day closed. The + means a close outside the IB; − means a close inside or on it.</p>
        {(Object.keys(codes) as Array<keyof typeof codes>).map(code=>{
          const rate=historicalBreakCodes.families[code];return <button key={code} className="level-stat-metric ib-stat-metric" type="button"
            disabled={!rate.count} onClick={()=>onInspectCode?.(code)}><span>{codes[code]}<small className="ib-stat-code"> {code}</small></span>{' '}
            <strong>{rate.denominator?`${rate.ratePct!.toFixed(1)}%`:'Not recorded'}{!!rate.denominator&&<small> {rate.count} of {rate.denominator} days</small>}</strong></button>;
        })}
        {!!historicalBreakCodes.unavailableDays&&<p>{historicalBreakCodes.unavailableDays} codes not recorded.</p>}
      </details>}
      <details className="stat-disclosure level-stat-section" aria-label="Annual comparison"><summary>Yearly totals</summary>
        <p>Each year uses its own recorded days. Typical width is its median.</p>
        <div className="ib-stat-years">{annualStatistics.map(({year,statistics:annual})=><button type="button" key={year}
          onClick={()=>onInspect(`${year} recorded days`,stats=>stats.days.filter(day=>day.rthDate.startsWith(year+'-')).map(day=>day.sessionId))}>
          <strong>{year}</strong><span>{annual.journaledDays} days · Typical IB {number(annual.ibWidth.median)}{annual.ibWidth.median!==null?' pt':''}</span>
          <small>{annual.returnInside.knownDenominator?`Edge retested: ${annual.returnInside.yes} of ${annual.returnInside.knownDenominator} days`:'No edge-return result recorded'}</small>
          <small>{annual.closeDispositionRates.INSIDE_OR_ON_IB.denominator?`Closed inside: ${annual.closeDispositionRates.INSIDE_OR_ON_IB.count} of ${annual.availableCloseDays} days`:'No close recorded'}</small>
        </button>)}</div>
      </details>
    </div>}
    <button className="secondary-action" type="button" onClick={()=>onInspect('Recorded days',stats=>stats.days.map(day=>day.sessionId))}>View recorded days</button>
    {view==='details'&&onBrowseAll&&<button className="secondary-action" type="button" onClick={onBrowseAll}>Find across all imported years</button>}
  </div>;
}

export function IbStatisticDays({title,days,sourceLabel,historicalSessions,onBack,onOpenSession,active=true}:{
  title:string;days:WeeklyDaySummary[];sourceLabel:string;historicalSessions?:HistoricalIbSession[];
  onBack:()=>void;onOpenSession?:(date:string)=>void;
  active?:boolean;
}) {
  const scroll=useReviewScroll(`ib-days:${sourceLabel}:${title}`,active);
  const [query,setQuery]=useState(''),[page,setPage]=useState(0);
  const imported=useMemo(()=>new Map(historicalSessions?.map(day=>[day.id,day])??[]),[historicalSessions]);
  const search=query.trim().toLowerCase(),terms=search.split(/\s+/).filter(Boolean);
  const matches=useMemo(()=>days.filter(day=>{
    const entry=imported.get(day.sessionId);
    const code=entry?historicalIbBreakCode(entry):null;
    return !search||!!entry&&historicalSessionSearchMatches(entry,search)||
      terms.every(term=>`${day.rthDate} ${date(day.rthDate)} ${day.dayType??''} ${day.dayType?outcomes[day.dayType]:''} ${code??''} ${day.firstBreakSide??''} ${day.closeDisposition??''} ${day.closeDisposition?closes[day.closeDisposition]:''} ${day.completed?'complete':'unfinished'}`.toLowerCase().includes(term));
  }).sort((a,b)=>b.rthDate.localeCompare(a.rthDate)),[days,imported,search]);
  const pages=Math.max(1,Math.ceil(matches.length/8)),currentPage=Math.min(page,pages-1);
  return <section ref={scroll} className="history-card level-statistics ib-statistic-days" aria-label={historicalSessions?'Research details page':'IB statistic details'}>
    <button type="button" className="research-overview-back" onClick={onBack}>← Back to IB stats</button>
    <h2>{title}</h2><p className="history-helper">{sourceLabel} · {matches.length} matching {matches.length===1?'day':'days'}</p>
    <label className="level-stat-search">Find a date or outcome<input type="search" placeholder="Date, code or outcome" value={query}
      onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
    <ol className="level-stat-facts" aria-label="Days behind this statistic">{matches.slice(currentPage*8,currentPage*8+8).map(day=>{
      const entry=imported.get(day.sessionId);
      return <li key={day.sessionId} data-review-item={day.sessionId}><div className="level-stat-fact-heading">
        {onOpenSession?<button type="button" onClick={()=>onOpenSession(day.rthDate)}>{date(day.rthDate)} ›</button>:<strong>{date(day.rthDate)}</strong>}
        <span>{day.completed?'Complete':entry?'Incomplete record':'Unfinished'}</span></div>
        <p className="ib-stat-outcome">{day.dayType?outcomes[day.dayType]:'Outcome not recorded'}{day.dayType&&<span className="ib-stat-code">{entry?historicalIbBreakCode(entry)??day.dayType:day.dayType}</span>}</p>
        <dl className="level-stat-coverage"><div><dt>IB width</dt><dd>{number(day.finalIbWidth)}{day.finalIbWidth!==null?' pt':''}</dd></div>
          <div><dt>First break</dt><dd>{day.firstBreakSide==='IBH'?'High first':day.firstBreakSide==='IBL'?'Low first':'Not recorded'}</dd></div>
          <div><dt>Recorded close</dt><dd>{day.closeDisposition?closes[day.closeDisposition]:'Not recorded'}</dd></div>
          <div><dt>Midpoint after break</dt><dd>{({YES:'Reached',NO:'Not reached',UNKNOWN:'Not recorded',NOT_APPLICABLE:'No first break recorded'})[day.returnDepthStatus.MIDPOINT]}</dd></div>
        </dl><details className="ib-stat-day-returns"><summary>Return details</summary><dl className="level-stat-coverage">
          {depths.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{({YES:'Reached',NO:'Not reached',UNKNOWN:'Not recorded',NOT_APPLICABLE:'No first break recorded'})[day.returnDepthStatus[key]]}</dd></div>)}
        </dl></details>{entry&&<small className="history-helper">{entry.contract??'Contract not recorded'} · {entry.status}</small>}
      </li>;
    })}</ol>
    {!matches.length&&<p className="empty-state">No matching days.</p>}
    {pages>1&&<div className="levels-pagination"><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button>
      <span>{currentPage+1} / {pages}</span><button type="button" disabled={currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>More</button></div>}
    <p className="history-helper">{onOpenSession?'Tap a date to open your journal day.':'Imported records are read-only and stay separate from your journal.'}</p>
  </section>;
}
