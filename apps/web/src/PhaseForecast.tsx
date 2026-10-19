// SPDX-License-Identifier: MPL-2.0
import type {ReactNode} from 'react';
import {firstRecordedIbBreak,formatPriceNumber,type BestFitOutlook,type ForecastUpdate,type JournalSession,
  type deriveSessionIbRead} from '@ib-field-notes/domain';
import {DeferredDetails} from './DeferredDetails';
import {IbReturnRead} from './IbReturnRead';
import {OvernightStudyPanel} from './OvernightStudy';
import {PostIbRecap} from './PostIbRecap';
import {workspaceClock} from './workspaceModel';
import {PUBLIC_BLANK} from './supportReportModel';

const percent=(p:number)=>p>0&&p<.01?'<1%':`${Math.round(p*100)}%`;
const names:Record<string,string>={IBH:'High only · IBH',IBL:'Low only · IBL',IBB:'Both sides · IBB',IBN:'Neither · IBN'};

/** Presentation only: all probabilities and recorded events come from the existing reader. */
function ForecastRow({label,value,detail,name}:{label:string;value:string;detail?:ReactNode;name?:string}){
  return <div className="phase-forecast-row" data-numeric={/%$| pt$/.test(value)} role="group" aria-label={name??label}>
    <div><h3>{label}</h3>{detail&&<p>{detail}</p>}</div><strong>{value}</strong>
  </div>;
}

export function PhaseForecast({session,now,current,outlook,ready,historyAvailable,updates,gaps,partial,inputStatus,details}: {
  session:JournalSession;now:string;current:ReturnType<typeof deriveSessionIbRead>;outlook:BestFitOutlook|null;
  ready:boolean;historyAvailable:boolean;updates:ForecastUpdate[];gaps:string[];partial:boolean;inputStatus:ReactNode;details:ReactNode;
}){
  const clock=workspaceClock(session,now),postIb=clock.phase==='RTH',overnight=clock.phase==='ON'||clock.upcoming;
  const read=current?.phase==='LOCKED'?current.read.ib:null,first=firstRecordedIbBreak(read);
  const both=!!read?.aboveCount&&!!read?.belowCount;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const remaining=outlook?.remainingEdge,estimate=outlook?.estimate;
  const highest=estimate?Math.max(...Object.values(estimate.dayType)):null;
  const leaders=estimate?Object.entries(estimate.dayType).filter(([,p])=>p===highest).map(([type])=>names[type]):[];
  const firstHighest=estimate?Math.max(...Object.values(estimate.firstBreak)):null;
  const firstLeaders=estimate?Object.entries(estimate.firstBreak).filter(([,p])=>p===firstHighest)
    .map(([side])=>side==='IBH'?'High · IBH':side==='IBL'?'Low · IBL':'Neither'):[];
  const displayReady=ready||!historyAvailable;
  const pending=PUBLIC_BLANK&&!historyAvailable?'No historical data is included. Historical forecast probabilities need compatible learning history.':!current?.width?'Record an opening range for an estimate.':!historyAvailable?'Earlier compatible IB history is needed for odds.':!ready?'Comparing earlier sessions…':'No compatible estimate is available.';
  return <section className="forecast-card phase-forecast" aria-label="IB Forecast" aria-busy={!clock.closed&&!overnight&&!displayReady&&!!current?.width}>
    {clock.unavailable?<p>No study session is scheduled for this date.</p>:clock.closed?<>
      {session.close.finishedAt?<PostIbRecap session={session} updates={updates}/>:<p>Session ended. Saved estimates are available below.</p>}
    </>:overnight?<OvernightStudyPanel session={session} compact/>:<>
      <div aria-label={outlook?'Current best-fit estimate':undefined} className="phase-forecast-results">
        {postIb&&<IbReturnRead session={session} current={current} forecast={outlook?.ibReturn} now={now} ready={displayReady} compact/>}
        {postIb&&first&&!both?<ForecastRow name="Other edge outlook"
          label={`Chance ${first.side==='IBH'?'low':'high'} also breaks`}
          value={!displayReady?'Updating…':remaining?.probability!=null?percent(remaining.probability):'Unavailable'}
          detail="Before close · would record both IB edges (IBB)"/>:both?
          <ForecastRow label="Both IB edges" value="Recorded · IBB"/>:estimate?<>
          <ForecastRow label="Most likely IB outcome" value={percent(highest!)} detail={leaders.join(' / ')}/>
          <ForecastRow label="First edge to break" value={percent(firstHighest!)} detail={firstLeaders.join(' / ')}/>
        </>:<div className="forecast-pending"><strong>{PUBLIC_BLANK&&!historyAvailable?'Forecast unavailable':'Forecast getting ready'}</strong><p>{pending}</p></div>}
        {!postIb&&estimate&&<ForecastRow label="Estimated IB width" value={`${formatPriceNumber(estimate.width.median,1)} pt`}
          detail={`Band ${formatPriceNumber(estimate.width.low,1)}–${formatPriceNumber(estimate.width.high,1)} pt`}/>}
      </div>
      <p className="phase-forecast-stamp">{outlook?`Estimate ${time(outlook.asOf)} · `:''}
        {postIb?`Through ${time(clock.windows.RTH.end)}`:`IB forming · locks ${time(clock.windows.B.end)}`}</p>
      {(partial||gaps.length>0)&&<p className="phase-forecast-partial" aria-label="Forecast input status">
        <strong>Partial forecast</strong>{gaps.length>0&&` · Missing ${gaps.join(' · ')}`}</p>}
    </>}
    {first&&<p className="phase-forecast-recorded" role="group" aria-label="Recorded IB breaks">
      <strong>{both?'Both IB edges have breaks recorded':`${first.side} break recorded`}</strong> · {both?'First break ':''}{time(first.at)}
    </p>}
    <DeferredDetails key={`${session.id}:${clock.closed?'closed':clock.phase??'ON'}`} className="workspace-forecast-disclosure phase-forecast-details" summary="Forecast details">
      {inputStatus}
      <p>Experimental · Not financial advice. Check session prices for accuracy; gaps between entries remain unknown.</p>
      {first&&!both&&<p>{remaining?.probability!=null?
        `The other-edge estimate uses earlier minute price paths with that edge still unbroken at the comparable time. ${remaining.matchingDays} matched sessions contribute; support is ${remaining.support}. It looks ahead through close, not at an already recorded break.`:
        'The other-edge estimate needs compatible earlier minute price history. Unavailable does not mean a zero chance.'}</p>}
      {postIb&&<IbReturnRead session={session} current={current} forecast={outlook?.ibReturn} now={now} ready={ready}/>}
      {details}
    </DeferredDetails>
  </section>;
}
