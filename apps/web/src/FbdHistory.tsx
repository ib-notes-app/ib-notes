// SPDX-License-Identifier: MPL-2.0
import { ContextTags, ContextEvents } from './ContextHistory';
import { useEffect, useState } from 'react';
import { fbdCompatibility, fbdImportConflict, fbdSummary, historicalLowStatus, priceTime,
  contextEventsAt, type ContextBatch, type FbdBatch, type ParsedFbdPack, type HistoricalLow, type StudyTemplate,
  type PriceHistoryBatch, type PriceHistoryDay } from '@ib-field-notes/domain';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { PriceDay } from './PriceHistory';
import { hiddenLowPacks, showLowPack } from './lowPackVisibility';
import { LevelQualityBadge } from './LevelQuality';
import type { LevelQuality } from './levelQuality';

export type FbdImportPreview = { parsed: ParsedFbdPack; text: string; fileName: string };
import { packTitle, lowPackDates, packTypes, studyGroupLabel, packContextUse } from './StudyPackLabels';
const price = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
const stamp = (at: string, zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(new Date(at));
function AboutFbd({ info }: { info: FbdBatch['info'] }) {
  const backtest = info.definition === 'breakout-backtest-1h-v1';
  return <details className="price-about"><summary>How these lows were found</summary>
    {backtest ? <p>Price tested resistance across at least five hours, broke above it, then returned to that shelf.
      A later completed hour confirmed a {info.qualificationPoints}+ point rise without flushing the backtest low. This is a breakout backtest, not a swing-low definition.</p> : <>
      <p>A completed 1-hour bar had a lower low than the bars on both sides. Price then rose at least {info.qualificationPoints} points before trading below that low.</p>
      <p>3H confirmation uses complete bars starting at midnight, 3 AM, 6 AM and so on in {info.timeZone}. Missing evidence stays unconfirmed.</p></>}
    <p>Any lower trade uses the original low. A reclaim does not make it untouched again.
      {backtest ? ' This pack records the first observed flush. Your saved prices track later interactions.'
        : ' This pack records the first flush and reclaim; it does not establish a squeeze or every repeat visit.'}</p>
    <p>Each contract stops at its own data cutoff. These historical lows are not a list of levels active today.</p>
    <p>Original title: {info.title}</p><p>Data group: {studyGroupLabel(info.cohort)}</p><p>{info.source}</p><p>{info.instrument} · Version {info.version}</p>
  </details>;
}
export function FbdHistoryPreview({ preview, template, batches, onImport, busy }: {
  preview: FbdImportPreview; template: StudyTemplate; batches: FbdBatch[]; onImport: () => Promise<void>; busy: boolean;
}) {
  const { parsed } = preview, { info } = parsed.pack, counts = fbdSummary(parsed);
  const compatibility = fbdCompatibility(info, template), error = compatibility.error ?? fbdImportConflict(parsed, batches);
  return <section className="historical-preview fbd-preview" aria-label="Low Pack preview">
    <h3>{packTitle('fbd', info.instrument)}</h3><p>{packTypes.fbd.description}</p><p>{lowPackDates(parsed.windows)}</p>
    <p>{info.definition === 'breakout-backtest-1h-v1' ? `${counts.lowCount} breakout backtests` : `${counts.lowCount} significant lows · ${counts.threeHourCount} also confirmed on 3H`}</p>
    <p>{counts.flushedCount} first flushes · {counts.reclaimedCount} recorded reclaims</p>
    <p>Read the low’s history and compare it with matching minute-price maps. {packContextUse(info.cohort)} Your personal levels stay separate.</p>
    <AboutFbd info={info} />
    {compatibility.comparison && !compatibility.error && <p className="study-source-note">Using {info.instrument} history in your {template.instrument} journal.</p>}
    {error && <p role="status">{error}</p>}
    <button type="button" className="primary" disabled={busy || !!error} onClick={() => void onImport()}>{busy ? 'Adding pack…' : 'Add Low Pack'}</button>
  </section>;
}
export function PackLevelVisibility({ journalId, batchId, batchIds = [batchId] }: { journalId: string; batchId: string; batchIds?: string[] }) {
  const [shown, setShown] = useState(() => batchIds.every(id => !hiddenLowPacks(journalId).includes(id)));
  return <label className="pack-level-visibility"><input type="checkbox" checked={shown} onChange={event => {
    setShown(event.target.checked); batchIds.forEach(id => showLowPack(journalId, id, event.target.checked));
  }} />Show in Levels</label>;
}
export function ImportedFbdEntry({ batch, onOpen, onRemove }: { batch: FbdBatch; onOpen: (batchId: string) => void; onRemove: (id: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  return <article data-history-kind="fbd"><details className="imported-history-entry">
    <summary><strong>{packTitle('fbd', batch.info.instrument)}</strong><span>{lowPackDates(batch.windows)}</span><span>{batch.lowCount} lows · {batch.windows.length} contracts</span></summary>
    <div className="imported-history-content"><p>Shows how lows qualified, their first flush and reclaim, and later loss of the flushing low where recorded.</p>
      <p>{batch.threeHourCount} also confirmed on 3H · {batch.reclaimedCount} recorded reclaims</p>
      <p>{packContextUse(batch.info.cohort)} No active levels are added.</p>
      <PackLevelVisibility journalId={batch.journalId} batchId={batch.id} />
      <button type="button" onClick={() => onOpen(batch.id)}>View levels</button>
      <details className="imported-history-source"><summary>Source details</summary><p>Original title: {batch.info.title}</p><p>Data group: {studyGroupLabel(batch.info.cohort)}</p><p>{batch.info.source}</p>
        <p>File: {batch.sourceFileName}</p><p>Research source: {batch.info.sourceFile}</p><p>Version {batch.info.version} · Imported {new Date(batch.importedAt).toLocaleString()}</p>
        {batch.windows.map(w => <p key={w.contract}>{w.contract}: first low {w.firstOriginAt.slice(0,10)}, data ends {stamp(w.cutoffAt, batch.info.timeZone)}</p>)}
      </details>
      {confirm ? <div className="historical-remove-confirmation" role="group" aria-label="Confirm Low Pack removal">
        <strong className="confirmation-target">{packTitle('fbd', batch.info.instrument)} · {lowPackDates(batch.windows)}</strong>
        <p>Remove this Low Pack? Your journal, daily IB records and minute maps stay saved.</p>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); void onRemove(batch.id).then(() => setConfirm(false)).finally(() => setBusy(false)); }}>Confirm Low Pack removal</button>
        <button type="button" disabled={busy} onClick={() => setConfirm(false)}>Keep pack</button>
      </div> : <button type="button" className="history-remove" onClick={() => setConfirm(true)}>Remove Low Pack</button>}
    </div>
  </details></article>;
}

