// SPDX-License-Identifier: MPL-2.0
import {useMemo} from 'react';
import {derivePostIbRecap,formatPriceNumber,type ForecastUpdate,type JournalSession} from '@ib-field-notes/domain';
import {DeferredDetails} from './DeferredDetails';
import {IbCodeBadge} from './IbCodeBadge';
import {postIbForecastSummary} from './postIbForecastSummary';

const percent=(value:number)=>value>0&&value<.01?'<1%':`${Math.round(value*100)}%`;
export function PostIbRecap({session,updates}:{session:JournalSession;updates:ForecastUpdate[]}){
  const recap=useMemo(()=>derivePostIbRecap(session,updates),[session,updates]);
  if(!recap)return null;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const position=recap.position==='ABOVE'?`${formatPriceNumber(recap.outsideDistance!)} pt above IBH`:
    recap.position==='BELOW'?`${formatPriceNumber(recap.outsideDistance!)} pt below IBL`:
    recap.position==='AT_HIGH'?'At IBH':recap.position==='AT_LOW'?'At IBL':recap.position==='INSIDE'?'Inside IB':recap.close===null?'Closing position unknown':'IB range not confirmed';
  return <section className="post-ib-recap" aria-label="Post-IB recap">
    <div className="post-ib-recap-heading"><h3>Post-IB recap</h3>
      {recap.code?<span>{!recap.complete&&<small>Provisional</small>}<IbCodeBadge code={recap.code} closed={recap.complete}/></span>:
        <small>IB code unconfirmed</small>}</div>
    <p className="forecast-caption">Close <strong>{recap.close===null?'Not recorded':formatPriceNumber(recap.close)}</strong> · {position}</p>
    {!!recap.timelines.length&&<DeferredDetails key={`${session.id}:forecasts`} className="post-ib-recap-details" summary="Forecast vs result">
      {recap.timelines.map(row=>{
        const words=postIbForecastSummary(row);
        return <div className="post-ib-forecast-summary" key={row.target}>
          <h4>{words.title} · before close</h4><p>{words.outlook}.</p>
          <dl className="post-ib-forecast-points">{row.points.map(({update,probability})=><div key={update.id}>
            <dt><time dateTime={update.issuedAt}>{time(update.issuedAt)}</time></dt><dd>{percent(probability)}</dd>
          </div>)}</dl>
          <p><strong>Recorded result:</strong> {words.result}.</p>
          {words.detail&&<p className="forecast-caption">{words.detail}</p>}
        </div>;
      })}
      <p className="forecast-caption">Saved estimates shown across the day; each looks ahead from its own time. Gaps may hide movement between entries.</p>
    </DeferredDetails>}
    <DeferredDetails key={session.id} className="post-ib-recap-details" summary="Return-to-IB estimates">
      {session.studyReplay&&<p className="forecast-caption">Historical replay · reconstructed from recorded entries.</p>}
      {!recap.estimates.length?<p>No return estimate was saved for this day.</p>:<>
        {recap.estimates.map(({update,returnAt,reason,result},i)=><article className="post-ib-recap-estimate" key={update.id}>
          <div><strong>{recap.estimates.length===1?'Saved estimate':i===0?'First estimate':'Latest estimate'}</strong><time dateTime={update.issuedAt}>{time(update.issuedAt)}</time></div>
          <p><b>{percent(update.ibReturn!.probability!)}</b> chance to return inside IB</p>
          <p className="forecast-caption">From {update.ibReturn!.from==='ABOVE'?'above IBH':'below IBL'}{update.price!==null?` · ${formatPriceNumber(update.price)}`:''}</p>
          {returnAt?<p className="post-ib-recap-return">Return recorded · <time dateTime={returnAt}>{time(returnAt)}</time></p>:
            <p>{result==='NO_RETURN_RECORDED'?'No return recorded':'Comparison unavailable'}<small>{reason==='IB corrected'?'The locked IB was corrected after this estimate.':
              reason==='Price at estimate was corrected'?'The price at this estimate was corrected or is no longer recorded.':
              reason==='Conflicting prices at the estimate time'?reason:'No later inside price was recorded. Gaps between entries may hide a return.'}</small></p>}
        </article>)}
        <p className="forecast-caption">{recap.savedCount>2?`First and latest of ${recap.savedCount} saved estimates. `:''}Each estimate looks ahead from its saved time. Earlier returns do not count toward later estimates.</p>
      </>}
    </DeferredDetails>
  </section>;
}
