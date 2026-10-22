// SPDX-License-Identifier: MPL-2.0
// Fixed 15R estimator. No outcome from the forecast date enters its training set.
import {
  deriveClosingOutcome, deriveSessionFinalIb, deriveSessionRecordedIb,
  type DayType, type HistoricalIbSession, type HistoricalIbImportBatch, type JournalSession, type SignificantLevel,
} from "./index";
import { Temporal } from '@js-temporal/polyfill';
import { studyPackCompatibility } from './studyPack';
import { replayLevelApplies } from './journalReplay';

export const FORECAST_MODEL_VERSION = "15r-recorded-context-v3";
export type CoverageState = "unknown" | "reviewed" | "none";
export type ForecastCoverage = Record<"news" | "fbd" | "levels", CoverageState>;
export type ForecastFactor = "news" | "fbd" | "levels" | "quarter" | "weekday";
export const FORECAST_FACTORS: ForecastFactor[] = ["news", "fbd", "levels", "quarter", "weekday"];
type Context = Record<ForecastFactor, string | null>;
export type ForecastFeatures = {
  onWidth: number; fifteenWidth: number; priorWidth: number;
  openingPosition: number; priorClosePosition: number; priorType: DayType;
};
export type ForecastPriorDay = {
  rthDate: string; journalId: string; instrument: string;
  high: number; low: number; close: number; dayType: DayType; availableAt: string;
  source: { kind: 'journal'; sessionId: string } | {
    kind: 'import'; rowId: string; batchId: string; contentSha256: string;
    cohort: HistoricalIbSession['cohort']; sourceFileName: string; instrument: string | null; contract: string | null;
  };
};
// Joint outcomes keep the day-type and first-break probabilities consistent.
const JOINT = ["HIGH_ONLY", "LOW_ONLY", "HIGH_THEN_BOTH", "LOW_THEN_BOTH", "NEITHER"] as const;
type Joint = typeof JOINT[number];
export type ForecastExample = {
  id: string; date: string; source: "reference" | "local"; batchId: string | null;
  availableAt: string; predictedAt?: string; features: ForecastFeatures; context: Context;
  outcome: Joint; finalWidth: number;
  packEvidence?: Partial<Record<ForecastFactor | 'price', import('./forecastPacks').ForecastPackEvidence>>;
};
export type ForecastEstimate = {
  dayType: Record<DayType, number>;
  firstBreak: Record<"IBH" | "IBL" | "none", number>;
  width: { median: number; low: number; high: number };
};
export type ForecastFactorReport = {
  factor: ForecastFactor; matchingDays: number; evaluatedDays: number;
  brierImprovement: number | null; widthImprovement: number | null;
  probabilityUsed: boolean; widthUsed: boolean;
};
export type ForecastValidation = {
  days: number; brier: number | null; baselineBrier: number | null;
  analogBrier: number | null;
  probabilityModel: "historical" | "analog"; widthModel: "historical" | "analog";
  contextCheck?: {
    probabilityDays: number; widthDays: number; brier: number | null; baselineBrier: number | null;
    widthError: number | null; baselineWidthError: number | null; probabilityUsed: boolean; widthUsed: boolean;
  };
};
export type ForecastSnapshot = {
  version: 1; modelVersion: string; issuedAt: string; asOf: string; tickSize: number;
  mode: "live" | "replay"; priorDate: string; features: ForecastFeatures;
  priorDay?: ForecastPriorDay;
  coverage: ForecastCoverage; context: Context;
  contextCapture?: 'recorded';
  contextWarnings: string[];
  contextSourceIds: Record<"news" | "fbd" | "levels", string[]>;
  estimate: ForecastEstimate | null;
  referenceDays: number; localDays: number; referenceBatchIds: string[];
  localSourceVersions: Array<{ id: string; availableAt: string }>;
  factors: ForecastFactorReport[];
  validation: ForecastValidation;
  packSupport?: {
    enrichedDays: number; newsDays: number; fbdDays: number; lowDays: number; priceDays: number;
    sources: Array<{ id: string; contentSha256: string; importedAt: string }>;
  };
};

function time(value: string | null | undefined): number { return value ? Date.parse(value) : NaN; }
function finite(value: number | null | undefined): value is number { return typeof value === "number" && Number.isFinite(value); }
function contextForDate(date: string): Context {
  return { news: null, fbd: null, levels: null,
    quarter: `Q${Math.ceil(Number(date.slice(5, 7)) / 3)}`,
    weekday: String(new Date(`${date}T12:00:00Z`).getUTCDay()) };
}
function joint(day: DayType | null, first: string | null): Joint | null {
  if (day === "IBN" && !first) return "NEITHER";
  if (day === "IBH" && first === "IBH") return "HIGH_ONLY";
  if (day === "IBL" && first === "IBL") return "LOW_ONLY";
  if (day === "IBB" && first === "IBH") return "HIGH_THEN_BOTH";
  if (day === "IBB" && first === "IBL") return "LOW_THEN_BOTH";
  return null;
}

