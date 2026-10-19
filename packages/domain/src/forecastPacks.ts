// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { HistoricalIbSession, StudyTemplate } from './index';
import type { ContextBatch } from './contextHistory';
import { contextCompatibility } from './contextHistory';
import type { FbdBatch, HistoricalLow } from './fbdHistory';
import { fbdCompatibility } from './fbdHistory';
import type { PriceHistoryBatch, PriceHistoryDay } from './priceHistory';
import { priceHistoryCompatibility } from './priceHistory';
import type { ForecastExample, ForecastFactor } from './forecast';
import { newsCategory } from './forecast';
import { memoryContractMatches } from './marketMemory';

export type ForecastPackEvidence = { batchIds: string[]; sourceIds: string[] };
export type ForecastPriceAnchor = {
  batch: PriceHistoryBatch; date: string; contract: string; knownAt: string;
  price: number; high: number; low: number;
};
export type ForecastPackLibrary = {
  news: ContextBatch[];
  lows: Array<{ batch: FbdBatch; lows: HistoricalLow[] }>;
  prices: ForecastPriceAnchor[];
};
export type ForecastPackScope = { journalId: string; template: StudyTemplate; now: string;
  // The saved original defaults to 15R. The changing view supplies its relative minute.
  checkpointAt?: (date: string) => string };

const millis = (at: string) => Date.parse(at);
// Most instants differ by whole milliseconds. Preserve source microseconds at boundaries.
function compareTime(a: string, b: string): number {
  const difference = millis(a) - millis(b);
  return difference ? Math.sign(difference) : Temporal.Instant.compare(a, b);
}
export function forecastPackCheckpoint(date: string, template: StudyTemplate): string {
  let day = Temporal.PlainDate.from(date);
  if (Temporal.PlainTime.compare(Temporal.PlainTime.from(template.checkpoints.fifteenMinuteLock),
    Temporal.PlainTime.from(template.checkpoints.overnightLock)) < 0) day = day.add({ days: 1 });
  return day.toZonedDateTime({ timeZone: template.canonicalTimeZone,
    plainTime: template.checkpoints.fifteenMinuteLock }).toInstant().toString();
}

/** Summarize only the completed opening 15 minutes. Later range/path data is ignored. */
export function forecastPriceAnchor(batch: PriceHistoryBatch, day: PriceHistoryDay): ForecastPriceAnchor | null {
  const lock = millis(day.summary.fifteenAt), open = millis(day.summary.openAt);
  const minutes = day.minutes.filter(m => millis(m.at) >= open && millis(m.at) + 60_000 <= lock);
  if (minutes.length !== 15 || minutes.some((m, i) => millis(m.at) !== open + i * 60_000 ||
    m.close === null || m.high === null || m.low === null)) return null;
  return { batch, date: day.summary.date, contract: day.summary.contract, knownAt: day.summary.fifteenAt,
    price: minutes.at(-1)!.close!, high: Math.max(...minutes.map(m => m.high!)), low: Math.min(...minutes.map(m => m.low!)) };
}

