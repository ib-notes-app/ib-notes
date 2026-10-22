// SPDX-License-Identifier: MPL-2.0
import { useEffect, useMemo, useState } from 'react';
import { historicalIbBreakCode, type ContextBatch, type HistoricalIbSession, type JournalSession, type PriceHistoryBatch, type PriceHistoryDay } from '@ib-field-notes/domain';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { packTitle, packDates, studyGroupLabel } from './StudyPackLabels';
import { ContextEvents } from './ContextHistory';
import { PriceDay } from './PriceHistory';

export type ReviewPackFilter = { kind: 'daily' | 'price' | 'context' | 'monthly'; id: string; title: string };
const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
const price = (value: number | null) => value === null ? 'Not recorded' : value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });

export function ReviewDayList({ journals, daily, prices, contexts, onOpen, currentDate,page,onPageChange }: {
  journals: JournalSession[]; daily: HistoricalIbSession[]; prices: PriceHistoryBatch[]; contexts: ContextBatch[]; onOpen: (date: string) => void;
  currentDate?: string;
  page:number;onPageChange:(page:number)=>void;
}) {
  const days = useMemo(() => {
    const byDate = new Map<string, Set<string>>();
    const add = (date: string, kind: string) => { if (!byDate.has(date)) byDate.set(date, new Set()); byDate.get(date)!.add(kind); };
    journals.forEach(j => add(j.rthDate, j.studyReplay ? 'Journal replay' : 'My journal'));
    daily.forEach(d => add(d.rthDate, 'IB summary'));
    prices.forEach(b => b.days.forEach(d => add(d.date, 'Minute map')));
    contexts.forEach(b => b.events.forEach(e => add(e.sessionDate, e.name)));
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [journals, daily, prices, contexts]);
  const currentPage=Math.min(page,Math.max(0,Math.ceil(days.length/20)-1));
  return <>
    <p className="history-helper" role="status">{days.length} saved {days.length === 1 ? 'day' : 'days'}</p>
    {!days.length && <p>No days match yet. Record a day on Today or add a study pack.</p>}
    <ul className="review-day-list" aria-label="Saved days">{days.slice(currentPage * 20, (currentPage + 1) * 20).map(([date, kinds]) =>
      <li key={date}><button type="button" onClick={() => onOpen(date)} aria-label={`Review day ${date}`}
        aria-current={date===currentDate?'date':undefined} data-current-period={date===currentDate||undefined}>
        <span className="review-day-heading"><strong>{dateLabel(date)}</strong>
          {date===currentDate&&<small className="review-current-label">Current day</small>}</span><span>{[...kinds].join(' · ')}</span>
      </button></li>)}</ul>
    {days.length > 20 && <div className="price-actions"><button type="button" disabled={!currentPage} onClick={() => onPageChange(currentPage-1)}>Previous days</button>
      <span>Page {currentPage + 1} of {Math.ceil(days.length / 20)}</span><button type="button" disabled={(currentPage + 1) * 20 >= days.length} onClick={() => onPageChange(currentPage+1)}>More days</button></div>}
  </>;
}

export function ReviewDayDetail({ date, journals, daily, prices, contextBatches, repository, zone, onBack, onOpenJournal }: {
  date: string; journals: JournalSession[]; daily: HistoricalIbSession[]; prices: PriceHistoryBatch[];
  contextBatches: ContextBatch[]; repository: JournalRepository; zone: string; onBack: () => void; onOpenJournal: (date: string) => void;
}) {
  const journal = journals.find(j => j.rthDate === date);
  const context = contextBatches.flatMap(batch => batch.events.filter(e => e.sessionDate === date).map(event => ({event, batch})));
  const facts = daily.filter(d => d.rthDate === date);
  const matches = useMemo(() => prices.filter(b => b.days.some(d => d.date === date)), [prices, date]);
  const [choice, setChoice] = useState(matches[0]?.id ?? '');
  const batch = matches.find(b => b.id === choice);
  const [day, setDay] = useState<PriceHistoryDay | null>(null), [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; setDay(null); setError('');
    if (batch) void repository.getPriceHistoryDay(batch.id, date).then(result => {
      if (!cancelled) { setDay(result); if (!result) setError('This minute map is no longer available.'); }
    }).catch(err => { if (!cancelled) setError(String(err.message ?? err)); });
    return () => { cancelled = true; };
  }, [repository, batch, date]);
  return <section className="history-card review-day-detail" aria-label="Saved day details">
    <button type="button" className="research-overview-back" onClick={onBack}>← Back to Days</button>
    <h2>{dateLabel(date)}</h2>
    {journal && <section className="review-day-journal"><h3>{journal.studyReplay?'Journal replay':'My journal'}</h3><p>{journal.studyReplay?'Historical IB, entries and replay forecasts.':'Your notes, recorded prices and day recap.'}</p>
      <button type="button" onClick={() => onOpenJournal(date)}>Open my journal day</button></section>}
    <ContextEvents matches={context} zone={zone} />
    {facts.map(row => <section className="review-day-facts" key={row.id} data-review-item={row.id} aria-label={`${studyGroupLabel(row.cohort)} IB summary`}>
      <h3>IB summary</h3><p>{row.contract ?? 'Contract not supplied'} · {studyGroupLabel(row.cohort)}</p>
      <dl><div><dt>IB high</dt><dd>{price(row.lockedIbh)}</dd></div><div><dt>IB low</dt><dd>{price(row.lockedIbl)}</dd></div>
        <div><dt>IB range</dt><dd>{price(row.lockedIbWidthPoints)} points</dd></div><div><dt>Day type</dt><dd>{row.dayType ?? 'Not recorded'}</dd></div>
        <div><dt>Break code</dt><dd>{historicalIbBreakCode(row) ?? 'Not recorded'}</dd></div><div><dt>First break</dt><dd>{row.firstBreakSide ?? 'None recorded'}</dd></div>
        <div><dt>RTH close</dt><dd>{price(row.rthClose)}</dd></div></dl>
      {row.status === 'MISSING_DATA' && <p>Missing data: {row.missingDataDetails || 'This day is incomplete.'}</p>}
      <details><summary>Source details</summary><p>{row.sourceFileName} · row {row.sourceRowNumber}</p><p>Imported IB summary; your journal entries stay separate.</p></details>
    </section>)}
    {!!matches.length && <section className="review-day-map" aria-label="Day minute map"><h3>Minute map</h3>
      {matches.length > 1 && <label>Choose a map<select value={choice} onChange={e => setChoice(e.target.value)}>{matches.map(b =>
        <option key={b.id} value={b.id}>{packTitle('price', b.info.instrument)} · {studyGroupLabel(b.info.cohort)} · {b.days.find(d => d.date === date)!.contract}</option>)}</select></label>}
      {batch && <p>{packTitle('price', batch.info.instrument)} · {packDates(batch.days[0].date, batch.days.at(-1)!.date)}</p>}
      {error && <p role="alert">{error}</p>}{batch && !day && !error && <p role="status">Loading minute map…</p>}
      {day && batch && <PriceDay key={`${batch.id}:${date}`} day={day} batch={batch} zone={zone} contextBatches={contextBatches} />}
    </section>}
    {!matches.length && !!facts.length && <p>This pack has the daily IB summary. No minute map is installed for this date.</p>}
    {!journal && !facts.length && !matches.length && (context.length ? <p>No IB summary or minute map is installed for this event day.</p> : <p>This day is no longer available.</p>)}
  </section>;
}
