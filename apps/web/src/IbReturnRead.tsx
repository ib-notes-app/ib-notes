// SPDX-License-Identifier: MPL-2.0
import {deriveRecordedIbReturns,formatPriceNumber,type IbReturnForecast,type JournalSession,type deriveSessionIbRead} from '@ib-field-notes/domain';
import {journalClock} from './journalClock';

const percent=(value:number)=>value>0&&value<.01?'<1%':`${Math.round(value*100)}%`;
export function IbReturnRead({session,current,forecast,now,ready=true,compact=false}:{session:JournalSession;
  current:ReturnType<typeof deriveSessionIbRead>;forecast:IbReturnForecast|undefined;now:string;ready?:boolean;compact?:boolean}){
  const clock=journalClock(session.market),end=clock.checkpointInstant(session.rthDate,session.market.checkpoints.studyClose).toString();
  const latest=current?.read.latest;
  if(!current||current.phase!=='LOCKED'||!latest||current.low===null||current.high===null||session.close.finishedAt||
    Date.parse(now)>=Date.parse(end)||Date.parse(latest.at)<=Date.parse(clock.checkpointInstant(session.rthDate,session.market.checkpoints.ibLock).toString()))return null;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const inside=latest.price>current.low&&latest.price<current.high,edge=latest.price===current.low||latest.price===current.high;
  const recorded=deriveRecordedIbReturns(current,session.market.tickSize);
  const count=recorded.count?`${recorded.count} ${recorded.count===1?'return':'returns'} recorded`:recorded.firstBreak?'No return recorded yet':null;
  const value=inside&&recorded.count?`Recorded · ${recorded.count} ${recorded.count===1?'return':'returns'}`:inside?'Inside the IB':edge?'At the edge':!ready?'Updating…':forecast?.probability!=null?percent(forecast.probability):'Unavailable';
  const heading=!inside&&!edge&&recorded.count?'Another return inside IB':'Return inside IB';
  if(compact)return <section className="phase-forecast-row" data-numeric={ready&&!inside&&!edge&&forecast?.probability!=null} aria-label="Return inside IB" aria-busy={!ready&&!inside&&!edge}>
    <div><h3>{heading}</h3><p>{inside||edge?`Recorded ${time(latest.at)}`:`Before ${time(end)} · CP ${time(latest.at)}`}</p>{count&&<p>{inside&&recorded.count?'Since the first recorded edge break':count}</p>}</div>
    <strong>{value}</strong>
  </section>;
  return <section className="ib-return-read" aria-label="Return inside IB" aria-busy={!ready&&!inside&&!edge}>
    <div className="ib-return-heading"><h3>{heading}</h3><strong>{value}</strong></div>
    {count&&<p className="forecast-caption">{count} since the first recorded edge break{recorded.lastReturn?` · latest ${time(recorded.lastReturn.returnedAt)}`:''}</p>}
    {inside||edge?<p className="forecast-caption">Recorded price · {time(latest.at)}</p>:<>
      <p className="forecast-caption">Before {time(end)} · {Math.max(0,Math.ceil((Date.parse(end)-Date.parse(now))/60000))} min left</p>
      <p className="forecast-caption">From {formatPriceNumber(latest.price)} at {time(latest.at)} · {formatPriceNumber(
        latest.price<current.low?current.low-latest.price:latest.price-current.high)} pt outside {latest.price<current.low?'IBL':'IBH'}</p>
      <details className="ib-return-evidence"><summary>History &amp; meaning</summary>
        <p>Experimental estimate of price reaching at least one tick inside the locked Initial Balance after this estimate, before the session closes. Touching its edge alone does not count.</p>
        {forecast?.probability!=null?<><p>Historical matches: {forecast.support}. {forecast.matchingDays} matched sessions out of {forecast.eligibleDays} reviewed.</p>
          <p>Closer matches count more. After weighting, these matches contribute the equivalent of {forecast.effectiveDays.toFixed(1)} sessions.</p>
          <p>Uses earlier sessions with price on the same outside side, at your entry times. Time left, distance, IB width and available session context affect the comparison. Older prices give a broader read.</p></>:<p>{ready?'This estimate needs compatible earlier minute price history. Your price is saved.':'Reading earlier price history…'}</p>}
        <p>A previous return does not settle a new estimate after price moves outside again. Sparse entries can miss a return; missing entries do not mean it failed.</p>
      </details>
    </>}
    <small className="forecast-disclaimer">Experimental · Not financial advice</small>
  </section>;
}
