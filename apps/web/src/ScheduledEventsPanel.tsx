// SPDX-License-Identifier: MPL-2.0
import { useEffect, useRef, useState } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { scheduledEventState,validNewsResult,newsResultForItem,type NewsResult,type JournalSession,type ScheduledEvent } from '@ib-field-notes/domain';
import { retainSchedule, scheduleCoverage, SCHEDULE_PROVIDERS, type ScheduleResponse } from './scheduleTypes';

const cacheKey = (month: string) => `ib-official-schedule-v1:${month}`;
function validResponse(value: unknown, month: string): value is ScheduleResponse {
  if (!value || typeof value !== 'object') return false;
  const data = value as ScheduleResponse;
  return data.month === month && Array.isArray(data.sources) && data.sources.length === 3 &&
    new Set(data.sources.map(source => scheduleCoverage(source.provider))).size === 3 && data.sources.every(source =>
      Object.hasOwn(SCHEDULE_PROVIDERS, source.provider) && ['ok', 'unavailable'].includes(source.status) &&
      Number.isFinite(Date.parse(source.checkedAt)) && officialUrl(source.sourceUrl, source.provider) &&
      Array.isArray(source.events) && source.events.every(event =>
        event.provider === source.provider && typeof event.sourceId === 'string' &&
        typeof event.name === 'string' && event.name.length > 0 && event.name.length <= 200 &&
        Number.isFinite(Date.parse(event.eventAt)) && Number.isFinite(Date.parse(event.fetchedAt)) &&
        officialUrl(event.sourceUrl, event.provider) && (event.provider === 'fred' || event.sourceUrl === source.sourceUrl)));
}
function officialUrl(value: string, provider: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (provider === 'fred' ? url.hostname === 'fred.stlouisfed.org' && url.pathname === '/releases/calendar' :
        url.hostname === ({ bls: 'www.bls.gov', bea: 'www.bea.gov', fed: 'www.federalreserve.gov' } as Record<string, string>)[provider]);
  } catch { return false; }
}
function readCache(month: string): ScheduleResponse | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(cacheKey(month)) ?? 'null');
    return validResponse(data, month) ? data : null;
  } catch { return null; }
}