/** Reconstruct observed context at the checkpoint, never source-cutoff status or future outcomes. */
export function enrichForecastExamples(examples: ForecastExample[], historical: HistoricalIbSession[],
  library: ForecastPackLibrary, scope: ForecastPackScope,
  cohort: 'REFERENCE' | 'FORWARD_OBSERVATION' = 'REFERENCE'): ForecastExample[] {
  const rows = new Map(historical.filter(r => r.cohort === cohort).map(r => [r.id, r]));
  const eligible = (b: { journalId: string; importedAt: string; info: { cohort: string } }) =>
    b.journalId === scope.journalId && b.info.cohort === cohort && compareTime(b.importedAt, scope.now) <= 0;
  const news = library.news.filter(b => eligible(b) && !contextCompatibility(b.info, scope.template).error);
  const lows = library.lows.filter(p => p.batch.info.definition === 'strict-1h-first-flush-v1' && eligible(p.batch) && !fbdCompatibility(p.batch.info, scope.template).error);
  const prices = library.prices.filter(p => eligible(p.batch) && !priceHistoryCompatibility(p.batch.info, scope.template).error);
  return examples.map(example => {
    const row = rows.get(example.id);
    if (!row?.forecastInputs) return example; // Local snapshots retain their explicitly recorded context.
    const asOf = scope.checkpointAt?.(row.rthDate) ?? forecastPackCheckpoint(row.rthDate, scope.template), cutoff = millis(asOf);
    const context = { ...example.context }, evidence: Partial<Record<ForecastFactor | 'price', ForecastPackEvidence>> = {};
    const events = news.flatMap(batch => batch.events.filter(e => !e.holiday && e.sessionDate === row.rthDate && compareTime(e.eventAt, asOf) <= 0)
      .map(event => ({ batch, event })));
    if (events.length) {
      context.news = [...new Set(events.map(e => newsCategory(e.event.name)))].sort().join('+');
      evidence.news = { batchIds: [...new Set(events.map(e => e.batch.id))].sort(), sourceIds: events.map(e => e.event.id).sort() };
    }
    // Missing dates in these positive-event catalogues cannot establish NONE.
    const sameContract = lows.flatMap(pack => pack.lows.filter(low => memoryContractMatches(low.contract,row.contract,Number(row.sourceYear)) &&
      compareTime(low.qualifiedAt, asOf) <= 0 && compareTime(low.pivotKnownAt, asOf) <= 0 && compareTime(low.cutoffAt, asOf) >= 0)
      .map(low => ({ batch: pack.batch, low, all: pack.lows })));
    const anchor = prices.filter(p => p.date === row.rthDate && memoryContractMatches(p.contract,row.contract,Number(row.sourceYear)) && compareTime(p.knownAt, asOf) <= 0 &&
      p.high === row.forecastInputs!.fifteenHigh && p.low === row.forecastInputs!.fifteenLow)
      .sort((a, b) => b.knownAt.localeCompare(a.knownAt) || a.batch.id.localeCompare(b.batch.id))[0];
    const price = anchor?.price ?? (row.forecastInputs.fifteenHigh + row.forecastInputs.fifteenLow) / 2;
    const untouched = sameContract.filter(({ low }) => (!low.flushAt || compareTime(low.flushAt, asOf) > 0) && low.price <= price)
      .sort((a, b) => b.low.price - a.low.price || a.low.id.localeCompare(b.low.id));
    if (untouched.length) {
      const { batch, low } = untouched[0], distance = (price - low.price) / example.features.fifteenWidth;
      context.levels = distance <= 1 ? 'WITHIN_1_RANGE' : distance <= 3 ? 'WITHIN_3_RANGES' : 'FARTHER';
      evidence.levels = { batchIds: [batch.id], sourceIds: [low.id] };
      if (anchor) evidence.price = { batchIds: [anchor.batch.id], sourceIds: [anchor.date] };
    }
    // Reclaim alone is insufficient. Require independent 20+ rise qualification of the flushing low.
    const episodes = sameContract.flatMap(({ batch, low, all }) => {
      const episode = low.episode;
      if (!low.flushAt || !episode?.reclaimAt || compareTime(episode.reclaimAt, asOf) > 0 ||
        compareTime(episode.lowAt, asOf) > 0 || !episode.replacementId) return [];
      const replacement = all.find(l => l.id === episode.replacementId && memoryContractMatches(l.contract,row.contract,Number(row.sourceYear)));
      if (!replacement || compareTime(replacement.qualifiedAt, asOf) > 0 || compareTime(replacement.pivotKnownAt, asOf) > 0 ||
        replacement.price !== episode.low || replacement.confirmationPrice - replacement.price < batch.info.qualificationPoints) return [];
      const knownAt = [episode.reclaimAt, replacement.qualifiedAt, replacement.pivotKnownAt]
        .sort(compareTime).at(-1)!;
      return compareTime(knownAt, new Date(cutoff - 7 * 86_400_000).toISOString()) >= 0 ? [{ batch, low, knownAt }] : [];
    });
    if (episodes.length) {
      context.fbd = episodes.some(e => compareTime(e.knownAt, new Date(cutoff - 86_400_000).toISOString()) >= 0) ? 'WITHIN_24H' : 'WITHIN_7D';
      evidence.fbd = { batchIds: [...new Set(episodes.map(e => e.batch.id))].sort(), sourceIds: episodes.map(e => e.low.id).sort() };
    }
    return Object.keys(evidence).length ? { ...example, context, packEvidence: evidence } : example;
  });
}
