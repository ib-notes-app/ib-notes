// SPDX-License-Identifier: MPL-2.0
import { useState } from 'react';
import { PackLevelVisibility } from './FbdHistory';
import { monthlyPackTitle, monthlyPackCompatibility, monthlyPackImportIssue,
  type MonthlyPackBatch, type ParsedMonthlyStudyPack, type MonthlyPackContents, type MonthlyLevelFilter, type StudyTemplate } from '@ib-field-notes/domain';

export type MonthlyImportPreview = { parsed: ParsedMonthlyStudyPack; text: string; fileName: string };
export function MonthlyContents({ contents }: { contents: MonthlyPackContents }) {
  const count = (n: number, name: string) => n ? `${n} ${name}${n === 1 ? '' : 's'}` : null;
  const rows = [['IB history', count(contents.ibDays, 'day')],
    ['Price maps', count(contents.priceDays, 'day')],
    ['Levels & recoveries', count(contents.lows, 'low')],
    ['Resistance references', count(contents.levels ?? 0, 'level')],
    ['Scheduled events', count(contents.events, 'event')],
    ['Holidays', count(contents.holidays, 'day')]];
  return <dl className="monthly-pack-contents">{rows.filter(([, value]) => value).map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function MonthlyPackPreview({ preview, template, packs, availableBatchIds, busy, onImport }: {
  preview: MonthlyImportPreview; template: StudyTemplate; packs: MonthlyPackBatch[]; availableBatchIds: Set<string>;
  busy: boolean; onImport: () => Promise<void>;
}) {
  const { parsed } = preview, existing = packs.find(p => p.manifest.id === parsed.pack.manifest.id);
  const issue = monthlyPackCompatibility(parsed, template) ?? monthlyPackImportIssue(parsed, packs, availableBatchIds);
  const learning = parsed.parts.filter(p => p.kind !== 'levels' && (p.kind === 'daily' ? p.parsed.cohort : p.parsed.pack.info.cohort) === 'REFERENCE');
  const comparison = parsed.parts.some(p => p.kind !== 'levels' && (p.kind === 'daily' ? p.parsed.cohort : p.parsed.pack.info.cohort) === 'FORWARD_OBSERVATION');
  const names = { daily: 'IB history', price: 'price paths', fbd: 'level history', context: 'event history', levels: 'resistance references' };
  const trackedBacktests = parsed.parts.flatMap(p => p.kind === 'fbd' ? p.parsed.lows : [])
    .filter(low => low.breakoutBacktest && !low.flushAt && !low.breakoutBacktest.coverageHasGaps).length;
  return <section className="historical-preview monthly-pack-preview" aria-label="Study Pack preview">
    <p className="eyebrow">Study Pack</p><h3>{monthlyPackTitle(parsed.pack.manifest)}</h3>
    <MonthlyContents contents={parsed.contents} />
    {trackedBacktests > 0 && <p>{trackedBacktests} breakout backtest{trackedBacktests === 1 ? '' : 's'} ready to track from your prices.</p>}
    {!!parsed.contents.levels && <p>Resistance references appear in Levels. Choose which to show on your map.</p>}
    {!parsed.contents.ibDays && !parsed.contents.priceDays && !parsed.contents.levels && <p>Plan ahead with this month’s events. Price history can be added in a later update.</p>}
    {issue && <p className="historical-notice" role="status">{issue}</p>}
    <button type="button" className="primary-action" disabled={busy || !!issue} onClick={() => void onImport()}>
      {busy ? 'Adding…' : existing ? 'Update Study Pack' : 'Add Study Pack'}</button>
    <details className="monthly-pack-details"><summary>Contents &amp; source</summary>
      <p>Version {parsed.pack.manifest.version} · Prepared {parsed.pack.manifest.preparedOn}</p>
      {learning.length > 0 && <p>Forecast learning: {learning.map(p => names[p.kind]).join(', ')}. Only eligible earlier records are used.</p>}
      {comparison && <p>Comparison material stays separate from forecast learning.</p>}
      <p>Existing journal entries and saved forecasts stay yours. Matching installed history is reused.</p>
      {parsed.parts.map(p => <div key={p.fileName}><p>{names[p.kind]} · {p.fileName}</p>
        {p.kind === 'daily' && <p>{p.parsed.completeRowCount} complete days · {p.parsed.missingRowCount} with missing data</p>}
        {p.kind === 'price' && <p>{p.parsed.days.filter(d => d.summary.rthMissing > 0).length} days have RTH gaps.</p>}
      </div>)}
      {parsed.pack.manifest.notes.map(n => <p key={n}>{n}</p>)}
    </details>
  </section>;
}
export function InstalledMonthlyPacks({ packs, availableBatchIds, onRemove, onViewDays, onViewLevels, onViewReferences }: {
  packs: MonthlyPackBatch[]; availableBatchIds: Set<string>; onRemove: (id: string) => Promise<void>;
  onViewDays: (month: string) => void; onViewLevels: (id: string) => void;
  onViewReferences: (filter: MonthlyLevelFilter) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  return <div className="imported-history-list monthly-pack-list">{packs.map(pack => {
    const missing = pack.links.some(l => l.batchIds.some(id => !availableBatchIds.has(id)));
    const lows = [...new Set(pack.links.filter(l => l.kind === 'fbd').flatMap(l => l.batchIds))].filter(id => availableBatchIds.has(id));
    const references = pack.links.filter(l => l.kind === 'levels').flatMap(l => l.batchIds).filter(id => availableBatchIds.has(id));
    return <article key={pack.id} data-history-kind="monthly"><details className="imported-history-entry">
      <summary><strong>{monthlyPackTitle(pack.manifest)}</strong><span>{missing ? 'Some contents were removed' : 'Study Pack'}</span></summary>
      <div className="imported-history-content"><MonthlyContents contents={pack.contents} />
        {missing && <p>Choose the same file again to restore its missing contents.</p>}
        {(pack.contents.ibDays + pack.contents.priceDays + pack.contents.events + pack.contents.holidays > 0) && <button type="button" onClick={() => onViewDays(pack.manifest.month)}>View days</button>}
        {lows.length > 0 && <PackLevelVisibility key={lows.join(',')} journalId={pack.journalId} batchId={lows[0]} batchIds={lows} />}
        {(lows.length > 0 || references.length > 0) && <button type="button" onClick={() => references.length
          ? onViewReferences({ levelIds: references, lowBatchIds: lows }) : onViewLevels(lows.length === 1 ? lows[0] : '')}>View levels</button>}
        <details><summary>Source details</summary><p>Version {pack.manifest.version} · Prepared {pack.manifest.preparedOn}</p>
          <p>{pack.sourceFileName}</p>{pack.manifest.notes.map(n => <p key={n}>{n}</p>)}</details>
        {removing !== pack.id ? <button type="button" className="history-remove" onClick={() => { setRemoving(pack.id); setError(null); }}>Remove Study Pack</button>
          : <div className="historical-remove-confirmation" role="group" aria-label="Confirm Study Pack removal">
            <strong className="confirmation-target">{monthlyPackTitle(pack.manifest)}</strong>
            <p>Remove this month’s imported material? Your journal, saved events and forecasts stay saved. Shared history stays with other packs.</p>
            <button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(null);
              try { await onRemove(pack.id); setRemoving(null); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
              finally { setBusy(false); } }}>Confirm removal</button>
            <button type="button" disabled={busy} onClick={() => setRemoving(null)}>Keep pack</button>
            {error && <p role="alert">{error}</p>}
          </div>}
      </div></details></article>;
  })}</div>;
}
