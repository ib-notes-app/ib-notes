// SPDX-License-Identifier: MPL-2.0
import { useState } from 'react';
import { contextCompatibility, contextImportConflict, contextEventsAt, type ContextBatch, type ContextMatch,
  type ParsedContextPack, type StudyTemplate, type HistoricalIbCohort } from '@ib-field-notes/domain';
import { holidaySummary } from '@ib-field-notes/domain';
import { packTitle, packDates, packTypes, studyGroupLabel, packContextUse } from './StudyPackLabels';

export type ContextImportPreview = { parsed: ParsedContextPack; text: string; fileName: string };
export const contextDates = (events: ContextBatch['events']) => { const dates = events.map(e => e.sessionDate).sort(); return packDates(dates[0], dates.at(-1)!); };
export const contextTime = (at: string, zone: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: zone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).format(new Date(at));
const number = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });

function ContextSource({ info }: { info: ContextBatch['info'] }) {
  return <details className="imported-history-source"><summary>Source details</summary>
    <p>{info.source}</p><p>Original title: {info.title}</p><p>Version {info.version} · {studyGroupLabel(info.cohort)}</p>
    <p>Research file: {info.sourceFile}</p>
    <p>Pack history stays separate from your journal. Today’s menu → Context lets you save a chosen event into the day’s context.</p>
  </details>;
}
export function ContextHistoryPreview({ preview, template, batches, busy, onImport }: {
  preview: ContextImportPreview; template: StudyTemplate; batches: ContextBatch[]; busy: boolean; onImport: () => Promise<void>;
}) {
  const { parsed } = preview, { info } = parsed.pack;
  const compatibility = contextCompatibility(info, template), error = compatibility.error ?? contextImportConflict(parsed, batches);
  return <section className="historical-preview context-preview" aria-label="Context Pack preview">
    <h3>{packTitle('context', info.instrument)}</h3><p>{packTypes.context.description}</p>
    <p>{contextDates(parsed.events)}</p><p>{parsed.events.length} events · {[...new Set(parsed.events.map(e => e.name))].join(', ')}</p>
    <p>{parsed.events.filter(e => e.results.length).length} with reported results · {parsed.events.filter(e => e.prices).length} with price summaries</p>
    <p>Read events alongside historical days and lows, or save an event through Today’s menu → Context. {packContextUse(info.cohort)}</p>
    <ContextSource info={info} />
    {compatibility.comparison && !compatibility.error && <p className="study-source-note">Using {info.instrument} history in your {template.instrument} journal.</p>}
    {error && <p role="status">{error}</p>}
    <button type="button" className="primary" disabled={busy || !!error} onClick={() => void onImport()}>{busy ? 'Adding pack…' : 'Add Context Pack'}</button>
  </section>;
}
export function ImportedContextEntry({ batch, onOpen, onRemove }: {
  batch: ContextBatch; onOpen: (id: string) => void; onRemove: (id: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  return <article data-history-kind="context"><details className="imported-history-entry">
    <summary><strong>{packTitle('context', batch.info.instrument)}</strong><span>{contextDates(batch.events)}</span><span>{batch.events.length} events</span></summary>
    <div className="imported-history-content"><p>{packTypes.context.description}</p>
      <p>{[...new Set(batch.events.map(e => e.name))].join(' · ')}</p>
      <p>{packContextUse(batch.info.cohort)} Reported numbers and price summaries stay for review.</p>
      <button type="button" onClick={() => onOpen(batch.id)}>View event days</button>
      <ContextSource info={batch.info} />
      {confirm ? <div className="historical-remove-confirmation" role="group" aria-label="Confirm Context Pack removal">
        <strong className="confirmation-target">{packTitle('context', batch.info.instrument)} · {contextDates(batch.events)}</strong>
        <p>Remove this Context Pack? Your notes, levels and other packs stay saved.</p>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void onRemove(batch.id).then(() => setConfirm(false)).finally(() => setBusy(false)); }}>Confirm Context Pack removal</button>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Keep pack</button>
      </div> : <button type="button" className="history-remove" onClick={() => setConfirm(true)}>Remove Context Pack</button>}
    </div>
  </details></article>;
}
export function ContextEvents({ matches, zone, showDate = false }: { matches: ContextMatch[]; zone: string; showDate?: boolean }) {
  if (!matches.length) return null;
  return <section className="context-events" aria-label="Historical context"><h3>News &amp; events</h3>
    <p>Event windows cover 5 minutes before through 15 minutes after release. Nearby activity does not establish cause.</p>
    {matches.map(({ event: e, batch }) => <details className="context-event" key={`${batch.id}:${e.id}`}>
      <summary><strong>{e.name}</strong><span>{showDate && `${e.sessionDate} · `}{e.holiday ? holidaySummary(e.holiday, zone) : contextTime(e.eventAt, zone)} · {e.referencePeriod}</span></summary>
      <div className="context-event-content">
        {e.holiday ? <p>All-day holiday context. {holidaySummary(e.holiday, zone)}</p> : <>
        <h4>Reported results</h4>
        {e.results.length ? <dl>{e.results.map(r => <div key={r.measure}><dt>{r.measure}</dt><dd>{number(r.actual)}{r.units === 'percent' ? '%' : ` ${r.units}`}</dd></div>)}</dl> : <p>No reported results in this pack.</p>}
        <p>Expected figures are not included, so hotter/cooler than expected is unknown.</p>
        {e.prices ? <><h4>Price around release</h4><p>{batch.info.instrument} · {e.prices.contract}</p>
          <dl>{e.prices.windows.map(w => <div key={w.period}><dt>{w.period === 'BEFORE_60' ? 'Hour before' : w.period === 'AFTER_15' ? '15 minutes after' : 'Hour after'}</dt>
            <dd>{w.change === null ? 'Change unavailable' : `${w.change > 0 ? '+' : ''}${number(w.change)} points`}<small>{w.observedMinutes}/{w.expectedMinutes} minutes observed</small></dd></div>)}</dl>
          <p>Before: first to last recorded price. After: change from the last price at or before release, when no more than one minute old. Missing minutes keep the change unknown.</p>
        </> : <p>No price summary in this pack for this release. An installed Price Action Pack may still cover the day.</p>}
        </>}
        <details className="context-event-sources"><summary>Sources &amp; timing</summary>
          <p>{batch.info.instrument} · {studyGroupLabel(batch.info.cohort)} · {batch.info.title}</p>
          <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">{e.holiday ? 'Holiday source' : 'Release schedule'}</a>
          <p>{e.holiday ? `Date: ${e.sessionDate} · All day` : `Scheduled: ${e.eventAt}`} · Retrieved {e.retrievedOn}</p>
          {e.results.map(r => <p key={r.measure}><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{r.measure} — original release</a><br />Available {contextTime(r.availableAt, zone)} on {r.availableAt.slice(0, 10)}</p>)}
          <p>These summaries keep their own source contract and coverage. They do not fill missing minutes on another pack’s map.</p>
        </details>
      </div>
    </details>)}
  </section>;
}
export function ContextTags({ batches, at, until, instrument, cohort }: {
  batches: ContextBatch[]; at: string; until?: string; instrument: string; cohort: HistoricalIbCohort;
}) {
  const matches = contextEventsAt(batches, at, { instrument, cohort }, until);
  if (!matches.length) return null;
  return <span className="context-window-tags" aria-label="Historical event windows">
    {matches.map(({ event, batch }) => <span key={`${batch.id}:${event.id}`}>{event.name}{event.holiday ? ' · all day' : ` window${until ? ' · minute overlaps' : ''}`}</span>)}
  </span>;
}
