// SPDX-License-Identifier: MPL-2.0
import { assembleForecastReferences, extendLearningPaths,studyPackCompatibility, unpackMarketMemoryLibrary,
  type BestFitPathLibrary, type PackedMarketMemoryLibrary,
  type AuctionReferenceLibrary } from '@ib-field-notes/domain';

type Input = Parameters<typeof assembleForecastReferences>[0];
let inputs: Input | null = null;
let latest = 0;
let pending: Promise<void> = Promise.resolve();
let bundled: Promise<Pick<Input, 'bundledPaths' | 'bundledMemory' | 'bundledAuction'>> | null = null;
function loadBundled() {
  if (import.meta.env.MODE === 'beta-rehearsal' || import.meta.env.MODE === 'public-blank') return Promise.resolve({ bundledPaths: null, bundledMemory: null, bundledAuction: null });
  bundled ??= Promise.all([
    import('./data/es-ib-path-reference.json').then(async d => extendLearningPaths(d.default as BestFitPathLibrary,
      await import('./data/es-ib-learning-2026-reference.json').then(extra=>extra.default as BestFitPathLibrary).catch(()=>null))).catch(() => null),
    import('./data/es-market-memory-reference.json').then(d => unpackMarketMemoryLibrary(d.default as unknown as PackedMarketMemoryLibrary)).catch(() => null),
    import('./data/es-auction-range-reference.json').then(d => d.default as unknown as AuctionReferenceLibrary).catch(() => null),
  ]).then(([bundledPaths, bundledMemory, bundledAuction]) => ({ bundledPaths, bundledMemory, bundledAuction }));
  return bundled;
}
self.onmessage = (event: MessageEvent<{ id: number; inputs?: Input; minute: number; now: string }>) => {
  const message = event.data; latest = message.id;
  pending=pending.then(async()=>{
    try {
      if (message.inputs) {
        const base = studyPackCompatibility({ instrument: 'MES' }, message.inputs.session.market).error ? {} : await loadBundled();
        inputs = { ...message.inputs, ...base };
      }
      if (message.id !== latest) return;
      if (!inputs) throw new Error('Forecast reference history is not ready.');
      const references = assembleForecastReferences({ ...inputs, minute: message.minute, now: message.now });
      // Only the latest usable summary is needed in the UI; keep full data/cache here.
      references.memoryLibrary.days = references.memoryLibrary.days.map(d => ({ ...d,
        snapshots: d.snapshots.filter(s => s.minute <= message.minute).slice(-1) }));
      self.postMessage({ id: message.id, references });
    } catch {
      self.postMessage({ id: message.id, error: 'Some forecast history could not be prepared. Broader IB history is still available.' });
    }
  });
};
