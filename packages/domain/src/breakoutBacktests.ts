// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { AOI_RULE_VERSION, ES_AOI_RESEARCH_RULES } from './aoiResearch';
import type { FbdInfo, HistoricalLow } from './fbdHistory';
import type { SignificantLevel, StudyTemplate } from './index';

export const BACKTEST_DEFINITION = 'breakout-backtest-1h-v1';
export const BACKTEST_LABEL = 'Breakout backtest';
export type BreakoutBacktestEvidence = {
  ruleVersion: string; resistanceLow: number; resistanceHigh: number;
  resistanceStartAt: string; resistanceHours: number; resistanceTestHours: number;
  breakoutAt: string; breakoutKnownAt: string; backtestKnownAt: string;
  continuousThrough: string; coverageHasGaps: boolean;
};

/** Separate formation definition: never reinterpret a 15-point backtest as a 20-point swing low. */
export function readBacktestEvidence(value: unknown, low: HistoricalLow, info: FbdInfo): BreakoutBacktestEvidence {
  const fail = (ok: unknown): void => { if (!ok) throw new Error('Invalid breakout-backtest formation evidence.'); };
  fail(value && typeof value === 'object' && !Array.isArray(value));
  const v = value as Record<string, unknown>, rules = ES_AOI_RESEARCH_RULES;
  const number = (key: string) => { fail(typeof v[key] === 'number' && Number.isFinite(v[key])); return v[key] as number; };
  const at = (key: string) => {
    fail(typeof v[key] === 'string' && (v[key] as string).endsWith('Z'));
    return Temporal.Instant.from(v[key] as string).toString({ fractionalSecondDigits: 6 });
  };
  const e: BreakoutBacktestEvidence = { ruleVersion: String(v.ruleVersion), resistanceLow: number('resistanceLow'),
    resistanceHigh: number('resistanceHigh'), resistanceStartAt: at('resistanceStartAt'),
    resistanceHours: number('resistanceHours'), resistanceTestHours: number('resistanceTestHours'),
    breakoutAt: at('breakoutAt'), breakoutKnownAt: at('breakoutKnownAt'), backtestKnownAt: at('backtestKnownAt'),
    continuousThrough: at('continuousThrough'), coverageHasGaps: v.coverageHasGaps as boolean };
  const ms = (at: string) => Temporal.Instant.from(at).epochMilliseconds, hour = 3_600_000;
  const tickAligned = (p: number) => Math.abs(p / info.tickSize - Math.round(p / info.tickSize)) < 1e-6;
  fail(['ES','MES'].includes(info.instrument) && info.tickSize === rules.tickSize && info.qualificationPoints === rules.risePoints &&
    e.ruleVersion === AOI_RULE_VERSION && typeof e.coverageHasGaps === 'boolean');
  fail(tickAligned(e.resistanceLow) && tickAligned(e.resistanceHigh) &&
    e.resistanceHigh - e.resistanceLow === rules.resistanceWidth &&
    low.price >= e.resistanceLow && low.price <= e.resistanceHigh);
  fail(Number.isInteger(e.resistanceHours) && e.resistanceHours >= rules.minimumResistanceHours &&
    Number.isInteger(e.resistanceTestHours) && e.resistanceTestHours >= rules.minimumTestHours &&
    e.resistanceTestHours <= e.resistanceHours + 1 &&
    ms(e.breakoutAt) - ms(e.resistanceStartAt) >= (e.resistanceHours + 1) * hour);
  fail(ms(e.breakoutKnownAt) - ms(e.breakoutAt) === hour &&
    ms(e.backtestKnownAt) - ms(e.breakoutKnownAt) >= hour &&
    ms(e.backtestKnownAt) - ms(e.breakoutKnownAt) <= rules.backtestHours * hour &&
    ms(low.originAt) >= ms(e.backtestKnownAt) - hour && ms(low.originAt) < ms(e.backtestKnownAt) &&
    low.pivotKnownAt === e.backtestKnownAt &&
    ms(low.qualifiedAt) - ms(e.backtestKnownAt) >= hour &&
    ms(low.qualifiedAt) - ms(e.backtestKnownAt) <= rules.riseHours * hour);
  fail(low.qualifiedAt <= e.continuousThrough && e.continuousThrough <= low.cutoffAt &&
    e.coverageHasGaps === (e.continuousThrough < low.cutoffAt) && !low.threeHourKnownAt);
  return e;
}

/** Only a continuously covered, unflushed backtest is handed over for journal tracking.
 * Historical/gapped findings remain readable in the pack. No synthetic CPs or FBD episodes. */
export function backtestJournalLevel(low: HistoricalLow, template: StudyTemplate, journalId: string,
  packId: string, importedAt: string): SignificantLevel | null {
  const evidence = low.breakoutBacktest;
  if (!evidence || low.flushAt || evidence.coverageHasGaps || evidence.continuousThrough !== low.cutoffAt) return null;
  const date = Temporal.Instant.from(low.originAt).toZonedDateTimeISO(template.canonicalTimeZone).toPlainDate().toString();
  return { id: `level:pack-backtest:${journalId}:${low.id}`, instrument: template.instrument,
    createdInSessionId: `${journalId === 'es' ? 'ES' : journalId}:${date}`, createdInRthDate: date,
    levelType: 'low', shape: 'single_price', price: low.price, zoneLow: null, zoneHigh: null,
    originTimePrecision: 'exact', originAt: low.originAt, sourceTimeframe: '1h',
    producedTwentyPlus: low.confirmationPrice - low.price >= 20, qualifyingMoveDirection: 'up',
    qualifyingMovePoints: low.confirmationPrice - low.price, label: BACKTEST_LABEL, note: null,
    notes: [], marketEvents: [], episodes: [], showOnMap: false, linkedCpObservationId: null,
    createdAt: low.qualifiedAt, updatedAt: importedAt, currentStatus: 'active', lifecycleEvents: [], revisionHistory: [],
    studyReplay: { packId, sourceId: low.id, knownAt: low.qualifiedAt, contract: low.contract, importedAt,
      scope: 'CONTRACT', kind: 'BREAKOUT_BACKTEST', sourceStatus: 'UNFLUSHED_AT_SOURCE_CUTOFF',
      breakoutBacktest: evidence, sourceCutoffAt: low.cutoffAt } };
}
