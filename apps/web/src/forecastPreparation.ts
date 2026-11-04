// SPDX-License-Identifier: MPL-2.0
import { contextCompatibility, fbdCompatibility, priceHistoryCompatibility, forecastPriceAnchor,
  projectForecastPriceReference, type ForecastPriceReference, type PriceHistoryBatch, type JournalSession,
  type ForecastPackLibrary, type ForecastPackScope, type ForecastSnapshot, type HistoricalIbSession } from '@ib-field-notes/domain';
import type { JournalRepository } from '@ib-field-notes/storage-port';

const referenceCaches = new WeakMap<JournalRepository, Map<string, Promise<ForecastPriceReference | null>>>();
/** Cache compact projections, never all raw minute days. Four sequential lanes
 * bound SQLite work; navigating or entering another CP reuses completed reads. */
export async function loadForecastReferencePrices(repository: JournalRepository, session: JournalSession,
  historical: HistoricalIbSession[], batches: PriceHistoryBatch[], now: string): Promise<ForecastPriceReference[]> {
  let cache = referenceCaches.get(repository);
  if (!cache) { cache = new Map(); referenceCaches.set(repository, cache); }
  const dates = new Set(historical.filter(r => r.cohort === 'REFERENCE' && (r.journalId ?? 'es') === session.journalId &&
    r.rthDate < session.rthDate && Date.parse(r.importedAt) <= Date.parse(now)).map(r => r.rthDate));
  const candidates = batches.filter(b => b.journalId === session.journalId && b.info.cohort === 'REFERENCE' &&
    Date.parse(b.importedAt) <= Date.parse(now) && !priceHistoryCompatibility(b.info, session.market).error)
    .flatMap(batch => batch.days.filter(d => dates.has(d.date) && Date.parse(d.end) <= Date.parse(now))
      .map(day => ({ batch, date: day.date })));
  const active = new Set(candidates.map(c => `${session.journalId}:${JSON.stringify(session.market)}:${c.batch.id}:${c.batch.contentSha256}:${c.date}`));
  // Pack removal stops use immediately and releases its cached projections.
  for (const key of cache.keys()) if (!active.has(key)) cache.delete(key);
  const results: ForecastPriceReference[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
    while (next < candidates.length) {
      const c = candidates[next++]!, key = `${session.journalId}:${JSON.stringify(session.market)}:${c.batch.id}:${c.batch.contentSha256}:${c.date}`;
      let pending = cache!.get(key);
      if (!pending) {
        pending = repository.getPriceHistoryDay(c.batch.id, c.date)
          .then(day => day ? projectForecastPriceReference(c.batch, day, session, now) : null);
        cache!.set(key, pending);
        void pending.catch(() => { if (cache!.get(key) === pending) cache!.delete(key); });
      }
      const projected = await pending;
      if (projected) results.push(projected);
    }
  }));
  return results.sort((a, b) => a.path.date.localeCompare(b.path.date) || a.batch.id.localeCompare(b.batch.id));
}

export async function loadForecastPacks(repository: JournalRepository, historical: HistoricalIbSession[], scope: ForecastPackScope) {
  const [newsBatches, lowBatches, priceBatches] = await Promise.all([
    repository.listContextBatches(), repository.listFbdBatches(), repository.listPriceHistoryBatches(),
  ]);
  const eligible = (b: { journalId: string; importedAt: string; info: { cohort: string } }) =>
    b.journalId === scope.journalId && b.info.cohort === 'REFERENCE' && Date.parse(b.importedAt) <= Date.parse(scope.now);
  const news = newsBatches.filter(b => eligible(b) && !contextCompatibility(b.info, scope.template).error);
  const lows = await Promise.all(lowBatches.filter(b => eligible(b) && !fbdCompatibility(b.info, scope.template).error)
    .map(async batch => ({ batch, lows: await repository.getFbdLows(batch.id) })));
  const dates = new Set(historical.filter(row => row.cohort === 'REFERENCE').map(row => row.rthDate));
  const prices = (await Promise.all(priceBatches.filter(b => eligible(b) && !priceHistoryCompatibility(b.info, scope.template).error)
    .flatMap(batch => batch.days.filter(day => dates.has(day.date)).map(async day => {
      const data = await repository.getPriceHistoryDay(batch.id, day.date);
      return data ? forecastPriceAnchor(batch, data) : null;
    })))).filter(anchor => anchor !== null);
  const library: ForecastPackLibrary = { news, lows, prices };
  const sources: NonNullable<ForecastSnapshot['packSupport']>['sources'] =
    [...news, ...lows.map(p => p.batch), ...prices.map(p => p.batch)]
      .filter((batch, i, all) => all.findIndex(b => b.id === batch.id) === i)
      .map(({ id, contentSha256, importedAt }) => ({ id, contentSha256, importedAt }));
  return { library, sources };
}