export function LowDetail({ low, batch, zone, lows, priceBatches, contextBatches, repository, onSelect, onImport, quality }: {
  contextBatches: ContextBatch[]; low: HistoricalLow; batch: FbdBatch; zone: string; lows: HistoricalLow[]; priceBatches: PriceHistoryBatch[];
  repository: JournalRepository; onSelect: (low: HistoricalLow) => void; onImport: () => void;
  quality?: LevelQuality;
}) {
  const e = low.episode;
  const matches = priceBatches.filter(b => b.info.cohort === batch.info.cohort && b.info.instrument === batch.info.instrument)
    .flatMap(b => b.days.filter(d => d.contract === low.contract && priceTime(d.end) > priceTime(low.qualifiedAt) && priceTime(d.start) < priceTime(low.cutoffAt))
      .map(d => ({ batch: b, summary: d }))).sort((a,b) => a.summary.date.localeCompare(b.summary.date));
  const [choice, setChoice] = useState(''), [day, setDay] = useState<PriceHistoryDay | null>(null), [error, setError] = useState('');
  const selected = matches.find(d => `${d.batch.id}:${d.summary.date}` === choice);
  useEffect(() => {
    let cancelled = false; setDay(null); setError('');
    if (selected) void repository.getPriceHistoryDay(selected.batch.id, selected.summary.date).then(d => {
      if (!cancelled) { setDay(d); if (!d) setError('This price day is no longer available.'); }
    }).catch(err => { if (!cancelled) setError(String(err.message ?? err)); });
    return () => { cancelled = true; };
  }, [repository, choice]);
  const timeline: { label: string; at: string; value?: number }[] = [
    ...(low.breakoutBacktest ? [
      {label:'Resistance first tested', at:low.breakoutBacktest.resistanceStartAt},
      {label:'Breakout hour completed', at:low.breakoutBacktest.breakoutKnownAt},
    ] : []),
    { label: low.breakoutBacktest ? 'Backtest low formed' : 'Low formed', at: low.originAt, value: low.price },
    { label: low.breakoutBacktest ? 'Backtest hour completed' : '1H swing confirmed', at: low.pivotKnownAt },
    { label: `${batch.info.qualificationPoints}+ point rise confirmed`, at: low.qualifiedAt, value: low.confirmationPrice },
    ...(low.threeHourKnownAt ? [{ label: '3H confirmation available', at: low.threeHourKnownAt }] : []),
    ...(low.flushAt ? [{ label: 'First trade below the low', at: low.flushAt, value: low.firstPriceBelow! }] : []),
    ...(e ? [{ label: 'Flushing low formed', at: e.lowAt, value: e.low }] : []),
    ...(e?.reclaimAt ? [{ label: 'Original low reclaimed', at: e.reclaimAt, value: e.reclaimPrice! }] : []),
    ...(e?.lowBrokenAt ? [{ label: 'Flushing low broken later', at: e.lowBrokenAt }] : []),
    { label: 'Source data ends', at: low.cutoffAt },
  ];
  timeline.sort((a,b) => a.at.localeCompare(b.at));
  const activity = timeline.filter(item => item.value !== undefined || item.label === 'Flushing low broken later');
  const context = [...new Map(activity.flatMap(item => contextEventsAt(contextBatches, item.at, batch.info)).map(match => [`${match.batch.id}:${match.event.id}`, match])).values()];
  const replacement = e?.replacementId ? lows.find(l => l.id === e.replacementId) : null;
  const waitSeconds = e?.reclaimAt ? (priceTime(e.reclaimAt) - priceTime(low.flushAt!)) / 1000 : null;
  return <article className="fbd-low-detail" aria-label="Significant low history">
    <div className="fbd-low-heading"><h3>{price(low.price)} {quality&&<LevelQualityBadge quality={quality}/>}</h3><p>{low.contract} · 1H{low.threeHourKnownAt ? ' + 3H' : ''}</p><strong>{historicalLowStatus(low)}</strong></div>
    <p>{stamp(low.originAt, zone)}</p>
    <p>{low.flushAt ? 'The original low was used at its first flush. Reclaiming it does not restore untouched status.' : `No lower trade recorded through ${stamp(low.cutoffAt, zone)}. Its status after that is unknown.`}</p>
    {low.breakoutBacktest ? <p>Breakout backtest · {low.breakoutBacktest.resistanceHours} hours of resistance
      {low.breakoutBacktest.coverageHasGaps ? '. Later coverage has gaps; this finding stays in pack history.' : '. Continuous price coverage through the data cutoff.'}</p>
      : !low.threeHourKnownAt && <p>3H confirmation was not established in the available bars.</p>}
    {waitSeconds !== null && <p>Reclaim after {waitSeconds < 60 ? `${Number(waitSeconds.toFixed(3))} seconds` : `${Number((waitSeconds / 60).toFixed(1))} minutes`}. A reclaim alone does not confirm a squeeze.</p>}
    {e && !e.reclaimAt && <p>No reclaim recorded before the source ended. This does not establish a permanent breakdown.</p>}
    {e?.lowBrokenAt && e.lowBrokenAt === e.reclaimAt && <p>Reclaim and flushing-low loss share a timestamp. Their order is not resolved by this pack.</p>}
    <h4>What happened</h4><ol className="fbd-timeline">{timeline.map((event,i) => <li key={i}><strong>{event.label}{event.value !== undefined ? ` · ${price(event.value)}` : ''}</strong><time dateTime={event.at}>{stamp(event.at, zone)}</time>{activity.includes(event) && <ContextTags batches={contextBatches} at={event.at} instrument={batch.info.instrument} cohort={batch.info.cohort} />}</li>)}</ol>
    <ContextEvents matches={context} zone={zone} showDate />
    {replacement && <button type="button" onClick={() => onSelect(replacement)}>Explore the new qualifying low · {price(replacement.price)}</button>}
    <section className="fbd-map-section" aria-label="Compare with minute prices"><h4>See it with price</h4>
      {matches.length ? <><label>Choose a recorded day<select value={choice} onChange={ev => setChoice(ev.target.value)}>
        <option value="">Select a day</option>{matches.map(d => <option key={`${d.batch.id}:${d.summary.date}`} value={`${d.batch.id}:${d.summary.date}`}>{d.summary.date} · {d.summary.contract}</option>)}
      </select></label><p>The low appears only once its rise is confirmed. The flushing-low reference appears after the reclaim, when its depth is known.</p>
      {error && <p role="alert">{error}</p>}{selected && !day && !error && <p role="status">Loading minute prices…</p>}
      {day && selected && <PriceDay key={choice} day={day} batch={selected.batch} zone={zone} historicalLow={low} contextBatches={contextBatches} />}</>
        : <><p>No matching Price Action Pack is installed for this contract and period. The event history above is still available.</p><button type="button" onClick={onImport}>Add a Price Action Pack</button></>}
    </section><AboutFbd info={batch.info} />
  </article>;
}