export function forecastActual(session: JournalSession, tickSize = session.forecast?.tickSize ?? session.market.tickSize) {
  const ib = deriveSessionRecordedIb(session);
  const width = ib?.high !== null && ib?.low !== null && ib ? ib.high! - ib.low! : null;
  const closed = Boolean(session.close.finishedAt);
  const outcome = deriveClosingOutcome(session, ib, tickSize);
  let complete = closed && session.close.pathComplete && outcome?.status === "final";
  if (ib && outcome && finite(session.close.rthHigh) && finite(session.close.rthLow)) {
    complete = complete && (session.close.rthHigh >= ib.high! + tickSize - 1e-9) === outcome.highBreakRecorded &&
      (session.close.rthLow <= ib.low! - tickSize + 1e-9) === outcome.lowBreakRecorded;
  }
  const prices = [...session.rthObservations];
  if (session.close.price !== null && session.close.observedAt) {
    prices.push({ id: "forecast-close", price: session.close.price,
      observedAt: session.close.observedAt, recordedAt: session.close.recordedAt ?? "",
      note: null, cpObservationId: null });
  }
  prices.sort((a, b) => time(a.observedAt) - time(b.observedAt));
  const breaks = ib ? prices.filter((p) => p.price >= ib.high! + tickSize - 1e-9 || p.price <= ib.low! - tickSize + 1e-9) : [];
  const first = breaks[0];
  const ambiguous = first && ib && breaks.some((p) => time(p.observedAt) === time(first.observedAt) &&
    (p.price > ib.high!) !== (first.price > ib.high!));
  const firstBreak = complete && ib && !ambiguous
    ? first ? first.price > ib.high! ? "IBH" as const : "IBL" as const : "none" as const
    : null;
  const dayType = complete ? outcome?.dayType ?? null : null;
  return { closed, complete, width, dayType, firstBreak,
    joint: joint(dayType, firstBreak === "none" ? null : firstBreak) };
}

function features(onHigh: number, onLow: number, high: number, low: number,
  priorHigh: number, priorLow: number, priorClose: number, priorType: DayType): ForecastFeatures | null {
  const onWidth = onHigh - onLow, fifteenWidth = high - low, priorWidth = priorHigh - priorLow;
  if (![onHigh, onLow, high, low, priorHigh, priorLow, priorClose].every(Number.isFinite) ||
      onWidth <= 0 || fifteenWidth <= 0 || priorWidth <= 0) return null;
  return { onWidth, fifteenWidth, priorWidth, openingPosition: ((high + low) / 2 - onLow) / onWidth,
    priorClosePosition: (priorClose - priorLow) / priorWidth, priorType };
}

function journalPriorDay(prior: JournalSession): ForecastPriorDay | null {
  const actual = forecastActual(prior), ib = deriveSessionFinalIb(prior);
  if (!ib || !finite(prior.close.price) || !finite(ib.high) || !finite(ib.low) ||
    ib.high <= ib.low || !Number.isFinite(time(prior.close.finishedAt))) return null;
  // Reviewed daily extrema establish the prior day's broad outcome without
  // establishing an unseen first-break/return sequence or a complete path.
  const {rthHigh,rthLow}=prior.close,tick=prior.market.tickSize;
  const reviewedRange=finite(rthHigh)&&finite(rthLow)&&rthHigh>=ib.high&&rthLow<=ib.low&&
    prior.close.price<=rthHigh&&prior.close.price>=rthLow&&
    prior.rthObservations.every(p=>p.price<=rthHigh&&p.price>=rthLow);
  const high=reviewedRange&&rthHigh!>=ib.high+tick-1e-9,low=reviewedRange&&rthLow!<=ib.low-tick+1e-9;
  const dayType=actual.complete?actual.dayType:reviewedRange?high?(low?'IBB':'IBH'):low?'IBL':'IBN':null;
  if(!dayType)return null;
  return { rthDate: prior.rthDate, journalId: prior.journalId, instrument: prior.instrument,
    high: ib.high, low: ib.low, close: prior.close.price, dayType,
    availableAt: prior.close.finishedAt!, source: { kind: 'journal', sessionId: prior.id } };
}
const priorDay = (prior: JournalSession | ForecastPriorDay | null) =>
  prior ? 'source' in prior ? prior : journalPriorDay(prior) : null;

