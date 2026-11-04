// SPDX-License-Identifier: MPL-2.0
import type {ReactNode} from 'react';
import {deriveRecordedIbReturns,firstRecordedIbBreak,type BestFitOutlook,type ForecastUpdate,type JournalSession,
  type RangeComparison,type deriveSessionIbRead} from '@ib-field-notes/domain';
import {DeferredDetails} from './DeferredDetails';
import {IbReturnRead} from './IbReturnRead';
import {OvernightStudyPanel} from './OvernightStudy';
import {PostIbRecap} from './PostIbRecap';
import {workspaceClock} from './workspaceModel';
import {PUBLIC_BLANK} from './supportReportModel';
import {ibForecastStory,rangeStory,recordedOnRange} from './forecastStory';

/** Presentation only: all probabilities and recorded events come from the existing reader. */
function ForecastRow({label,value,detail,name}:{label:string;value:string;detail?:ReactNode;name?:string}){
  return <div className="phase-forecast-row" data-numeric={/%$| pt$/.test(value)} role="group" aria-label={name??label}>
    <div><h3>{label}</h3>{detail&&<p>{detail}</p>}</div><strong>{value}</strong>
  </div>;
}

export function PhaseForecast({session,now,current,outlook,ready,historyAvailable,updates,gaps,partial,inputStatus,details,comparisons=[]}: {
  session:JournalSession;now:string;current:ReturnType<typeof deriveSessionIbRead>;outlook:BestFitOutlook|null;
  ready:boolean;historyAvailable:boolean;updates:ForecastUpdate[];gaps:string[];partial:boolean;inputStatus:ReactNode;details:ReactNode;comparisons?:RangeComparison[];
}){
  const clock=workspaceClock(session,now),postIb=clock.phase==='RTH',overnight=clock.phase==='ON'||clock.upcoming;
  const read=current?.phase==='LOCKED'?current.read.ib:null,first=firstRecordedIbBreak(read);
  const both=!!read?.aboveCount&&!!read?.belowCount;
  const recordedReturns=deriveRecordedIbReturns(current,session.market.tickSize);
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const remaining=outlook?.remainingEdge;
  const story=ibForecastStory({session,now,current,outlook,updates,ready});
  const context=rangeStory(session,current,recordedOnRange(session,now),comparisons);
  const displayReady=ready||!historyAvailable;
  const pending=PUBLIC_BLANK&&!historyAvailable?'No historical data is included. Historical forecast probabilities need compatible learning history.':!current?.width?'Record an opening range for an estimate.':!historyAvailable?'Earlier compatible IB history is needed for odds.':!ready?'Comparing earlier sessions…':'No compatible estimate is available.';
  return <section className="forecast-card phase-forecast" aria-label="IB Forecast" aria-busy={!clock.closed&&!overnight&&!displayReady&&!!current?.width}>
    {clock.unavailable?<p>No study session is scheduled for this date.</p>:clock.closed?<>
      {session.close.finishedAt?<PostIbRecap session={session} updates={updates}/>:<p>Session ended. Saved estimates are available below.</p>}
    </>:overnight?<OvernightStudyPanel session={session} compact/>:<>
      <div aria-label={outlook?'Current best-fit estimate':undefined} className="phase-forecast-results">
        {story.rows.map(row=><ForecastRow key={row.label} name={row.label.startsWith('Chance IB')?'Other edge outlook':undefined} {...row}/>)}
        {!story.rows.length&&<div className="forecast-pending"><strong>{PUBLIC_BLANK&&!historyAvailable?'Forecast unavailable':'Forecast getting ready'}</strong><p>{pending}</p></div>}
        {story.outcomes.length>0&&<div className="phase-forecast-outcomes" role="group" aria-label="IB edge outcomes by RTH close">
          {story.outcomes.map(row=><div key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}
        </div>}
      </div>
      <p className="phase-forecast-stamp">{story.caption}{!postIb&&` · IB locks ${time(clock.windows.B.end)}`}</p>
      {(partial||gaps.length>0)&&<p className="phase-forecast-partial" aria-label="Forecast input status">
        <strong>Partial forecast</strong>{gaps.length>0&&` · Missing ${gaps.join(' · ')}`}</p>}
    </>}
    {context.rows.length>0&&<div className="phase-forecast-context" role="group" aria-label="Recorded range context">
      <h3>Today in context</h3>{context.rows.map(row=><p key={row.label}><span>{row.label}</span><strong>{row.value}</strong>{row.label.includes('IBs at least')&&<small>Historical frequency · completed sessions</small>}</p>)}
    </div>}
    {first&&<p className="phase-forecast-recorded" role="group" aria-label="Recorded IB breaks">
      <strong>{both?'Both IB edges have breaks recorded':`${first.side} break recorded`}</strong> · {both?'First break ':''}{time(first.at)}
    </p>}
    {clock.closed&&recordedReturns.count>0&&<p className="phase-forecast-recorded" role="group" aria-label="Recorded IB returns"><strong>Returned inside IB · {recordedReturns.count} {recordedReturns.count===1?'time':'times'}</strong> since the first recorded edge break.</p>}
    <DeferredDetails key={`${session.id}:${clock.closed?'closed':clock.phase??'ON'}`} className="workspace-forecast-disclosure phase-forecast-details" summary="Forecast details">
      {inputStatus}
      <p>Experimental · Not financial advice. Check session prices for accuracy; gaps between entries remain unknown.</p>
      {[...story.details,...context.rows.filter(row=>row.detail),...context.details].map((row,i)=><p key={`${row.label}:${i}`}><strong>{row.label}: {row.value}</strong>{row.detail&&` · ${row.detail}`}</p>)}
      <p>Neither means neither IB edge breaks by RTH close; touching an edge is different. Historical frequencies count completed comparable records. Model estimates weight several factors and can differ from those frequencies.</p>
      {first&&!both&&<p>{remaining?.probability!=null?
        `The other-edge estimate uses earlier minute price paths with that edge still unbroken at the comparable time. ${remaining.matchingDays} matched sessions contribute; support is ${remaining.support}. It looks ahead through close, not at an already recorded break.`:
        'The other-edge estimate needs compatible earlier minute price history. Unavailable does not mean a zero chance.'}</p>}
      {postIb&&<IbReturnRead session={session} current={current} forecast={outlook?.ibReturn} now={now} ready={ready}/>}
      {details}
    </DeferredDetails>
  </section>;
}
