// SPDX-License-Identifier: MPL-2.0
import { ContextTags, contextTime } from './ContextHistory';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { historicalLowLines, type ContextBatch, type HistoricalLow, type HistoricalLowLine, developingPriceRanges, priceHistoryCompatibility, priceTime,
  type ParsedPriceHistory, type PriceHistoryBatch, type PriceHistoryDay, type HistoryPriceEvent,
  type StudyTemplate } from '@ib-field-notes/domain';

export type PriceImportPreview = { parsed: ParsedPriceHistory; text: string; fileName: string };
import { packTitle, packDates, packTypes, studyGroupLabel, packContextUse } from './StudyPackLabels';
const price = (n: number | null) => n === null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
function time(at: string, zone: string, precise = false) {
  return new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit',
    ...(precise ? { second: '2-digit', fractionalSecondDigits: 3 } : {}) }).format(new Date(at));
}
const label = (event: HistoryPriceEvent) => event.kind === 'BREAK_OBSERVED' ? `${event.edge === 'IBH' ? 'High' : 'Low'} break`
  : event.kind === 'RETURN_OBSERVED' ? 'Back inside IB' : event.kind === 'OUTSIDE_IN_BAR' ? `${event.edge === 'IBH' ? 'Above high' : 'Below low'} during minute` : 'Range overlap during minute';

function AboutPack({ batch }: { batch: Pick<PriceHistoryBatch, 'info'> }) {
  const p = batch.info;
  return <details className="price-about"><summary>About this Price Action Pack</summary>
    <p>Original title: {p.title}</p><p>Data group: {studyGroupLabel(p.cohort)}</p><p>{p.source}</p><p>{p.instrument} · {p.sources.map(s => s.contract).join(', ')} · Version {p.version}</p>
    <p>{p.resolution === 'TRADES' ? 'Minute bars summarize the recorded trades. Break and return times come from the original records.' : 'Minute bars show price ranges. The order of moves within each minute is unknown.'}</p>
    <p>Every observed minute does not guarantee every market trade is present. Empty overnight intervals may include market closures.</p>
    <p>{p.cohort === 'REFERENCE' ? 'A complete opening 15R can supply a low-distance anchor for future forecasts; later price moves stay for review.' : packContextUse(p.cohort)}</p>
    {p.notes.map((n, i) => <p key={i}>{n}</p>)}
    <p>Calendar: {p.calendarBasis}</p>
  </details>;
}