function samePrior(a: ForecastPriorDay, b: ForecastPriorDay): boolean {
  if (a.rthDate !== b.rthDate || a.journalId !== b.journalId || a.instrument !== b.instrument ||
      a.high !== b.high || a.low !== b.low || a.close !== b.close || a.dayType !== b.dayType) return false;
  return a.source.kind === 'journal' && b.source.kind === 'journal' ? a.source.sessionId === b.source.sessionId
    : a.source.kind === 'import' && b.source.kind === 'import' && a.source.rowId === b.source.rowId &&
      a.source.batchId === b.source.batchId && a.source.contentSha256 === b.source.contentSha256 && a.source.cohort === b.source.cohort;
}

/** Read-only prior-day inputs. Imported comparison outcomes never become training rows here. */
export function resolveForecastPrior(args: {
  session: JournalSession; sessions: JournalSession[]; historical: HistoricalIbSession[];
  batches: HistoricalIbImportBatch[]; previousDate: (date: string) => string; now: string;
  expected?: ForecastPriorDay;
}): ForecastPriorDay | null {
  const { session, expected } = args, date = args.previousDate(session.rthDate), now = time(args.now);
  if (!Number.isFinite(now) || date >= session.rthDate) return null;
  const valid = (value: ForecastPriorDay) => time(value.availableAt) <= now && (!expected || samePrior(value, expected));
  if (!expected || expected.source.kind === 'journal') {
    const candidates = args.sessions.filter(p => p.rthDate === date && p.journalId === session.journalId && p.instrument === session.instrument);
    for (const candidate of candidates) {
      const value = journalPriorDay(candidate);
      if (value && valid(value)) return value;
    }
    if (expected) return null; // Never silently switch the captured source after correction/removal.
  }
  const compatible = new Map(args.batches.filter(b => (b.journalId ?? 'es') === session.journalId &&
    Number.isFinite(time(b.importedAt)) && time(b.importedAt) <= now &&
    !studyPackCompatibility(b.studyPack ?? { instrument: session.instrument }, session.market).error).map(b => [b.id, b]));
  const candidates = args.historical.filter(row => row.rthDate === date && (row.journalId ?? 'es') === session.journalId)
    .sort((a, b) => Number(b.cohort === 'REFERENCE') - Number(a.cohort === 'REFERENCE') || a.id.localeCompare(b.id));
  // Daily IB CSVs declare this study clock; even an imported close must have happened already.
  const closeAt = Temporal.PlainDate.from(date).toZonedDateTime({ timeZone: session.market.canonicalTimeZone,
    plainTime: session.market.checkpoints.studyClose }).toInstant().toString();
  for (const row of candidates) {
    const batch = compatible.get(row.batchId);
    if (!batch || batch.cohort !== row.cohort || row.status !== 'OK' || !row.dayType || !finite(row.rthClose) ||
      !finite(row.lockedIbh) || !finite(row.lockedIbl) || !finite(row.lockedIbWidthPoints) || row.lockedIbh <= row.lockedIbl ||
      Math.abs(row.lockedIbh - row.lockedIbl - row.lockedIbWidthPoints) > 1e-8 || !Number.isFinite(time(row.importedAt))) continue;
    const availableAt = [row.importedAt, batch.importedAt, closeAt].sort((a, b) => time(a) - time(b)).at(-1)!;
    const value: ForecastPriorDay = { rthDate: date, journalId: session.journalId, instrument: session.instrument,
      high: row.lockedIbh, low: row.lockedIbl, close: row.rthClose, dayType: row.dayType, availableAt,
      source: { kind: 'import', rowId: row.id, batchId: batch.id, contentSha256: batch.contentSha256,
        cohort: row.cohort, sourceFileName: batch.sourceFileName, instrument: batch.studyPack?.instrument ?? null, contract: row.contract } };
    if (valid(value)) return value;
  }
  return null;
}

export function forecastFeaturesForSession(session: JournalSession, supplied: JournalSession | ForecastPriorDay | null): ForecastFeatures | null {
  const prior = priorDay(supplied);
  if (!prior || prior.rthDate >= session.rthDate || session.journalId !== prior.journalId || session.instrument !== prior.instrument || session.overnight.status !== "confirmed" ||
      session.fifteenMinute.status !== "confirmed") return null;
  const { high: oh, low: ol } = session.overnight;
  const { high: h, low: l } = session.fifteenMinute;
  if (![oh, ol, h, l, prior.high, prior.low, prior.close].every(finite)) return null;
  return features(oh!, ol!, h!, l!, prior.high, prior.low, prior.close, prior.dayType);
}

/** Evaluation targets are separate from the reference-only training builder. */
export function buildForecastEvaluationExamples(historical: HistoricalIbSession[], previousDate: (date: string) => string): ForecastExample[] {
  return historicalExamples(historical, previousDate, 'FORWARD_OBSERVATION');
}