export function ScheduledEventsPanel({ session, onAdd,onResults }: {
  session: JournalSession;
  onAdd: (events: ScheduledEvent[],results?:NewsResult[]) => Promise<void>;
  onResults?:(results:NewsResult[])=>Promise<void>;
}) {
  const month = session.rthDate.slice(0, 7);
  const [data, setData] = useState<ScheduleResponse | null>(() => readCache(month));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const resultKey=`ib-news-results-v1:${session.rthDate}`;
  const [results,setResults]=useState<NewsResult[]>(()=>{try{const values:unknown=JSON.parse(localStorage.getItem(resultKey)??'[]');return Array.isArray(values)?values.filter(r=>validNewsResult(r)&&r.releaseDate===session.rthDate&&r.source==='official'):[];}catch{return [];}});
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const supported = ['ES', 'MES'].includes(session.instrument.trim().toUpperCase());
  if (import.meta.env.MODE === 'public-blank') return <p className="stage-helper">Enter news events and results yourself. Automatic news lookup is not included in this edition; saved entries work offline.</p>;
  if (import.meta.env.MODE === 'beta-rehearsal') return <p className="stage-helper">Automatic news lookup is unavailable in this static rehearsal. Add events and results below; saved entries work offline.</p>;
  if (!supported) return <p className="stage-helper">Official schedules start with ES and MES. You can add events for {session.instrument} below.</p>;
  const events = data?.sources.flatMap(source => source.events).filter(event =>
    Temporal.Instant.from(event.eventAt).toZonedDateTimeISO('America/New_York').toPlainDate().toString() === session.rthDate,
  ).sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt)) ?? [];
  const newEvents = events.filter(event => scheduledEventState(session, event) === 'new');
  const missing = data?.sources.filter(source => source.status === 'unavailable').map(source =>
    scheduleCoverage(source.provider) === 'bls' ? 'CPI, PPI & jobs' : source.provider === 'fed' ? 'FOMC' : 'GDP & PCE') ?? [];
  const time = (at: string, date = false) => new Date(at).toLocaleString('en-US', {
    timeZone: session.displayTimeZone, ...(date ? { month: 'short', day: 'numeric', year: 'numeric' } as const : {}),
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
  async function checkSchedule() {
    setBusy(true); setMessage('');
    const abort = new AbortController(); controller.current = abort;
    // Primary and backup requests are bounded to 12 seconds each on the server.
    const timeout = setTimeout(() => abort.abort(), 30_000);
    const resultTask=fetch(`/api/news-results?date=${session.rthDate}`,{signal:abort.signal}).then(async response=>{
      if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new Error('Results could not be checked.');
      const incoming=await response.json() as {date:string;sources:{family:string;status:string;result:unknown}[]};
      if(incoming.date!==session.rthDate||!Array.isArray(incoming.sources)||incoming.sources.length!==3||
        new Set(incoming.sources.map(s=>s.family)).size!==3||incoming.sources.some(s=>!['cpi','ppi','jobs'].includes(s.family)||
          !['ok','unavailable'].includes(s.status)||s.status==='ok'&&(!validNewsResult(s.result)||s.result.source!=='official'||s.result.releaseDate!==session.rthDate||s.result.family!==s.family)))throw new Error('Results could not be verified.');
      if(incoming.sources.every(s=>s.status==='unavailable'))return null;
      return incoming.sources.flatMap(s=>s.status==='ok'&&validNewsResult(s.result)?[s.result]:[]);
    }).catch(()=>null);
    try {
      const response = await fetch(`/api/scheduled-events?month=${month}`, { signal: abort.signal });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('Schedule lookup is unavailable. Your saved events are still here; you can add an event manually.');
      }
      const incoming: unknown = await response.json();
      if (!validResponse(incoming, month)) throw new Error('This schedule could not be read. You can add an event manually.');
      // Keep the last public schedule when an individual source fails, with an explicit stale label.
      const result = retainSchedule(incoming, data);
      setData(result);
      try { localStorage.setItem(cacheKey(month), JSON.stringify(result)); } catch { /* Journal persistence is separate. */ }
      setMessage(result.sources.some(source => source.status === 'unavailable') ? '' : 'Schedule checked.');
    } catch (error) {
      setMessage(abort.signal.aborted ? 'Could not connect. Showing any previously downloaded schedule.' :
        error instanceof Error ? error.message : 'Could not check the schedule.');
    } finally {
      try{
        const fresh=await resultTask;
        if(!abort.signal.aborted&&fresh){
          const combined=[...new Map([...results,...fresh].map(r=>[r.family,r])).values()];setResults(combined);
          try{localStorage.setItem(resultKey,JSON.stringify(combined));}catch{/* Saved journal results remain independent. */}
          if(fresh.length)await onResults?.(fresh);
          setMessage(prior=>`${prior}${prior?' ':''}${fresh.length?'Released results checked.':'No matching released figures found; saved results kept.'}`);
        }else setMessage(prior=>`${prior}${prior?' ':''}Results unavailable; saved results kept. You can add a result below.`);
      }catch{setMessage(prior=>`${prior} Results could not be saved. Try again.`);}
      clearTimeout(timeout);setBusy(false);
    }
  }
  async function addEvents() {
    setBusy(true); setMessage('');
    try {
      await onAdd(newEvents,results);
      setMessage('Events added. You can edit or remove them below.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save events.'); }
    finally { setBusy(false); }
  }
  return <section className="scheduled-events" aria-label="Official schedule">
    <h4>Scheduled events</h4>
    <p>Key events for {new Date(`${session.rthDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}.</p>
    <button type="button" disabled={busy} onClick={() => void checkSchedule()}>
      {busy ? 'Please wait…' : 'Refresh news'}
    </button>
    <p className="stage-helper">Checks schedules and released CPI, PPI &amp; jobs figures. Other or older results can be entered below.</p>
    <div role="status" aria-live="polite">{message}</div>
    {data && <>
      {missing.length > 0 && <p className="schedule-incomplete">Schedule incomplete · could not check {missing.join(' / ')}. Try again or add an event.</p>}
      {data.sources.some(source => source.provider === 'fred' && source.status === 'ok') &&
        <p className="stage-helper">CPI, PPI &amp; jobs from the St. Louis Fed backup calendar.</p>}
      {events.length > 0 ? <ul className="schedule-event-list" aria-label="Available scheduled events">
        {events.map(event => {
          const state = scheduledEventState(session, event);
          const source = data.sources.find(source => source.provider === event.provider)!;
          return <li key={`${event.provider}:${event.sourceId}`}>
            <strong>{event.name}</strong><time dateTime={event.eventAt}>{time(event.eventAt)}</time>
            {results.filter(r=>newsResultForItem({id:'preview',name:event.name,eventDate:session.rthDate,eventAt:event.eventAt,note:null,source:'official',recordedAt:event.fetchedAt,newsResult:r},new Date().toISOString()))
              .map(r=><small key={r.family}>Downloaded result: {r.actual}</small>)}
            <small>{source.status !== 'ok' ? 'Previously downloaded · ' : ''}{state === 'saved' ? 'Already saved' :
              state === 'removed' ? 'Removed by you' : state === 'changed' ? 'Time differs · edit the saved event below' : 'Ready to add'}</small>
          </li>;
        })}
      </ul> : <p>{missing.length ? 'This day’s schedule could not be fully checked.' : 'No key events listed for this day.'}</p>}
      {newEvents.length > 0 && <button className="primary-action" type="button" disabled={busy} onClick={() => void addEvents()}>
        Add {newEvents.length === 1 ? 'event' : `${newEvents.length} events`} to this day
      </button>}
      <details className="schedule-sources"><summary>Saved schedule &amp; sources</summary>
        <p>CPI, PPI, jobs, FOMC, GDP and PCE. Downloaded schedules can change. Check again before using an older copy; saved events remain yours to edit.</p>
        <p>Tags cover 5 minutes before to 15 minutes after. They describe timing, not the cause of a move.</p>
        <ul>{data.sources.map(source => <li key={source.provider}>
          <a href={source.provider === 'bls' ? 'https://www.bls.gov/schedule/' : source.provider === 'bea' ? 'https://www.bea.gov/news/schedule/full' : source.sourceUrl} target="_blank" rel="noreferrer">{SCHEDULE_PROVIDERS[source.provider]}</a>
          <small>{source.status === 'ok' ? 'Downloaded' : 'Could not check'} · {time(source.checkedAt, true)}</small>
          {source.message && <p>{source.message}</p>}
          {source.status !== 'ok' && source.events[0] && <small>Saved copy from {time(source.events[0].fetchedAt, true)}</small>}
        </li>)}</ul>
      </details>
    </>}
  </section>;
}