export function PriceHistoryPreview({ preview, template, batches, onImport }: {
  preview: PriceImportPreview; template: StudyTemplate; batches: PriceHistoryBatch[]; onImport: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const { info } = preview.parsed.pack, { days } = preview.parsed;
  const compatibility = priceHistoryCompatibility(info, template);
  const existing = batches.find(b => b.contentSha256 === preview.parsed.contentSha256 && b.info.cohort === info.cohort);
  const overlaps = batches.some(b => b.info.cohort === info.cohort && b.days.some(d => days.some(day => day.summary.date === d.date)));
  const error = compatibility.error ?? (existing ? 'This price history is already imported.' : overlaps ? 'These dates overlap an installed Price Action Pack. Remove that pack before replacing it.' : null);
  return <section className="historical-preview price-import-preview" aria-label="Price Action Pack preview">
    <h3>{packTitle('price', info.instrument)}</h3><p>{packTypes.price.description}</p>
    <p>{packDates(days[0].summary.date, days.at(-1)!.summary.date)}</p>
    <p>{days.length} days · {days.filter(d => d.summary.rthMissing > 0).length} with RTH gaps</p>
    <p>One-minute maps for historical study. {packContextUse(info.cohort)}</p>
    <AboutPack batch={{ info }} />
    {compatibility.comparison && !compatibility.error && <p className="study-source-note">Using {info.instrument} history in your {template.instrument} journal.</p>}
    {error && <p role="status">{error}</p>}
    <button type="button" className="primary" disabled={busy || !!error} onClick={() => {
      setBusy(true); void onImport().finally(() => setBusy(false));
    }}>{busy ? 'Adding pack…' : 'Add Price Action Pack'}</button>
  </section>;
}

function PriceMap({ day, first, last, selected, zone, onSelect, lowLines = [] }: { day: PriceHistoryDay; first: number; last: number;
  selected: number; zone: string; onSelect: (index: number) => void; lowLines?: HistoricalLowLine[] }) {
  const ref = useRef<HTMLDivElement>(null), [width, setWidth] = useState(340);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(1, entries[0].contentRect.width)));
    observer.observe(ref.current); return () => observer.disconnect();
  }, []);
  const ranges = useMemo(() => developingPriceRanges(day), [day]);
  const minutes = day.minutes.slice(first, last + 1);
  const values = minutes.flatMap(m => m.high === null ? [] : [m.high, m.low!]);
  const locked = day.summary.ibHigh !== null && priceTime(minutes.at(-1)!.at) + 60000 >= priceTime(day.summary.lockAt);
  if (locked) values.push(day.summary.ibHigh!, day.summary.ibLow!);
  values.push(...lowLines.map(line => line.price));
  const lo = values.length ? Math.min(...values) : 0, hi = values.length ? Math.max(...values) : 1;
  const padding = Math.max((hi - lo) * .12, .5), bottom = 286, top = 28, left = 78, right = width - 12;
  const y = (p: number) => bottom - (p - lo + padding) / (hi - lo + padding * 2) * (bottom - top);
  const x = (index: number) => left + (index - first) / (last - first + 1) * (right - left);
  const xAt = (at: string) => left + (priceTime(at) - priceTime(minutes[0].at)) / ((last - first + 1) * 60000) * (right - left);
  let closePath = '', wicks = '', highPath = '', lowPath = '', midPath = '', previous: typeof ranges[number] | null = null, continuous = false;
  const bands: string[] = [];
  for (let i = first; i <= last; i++) {
    const m = day.minutes[i], r = ranges[i];
    if (m.close !== null) {
      const center = (x(i) + x(i + 1)) / 2;
      wicks += `M${center},${y(m.high!)}V${y(m.low!)} `;
      closePath += `${continuous ? 'L' : 'M'}${x(i + 1)},${y(m.close)} `;
      continuous = true;
    } else continuous = false;
    if (priceTime(m.at) < priceTime(day.summary.lockAt) && r.high !== null) {
      const newX = x(i + 1);
      if (previous?.high !== null && previous?.high !== undefined) {
        highPath += `H${newX}V${y(r.high)} `; lowPath += `H${newX}V${y(r.low!)} `;
        midPath += `H${newX}V${y((r.high + r.low!) / 2)} `;
        bands.push(`M${x(i)},${y(previous.high)}H${newX}V${y(previous.low!)}H${x(i)}Z`);
      } else {
        highPath += `M${newX},${y(r.high)} `; lowPath += `M${newX},${y(r.low!)} `; midPath += `M${newX},${y((r.high + r.low!) / 2)} `;
      }
      previous = r;
    }
  }
  const lockX = Math.max(left, xAt(day.summary.lockAt));
  const labelY = (p: number) => Math.max(top, Math.min(bottom, y(p) - 7));
  const lastRange = ranges[last];
  const shownHigh = locked ? day.summary.ibHigh : lastRange.high, shownLow = locked ? day.summary.ibLow : lastRange.low;
  const ticks = width < 360 ? [first, last + 1] : [first, Math.floor((first + last + 1) / 2), last + 1];
  return <div ref={ref} className="price-map-frame">
    <svg role="img" aria-label="Historical price map with minute ranges and developing Initial Balance" viewBox={`0 0 ${width} 324`}
      onClick={e => { const box = e.currentTarget.getBoundingClientRect(); const px = (e.clientX - box.left) * width / box.width; onSelect(Math.max(first, Math.min(last, Math.floor(first + (px - left) / (right - left) * (last - first + 1))))); }}>
      <title>Recorded minute prices and Initial Balance</title><desc>Pink edges show the IB developing at completed minutes. Pale marks show each minute’s range and closing price. Shaded columns have no observations.</desc>
      {minutes.map((m, offset) => m.close === null ? <rect key={m.at} className="price-gap" x={x(first + offset)} y={top} width={Math.max(.5, x(first + offset + 1) - x(first + offset))} height={bottom - top} /> : null)}
      <path d={bands.join(' ')} className="price-ib-fill" />
      {locked && lockX < right && <rect className="price-ib-fill" x={lockX} y={y(day.summary.ibHigh!)} width={right - lockX} height={y(day.summary.ibLow!) - y(day.summary.ibHigh!)} />}
      <path d={wicks} className="price-wicks" /><path d={closePath} className="price-closes" />
      <path d={highPath} className="price-ib-edge" /><path d={lowPath} className="price-ib-edge" /><path d={midPath} className="price-ib-mid" />
      {locked && lockX <= right && <><path className="price-ib-edge" d={`M${lockX},${y(day.summary.ibHigh!)}H${right}M${lockX},${y(day.summary.ibLow!)}H${right}`} />
        <path className="price-ib-mid" d={`M${lockX},${y((day.summary.ibHigh! + day.summary.ibLow!) / 2)}H${right}`} /></>}
      {shownHigh !== null && <text className="price-map-label" x="5" y={labelY(shownHigh)}>{day.summary.formationMissing ? 'High' : 'IBH'}<tspan x="5" dy="16">{price(shownHigh)}</tspan></text>}
      {shownLow !== null && <text className="price-map-label" x="5" y={Math.max(labelY(shownLow), shownHigh !== null ? labelY(shownHigh) + 38 : top)}>{day.summary.formationMissing ? 'Low' : 'IBL'}<tspan x="5" dy="16">{price(shownLow)}</tspan></text>}
      {lowLines.map((line, i) => <path key={i} className={i === 0 ? 'price-historical-low' : 'price-flushing-low'}
        d={`M${Math.max(left, xAt(line.from))},${y(line.price)}H${Math.min(right, xAt(line.through))}`}><title>{line.label}: {price(line.price)}</title></path>)}
      <path className="price-selected-line" d={`M${x(selected + .5)},${top}V${bottom}`} />
      {day.minutes[selected].close !== null && <circle className="price-selected-dot" cx={x(selected + 1)} cy={y(day.minutes[selected].close!)} r="3.5" />}
      {ticks.map((i, n) => <text key={i} x={x(i)} y="313" textAnchor={n === 0 ? 'start' : n === ticks.length - 1 ? 'end' : 'middle'} className="price-time-label">{time(i > last ? new Date(priceTime(minutes.at(-1)!.at) + 60000).toISOString() : day.minutes[i].at, zone)}</text>)}
    </svg>
  </div>;
}