function historicalExamples(historical: HistoricalIbSession[], previousDate: (date: string) => string,
  cohort: 'REFERENCE' | 'FORWARD_OBSERVATION'): ForecastExample[] {
  const examples: ForecastExample[] = [];
  const reference = historical.filter((row) => row.cohort === cohort);
  const byDate = new Map(historical.filter(row => row.cohort === cohort || row.cohort === 'REFERENCE').map(row => [row.rthDate, row]));
  for (const row of reference) {
    const prior = byDate.get(previousDate(row.rthDate)), early = row.forecastInputs;
    const outcome = joint(row.dayType, row.firstBreakSide);
    if (row.status !== "OK" || !early || !prior || prior.status !== "OK" ||
        !prior.dayType || !finite(prior.rthClose) || !outcome) continue;
    const input = features(early.onHigh, early.onLow, early.fifteenHigh, early.fifteenLow,
      prior.lockedIbh, prior.lockedIbl, prior.rthClose, prior.dayType);
    if (!input || row.lockedIbWidthPoints < input.fifteenWidth) continue;
    examples.push({ id: row.id, date: row.rthDate, source: "reference", batchId: row.batchId,
      availableAt: row.importedAt, features: input, context: contextForDate(row.rthDate),
      outcome, finalWidth: row.lockedIbWidthPoints });
  }
  return examples;
}

