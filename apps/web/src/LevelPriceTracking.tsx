// SPDX-License-Identifier: MPL-2.0
import { createContext, useContext } from 'react';
import { EventWindowTags } from './EventWindowTags';
import { deriveLowRecoveryTracking as deriveLowTracking,formatPriceNumber, lowTrackingLabels, type JournalSession, type SignificantLevel } from '@ib-field-notes/domain';
import { levelCardState } from './levelRoles';
import {levelMapRole} from './mapLevelReferences';
export const LevelTrackingContext = createContext<JournalSession[] | null>(null);
export function LevelPriceTracking({ level, session }: { level: SignificantLevel; session: JournalSession }) {
  const sessions = useContext(LevelTrackingContext);
  if (level.levelType !== 'low') return null;
  if (level.sessionEdge?.status === 'forming') return <p className="levels-help">This edge moves as you record the range. Price tracking starts when the range locks.</p>;
  if (!sessions) return <p>Price history is not available yet.</p>;
  const result = deriveLowTracking(level, sessions, session);
  const role = levelCardState(level, result,session,levelMapRole(level,sessions,session));
  const history=[...result.history.map(event=>({...event,label:lowTrackingLabels[event.state]})),
    ...(result.read?.events.filter(event=>event.kind==='confirmed').map(event=>({...event,label:'LBAF reclaimed'}))??[])]
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  return <section className="level-price-tracking" aria-label="Low tracking">
    <strong>{role.label}</strong>
    {role.activity&&<p className="level-recovery-activity">{role.activity}</p>}
    {role.history.map(item=><p key={item.pattern} className="level-pattern-history" title={item.detail}>{item.label}</p>)}
    <details><summary>Tracking details</summary>
      <p>{role.detail}</p>
      {result.read&&<>
        <p>LBAF: Look Below and Fail. The low must first produce a documented or recorded 20+ point upward move before the flush.</p>
        {result.read.qualifiedAt&&<p>20+ move {result.read.qualificationSource==='documented'?'documented':'recorded'} · {new Date(result.read.qualifiedAt).toLocaleString('en-US',{timeZone:session.displayTimeZone})}.</p>}
        {!result.read.flushQualified&&result.read.stage!=='watching'&&<p>No qualifying 20+ upward move was established before this flush. Ordinary crossings stay tracked without an automatic LBAF tag.</p>}
        <p>Reclaimed requires recorded prices at or above {formatPriceNumber(result.read.threshold)}
          {' '}({level.shape==='price_zone'?'zone high':'low'} +5 pt), more than 3 minutes apart, with no recorded dip below that threshold between them.</p>
        {result.read.holdingFrom&&result.read.confirmedAt===null&&<p>+5 check started {new Date(result.read.holdingFrom).toLocaleString('en-US',{timeZone:session.displayTimeZone})}. Another price entry is needed to complete the check.</p>}
        <p>A later entry can complete the check. Continuous holding between entries is unknown.</p>
      </>}
      {level.studyReplay?.breakoutBacktest && <p>Resistance held for {level.studyReplay.breakoutBacktest.resistanceHours} hours,
        then price broke above it, returned and made a later 15+ point rise.
        Pack prices end {new Date(level.studyReplay.sourceCutoffAt!).toLocaleDateString('en-US', {timeZone:session.displayTimeZone})}.
        Your price entries continue its tracking.</p>}
      <small>From saved prices. Moves between entries may be missing.</small>
      {!result.contractGap && history.length > 0 && <>
        <p>Tags match the saved price time. Moves between entries may have happened outside that window.</p>
        <ol>{history.map((event, i) => <li key={i}>{event.label} · {event.price}<br /><small>{new Date(event.at).toLocaleString('en-US', { timeZone: session.displayTimeZone })}</small>
          <EventWindowTags items={sessions.filter(day => day.instrument === session.instrument && day.journalId === session.journalId).flatMap(day => day.marketContextItems)} at={event.at} />
        </li>)}</ol>
      </>}
    </details>
  </section>;
}
