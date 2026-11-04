// SPDX-License-Identifier: MPL-2.0
import { useEffect, useState, type ReactNode } from 'react';
import { contextEventsForSession, contextPacksForSession, contextPackEventState,
  type ContextBatch, type ContextMatch, type JournalSession } from '@ib-field-notes/domain';
import { holidaySummary } from '@ib-field-notes/domain';
import { contextDates, contextTime } from './ContextHistory';
import { studyGroupLabel } from './StudyPackLabels';

export function ContextWorkspace({ session, batches, active, onAdd, onUseEvents, schedule, savedEvents }: {
  session: JournalSession; batches: ContextBatch[]; active: boolean;
  onAdd: (kind: 'event' | 'holiday' | 'notes') => void;
  onUseEvents: (matches: ContextMatch[]) => Promise<void>; schedule: ReactNode; savedEvents: ReactNode;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);
  const packs = contextPacksForSession(batches, session), matches = contextEventsForSession(packs, session);
  const count = session.marketContextItems.length;
  if (!active) return null;
  return <section className="entry-card context-workspace context-v2" aria-label="Context">
    <div className="context-add">
      <h2>Add context</h2>
      <div className="context-add-actions">
        <button type="button" onClick={() => onAdd('event')}>News or event</button>
        <button type="button" onClick={() => onAdd('holiday')}>Holiday</button>
        <button type="button" onClick={() => onAdd('notes')}>Note</button>
      </div>
    </div>
    <section className="context-day-events" aria-label="News and events for this day">
      <div className="context-section-heading"><h3>News, events &amp; holidays</h3><span>{count} saved</span></div>
      {savedEvents}
      <DayPackEvents session={session} packs={packs} matches={matches} now={now} onUseEvents={onUseEvents} />
      {schedule}
    </section>
    {session.sessionNotes.length > 0 && <details className="context-day-notes"><summary>Notes · {session.sessionNotes.length}</summary>
      <ul>{session.sessionNotes.map(note => <li key={note.id}><small>{note.phase} · {contextTime(note.observedAt, session.displayTimeZone)}</small><p>{note.text}</p></li>)}</ul>
      <button type="button" onClick={() => onAdd('notes')}>Review notes</button>
    </details>}
  </section>;
}

function DayPackEvents({ session, packs, matches, now, onUseEvents }: {
  session: JournalSession; packs: ContextBatch[]; matches: ContextMatch[]; now: number;
  onUseEvents: (matches: ContextMatch[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  return <div className="context-pack-events" aria-label="Context Pack events">
    <h4>From your Context Packs</h4>
    {!matches.length && <p className="context-hint">{packs.length ? `No pack events for ${session.rthDate}. You can still add an event or check the official schedule.`
      : 'No Context Pack loaded for this journal. You can add events yourself or check the official schedule.'}</p>}
    {matches.map(match => {
      const { event, batch } = match, state = contextPackEventState(session, match);
      const key = `${batch.id}:${event.id}`, available = event.results.filter(result => Date.parse(result.availableAt) <= now);
      return <article className="context-pack-day-event" key={key}>
        <div className="context-section-heading"><strong>{event.name}</strong><time dateTime={event.eventAt}>{event.holiday ? holidaySummary(event.holiday, session.displayTimeZone) : contextTime(event.eventAt, session.displayTimeZone)}</time></div>
        <details><summary>Details &amp; source</summary>
          <p>{event.referencePeriod} · {batch.info.instrument} · {studyGroupLabel(batch.info.cohort)}</p>
          <p>{batch.info.title}</p>
          {!event.holiday && (available.length > 0 ? <dl>{available.map(result => <div key={result.measure}><dt>{result.measure}</dt>
            <dd>{result.actual.toLocaleString('en-US', { maximumFractionDigits: 6 })}{result.units === 'percent' ? '%' : ` ${result.units}`}</dd></div>)}</dl>
            : <p>{event.results.length ? 'Results are not available yet.' : 'No reported results in this pack.'}</p>)}
          <p className="context-hint">{event.holiday ? 'Applies throughout this study date.' : 'Reported figures are for review. The forecast currently uses the event type, not these results.'}</p>
          <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.holiday ? 'Holiday source' : 'Release schedule'}</a>
          {available.map(result => <p key={result.measure}><a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">{result.measure} source</a></p>)}
        </details>
        <button type="button" disabled={state !== 'new' || busy !== null} onClick={async () => {
          setBusy(key); setError(null);
          try { await onUseEvents([match]); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
          finally { setBusy(null); }
        }}>{state === 'saved' ? 'Saved to this day' : state === 'removed' ? 'Removed from this day' : busy === key ? 'Saving…' : `Use ${event.name} in this day`}</button>
      </article>;
    })}
    {error && <p role="alert">{error}</p>}
    {packs.length > 0 && <details className="context-pack-coverage"><summary>Loaded packs · {packs.length}</summary>
      <ul>{packs.map(pack => <li key={pack.id}>{pack.info.instrument} Context Pack · {contextDates(pack.events)}<small>{studyGroupLabel(pack.info.cohort)} · {pack.info.title}</small></li>)}</ul>
    </details>}
  </div>;
}

export function ContextRecap({ session }: { session: JournalSession }) {
  if (!session.marketContextItems.length) return null;
  return <section className="recap-section context-recap" aria-label="Day context">
    <h3>Day context</h3>
    {session.marketContextItems.length > 0 && <ul>{session.marketContextItems.map(item => <li key={item.id}>
      <strong>{item.name}</strong><time dateTime={item.eventAt}>{item.holiday ? holidaySummary(item.holiday, session.displayTimeZone) : contextTime(item.eventAt, session.displayTimeZone)}</time>
      {item.contextPack && <small>Context Pack · {item.contextPack.instrument} · {item.contextPack.referencePeriod}</small>}
      {session.forecast && Date.parse(item.recordedAt) > Date.parse(session.forecast.issuedAt) && <small>Added after the original forecast</small>}
    </li>)}</ul>}
  </section>;
}