export function buildForecastTraining(
  historical: HistoricalIbSession[], sessions: JournalSession[],
  previousDate: (date: string) => string,
  levels: SignificantLevel[] = [],
  batches: HistoricalIbImportBatch[] = [],
): ForecastExample[] {
  const examples = historicalExamples(historical.filter(row => row.cohort === 'REFERENCE'), previousDate, 'REFERENCE');
  for (const session of sessions) {
    const saved = session.forecast, actual = forecastActual(session);
    if (!saved || saved.mode !== "live" || !actual.complete || !actual.joint || !finite(actual.width) ||
        actual.width < saved.features.fifteenWidth) continue;
    // Corrections to the original ON/15R invalidate that training example, not its saved forecast.
    const prior = saved.priorDay ? resolveForecastPrior({ session, sessions, historical, batches, previousDate,
      now: saved.issuedAt, expected: saved.priorDay })
      : sessions.find((row) => row.rthDate === saved.priorDate && row.journalId === session.journalId && row.instrument === session.instrument) ?? null;
    const current = forecastFeaturesForSession(session, prior);
    if (!current || JSON.stringify(current) !== JSON.stringify(saved.features)) continue;
    // One instrument/day contributes once. An imported reference retains ownership of duplicate dates.
    if (examples.some((row) => row.date === session.rthDate)) continue;
    const context = { ...saved.context };
    const currentContext = captureForecastContext(session, levels, saved.asOf, saved.issuedAt,
      undefined, { recordedOnly: saved.contextCapture === 'recorded' });
    for (const factor of ["news", "fbd", "levels"] as const) {
      if (context[factor] !== currentContext.context[factor] ||
          JSON.stringify(saved.contextSourceIds[factor]) !== JSON.stringify(currentContext.ids[factor])) context[factor] = null;
    }
    // A reviewed comparison-pack event may describe the forecast day, but cannot train its news factor.
    if (session.marketContextItems.some(event => saved.contextSourceIds.news.includes(event.id) &&
      event.contextPack?.cohort === "FORWARD_OBSERVATION")) context.news = null;
    examples.push({ id: session.id, date: session.rthDate, source: "local", batchId: null,
      availableAt: session.updatedAt, predictedAt: saved.issuedAt, features: saved.features, context,
      outcome: actual.joint, finalWidth: actual.width });
  }
  return examples.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function newsCategory(name: string): string {
  const upper = name.toUpperCase();
  for (const category of ["CPI", "PPI", "FOMC", "NFP", "GDP", "PCE"]) {
    if (new RegExp(`\\b${category}\\b`).test(upper)) return category;
  }
  if (/PAYROLL/.test(upper)) return "NFP";
  if (/EARNING/.test(upper)) return "EARNINGS";
  return "OTHER";
}

export function captureForecastContext(session: JournalSession, levels: SignificantLevel[], asOf: string, now: string,
  observedPrice?: number, options: { positiveEvidence?: boolean; releasedOnly?: boolean; recordedOnly?: boolean } = {}) {
  const context = contextForDate(session.rthDate);
  const warnings: string[] = [];
  const ids: ForecastSnapshot["contextSourceIds"] = { news: [], fbd: [], levels: [] };
  const cutoff = time(asOf), issued = time(now);
  // New snapshots derive context from records. Old snapshots retain checklist semantics.
  const coverage: ForecastCoverage = options.recordedOnly
    ? { news: 'unknown', fbd: 'unknown', levels: 'unknown' } : session.forecastCoverage;
  const positiveEvidence = options.positiveEvidence || options.recordedOnly;
  const events = session.marketContextItems.filter((event) => !event.holiday && time(event.recordedAt) <= issued &&
    (!options.releasedOnly || event.eventDate === session.rthDate && time(event.eventAt) <= cutoff));
  // A checked holiday alone establishes neither timed news nor a quiet day.
  const holidayOnly = !events.length && session.marketContextItems.some(event => event.holiday &&
    time(event.recordedAt) <= issued && event.eventDate === session.rthDate);
  const newsCoverage = holidayOnly ? 'unknown' : positiveEvidence && events.length ? 'reviewed' : coverage.news;
  if (newsCoverage !== "unknown") {
    if ((newsCoverage === "none" && events.length) || (newsCoverage === "reviewed" && !events.length)) {
      warnings.push("News coverage and recorded events disagree; news remains unknown for this forecast.");
    } else {
      context.news = events.length ? [...new Set(events.map((event) => newsCategory(event.name)))].sort().join("+") : "NONE";
      ids.news = events.map((event) => event.id).sort();
    }
  }
  // IB/ON geometry already has dedicated inputs. Personal map choices must not
  // count the same range again as an independently supplied significant low.
  const eligible = levels.filter((level) => !level.sessionEdge && level.studyReplay?.kind !== 'BREAKOUT_BACKTEST' && level.instrument === session.instrument &&
    replayLevelApplies(level, session, asOf, now) &&
    level.currentStatus === "active" && time(level.createdAt) <= issued &&
    (level.originTimePrecision === "unknown" || time(level.originAt) <= cutoff));
  const episodes = levels.filter((level) => (!level.sessionEdge || level.sessionEdge.status === 'locked' && time(level.sessionEdge.availableAt) <= cutoff) && level.studyReplay?.kind !== 'BREAKOUT_BACKTEST' && level.instrument === session.instrument && level.currentStatus !== "removed")
    .flatMap((level) => level.episodes).filter((episode) => !episode.removedAt && episode.classification === "FBD" &&
      time(episode.confirmedAt) <= issued && time(episode.observedAt) <= cutoff &&
      time(episode.laterObservedAt) <= cutoff && time(episode.observedAt) >= cutoff - 7 * 86400000);
  const fbdCoverage = positiveEvidence && episodes.length ? 'reviewed' : coverage.fbd;
  if (fbdCoverage !== "unknown") {
    if ((fbdCoverage === "none" && episodes.length) || (fbdCoverage === "reviewed" && !episodes.length)) {
      warnings.push("FBD coverage and confirmed episodes disagree; FBD remains unknown for this forecast.");
    } else {
      context.fbd = episodes.length === 0 ? "NONE" : episodes.some((e) => time(e.observedAt) >= cutoff - 86400000) ? "WITHIN_24H" : "WITHIN_7D";
      ids.fbd = episodes.map((episode) => episode.id).sort();
    }
  }
  const levelCoverage = positiveEvidence && eligible.some(level => level.levelType === 'low') ? 'reviewed' : coverage.levels;
  if (levelCoverage !== "unknown") {
    const cp = observedPrice ?? session.fifteenMinute.cp ?? (session.fifteenMinute.high! + session.fifteenMinute.low!) / 2;
    const lows = eligible.filter((level) => level.levelType === "low").map((level) => ({ level,
      price: level.shape === "price_zone" ? level.zoneHigh : level.price }))
      .filter((entry) => finite(entry.price) && entry.price! <= cp).sort((a, b) => b.price! - a.price!);
    if ((levelCoverage === "none" && lows.length) || (levelCoverage === "reviewed" && !lows.length)) {
      warnings.push("Level coverage and recorded lows disagree; proximity remains unknown for this forecast.");
      return { context, ids, warnings };
    }
    const nearest = lows[0], width = session.fifteenMinute.high! - session.fifteenMinute.low!;
    context.levels = !nearest ? "NONE" : (cp - nearest.price!) / width <= 1 ? "WITHIN_1_RANGE" :
      (cp - nearest.price!) / width <= 3 ? "WITHIN_3_RANGES" : "FARTHER";
    ids.levels = nearest ? [nearest.level.id] : [];
  }
  return { context, ids, warnings };
}

type Weighted = { row: ForecastExample; weight: number };
type RawEstimate = { probabilities: number[]; widths: Array<{ value: number; weight: number }> };
export function forecastSimilarityDistance(a: ForecastFeatures, b: ForecastFeatures): number {
  const sq = (v: number) => v * v;
  return sq(Math.log(a.fifteenWidth / a.priorWidth) - Math.log(b.fifteenWidth / b.priorWidth)) +
    sq(Math.log(a.onWidth / a.priorWidth) - Math.log(b.onWidth / b.priorWidth)) +
    sq((a.openingPosition - b.openingPosition) / 0.5) +
    sq((a.priorClosePosition - b.priorClosePosition) / 0.75) + (a.priorType === b.priorType ? 0 : 1);
}
function empirical(rows: Weighted[], input: ForecastFeatures, prior?: number[]): RawEstimate {
  const counts = prior ? prior.map((p) => p * 20) : JOINT.map(() => 0.5);
  const widths: RawEstimate["widths"] = [];
  for (const { row, weight } of rows) {
    counts[JOINT.indexOf(row.outcome)] += weight;
    widths.push({ value: Math.max(input.fifteenWidth, input.fifteenWidth * row.finalWidth / row.features.fifteenWidth), weight });
  }
  const total = counts.reduce((sum, n) => sum + n, 0);
  return { probabilities: counts.map((n) => n / total), widths };
}
function baseEstimate(rows: ForecastExample[], input: ForecastFeatures): RawEstimate {
  const base = empirical(rows.map((row) => ({ row, weight: 1 })), input);
  const near = rows.map((row) => ({ row, distance: forecastSimilarityDistance(input, row.features) }))
    .sort((a, b) => a.distance - b.distance || a.row.id.localeCompare(b.row.id)).slice(0, 40);
  const weights = near.map(({ row, distance: d }) => ({ row, weight: 1 / (1 + d) }));
  const sum = weights.reduce((s, row) => s + row.weight, 0);
  const result = empirical(weights.map((entry) => ({ ...entry, weight: entry.weight * near.length / sum })), input, base.probabilities);
  // The width distribution also retains 20 effective days of the broader reference.
  result.widths.push(...base.widths.map((entry) => ({ ...entry, weight: entry.weight * 20 / rows.length })));
  return result;
}
function quantile(values: RawEstimate["widths"], p: number): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const target = p * sorted.reduce((sum, entry) => sum + entry.weight, 0);
  let total = 0;
  for (const entry of sorted) { total += entry.weight; if (total >= target) return entry.value; }
  return sorted.at(-1)!.value;
}
function brier(probabilities: number[], outcome: Joint): number {
  return probabilities.reduce((sum, p, i) => sum + (p - Number(JOINT[i] === outcome)) ** 2, 0);
}
function factorEstimate(rows: ForecastExample[], input: ForecastFeatures, base: RawEstimate): RawEstimate {
  const estimate = empirical(rows.map((row) => ({ row, weight: 1 })), input, base.probabilities);
  const total = base.widths.reduce((sum, entry) => sum + entry.weight, 0);
  estimate.widths.push(...base.widths.map((entry) => ({ ...entry, weight: entry.weight * 20 / total })));
  return estimate;
}

