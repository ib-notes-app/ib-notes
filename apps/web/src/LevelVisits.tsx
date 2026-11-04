// SPDX-License-Identifier: MPL-2.0
import {useContext,useMemo,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {deriveLevelVisitHistory,formatPriceNumber,type JournalSession,type SignificantLevel,type LevelVisit} from '@ib-field-notes/domain';
import {LevelTrackingContext} from './LevelPriceTracking';
import {journalClock} from './journalClock';
import {LevelQualityContext,levelQualificationCatalog} from './LevelQuality';
import {levelTimeframeLabels} from './LevelChoices';

export function visitDescription(visit:LevelVisit) {
  const approach=visit.approach==='above'?'Test from above':visit.approach==='below'?'Test from below':'Contact · approach unknown';
  const result=visit.departure===null?'no departure recorded':visit.departure===visit.approach?
    `returned ${visit.departure}`:visit.departure==='above'?'left above':'left below';
  return `${approach} · ${result}`;
}

export function visitResponseDescription(visit:LevelVisit,type?:SignificantLevel['levelType']) {
  const response=visit.response;if(!response)return 'Move away not recorded';
  if(visit.approach==='unknown')return `Last entry ${response.latestSide} the level`;
  if(response.latestSide===visit.approach) {
    const crossed=visit.approach==='above'?response.firstBelowAt:response.firstAboveAt;
    return crossed?visit.approach==='above'?'Reclaimed above':'Returned below after crossing above':`Held ${visit.approach} in recorded prices`;
  }
  return response.latestSide==='below'?'Lost below':type==='low'&&response.reclaimedAt?'Reclaimed above':'Crossed above';
}
export function visitMoveDescription(visit:LevelVisit) {
  const response=visit.response;if(!response)return null;
  return `Max above ${response.maxAboveAt?`${formatPriceNumber(response.maxAbove)} pt`:'not recorded'} · max below ${response.maxBelowAt?`${formatPriceNumber(response.maxBelow)} pt`:'not recorded'}`;
}

export function LevelVisits({level,session,levels=[]}:{level:SignificantLevel;session:JournalSession;levels?:SignificantLevel[]}) {
  const sessions=useContext(LevelTrackingContext);
  const qualitySources=useContext(LevelQualityContext);
  const [requested,setRequested]=useState(false),[page,setPage]=useState(0);
  const history=useMemo(()=>{
    if(!requested||!sessions)return null;
    const days=sessions.filter(day=>day.rthDate<=session.rthDate&&day.journalId===session.journalId&&day.instrument===session.instrument);
    const windows=new Map(days.map(day=>{
      const clock=journalClock(day.market),close=clock.checkpointInstant(day.rthDate,day.market.checkpoints.studyClose).toString();
      const observedEnd=day.id===session.id?session.close.observedAt??session.updatedAt:close;
      return [day.id,{start:clock.overnightStart(day.rthDate).toString(),ibLockAt:clock.checkpointInstant(day.rthDate,day.market.checkpoints.ibLock).toString(),
        close:Date.parse(observedEnd)<Date.parse(close)?observedEnd:close}];
    }));
    return deriveLevelVisitHistory({sessions:days,level,levels:[...levels,...levelQualificationCatalog(qualitySources,session)],
      context:session,asOf:Temporal.Now.instant().toString(),windows});
  },[requested,sessions,level,session,levels,qualitySources]);
  if(level.sessionEdge?.status==='forming')return null;
  const visits=history?.visits??[],cycles=history?.cycles??[];
  const rows=[...visits.map(visit=>({id:visit.id,at:visit.at,date:visit.rthDate,description:visitDescription(visit),
    detail:`${visit.entries} ${visit.entries===1?'entry':'entries'} · ${formatPriceNumber(visit.price)}${visit.lastContactPrice!==visit.price?` → ${formatPriceNumber(visit.lastContactPrice)}`:''}`,
    exit:visit.departureAt,exitPrice:visit.departurePrice,visit})),
    ...cycles.map(cycle=>({id:cycle.id,at:cycle.reclaimAt,date:cycle.rthDate,description:'Below low → reclaimed',
      detail:`Recorded low ${formatPriceNumber(cycle.lowestPrice)} · reclaim ${formatPriceNumber(cycle.reclaimPrice)}${cycle.priorAboveAt===null?' · earlier above price not recorded':''}`,
      exit:null,exitPrice:null,visit:null}))].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  const pages=Math.max(1,Math.ceil(rows.length/8)),current=Math.min(page,pages-1);
  const stamp=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const structural=level.levelType==='low'||level.levelType==='high';
  return <details className="level-visits-history" onToggle={event=>{if(event.currentTarget.open)setRequested(true);}}>
    <summary>Recorded visits{history?` · ${visits.length}`:''}</summary>
    {!history?<p>{sessions?'Reading saved prices…':'Price history is not available yet.'}</p>:<>
      <p className="levels-help">Consecutive contacts count once. Another visit needs a saved departure and return. Moves between entries may be missing.</p>
      <dl className="level-visit-counts">
        <div><dt>This day</dt><dd>{visits.filter(v=>v.sessionId===session.id).length} visits</dd></div>
        <div><dt>{structural?'Support tests':'Tests from above'}</dt><dd>{visits.filter(v=>v.approach==='above').length}</dd></div>
        <div><dt>Returned above</dt><dd>{visits.filter(v=>v.approach==='above'&&v.departure==='above').length}</dd></div>
        <div><dt>{structural?'Resistance tests':'Tests from below'}</dt><dd>{visits.filter(v=>v.approach==='below').length}</dd></div>
        <div><dt>Returned below</dt><dd>{visits.filter(v=>v.approach==='below'&&v.departure==='below').length}</dd></div>
        {level.levelType==='low'&&<div><dt>Reclaim cycles</dt><dd>{cycles.length}</dd></div>}
      </dl>
      <small>History through {new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${session.rthDate}T12:00:00Z`))}.
        Reclaim cycles mean recorded below then above a low in one session. LBAF confirmation stays separate.</small>
      <h3>Visit and reclaim history</h3>
      <p className="levels-help">Moves use the original level or zone edge, through the next recorded visit or last saved price.</p>
      <ol className="level-visit-list" aria-label="Recorded price visits">
        {rows.slice(current*8,current*8+8).map(row=><li key={row.id}><strong>{row.description}</strong><time dateTime={row.at}>{stamp(row.at)}</time>
          <span>{row.detail}</span>{row.exit&&<small>Departure {stamp(row.exit)} · {formatPriceNumber(row.exitPrice!)}</small>}
          {row.visit&&<>
            <small>{visitResponseDescription(row.visit,level.levelType)}</small>
            {row.visit.response&&<><span>{visitMoveDescription(row.visit)}</span>
              <small>{row.visit.response.end==='return'?'Next visit':row.visit.response.end==='archived'?'Archived':'Last saved price'} · {stamp(row.visit.response.endAt)}</small>
              {!!row.visit.response.newerLows.length&&<small>Later qualified low{row.visit.response.newerLows.length>1?'s':''} · {row.visit.response.newerLows.map(low=>
                `${formatPriceNumber(low.price)} (${levelTimeframeLabels[low.timeframe]}; qualified ${stamp(low.knownAt)})`).join(', ')}</small>}
            </>}
          </>}
        </li>)}
      </ol>
      {!rows.length&&<p>No contact or completed reclaim cycle recorded.</p>}
      {pages>1&&<div className="levels-pagination"><button type="button" disabled={!current} onClick={()=>setPage(current-1)}>Previous</button>
        <span>{current+1} / {pages}</span><button type="button" disabled={current===pages-1} onClick={()=>setPage(current+1)}>More</button></div>}
    </>}
  </details>;
}