export function PriceDay({ day, batch, zone, historicalLow, contextBatches = [] }: { day: PriceHistoryDay; batch: PriceHistoryBatch; zone: string; historicalLow?: HistoricalLow; contextBatches?: ContextBatch[] }) {
  const [mode, setMode] = useState<'IB' | 'RTH' | 'DAY'>(historicalLow ? 'DAY' : 'IB');
  const [selected, setSelected] = useState(() => historicalLow ? Math.max(0, Math.min(day.minutes.length - 1, Math.floor((priceTime(historicalLow.qualifiedAt) - priceTime(day.summary.start)) / 60000))) : 0);
  const [eventPage, setEventPage] = useState(0);
  const s = day.summary, first = mode === 'DAY' ? 0 : (priceTime(s.openAt) - priceTime(s.start)) / 60000;
  const last = mode === 'IB' ? (priceTime(s.lockAt) - priceTime(s.start)) / 60000 - 1 : day.minutes.length - 1;
  const index = Math.min(last, Math.max(first, selected)), m = day.minutes[index];
  const ranges = useMemo(() => developingPriceRanges(day), [day]), r = ranges[index];
  const jump = (event: HistoryPriceEvent) => { setMode('RTH'); setSelected((priceTime(event.minuteAt) - priceTime(s.start)) / 60000); };
  const firstBreak = day.events.find(e => ['BREAK_OBSERVED','OUTSIDE_IN_BAR'].includes(e.kind)), firstReturn = day.events.find(e => e.kind === 'RETURN_OBSERVED');
  const lowLines = historicalLow ? historicalLowLines(historicalLow, Temporal.Instant.from(m.at).add({ minutes: 1 }).subtract({ microseconds: 1 }).toString()) : [];
  const context = contextBatches.filter(b => b.info.instrument === batch.info.instrument && b.info.cohort === batch.info.cohort).flatMap(b => b.events).filter(e => priceTime(e.eventAt) >= priceTime(s.start) && priceTime(e.eventAt) < priceTime(s.end));
  const pageEvents = day.events.slice(eventPage * 20, (eventPage + 1) * 20);
  return <article className="price-day" aria-label="Historical day price path">
    <h3>{s.date}</h3><p className="price-subtitle">{batch.info.instrument} · {s.contract}</p>
    <div className="price-coverage-summary"><strong>{s.formationMissing ? `${s.formationMissing} IB minutes missing` : `All ${(priceTime(s.lockAt) - priceTime(s.openAt)) / 60000} IB minutes observed`}</strong>
      <span>{s.rthMissing ? `${s.rthMissing} RTH minutes missing` : 'All RTH minutes observed'}</span></div>
    <div className="price-range-picker" role="group" aria-label="Map time window">
      {(['IB','RTH','DAY'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'IB' ? 'IB formation' : value === 'DAY' ? 'Full day' : 'RTH'}</button>)}
    </div>
    {!!context.length && <div className="context-map-jumps" role="group" aria-label="Jump to news release">{context.map(e => e.holiday ? <span key={e.id}>{e.name} · All day</span> : <button type="button" key={e.id} onClick={() => {
      setMode('DAY'); setSelected(Math.floor((priceTime(e.eventAt) - priceTime(s.start)) / 60000));
    }}>{e.name} · {contextTime(e.eventAt, zone)}</button>)}</div>}
    <PriceMap day={day} first={first} last={last} selected={index} zone={zone} onSelect={setSelected} lowLines={lowLines} />
    <p className="price-map-key">Pink: {s.formationMissing ? 'observed IB edges' : 'IB edges'} · Pale: minute prices<br />Shaded columns: no observations</p>
    {historicalLow && <div className="fbd-map-legend" aria-label="Historical low map references">
      {lowLines.length ? lowLines.map((line,i) => <p key={i} className={i === 0 ? 'fbd-original-key' : 'fbd-flush-key'}>{line.label} · {price(line.price)}</p>)
        : <p>This low is not yet qualified at the selected minute, or the minute is beyond its data cutoff.</p>}
      <p>References as known by the end of the selected minute.</p>
    </div>}
    <section className="price-minute-card" aria-label="Selected minute">
      <strong>{time(m.at, zone)}–{time(new Date(priceTime(m.at) + 60000).toISOString(), zone)}</strong>
      <span>{new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' }).formatToParts(new Date(m.at)).find(p => p.type === 'timeZoneName')?.value}</span>
      <ContextTags batches={contextBatches} at={m.at} until={new Date(priceTime(m.at) + 60000).toISOString()} instrument={batch.info.instrument} cohort={batch.info.cohort} />
      {m.close === null ? <p>No observations in this minute.</p> : <dl>{(['open','high','low','close'] as const).map(k => <div key={k}><dt>{k[0].toUpperCase() + k.slice(1)}</dt><dd>{price(m[k])}</dd></div>)}</dl>}
      {r.high !== null && <p>IB so far: {price(r.low)}–{price(r.high)}{r.missing ? ' · has gaps' : ''}</p>}
      <label className="price-slider-label">Inspect a minute<input type="range" min={first} max={last} step="1" value={index} aria-valuetext={time(m.at, zone)} onChange={e => setSelected(Number(e.target.value))} /></label>
      <div className="price-actions"><button type="button" disabled={index <= first} onClick={() => setSelected(index - 1)}>← Previous minute</button><button type="button" disabled={index >= last} onClick={() => setSelected(index + 1)}>Next minute →</button></div>
    </section>
    <section className="price-events" aria-label="Recorded IB events"><h3>Breaks & returns</h3>
      <div className="price-actions">{firstBreak && <button type="button" onClick={() => jump(firstBreak)}>Jump to first break</button>}{firstReturn && <button type="button" onClick={() => jump(firstReturn)}>Jump to first return</button>}</div>
      <p>{day.events.length} recorded events{batch.info.resolution === 'OHLC_1M' ? ' · order within each minute is unknown' : ''}.</p>
      {!day.events.length && <p>{s.formationMissing ? 'IB events cannot be established from an incomplete formation.' : s.rthMissing ? 'No IB events recorded in the available prices. RTH has gaps.' : 'No IB break recorded in the supplied prices.'}</p>}
      <ol start={eventPage * 20 + 1}>{pageEvents.map((e, i) => <li key={eventPage * 20 + i}><button type="button" onClick={() => jump(e)}>
        <span><strong>{label(e)}</strong><time>{e.at ? time(e.at, zone, true) : `${time(e.minuteAt, zone)} minute`}</time></span>
        <span>{price(e.price)}</span>
        <ContextTags batches={contextBatches} at={e.at ?? e.minuteAt} until={e.at ? undefined : new Date(priceTime(e.minuteAt) + 60000).toISOString()} instrument={batch.info.instrument} cohort={batch.info.cohort} />
        {e.precision.includes('TIED') && <small>Same timestamp · file order</small>}{e.continuity === 'GAP_BEFORE' && <small>Follows a gap in observations</small>}
      </button></li>)}</ol>
      {day.events.length > 20 && <div className="price-actions"><button type="button" disabled={eventPage === 0} onClick={() => setEventPage(p => p - 1)}>Previous events</button><button type="button" disabled={(eventPage + 1) * 20 >= day.events.length} onClick={() => setEventPage(p => p + 1)}>More events</button></div>}
    </section>
    <AboutPack batch={batch} />
  </article>;
}