export function estimateForecast(rows: ForecastExample[], input: ForecastFeatures, context: Context) {
  rows = [...rows].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const scores = FORECAST_FACTORS.map((factor) => ({ factor, n: 0, baseBrier: 0, adjustedBrier: 0, baseWidth: 0, adjustedWidth: 0 }));
  let evaluated = 0, score = 0, baselineScore = 0, analogScore = 0, analogWidth = 0, baselineWidth = 0;
  const useAnalogProbabilities = () => evaluated >= 20 && (baselineScore - analogScore) / evaluated > 0.005;
  const useAnalogWidth = () => evaluated >= 20 && (baselineWidth - analogWidth) / evaluated > 0.01;
  const select = (analog: RawEstimate, historical: RawEstimate): RawEstimate => ({
    probabilities: useAnalogProbabilities() ? analog.probabilities : historical.probabilities,
    widths: useAnalogWidth() ? analog.widths : historical.widths,
  });
  let contextProbabilityDays = 0, contextWidthDays = 0, contextBrier = 0, contextBaseBrier = 0,
    contextWidthError = 0, contextBaseWidthError = 0;
  // Evaluate the combined policy with factor decisions made before each target outcome.
  const combined = (history: ForecastExample[], target: ForecastFeatures, targetContext: Context, base: RawEstimate) => {
    const probabilities = [base.probabilities], widths = [base.widths];
    for (const item of scores) {
      const value = targetContext[item.factor];
      if (value === null || item.n < 20) continue;
      const matching = history.filter(row => row.context[item.factor] === value);
      if (matching.length < 10) continue;
      const prob = (item.baseBrier - item.adjustedBrier) / item.n > 0.005;
      const width = (item.baseWidth - item.adjustedWidth) / item.n > 0.01;
      if (!prob && !width) continue;
      const adjusted = factorEstimate(matching, target, base);
      if (prob) probabilities.push(adjusted.probabilities);
      if (width) widths.push(adjusted.widths);
    }
    return { probabilities: JOINT.map((_, i) => probabilities.reduce((sum, p) => sum + p[i], 0) / probabilities.length),
      widths: widths.flatMap(values => {
        const total = values.reduce((sum, v) => sum + v.weight, 0);
        return values.map(v => ({ ...v, weight: v.weight / total / widths.length }));
      }), probabilityAdjusted: probabilities.length > 1, widthAdjusted: widths.length > 1 };
  };
  // Expanding-window evaluation. A row is predicted only with strictly earlier dates.
  for (let i = 60; i < rows.length; i++) {
    const target = rows[i], prior = rows.slice(0, i).filter((row) => row.date < target.date &&
      (row.source === "reference" || !target.predictedAt || time(row.availableAt) < time(target.predictedAt)));
    if (prior.length < 30) continue;
    const analog = baseEstimate(prior, target.features);
    const priorOnly = empirical(prior.map((row) => ({ row, weight: 1 })), target.features);
    // Selection at each evaluation date uses only scores already observed before that date.
    const prediction = select(analog, priorOnly);
    const candidate = combined(prior, target.features, target.context, prediction);
    if (candidate.probabilityAdjusted) {
      contextProbabilityDays++; contextBaseBrier += brier(prediction.probabilities, target.outcome);
      contextBrier += brier(candidate.probabilities, target.outcome);
    }
    if (candidate.widthAdjusted) {
      contextWidthDays++; contextBaseWidthError += Math.abs(quantile(prediction.widths, 0.5) - target.finalWidth) / target.features.priorWidth;
      contextWidthError += Math.abs(quantile(candidate.widths, 0.5) - target.finalWidth) / target.features.priorWidth;
    }
    evaluated++; score += brier(prediction.probabilities, target.outcome);
    baselineScore += brier(priorOnly.probabilities, target.outcome);
    analogScore += brier(analog.probabilities, target.outcome);
    analogWidth += Math.abs(quantile(analog.widths, 0.5) - target.finalWidth) / target.features.priorWidth;
    baselineWidth += Math.abs(quantile(priorOnly.widths, 0.5) - target.finalWidth) / target.features.priorWidth;
    for (const item of scores) {
      const value = target.context[item.factor];
      if (value === null) continue;
      const matching = prior.filter((row) => row.context[item.factor] === value);
      if (matching.length < 10) continue;
      const adjusted = factorEstimate(matching, target.features, prediction);
      item.n++; item.baseBrier += brier(prediction.probabilities, target.outcome);
      item.adjustedBrier += brier(adjusted.probabilities, target.outcome);
      item.baseWidth += Math.abs(quantile(prediction.widths, 0.5) - target.finalWidth) / target.features.priorWidth;
      item.adjustedWidth += Math.abs(quantile(adjusted.widths, 0.5) - target.finalWidth) / target.features.priorWidth;
    }
  }
  const useContextProbability = contextProbabilityDays >= 20 && (contextBaseBrier - contextBrier) / contextProbabilityDays > 0.005;
  const useContextWidth = contextWidthDays >= 20 && (contextBaseWidthError - contextWidthError) / contextWidthDays > 0.01;
  const factors: ForecastFactorReport[] = scores.map((item) => {
    const matchingDays = context[item.factor] === null ? 0 : rows.filter((row) => row.context[item.factor] === context[item.factor]).length;
    const brierImprovement = item.n ? (item.baseBrier - item.adjustedBrier) / item.n : null;
    const widthImprovement = item.n ? (item.baseWidth - item.adjustedWidth) / item.n : null;
    return { factor: item.factor, matchingDays, evaluatedDays: item.n, brierImprovement, widthImprovement,
      probabilityUsed: useContextProbability && matchingDays >= 10 && item.n >= 20 && (brierImprovement ?? 0) > 0.005,
      widthUsed: useContextWidth && matchingDays >= 10 && item.n >= 20 && (widthImprovement ?? 0) > 0.01 };
  });
  const base = select(baseEstimate(rows, input), empirical(rows.map((row) => ({ row, weight: 1 })), input));
  const probabilityModels = [base.probabilities];
  const widthModels = [base.widths];
  for (const factor of factors) {
    if (!factor.probabilityUsed && !factor.widthUsed) continue;
    const adjusted = factorEstimate(rows.filter((row) => row.context[factor.factor] === context[factor.factor]), input, base);
    if (factor.probabilityUsed) probabilityModels.push(adjusted.probabilities);
    if (factor.widthUsed) widthModels.push(adjusted.widths);
  }
  const p = JOINT.map((_, i) => probabilityModels.reduce((sum, values) => sum + values[i], 0) / probabilityModels.length);
  const widths = widthModels.flatMap((values) => {
    const total = values.reduce((sum, value) => sum + value.weight, 0);
    return values.map((value) => ({ ...value, weight: value.weight / total / widthModels.length }));
  });
  const estimate: ForecastEstimate = {
    dayType: { IBH: p[0], IBL: p[1], IBB: p[2] + p[3], IBN: p[4] },
    firstBreak: { IBH: p[0] + p[2], IBL: p[1] + p[3], none: p[4] },
    width: { median: quantile(widths, 0.5), low: quantile(widths, 0.1), high: quantile(widths, 0.9) },
  };
  const validation: ForecastValidation = { days: evaluated, brier: evaluated ? score / evaluated : null,
    baselineBrier: evaluated ? baselineScore / evaluated : null,
    analogBrier: evaluated ? analogScore / evaluated : null,
    probabilityModel: useAnalogProbabilities() ? "analog" : "historical",
    widthModel: useAnalogWidth() ? "analog" : "historical",
    contextCheck: { probabilityDays: contextProbabilityDays, widthDays: contextWidthDays,
      brier: contextProbabilityDays ? contextBrier / contextProbabilityDays : null,
      baselineBrier: contextProbabilityDays ? contextBaseBrier / contextProbabilityDays : null,
      widthError: contextWidthDays ? contextWidthError / contextWidthDays : null,
      baselineWidthError: contextWidthDays ? contextBaseWidthError / contextWidthDays : null,
      probabilityUsed: useContextProbability, widthUsed: useContextWidth },
  };
  return { estimate, factors, validation };
}

