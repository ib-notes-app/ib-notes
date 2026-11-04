// SPDX-License-Identifier: MPL-2.0
import { ImportedContextEntry } from './ContextHistory';
import { useState } from 'react';
import { packTitle, packDates, packTypes, studyGroupLabel, ibForecastUse } from './StudyPackLabels';
import { ImportedFbdEntry } from './FbdHistory';
import type { ContextBatch, FbdBatch, HistoricalIbImportBatch, PriceHistoryBatch, MonthlyPackBatch, MonthlyLevelFilter } from '@ib-field-notes/domain';
import { InstalledMonthlyPacks } from './MonthlyStudyPacks';

type Entry = { kind: 'context'; batch: ContextBatch } | { kind: 'fbd'; batch: FbdBatch } | { kind: 'daily'; batch: HistoricalIbImportBatch } | { kind: 'price'; batch: PriceHistoryBatch };

export function ImportedHistoryBatches({ monthlyPacks = [], levelIds = [], onViewReferences, onRemoveMonthly, onViewDays, contextBatches, onOpenContext, onRemoveContext, fbdBatches, onOpenFbd, onRemoveFbd, batches, priceBatches, removeConfirmationId, onBeginRemove,
  onCancelRemove, onConfirmRemove, onRemovePrice, onOpenPrices, onOpenDaily }: {
  monthlyPacks?: MonthlyPackBatch[]; onRemoveMonthly?: (id: string) => Promise<void>; onViewDays?: (month: string) => void;
  levelIds?: string[]; onViewReferences?: (filter: MonthlyLevelFilter) => void;
  contextBatches: ContextBatch[]; onOpenContext: (id: string) => void; onRemoveContext: (id: string) => Promise<void>;
  fbdBatches: FbdBatch[]; onOpenFbd: (batchId: string) => void; onRemoveFbd: (id: string) => Promise<void>;
  batches: HistoricalIbImportBatch[]; priceBatches: PriceHistoryBatch[]; removeConfirmationId: string | null;
  onBeginRemove: (id: string) => void; onCancelRemove: () => void; onConfirmRemove: (id: string) => void;
  onRemovePrice: (id: string) => Promise<void>; onOpenPrices: (batchId: string) => void; onOpenDaily: (batchId: string) => void;
}) {
  const [priceRemoval, setPriceRemoval] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const entries: Entry[] = [...contextBatches.map(batch => ({ kind: 'context' as const, batch })), ...batches.map(batch => ({ kind: 'daily' as const, batch })),
    ...priceBatches.map(batch => ({ kind: 'price' as const, batch })), ...fbdBatches.map(batch => ({ kind: 'fbd' as const, batch }))];
  entries.sort((a, b) => b.batch.importedAt.localeCompare(a.batch.importedAt) || a.batch.id.localeCompare(b.batch.id));
  const available = new Set([...entries.map(e => e.batch.id), ...levelIds]);
  const managed = new Set(monthlyPacks.flatMap(p => p.managedBatchIds));
  const standalone = entries.filter(e => !managed.has(e.batch.id));
  const earlierFiles = <div className="imported-history-list">{standalone.map(entry => {
      if (entry.kind === 'context') return <ImportedContextEntry key={`context:${entry.batch.id}`} batch={entry.batch} onOpen={onOpenContext} onRemove={onRemoveContext} />;
      if (entry.kind === 'fbd') return <ImportedFbdEntry key={`fbd:${entry.batch.id}`} batch={entry.batch} onOpen={onOpenFbd} onRemove={onRemoveFbd} />;
      const batch = entry.batch, daily = entry.kind === 'daily' ? entry.batch : null, prices = entry.kind === 'price' ? entry.batch : null;
      const cohort = prices?.info.cohort ?? daily!.cohort;
      const title = packTitle(prices ? 'price' : 'daily', prices?.info.instrument ?? daily?.studyPack?.instrument);
      const dates = prices ? packDates(prices.days[0].date, prices.days.at(-1)!.date)
        : daily!.studyPack ? packDates(daily!.studyPack.coverage.firstDate, daily!.studyPack.coverage.lastDate) : daily!.years.join(', ');
      return <article key={`${entry.kind}:${batch.id}`} data-history-kind={entry.kind}>
        <details className="imported-history-entry">
          <summary><strong>{title}</strong>
            <span>{dates}</span><small className="pack-data-group">{studyGroupLabel(cohort)}</small></summary>
          <div className="imported-history-content">
            {prices ? <>
              <p>{packTypes.price.description} {cohort === 'REFERENCE'
                ? 'Eligible paths support the changing IB outlook when paired with matching IB history.'
                : 'These paths are saved for comparison and kept separate from forecast learning.'}</p>
              <p>{prices.days.length} days · {prices.days.filter(day => day.rthMissing > 0).length} with RTH gaps</p>
              <button type="button" onClick={() => onOpenPrices(batch.id)}>View pack days</button>
              <details className="imported-history-source"><summary>Source details</summary>
                <p>Original title: {prices.info.title}</p><p>Version {prices.info.version}</p>
                <p>{prices.info.source}</p><p>Contracts: {[...new Set(prices.info.sources.map(source => source.contract))].join(', ')}</p>
                {prices.info.notes.map((note, i) => <p key={i}>{note}</p>)}
                <p>Data group: {studyGroupLabel(cohort)}</p><p>File: {batch.sourceFileName}</p><p>Imported {new Date(batch.importedAt).toLocaleString()}</p>
              </details>
              {priceRemoval !== batch.id ? <button type="button" className="history-remove" onClick={() => setPriceRemoval(batch.id)}>Remove Price Action Pack</button> : <div className="historical-remove-confirmation" role="group" aria-label="Confirm Price Action Pack removal">
                <strong className="confirmation-target">{title} · {dates}</strong>
                <p>Remove these imported price paths? Daily IB history and your journal entries stay saved.</p>
                <button type="button" disabled={busy} onClick={() => { setBusy(true); void onRemovePrice(batch.id).then(() => setPriceRemoval(null)).finally(() => setBusy(false)); }}>Confirm removal</button>
                <button type="button" disabled={busy} onClick={() => setPriceRemoval(null)}>Keep pack</button>
              </div>}
            </> : <>
              <p>{packTypes.daily.description}</p>
              <p>{ibForecastUse(cohort)}</p>
              <p>{daily!.rowCount} rows · {daily!.completeRowCount} complete · {daily!.missingRowCount} with missing data</p>
              {daily!.studyPack && <>
                <p>{daily!.studyPack.coverage.openingRangeRows} days include overnight and 15R inputs.</p></>}
              <button type="button" onClick={() => onOpenDaily(batch.id)}>View pack days</button>
              <details className="imported-history-source"><summary>Source details</summary>
                {daily!.studyPack && <><p>Original title: {daily!.studyPack.title}</p><p>Version {daily!.studyPack.version}</p><p>{daily!.studyPack.source}</p><p>Contracts: {daily!.studyPack.coverage.contracts.join(', ') || 'Not supplied'}</p>
                  {daily!.studyPack.notes.map((note, i) => <p key={i}>{note}</p>)}</>}
                <p>Data group: {studyGroupLabel(cohort)}</p><p>File: {batch.sourceFileName}</p><p>Imported {new Date(batch.importedAt).toLocaleString()}</p>
              </details>
              {removeConfirmationId === batch.id ? <div className="historical-remove-confirmation" role="group" aria-label="Confirm IB Pack removal">
                <strong className="confirmation-target">{title} · {dates}</strong>
                <p>Remove this IB Pack and its imported days?</p>
                <p>Your journal entries and saved forecasts stay saved.</p>
                <button type="button" onClick={() => onConfirmRemove(batch.id)}>Remove IB Pack</button>
                <button type="button" onClick={onCancelRemove}>Cancel</button>
              </div> : <button type="button" className="history-remove" onClick={() => onBeginRemove(batch.id)}>Remove</button>}
            </>}
          </div>
        </details>
      </article>;
    })}</div>;
  return <section className="imported-history-batches" aria-label="Your packs">
    <h3>Your packs <span>({monthlyPacks.length + standalone.length})</span></h3>
    {entries.length || monthlyPacks.length ? <p>Study material saved in this journal. Open a pack to explore it.</p>
      : <p>No packs added yet.</p>}
    {monthlyPacks.length > 0 && <InstalledMonthlyPacks packs={monthlyPacks} availableBatchIds={available} onRemove={onRemoveMonthly!}
      onViewDays={onViewDays!} onViewLevels={onOpenFbd} onViewReferences={onViewReferences!} />}
    {monthlyPacks.length && standalone.length ? <details className="monthly-pack-details"><summary>Earlier files · {standalone.length}</summary>
      <p>These files remain installed. Monthly packs reuse matching material.</p>{earlierFiles}</details> : earlierFiles}
  </section>;
}
