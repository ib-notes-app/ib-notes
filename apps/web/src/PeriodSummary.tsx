// SPDX-License-Identifier: MPL-2.0
import {useMemo,type ReactNode} from 'react';
import {roundPriceToTick,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {periodSummaryRead} from './periodSummaryRead';
import {levelQuality,qualityNames,type QualitySources} from './levelQuality';
import {workspaceFormatPrice,workspaceWindows,type WorkspacePhase} from './workspaceModel';

export function PeriodSummary({session,phase,now,sessions,levels,sources,children}:{session:JournalSession;phase:WorkspacePhase;now:string;
  sessions:JournalSession[];levels:SignificantLevel[];sources:QualitySources;children:ReactNode}){
  const periodEnded=Date.parse(now)>=Date.parse(workspaceWindows(session)[phase].end);
  // The sheet clock ticks each second. Recalculate on new facts or a boundary,
  // rather than regrading every saved level on an unchanged completed period.
  const read=useMemo(()=>periodSummaryRead(session,phase,now,sessions,levels),[session,phase,periodEnded,sessions,levels]);
  const {range,width,midpoint,comparison,ended}=read,fmt=(n:number|null)=>n===null?'—':workspaceFormatPrice(n,session.market.tickSize);
  const matches=useMemo(()=>read.matches.map(match=>({...match,...levelQuality(match.level,sessions,session,sources,levels)}))
    .sort((a,b)=>Number(b.observed)-Number(a.observed)||(['legendary','rare','common'].indexOf(a.tier)-['legendary','rare','common'].indexOf(b.tier))||a.low-b.low||a.level.id.localeCompare(b.level.id)),[read.matches,sessions,session,sources,levels]);
  const wider=comparison&&comparison.narrower>=comparison.wider;
  const count=comparison?(wider?comparison.narrower:comparison.wider):0;
  const row=(match:typeof matches[number])=><li key={match.level.id} data-quality={match.quality}>
    <div><strong>{match.level.label??(match.level.sourceTimeframe==='daily'?`Daily ${match.level.levelType}`:`${match.level.sourceTimeframe} ${match.level.levelType}`)}</strong><span>{match.evidence}</span></div>
    <div><b>{fmt(match.low)}{match.high!==match.low?`–${fmt(match.high)}`:''}</b><span>{qualityNames[match.quality]}{match.level.createdInRthDate!==session.rthDate?` · ${match.level.createdInRthDate}`:''}</span></div>
  </li>;
  return <>
    <section className="period-summary" aria-label={`${phase} statistics`}>
      <h3>{phase==='ON'?'Overnight':phase==='B'?'B / Initial Balance':phase} {ended?'results':'so far'}</h3>
      <dl className="period-summary-grid">
        <div data-tone="low"><dt>{phase} low</dt><dd>{fmt(range.low)}</dd></div>
        <div data-tone="high"><dt>{phase} high</dt><dd>{fmt(range.high)}</dd></div>
        <div data-tone="width"><dt>Range distance</dt><dd>{fmt(width)}{width!==null&&<small> pt</small>}</dd></div>
        <div data-tone="mid"><dt>Midpoint</dt><dd>{fmt(midpoint===null?null:roundPriceToTick(midpoint,session.market.tickSize))}</dd></div>
      </dl>
      {comparison?<div className="period-journal-comparison" aria-label="Journal range comparison">
        <strong>{count===comparison.days?`${wider?'Wider':'Narrower'} than all ${comparison.days}`:count?`${wider?'Wider':'Narrower'} than ${count} of ${comparison.days}`:`Same width as all ${comparison.days}`}</strong>
        <span>earlier completed {phase} {comparison.days===1?'range':'ranges'} in your journal</span>
        <div className="period-comparison-bar" aria-hidden="true"><i style={{width:`${100*count/comparison.days}%`}}/></div>
        <small>Typical width {fmt(roundPriceToTick(comparison.median,session.market.tickSize))} pt{comparison.ties>0?` · ${comparison.ties} same width`:''}</small>
      </div>:<p className="period-summary-empty">{width===null?'Add the missing range edge to see width and midpoint.':!ended?'Journal comparison appears when this period ends.':'No earlier completed ranges with matching study hours in this journal yet.'}</p>}
      <div className="period-level-heading"><h4>Levels in this range</h4><span>{matches.length}</span></div>
      {matches.length?<><ul className="period-level-matches">{matches.slice(0,4).map(row)}</ul>{matches.length>4&&<details><summary>{matches.length-4} more levels</summary><ul className="period-level-matches">{matches.slice(4).map(row)}</ul></details>}</>:
        <p className="period-summary-empty">{width===null?'Enter both edges to check saved levels.':'No saved levels overlap this range.'}</p>}
    </section>
    {children}
  </>;
}