export function captureForecast(args: {
  session: JournalSession; prior: JournalSession | ForecastPriorDay | null; levels: SignificantLevel[];
  training: ForecastExample[]; now: string; asOf: string; liveUntil: string;
  tickSize?: number;
  packSources?: NonNullable<ForecastSnapshot['packSupport']>['sources'];
}): JournalSession {
  const { session, prior, now, asOf, liveUntil } = args;
  if (session.forecast || ![now, asOf, liveUntil].every((value) => Number.isFinite(time(value))) || time(now) < time(asOf)) return session;
  const input = forecastFeaturesForSession(session, prior);
  const previous = priorDay(prior);
  if (!input || !previous || !Number.isFinite(time(previous.availableAt)) || time(previous.availableAt) > time(now)) return session;
  const captured = captureForecastContext(session, args.levels, asOf, now, undefined, { recordedOnly: true });
  const training = args.training.filter((row) => row.date < session.rthDate && time(row.availableAt) <= time(now));
  const result = training.length >= 30 ? estimateForecast(training, input, captured.context) : null;
  const enriched = training.filter(row => row.packEvidence);
  const packIds = new Set(enriched.flatMap(row => Object.values(row.packEvidence!).flatMap(e => e!.batchIds)));
  return { ...session, forecast: {
    version: 1, modelVersion: FORECAST_MODEL_VERSION, issuedAt: now, asOf, tickSize: args.tickSize ?? session.market.tickSize,
    mode: time(now) < time(liveUntil) && !session.aPeriod.confirmedAt && !session.bPeriod.confirmedAt &&
      !session.rthObservations.length && !session.close.recordedAt ? "live" : "replay",
    priorDate: previous.rthDate, priorDay: previous, features: input, coverage: { ...session.forecastCoverage }, context: captured.context,
    contextCapture: 'recorded',
    contextWarnings: captured.warnings,
    contextSourceIds: captured.ids, estimate: result?.estimate ?? null,
    referenceDays: training.filter((row) => row.source === "reference").length,
    localDays: training.filter((row) => row.source === "local").length,
    referenceBatchIds: [...new Set(training.flatMap((row) => row.batchId ? [row.batchId] : []))],
    localSourceVersions: training.filter((row) => row.source === "local").map((row) => ({ id: row.id, availableAt: row.availableAt })),
    factors: result?.factors ?? [], validation: result?.validation ?? {
      days: 0, brier: null, baselineBrier: null, analogBrier: null, probabilityModel: "historical", widthModel: "historical" },
    packSupport: {
      enrichedDays: enriched.length, newsDays: enriched.filter(row => row.packEvidence?.news).length,
      fbdDays: enriched.filter(row => row.packEvidence?.fbd).length, lowDays: enriched.filter(row => row.packEvidence?.levels).length,
      priceDays: enriched.filter(row => row.packEvidence?.price).length,
      sources: (args.packSources ?? []).filter(source => packIds.has(source.id) && time(source.importedAt) <= time(now)),
    },
  }, updatedAt: now };
}

export function compareForecast(session: JournalSession) {
  const saved = session.forecast, actual = forecastActual(session);
  if (!saved?.estimate || !actual.closed) return null;
  const estimate = saved.estimate;
  return { actual, mode: saved.mode,
    dayTypeProbability: actual.dayType ? estimate.dayType[actual.dayType] : null,
    firstBreakProbability: actual.firstBreak ? estimate.firstBreak[actual.firstBreak] : null,
    widthError: actual.width === null ? null : actual.width - estimate.width.median,
    widthInside: actual.width === null ? null : actual.width >= estimate.width.low && actual.width <= estimate.width.high,
  };
}
