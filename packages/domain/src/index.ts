// SPDX-License-Identifier: MPL-2.0

import type { ForecastSnapshot, ForecastCoverage } from "./forecast";
import {duplicateManualLevelEvent} from './levelRecordedEvents';
import type { ForecastUpdate } from './forecastUpdates';
import { holidayDayStart, validateHolidayContext, type HolidayContext } from './holidays';
import { reconcileFormingPriceRanges, formingPricePeriods, manualRangeInputs } from './formingRanges';
import { roundPriceToTick, roundManualPriceFields } from './priceTicks';
import {deriveSessionRecordedIb} from './recordedIb';
export {deriveSessionRecordedIb} from './recordedIb';
export { roundPriceToTick } from './priceTicks';
export * from './formingRanges';
export * from './eventPriceMoves';
export * from './newsResults';
export * from './rthRange';
export * from './sessionLevels';
export * from './holidays';
import type { StudyPackManifest } from "./studyPack";
export * from "./studyPack";
export * from './monthlyStudyPack';
export * from './levelReferencePack';
export * from "./priceHistory";
export * from "./fbdHistory";
export * from "./contextHistory";
export * from "./historyImport";
export * from './journalReplay';
export * from "./forecast";
export * from './forecastUpdates';
export * from './overnightForecast';
export * from './formingWidthForecast';
export * from './remainingEdgeForecast';
export * from './ibReturnForecast';
export * from './postIbRecap';
export * from './auctionForecast';
export * from "./forecastPacks";
export * from "./sessionIbRead";
export * from "./bestFitForecast";
export * from "./forecastReferences";

import { DEFAULT_JOURNAL, ES_STUDY_TEMPLATE, type JournalProfile, type StudyTemplate } from "./instruments";
export * from "./instruments";
export const JOURNAL_SCHEMA_VERSION = 33;

export type Price = number;
export type CalendarStatus =
  | "REGULAR"
  | "SHORTENED"
  | "CLOSED"
  | "UNVERIFIED"
  | "USER_CORRECTED";
export type CheckpointStatus = "pending" | "confirmed";

export type RangeObservation = {
  high: Price | null;
  low: Price | null;
  cp: Price | null;
};

export type RangeCheckpoint = RangeObservation & {
  status: CheckpointStatus;
  note: string | null;
  confirmedAt: string | null;
  /** Directly supplied edges, before dashboard prices and earlier ranges are included. */
  rangeInputs?: Pick<RangeObservation, 'high' | 'low'>;
};

export type RangeCheckpointRevision = RangeCheckpoint & {
  recordedAt: string;
  /** Time the entered range describes, not the time either edge was reached. */
  observedAt?: string;
  cpObservationId?: string;
  priorHigh?: Price | null;
  priorLow?: Price | null;
};

export type CpObservation = {
  id: string;
  price: Price;
  observedAt: string;
  timePrecision: "exact";
  source:
    | "preopen"
    | "standalone"
    | "checkpoint-15m"
    | "checkpoint-a"
    | "checkpoint-b-snapshot"
    | "checkpoint-b"
    | "significant-level"
    | "rth-observation"
    | "rth-close";
  recordedAt?: string;
  /** Only ranges still forming when this dashboard observation was saved. */
  formingPeriods?: Array<'15R' | 'A' | 'B'>;
};

export type CpObservationHistoryEntry = {
  id: string;
  observationId: string;
  action: "removed" | "undo_removal" | "corrected" | "undo_correction";
  prior: CpObservation | null;
  resulting: CpObservation | null;
  priorPreOpenSnapshot: PreOpenSnapshot | null;
  occurredAt: string;
};

export type SignificantLevelType = "high" | "low" | "gap" | "other";
export type SignificantLevelShape = "single_price" | "price_zone";
export type SignificantLevelTimeframe =
  | "unknown"
  | "session"
  | "5m"
  | "15m"
  | "1h"
  | "3h"
  | "1h+3h"
  | "4h"
  | "daily"
  | "other";
export type SignificantLevelMoveDirection = "up" | "down";
export type OriginTimePrecision = "exact" | "approximate" | "unknown";
export type SignificantLevelStatus = "active" | "retired" | "invalidated" | "removed";
export type SignificantLevelLifecycleAction =
  | "created"
  | "retired"
  | "restored"
  | "invalidated"
  | "invalidation_corrected"
  | "removed"
  | "removal_undone";
export type SignificantLevelStatusAction =
  | "retired"
  | "restored"
  | "invalidated"
  | "invalidation_corrected";

export type SignificantLevelArchiveReason = "breakdown" | "fbd_low_broken" | "no_longer_tracking" | "duplicate" | "other";
export type SignificantLevelArchiveDetails = { reason: SignificantLevelArchiveReason; note: string | null };

export type SignificantLevelLifecycleEvent = {
  id: string;
  action: SignificantLevelLifecycleAction;
  priorStatus: SignificantLevelStatus | null;
  resultingStatus: SignificantLevelStatus;
  occurredAt: string;
  source: "manual" | "rth_close";
  archiveDetails?: SignificantLevelArchiveDetails;
};

export type SignificantLevelNote = {
  id: string;
  text: string;
  observedAt: string;
  recordedAt: string;
  removedAt: string | null;
};

export type SignificantLevelPreferences = {
  instrument: string;
  proximityPoints: number;
  updatedAt: string;
};

export type SignificantLevelEpisodeClassification = "FBD" | "FBO";
export type SignificantLevelEpisodePhase =
  | "ON"
  | "15R"
  | "A"
  | "B"
  | "RTH"
  | "POST_RTH";

export type SignificantLevelEpisodeEventLink = {
  itemId: string;
  name: string;
  eventAt: string;
  holiday?: HolidayContext;
};

export type SignificantLevelMarketEventKind =
  | "tested_from_above"
  | "held_above"
  | "crossed_below"
  | "tested_from_below"
  | "held_below"
  | "crossed_above";

export type SignificantLevelMarketEvent = {
  id: string;
  kind: SignificantLevelMarketEventKind;
  levelId: string;
  sessionId: string;
  rthDate: string;
  observedAt: string;
  phase: SignificantLevelEpisodePhase;
  observedPrice: Price | null;
  linkedEvents: SignificantLevelEpisodeEventLink[];
  note: string | null;
  recordedAt: string;
  removedAt: string | null;
};

export type SignificantLevelMarketEventUpdate = {
  kind: SignificantLevelMarketEventKind;
  sessionId: string;
  rthDate: string;
  observedAt: string;
  phase: SignificantLevelEpisodePhase;
  observedPrice: Price | null;
  linkedEvents: SignificantLevelEpisodeEventLink[];
  note: string | null;
};

export type SignificantLevelEpisode = {
  id: string;
  classification: SignificantLevelEpisodeClassification;
  levelId: string;
  sessionId: string;
  rthDate: string;
  observedAt: string;
  phase: SignificantLevelEpisodePhase;
  evidenceInteractionId: string;
  evidenceKind: SignificantLevelInteraction["kind"];
  evidenceDirection: SignificantLevelInteraction["direction"];
  priorCp: Price | null;
  priorObservedAt: string | null;
  laterCp: Price;
  laterObservedAt: string;
  crossingTimeKnown: false;
  linkedEvents: SignificantLevelEpisodeEventLink[];
  note: string | null;
  confirmedAt: string;
  removedAt: string | null;
};

export type SignificantLevelEpisodeUpdate = {
  classification: SignificantLevelEpisodeClassification;
  sessionId: string;
  rthDate: string;
  observedAt: string;
  phase: SignificantLevelEpisodePhase;
  evidence: SignificantLevelInteraction;
  linkedEvents: SignificantLevelEpisodeEventLink[];
  note: string | null;
};

export type SignificantLevel = {
  studyReplay?: import('./journalReplay').ReplayLevelSource;
  sessionEdge?: import('./sessionLevels').SessionEdgeSource;
  id: string;
  instrument: string;
  createdInSessionId: string;
  createdInRthDate: string;
  levelType: SignificantLevelType;
  shape: SignificantLevelShape;
  price: Price | null;
  zoneLow: Price | null;
  zoneHigh: Price | null;
  originTimePrecision: OriginTimePrecision;
  originAt: string | null;
  sourceTimeframe: SignificantLevelTimeframe;
  producedTwentyPlus: boolean;
  qualifyingMoveDirection: SignificantLevelMoveDirection | null;
  qualifyingMovePoints: number | null;
  label: string | null;
  note: string | null;
  notes: SignificantLevelNote[];
  marketEvents: SignificantLevelMarketEvent[];
  episodes: SignificantLevelEpisode[];
  showOnMap: boolean;
  linkedCpObservationId: string | null;
  createdAt: string;
  currentStatus: SignificantLevelStatus;
  lifecycleEvents: SignificantLevelLifecycleEvent[];
  revisionHistory?: SignificantLevelRevisionEntry[];
  updatedAt: string;
};

export type SignificantLevelRevisionSnapshot = {
  levelType: SignificantLevelType;
  shape: SignificantLevelShape;
  price: Price | null;
  zoneLow: Price | null;
  zoneHigh: Price | null;
  originTimePrecision: OriginTimePrecision;
  originAt: string | null;
  sourceTimeframe: SignificantLevelTimeframe;
  producedTwentyPlus: boolean;
  qualifyingMoveDirection: SignificantLevelMoveDirection | null;
  qualifyingMovePoints: number | null;
  label: string | null;
  note: string | null;
  linkedCpObservationId: string | null;
  currentStatus: SignificantLevelStatus;
};

export type SignificantLevelRevisionEntry = {
  id: string;
  action: "corrected" | "removed" | "undo_correction" | "undo_removal";
  prior: SignificantLevelRevisionSnapshot | null;
  resulting: SignificantLevelRevisionSnapshot | null;
  priorLinkedCp: CpObservation | null;
  resultingLinkedCp: CpObservation | null;
  occurredAt: string;
};

export type SignificantLevelUpdate = {
  levelType: SignificantLevelType;
  shape: SignificantLevelShape;
  price: Price | null;
  zoneLow: Price | null;
  zoneHigh: Price | null;
  originTimePrecision: OriginTimePrecision;
  sourceTimeframe: SignificantLevelTimeframe;
  producedTwentyPlus: boolean;
  qualifyingMoveDirection: SignificantLevelMoveDirection | null;
  qualifyingMovePoints: number | null;
  label: string | null;
  note: string | null;
  currentPrice: Price | null;
};

export function normalizeSignificantLevel(level: SignificantLevel): SignificantLevel {
  return {
    ...level,
    sourceTimeframe: level.sourceTimeframe ?? "unknown",
    producedTwentyPlus: level.producedTwentyPlus ?? false,
    qualifyingMoveDirection: level.qualifyingMoveDirection ?? null,
    qualifyingMovePoints: level.qualifyingMovePoints ?? null,
    notes: level.notes ?? [],
    marketEvents: level.marketEvents ?? [],
    episodes: level.episodes ?? [],
    showOnMap: level.showOnMap ?? false,
    revisionHistory: level.revisionHistory ?? [],
  };
}

export function significantLevelDistanceFromPrice(
  level: SignificantLevel,
  price: Price,
): number {
  if (level.shape === "single_price" && level.price !== null) {
    return Math.abs(price - level.price);
  }
  if (level.zoneLow === null || level.zoneHigh === null) return Number.POSITIVE_INFINITY;
  if (price < level.zoneLow) return level.zoneLow - price;
  if (price > level.zoneHigh) return price - level.zoneHigh;
  return 0;
}

export type SignificantLevelInteraction = {
  id: string;
  levelId: string;
  kind: "touch" | "crossover" | "zone_entered" | "zone_traversed";
  direction:
    | "below_to_above"
    | "above_to_below"
    | "below_to_inside"
    | "above_to_inside"
    | null;
  priorCp: Price | null;
  priorObservedAt: string | null;
  laterCp: Price;
  laterObservedAt: string;
  crossingTimeKnown: false;
};

export type PreOpenSnapshot = {
  id: string;
  formingOvernightHigh: Price | null;
  formingOvernightLow: Price | null;
  note: string | null;
  recordedAt: string;
  cpObservationId: string | null;
};

export type ContractHistoryEntry = {
  status: "known" | "unknown";
  contract: string | null;
  changedAt: string;
};

export type OvernightCheckpoint = {
  high: Price | null;
  low: Price | null;
  status: CheckpointStatus;
  rthOpen: Price | null;
  rthOpenStatus: "pending" | "recorded";
  confirmedAt: string | null;
};

export type OvernightRevision = OvernightCheckpoint & {
  recordedAt: string;
};

export type DevelopingBSnapshot = RangeObservation & {
  id: string;
  note: string | null;
  observedAt: string;
  recordedAt: string;
  rangeInputs?: Pick<RangeObservation, 'high' | 'low'>;
};

export type DevelopingBSnapshotHistoryEntry = {
  id: string;
  action: "corrected";
  prior: DevelopingBSnapshot;
  resulting: DevelopingBSnapshot;
  occurredAt: string;
};

export type RthObservation = {
  id: string;
  price: Price;
  observedAt: string;
  recordedAt: string;
  note: string | null;
  cpObservationId: string | null;
};

export type SessionNotePhase = "ON" | "IB" | "RTH";

export type SessionNoteLinkKind =
  | "cp"
  | "checkpoint"
  | "event"
  | "significant_level";

export type SessionNoteLink = {
  kind: SessionNoteLinkKind;
  targetId: string;
  label: string;
};

export type SessionNote = {
  id: string;
  phase: SessionNotePhase;
  observedAt: string;
  recordedAt: string;
  text: string;
  link: SessionNoteLink | null;
};

export type RthObservationHistoryEntry = {
  id: string;
  observationId: string;
  action: "corrected" | "removed" | "undo_correction" | "undo_removal";
  prior: RthObservation | null;
  resulting: RthObservation | null;
  occurredAt: string;
};

export type MarketContextItem = {
  id: string;
  name: string;
  eventDate: string;
  eventAt: string;
  note: string | null;
  /** An optional user-linked, bounded move through saved prices. */
  priceMove?: import('./eventPriceMoves').EventPriceMoveLink;
  newsResult?: import('./newsResults').NewsResult;
  source: "manual" | "official";
  holiday?: HolidayContext;
  contextPack?: {
    batchId: string; eventId: string; title: string; instrument: string;
    cohort: HistoricalIbCohort; referencePeriod: string; sourceUrl: string;
  };
  schedule?: {
    sourceId: string;
    provider: import('./eventWindows').ScheduleProvider;
    url: string;
    fetchedAt: string;
    sourceTimeZone: 'America/New_York' | 'America/Chicago';
  };
  recordedAt: string;
};

export type MarketContextUpdate = {
  name: string;
  eventDate: string;
  note: string | null;
  holiday?: HolidayContext;
};

export type MarketContextHistoryEntry = {
  id: string;
  itemId: string;
  action: "corrected" | "removed" | "undo_correction" | "undo_removal";
  prior: MarketContextItem | null;
  resulting: MarketContextItem | null;
  occurredAt: string;
};

export type IbRelationship =
  | "IB_UNAVAILABLE"
  | "ABOVE_IBH_BREAK"
  | "ABOVE_IBH_NO_BREAK"
  | "AT_IBH"
  | "INSIDE_IB"
  | "AT_IBL"
  | "BELOW_IBL_NO_BREAK"
  | "BELOW_IBL_BREAK";

export type IbTransition =
  | "IBH_BREAK_RECORDED"
  | "RETURN_INSIDE_FROM_IBH_RECORDED"
  | "IBL_BREAK_RECORDED"
  | "RETURN_INSIDE_FROM_IBL_RECORDED";

export type RthObservationState = {
  observation: RthObservation;
  relationship: IbRelationship;
  transitions: IbTransition[];
  previousObservedAt: string | null;
};

export type SessionClose = {
  rthHigh: Price | null;
  rthLow: Price | null;
  price: Price | null;
  observedAt: string | null;
  recordedAt: string | null;
  note: string | null;
  pathComplete: boolean;
  finishedAt: string | null;
};

export type DayType = "IBH" | "IBL" | "IBB" | "IBN";
export type RecordedBreakDayType = Exclude<DayType, "IBN">;
export type CloseDisposition = "ABOVE_IBH" | "INSIDE_OR_ON_IB" | "BELOW_IBL";

export type ClosingOutcome = {
  status: "provisional" | "final";
  highBreakRecorded: boolean;
  lowBreakRecorded: boolean;
  dayType: DayType | null;
  closeDisposition: CloseDisposition;
  outsideCloseDistance: number | null;
  breakCode: string | null;
};

export type SessionMissingField =
  | "CONTRACT"
  | "OVERNIGHT_RANGE"
  | "RTH_OPEN"
  | "FIFTEEN_MINUTE_RANGE"
  | "A_PERIOD"
  | "B_PERIOD"
  | "FINAL_IB"
  | "RTH_PATH_COVERAGE";

export type FirstBreakSide = "IBH" | "IBL" | null;
export type ReturnInsideStatus = "YES" | "NO" | "UNKNOWN" | "NOT_APPLICABLE";
export type PostBreakReturnDepth = "EDGE" | "QUARTER" | "MIDPOINT" | "THREE_QUARTER" | "OPPOSITE_EDGE";

export type WeeklyDaySummary = {
  sessionId: string;
  rthDate: string;
  completed: boolean;
  finalIbWidth: number | null;
  dayType: DayType | null;
  firstBreakSide: FirstBreakSide;
  returnedInsideAfterBreak: boolean;
  returnInsideStatus: ReturnInsideStatus;
  returnDepthStatus: Record<PostBreakReturnDepth, ReturnInsideStatus>;
  closeDisposition: CloseDisposition | null;
  missingFields: SessionMissingField[];
};

export type StatisticRate = {
  count: number;
  denominator: number;
  ratePct: number | null;
};

export type NumericDistribution = {
  n: number;
  minimum: number | null;
  p25: number | null;
  median: number | null;
  mean: number | null;
  p75: number | null;
  maximum: number | null;
};

export type CoreIbStatistics = {
  journaledDays: number;
  completedDays: number;
  incompleteDays: number;
  finalIbAvailableDays: number;
  classifiedDayTypeDays: number;
  recordedFirstBreakDays: number;
  availableCloseDays: number;
  missingDataCount: number;
  ibWidth: NumericDistribution;
  dayTypeRates: Record<DayType, StatisticRate>;
  unclassifiedDayTypeDays: number;
  firstBreakRates: { high: StatisticRate; low: StatisticRate };
  noRecordedFirstBreakDays: number;
  returnInside: {
    yes: number;
    no: number;
    unknown: number;
    knownDenominator: number;
    yesRatePct: number | null;
  };
  returnDepth: Record<PostBreakReturnDepth, {
    yes: number;
    no: number;
    unknown: number;
    notApplicable: number;
    knownDenominator: number;
    yesRatePct: number | null;
  }>;
  closeDispositionRates: Record<CloseDisposition, StatisticRate>;
  unavailableCloseDays: number;
  days: WeeklyDaySummary[];
};

export type SignificantLevelStatisticMeasure = {
  count: number;
  sessionIds: string[];
};

export type SignificantLevelPeriodSummary = {
  period: string;
  levelsCreated: number;
  marketEvents: number;
  confirmedEpisodes: number;
  sessionIds: string[];
};

export type SignificantLevelStatistics = {
  levels: SignificantLevelStatisticMeasure;
  levelsByType: Record<SignificantLevelType, SignificantLevelStatisticMeasure>;
  levelsByTimeframe: Record<SignificantLevelTimeframe, SignificantLevelStatisticMeasure>;
  levelsByStatus: Record<Exclude<SignificantLevelStatus, "removed">, SignificantLevelStatisticMeasure>;
  twentyPlusRecorded: SignificantLevelStatisticMeasure;
  marketEvents: SignificantLevelStatisticMeasure;
  marketEventsByKind: Record<SignificantLevelMarketEventKind, SignificantLevelStatisticMeasure>;
  marketEventsByPhase: Record<SignificantLevelEpisodePhase, SignificantLevelStatisticMeasure>;
  confirmedEpisodes: SignificantLevelStatisticMeasure;
  episodesByClassification: Record<SignificantLevelEpisodeClassification, SignificantLevelStatisticMeasure>;
  episodesByPhase: Record<SignificantLevelEpisodePhase, SignificantLevelStatisticMeasure>;
  interactionSessions: SignificantLevelStatisticMeasure;
  unavailableInteractionSessions: SignificantLevelStatisticMeasure;
  firstBreakDenominator: number;
  firstBreak: Record<"IBH" | "IBL", SignificantLevelStatisticMeasure>;
  noRecordedFirstBreak: SignificantLevelStatisticMeasure;
  dayTypeDenominator: number;
  dayTypes: Record<DayType, SignificantLevelStatisticMeasure>;
  unclassifiedDayType: SignificantLevelStatisticMeasure;
  byDay: SignificantLevelPeriodSummary[];
  byWeek: SignificantLevelPeriodSummary[];
  byMonth: SignificantLevelPeriodSummary[];
  byYear: SignificantLevelPeriodSummary[];
};

export type HistoricalIbCohort = "REFERENCE" | "FORWARD_OBSERVATION";

export type HistoricalIbImportBatch = {
  id: string;
  journalId?: string;
  cohort: HistoricalIbCohort;
  sourceFileName: string;
  contentSha256: string;
  importedAt: string;
  schemaVersion: 1 | 2 | 3 | 4 | 5;
  studyPack?: StudyPackManifest;
  rowCount: number;
  completeRowCount: number;
  missingRowCount: number;
  duplicateDateCount: number;
  years: string[];
};

export type HistoricalIbSession = {
  id: string;
  journalId?: string;
  batchId: string;
  cohort: HistoricalIbCohort;
  sourceFileName: string;
  sourceRowNumber: number;
  rthDate: string;
  sourceYear: string;
  contract: string | null;
  status: "OK" | "MISSING_DATA";
  missingDataDetails: string | null;
  lockedIbh: number;
  lockedIbl: number;
  lockedIbWidthPoints: number;
  cp0730: number | null;
  cp0730PositionPct: number | null;
  forecastInputs?: { onHigh: number; onLow: number; fifteenHigh: number; fifteenLow: number } | null;
  firstBreakSide: FirstBreakSide;
  returnedToIb: boolean | null;
  deepestReturnPoints?: number | null;
  dayType: DayType | null;
  breakCode?: string | null;
  rthClose: number | null;
  closeDisposition: CloseDisposition | null;
  importedAt: string;
};

export type HistoricalBreakCodeFamily =
  | "IBN"
  | "IBH+"
  | "IBH-"
  | "IBL+"
  | "IBL-"
  | "IBBH+"
  | "IBBL+"
  | "IBB-";

export type HistoricalBreakCodeStatistics = {
  classifiedDays: number;
  unavailableDays: number;
  families: Record<HistoricalBreakCodeFamily, StatisticRate>;
};

export type HistoricalIbImportPreview = {
  studyPack?: StudyPackManifest;
  cohort: HistoricalIbCohort;
  sourceFileName: string;
  contentSha256: string;
  rowCount: number;
  completeRowCount: number;
  missingRowCount: number;
  duplicateDateCount: number;
  years: string[];
  blockingErrors: string[];
  sessions: HistoricalIbSession[];
};

export type SessionPeriodStatistics = {
  journaledDays: number;
  completedDays: number;
  incompleteDays: number;
  finalIbAvailableDays: number;
  medianIbWidth: number | null;
  dayTypeCounts: Record<DayType, number>;
  unclassifiedDayTypeCount: number;
  firstBreakCounts: { high: number; low: number; notRecorded: number };
  returnedInsideAfterBreakDays: number;
  recordedBreakDays: number;
  closeDispositionCounts: Record<CloseDisposition, number>;
  unavailableCloseCount: number;
  missingDataCount: number;
};

export type WeeklySessionSummary = SessionPeriodStatistics & {
  weekStart: string;
  weekEnd: string;
  days: WeeklyDaySummary[];
};

export type MonthlySessionSummary = SessionPeriodStatistics & {
  month: string;
  monthStart: string;
  monthEnd: string;
  weeks: WeeklySessionSummary[];
  days: WeeklyDaySummary[];
};

export type YearlySessionSummary = SessionPeriodStatistics & {
  year: string;
  yearStart: string;
  yearEnd: string;
  months: MonthlySessionSummary[];
  days: WeeklyDaySummary[];
};

export type JournalSession = {
  studyReplay?: import('./journalReplay').ReplayDaySource;
  recordVersion: 21;
  journalId: string;
  market: StudyTemplate;
  forecast: ForecastSnapshot | null;
  forecastUpdates: ForecastUpdate[];
  onForecastUpdates?: import('./overnightForecast').OnForecastUpdate[];
  forecastCoverage: ForecastCoverage;
  id: string;
  rthDate: string;
  templateId: string;
  instrument: string;
  contractStatus: "known" | "unknown";
  contract: string | null;
  calendarStatus: CalendarStatus;
  displayTimeZone: string;
  preOpenSnapshots: PreOpenSnapshot[];
  cpObservations: CpObservation[];
  cpObservationHistory: CpObservationHistoryEntry[];
  contractHistory: ContractHistoryEntry[];
  overnight: OvernightCheckpoint;
  overnightHistory: OvernightRevision[];
  fifteenMinute: RangeCheckpoint;
  fifteenMinuteHistory: RangeCheckpointRevision[];
  aPeriod: RangeCheckpoint;
  aPeriodHistory: RangeCheckpointRevision[];
  bSnapshots: DevelopingBSnapshot[];
  bSnapshotHistory: DevelopingBSnapshotHistoryEntry[];
  bPeriod: RangeCheckpoint;
  bPeriodHistory: RangeCheckpointRevision[];
  marketContextItems: MarketContextItem[];
  marketContextHistory: MarketContextHistoryEntry[];
  rthObservations: RthObservation[];
  rthObservationHistory: RthObservationHistoryEntry[];
  rthRangeHistory?: import('./rthRange').RthRangeRevision[];
  sessionNotes: SessionNote[];
  close: SessionClose;
  createdAt: string;
  updatedAt: string;
};

export type RangeGeometry = {
  width: number;
  midpoint: number;
  cpPositionPct: number | null;
};

export type PreOpenUpdate = {
  contractStatus: "known" | "unknown";
  contract: string | null;
  formingOvernightHigh: Price | null;
  formingOvernightLow: Price | null;
  cp: Price | null;
  note: string | null;
};

export type OvernightUpdate = {
  high: Price | null;
  low: Price | null;
  rthOpen: Price | null;
  confirm: boolean;
};

export type FifteenMinuteUpdate = RangeObservation & {
  note: string | null;
};

export type RthObservationUpdate = {
  price: Price;
  note: string | null;
};

export type RangeExtensions = {
  highExtension: number;
  lowExtension: number;
};

export function sortRangeEdges(
  high: Price | null,
  low: Price | null,
): Pick<RangeObservation, "high" | "low"> {
  if (high === null || low === null) return { high, low };
  return { high: Math.max(high, low), low: Math.min(high, low) };
}

export function carryRangeEdgesForward<T extends RangeObservation>(
  current: T,
  ...earlierRanges: RangeObservation[]
): T {
  const highs = [
    ...earlierRanges.map((range) => range.high),
    current.high,
  ].filter((price): price is Price => price !== null);
  const lows = [
    ...earlierRanges.map((range) => range.low),
    current.low,
  ].filter((price): price is Price => price !== null);

  return {
    ...current,
    high: highs.length > 0 ? Math.max(...highs) : null,
    low: lows.length > 0 ? Math.min(...lows) : null,
  };
}

export function deriveRange(range: RangeObservation): RangeGeometry | null {
  if (range.high === null || range.low === null || range.high < range.low) {
    return null;
  }

  const width = range.high - range.low;
  const midpoint = range.low + width / 2;
  const cpPositionPct =
    range.cp === null || width === 0
      ? null
      : ((range.cp - range.low) / width) * 100;

  return { width, midpoint, cpPositionPct };
}

export function deriveRangeExtensions(
  inner: RangeObservation,
  outer: RangeObservation,
): RangeExtensions | null {
  if (
    inner.high === null ||
    inner.low === null ||
    outer.high === null ||
    outer.low === null
  ) {
    return null;
  }
  return {
    highExtension: outer.high - inner.high,
    lowExtension: inner.low - outer.low
  };
}

export function deriveFinalIb(
  aPeriod: RangeCheckpoint,
  bPeriod: RangeCheckpoint,
): RangeObservation | null {
  if (
    aPeriod.status !== "confirmed" ||
    bPeriod.status !== "confirmed" ||
    aPeriod.high === null ||
    aPeriod.low === null ||
    bPeriod.high === null ||
    bPeriod.low === null
  ) {
    return null;
  }
  return {
    high: Math.max(aPeriod.high, bPeriod.high),
    low: Math.min(aPeriod.low, bPeriod.low),
    cp: bPeriod.cp
  };
}

export function deriveBExtensions(
  aPeriod: RangeObservation,
  bPeriod: RangeObservation,
): RangeExtensions | null {
  if (
    aPeriod.high === null ||
    aPeriod.low === null ||
    bPeriod.high === null ||
    bPeriod.low === null
  ) {
    return null;
  }
  return {
    highExtension: Math.max(0, bPeriod.high - aPeriod.high),
    lowExtension: Math.max(0, aPeriod.low - bPeriod.low)
  };
}

export function classifyIbRelationship(
  price: Price,
  finalIb: RangeObservation | null,
  tickSize = 0.25,
): IbRelationship {
  if (finalIb === null || finalIb.high === null || finalIb.low === null) {
    return "IB_UNAVAILABLE";
  }
  const epsilon = 1e-9;
  if (price >= finalIb.high + tickSize - epsilon) return "ABOVE_IBH_BREAK";
  if (price > finalIb.high) return "ABOVE_IBH_NO_BREAK";
  if (price === finalIb.high) return "AT_IBH";
  if (price <= finalIb.low - tickSize + epsilon) return "BELOW_IBL_BREAK";
  if (price < finalIb.low) return "BELOW_IBL_NO_BREAK";
  if (price === finalIb.low) return "AT_IBL";
  return "INSIDE_IB";
}

export function deriveRthObservationStates(
  observations: RthObservation[],
  finalIb: RangeObservation | null,
  tickSize = 0.25,
): RthObservationState[] {
  const ordered = [...observations].sort(
    (left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.recordedAt.localeCompare(right.recordedAt),
  );

  return ordered.map((observation, index) => {
    const previous = ordered[index - 1] ?? null;
    const transitions: IbTransition[] = [];
    if (
      previous &&
      finalIb !== null &&
      finalIb.high !== null &&
      finalIb.low !== null
    ) {
      const epsilon = 1e-9;
      if (
        previous.price < finalIb.high + tickSize - epsilon &&
        observation.price >= finalIb.high + tickSize - epsilon
      ) transitions.push("IBH_BREAK_RECORDED");
      if (
        previous.price >= finalIb.high + tickSize - epsilon &&
        observation.price <= finalIb.high
      ) transitions.push("RETURN_INSIDE_FROM_IBH_RECORDED");
      if (
        previous.price > finalIb.low - tickSize + epsilon &&
        observation.price <= finalIb.low - tickSize + epsilon
      ) transitions.push("IBL_BREAK_RECORDED");
      if (
        previous.price <= finalIb.low - tickSize + epsilon &&
        observation.price >= finalIb.low
      ) transitions.push("RETURN_INSIDE_FROM_IBL_RECORDED");
    }
    return {
      observation,
      relationship: classifyIbRelationship(observation.price, finalIb, tickSize),
      transitions,
      previousObservedAt: previous?.observedAt ?? null
    };
  });
}

export function deriveRecordedBreakDayType(
  observations: RthObservation[],
  finalIb: RangeObservation | null,
  tickSize = 0.25,
): RecordedBreakDayType | null {
  const relationships = observations.map((observation) =>
    classifyIbRelationship(observation.price, finalIb, tickSize),
  );
  const highBreakRecorded = relationships.includes("ABOVE_IBH_BREAK");
  const lowBreakRecorded = relationships.includes("BELOW_IBL_BREAK");

  if (highBreakRecorded && lowBreakRecorded) return "IBB";
  if (highBreakRecorded) return "IBH";
  if (lowBreakRecorded) return "IBL";
  return null;
}

function formatBreakDistance(distance: number): string {
  return distance.toFixed(2);
}

export function deriveClosingOutcome(
  session: JournalSession,
  finalIb: RangeObservation | null,
  tickSize = 0.25,
): ClosingOutcome | null {
  if (
    session.close.price === null ||
    finalIb === null ||
    finalIb.high === null ||
    finalIb.low === null
  ) {
    return null;
  }

  const allPrices = [
    ...session.rthObservations.map((observation) => observation.price),
    session.close.price
  ];
  const ibh = finalIb.high;
  const ibl = finalIb.low;
  const epsilon = 1e-9;
  const highBreakRecorded = allPrices.some(
    (price) => price >= ibh + tickSize - epsilon,
  );
  const lowBreakRecorded = allPrices.some(
    (price) => price <= ibl - tickSize + epsilon,
  );
  const dayType: DayType | null =
    highBreakRecorded && lowBreakRecorded
      ? "IBB"
      : highBreakRecorded
        ? "IBH"
        : lowBreakRecorded
          ? "IBL"
          : session.close.pathComplete
            ? "IBN"
            : null;
  const closeDisposition: CloseDisposition =
    session.close.price > ibh
      ? "ABOVE_IBH"
      : session.close.price < ibl
        ? "BELOW_IBL"
        : "INSIDE_OR_ON_IB";
  const outsideCloseDistance =
    closeDisposition === "ABOVE_IBH"
      ? session.close.price - ibh
      : closeDisposition === "BELOW_IBL"
        ? ibl - session.close.price
        : null;
  const distanceText =
    outsideCloseDistance === null ? null : formatBreakDistance(outsideCloseDistance);
  const breakCode =
    dayType === null
      ? null
      : dayType === "IBN"
        ? "IBN"
        : dayType === "IBH"
          ? closeDisposition === "ABOVE_IBH"
            ? `IBH+${distanceText}`
            : "IBH-"
          : dayType === "IBL"
            ? closeDisposition === "BELOW_IBL"
              ? `IBL+${distanceText}`
              : "IBL-"
            : closeDisposition === "ABOVE_IBH"
              ? `IBBH+${distanceText}`
              : closeDisposition === "BELOW_IBL"
                ? `IBBL+${distanceText}`
                : "IBB-";

  return {
    status: session.close.pathComplete ? "final" : "provisional",
    highBreakRecorded,
    lowBreakRecorded,
    dayType,
    closeDisposition,
    outsideCloseDistance,
    breakCode
  };
}

export function deriveSessionFinalIb(
  session: JournalSession,
): RangeObservation | null {
  const aPeriod = carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
  const bPeriod = carryRangeEdgesForward(
    session.bPeriod,
    session.fifteenMinute,
    aPeriod,
    ...session.bSnapshots,
  );
  return deriveFinalIb(aPeriod, bPeriod);
}

export function deriveSessionMissingFields(
  session: JournalSession,
  finalIb: RangeObservation | null = deriveSessionFinalIb(session),
): SessionMissingField[] {
  const missing: SessionMissingField[] = [];
  if (session.market.requiresContract && session.contractStatus === "unknown") missing.push("CONTRACT");
  if (session.overnight.status !== "confirmed") missing.push("OVERNIGHT_RANGE");
  if (session.overnight.rthOpen === null) missing.push("RTH_OPEN");
  if (session.fifteenMinute.status !== "confirmed") missing.push("FIFTEEN_MINUTE_RANGE");
  if (session.aPeriod.status !== "confirmed") missing.push("A_PERIOD");
  if (session.bPeriod.status !== "confirmed") missing.push("B_PERIOD");
  if (finalIb === null) missing.push("FINAL_IB");
  // Checkpoint CP belonged to the old optional range inputs. Dashboard price
  // observations are independent; neither is required to complete a range.
  if (!session.close.pathComplete) missing.push("RTH_PATH_COVERAGE");
  return missing;
}

function sessionPathThroughClose(session: JournalSession): RthObservation[] {
  if (
    session.close.price === null ||
    session.close.observedAt === null ||
    session.close.recordedAt === null
  ) {
    return session.rthObservations;
  }
  return [
    ...session.rthObservations,
    {
      id: `weekly-close:${session.id}`,
      price: session.close.price,
      observedAt: session.close.observedAt,
      recordedAt: session.close.recordedAt,
      note: session.close.note,
      cpObservationId: null
    }
  ];
}

export function deriveWeeklyDaySummary(
  session: JournalSession,
  tickSize = 0.25,
): WeeklyDaySummary {
  const finalIb = deriveSessionRecordedIb(session);
  const path = sessionPathThroughClose(session);
  const states = deriveRthObservationStates(path, finalIb, tickSize);
  const firstBreak = states.find((state) =>
    state.relationship === "ABOVE_IBH_BREAK" ||
    state.relationship === "BELOW_IBL_BREAK");
  const firstBreakSide: FirstBreakSide =
    firstBreak?.relationship === "ABOVE_IBH_BREAK"
      ? "IBH"
      : firstBreak?.relationship === "BELOW_IBL_BREAK"
        ? "IBL"
        : null;
  const returnedInsideAfterBreak = states.some((state) =>
    state.transitions.includes("RETURN_INSIDE_FROM_IBH_RECORDED") ||
    state.transitions.includes("RETURN_INSIDE_FROM_IBL_RECORDED"));
  const closingOutcome = deriveClosingOutcome(session, finalIb, tickSize);
  const recordedDayType = deriveRecordedBreakDayType(path, finalIb, tickSize);
  const dayType = closingOutcome?.dayType ?? recordedDayType;
  const finalIbWidth = finalIb !== null && finalIb.high !== null && finalIb.low !== null
    ? finalIb.high - finalIb.low
    : null;
  const returnInsideStatus: ReturnInsideStatus =
    firstBreakSide === null
      ? "NOT_APPLICABLE"
      : returnedInsideAfterBreak
        ? "YES"
        : session.close.pathComplete
          ? "NO"
          : "UNKNOWN";
  const firstBreakIndex = firstBreak ? states.indexOf(firstBreak) : -1;
  const postBreakPrices = firstBreakIndex < 0
    ? []
    : states.slice(firstBreakIndex + 1).map((state) => state.observation.price);
  const deepestReturnPoints =
    firstBreakSide === "IBH" && finalIb?.high !== null && finalIb?.high !== undefined
      ? Math.max(0, ...postBreakPrices.map((price) => finalIb.high! - price))
      : firstBreakSide === "IBL" && finalIb?.low !== null && finalIb?.low !== undefined
        ? Math.max(0, ...postBreakPrices.map((price) => price - finalIb.low!))
        : null;
  const thresholdStatus = (fraction: number): ReturnInsideStatus => {
    if (firstBreakSide === null || finalIbWidth === null) return "NOT_APPLICABLE";
    if (deepestReturnPoints !== null && deepestReturnPoints + 1e-9 >= finalIbWidth * fraction) {
      return "YES";
    }
    return session.close.pathComplete ? "NO" : "UNKNOWN";
  };
  const returnDepthStatus: Record<PostBreakReturnDepth, ReturnInsideStatus> = {
    EDGE: returnInsideStatus,
    QUARTER: thresholdStatus(0.25),
    MIDPOINT: thresholdStatus(0.5),
    THREE_QUARTER: thresholdStatus(0.75),
    OPPOSITE_EDGE: thresholdStatus(1),
  };

  return {
    sessionId: session.id,
    rthDate: session.rthDate,
    completed: session.close.finishedAt !== null,
    finalIbWidth,
    dayType,
    firstBreakSide,
    returnedInsideAfterBreak,
    returnInsideStatus,
    returnDepthStatus,
    closeDisposition: closingOutcome?.closeDisposition ?? null,
    missingFields: deriveSessionMissingFields(session, finalIb)
  };
}

function isoCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayForRthDate(rthDate: string): string {
  const date = new Date(`${rthDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid RTH date: ${rthDate}`);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return isoCalendarDate(date);
}

function addCalendarDays(rthDate: string, days: number): string {
  const date = new Date(`${rthDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoCalendarDate(date);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return ordered[lowerIndex];
  const weight = position - lowerIndex;
  return ordered[lowerIndex] * (1 - weight) + ordered[upperIndex] * weight;
}

function statisticRate(count: number, denominator: number): StatisticRate {
  return {
    count,
    denominator,
    ratePct: denominator === 0 ? null : (count / denominator) * 100
  };
}

function numericDistribution(values: number[]): NumericDistribution {
  return {
    n: values.length,
    minimum: values.length === 0 ? null : Math.min(...values),
    p25: percentile(values, 0.25),
    median: median(values),
    mean: values.length === 0
      ? null
      : values.reduce((total, value) => total + value, 0) / values.length,
    p75: percentile(values, 0.75),
    maximum: values.length === 0 ? null : Math.max(...values)
  };
}

export function deriveCoreIbStatistics(
  sessions: JournalSession[],
  tickSize = 0.25,
): CoreIbStatistics {
  const days = sessions
    .map((session) => deriveWeeklyDaySummary(session, tickSize))
    .sort((left, right) => left.rthDate.localeCompare(right.rthDate));
  return deriveCoreIbStatisticsFromDays(days);
}

const SIGNIFICANT_LEVEL_TYPES: SignificantLevelType[] = ["high", "low", "gap", "other"];
const SIGNIFICANT_LEVEL_TIMEFRAMES: SignificantLevelTimeframe[] = [
  "unknown",
  "session",
  "5m",
  "15m",
  "1h",
  "3h",
  "1h+3h",
  "4h",
  "daily",
  "other",
];
const SIGNIFICANT_LEVEL_STATUSES: Array<Exclude<SignificantLevelStatus, "removed">> = [
  "active",
  "retired",
  "invalidated",
];
const SIGNIFICANT_LEVEL_MARKET_EVENT_KINDS: SignificantLevelMarketEventKind[] = [
  "tested_from_above",
  "held_above",
  "crossed_below",
  "tested_from_below",
  "held_below",
  "crossed_above",
];
const SIGNIFICANT_LEVEL_PHASES: SignificantLevelEpisodePhase[] = [
  "ON",
  "15R",
  "A",
  "B",
  "RTH",
  "POST_RTH",
];

function significantLevelMeasure(
  count: number,
  sessionIds: string[],
): SignificantLevelStatisticMeasure {
  return {
    count,
    sessionIds: [...new Set(sessionIds)].sort(),
  };
}

function significantLevelMeasuresByKey<Key extends string, RecordValue>(
  keys: Key[],
  records: RecordValue[],
  keyFor: (record: RecordValue) => Key,
  sessionIdFor: (record: RecordValue) => string,
): Record<Key, SignificantLevelStatisticMeasure> {
  return Object.fromEntries(keys.map((key) => {
    const matching = records.filter((record) => keyFor(record) === key);
    return [key, significantLevelMeasure(
      matching.length,
      matching.map(sessionIdFor),
    )];
  })) as Record<Key, SignificantLevelStatisticMeasure>;
}

type SignificantLevelPeriodFact = {
  rthDate: string;
  sessionId: string;
  kind: "level" | "market_event" | "episode";
};

function significantLevelPeriods(
  facts: SignificantLevelPeriodFact[],
  periodFor: (rthDate: string) => string,
): SignificantLevelPeriodSummary[] {
  const grouped = new Map<string, SignificantLevelPeriodFact[]>();
  for (const fact of facts) {
    const period = periodFor(fact.rthDate);
    grouped.set(period, [...(grouped.get(period) ?? []), fact]);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, periodFacts]) => ({
      period,
      levelsCreated: periodFacts.filter((fact) => fact.kind === "level").length,
      marketEvents: periodFacts.filter((fact) => fact.kind === "market_event").length,
      confirmedEpisodes: periodFacts.filter((fact) => fact.kind === "episode").length,
      sessionIds: [...new Set(periodFacts.map((fact) => fact.sessionId))].sort(),
    }));
}

export function deriveSignificantLevelStatistics(
  sessions: JournalSession[],
  significantLevels: SignificantLevel[],
  tickSize = 0.25,
): SignificantLevelStatistics {
  const levels = significantLevels
    .map(normalizeSignificantLevel)
    .filter((level) => level.currentStatus !== "removed");
  const levelRecords = levels.map((level) => ({
    level,
    sessionId: level.createdInSessionId,
  }));
  const marketEvents = levels.flatMap((level) =>
    level.marketEvents
      .filter((marketEvent) => marketEvent.removedAt === null)
      .map((marketEvent) => ({ level, marketEvent })));
  const episodes = levels.flatMap((level) =>
    level.episodes
      .filter((episode) => episode.removedAt === null)
      .map((episode) => ({ level, episode })));
  const interactionSessionIds = [...new Set([
    ...marketEvents.map(({ marketEvent }) => marketEvent.sessionId),
    ...episodes.map(({ episode }) => episode.sessionId),
  ])].sort();
  const daysBySessionId = new Map(
    sessions.map((session) => [session.id, deriveWeeklyDaySummary(session, tickSize)]),
  );
  const interactionDays = interactionSessionIds
    .map((sessionId) => daysBySessionId.get(sessionId) ?? null)
    .filter((day): day is WeeklyDaySummary => day !== null);
  const unavailableInteractionSessionIds = interactionSessionIds.filter(
    (sessionId) => !daysBySessionId.has(sessionId),
  );
  const knownFirstBreakDays = interactionDays.filter((day) => day.firstBreakSide !== null);
  const knownDayTypeDays = interactionDays.filter((day) => day.dayType !== null);
  const periodFacts: SignificantLevelPeriodFact[] = [
    ...levels.map((level) => ({
      rthDate: level.createdInRthDate,
      sessionId: level.createdInSessionId,
      kind: "level" as const,
    })),
    ...marketEvents.map(({ marketEvent }) => ({
      rthDate: marketEvent.rthDate,
      sessionId: marketEvent.sessionId,
      kind: "market_event" as const,
    })),
    ...episodes.map(({ episode }) => ({
      rthDate: episode.rthDate,
      sessionId: episode.sessionId,
      kind: "episode" as const,
    })),
  ];

  return {
    levels: significantLevelMeasure(levels.length, levels.map((level) => level.createdInSessionId)),
    levelsByType: significantLevelMeasuresByKey(
      SIGNIFICANT_LEVEL_TYPES,
      levelRecords,
      ({ level }) => level.levelType,
      ({ sessionId }) => sessionId,
    ),
    levelsByTimeframe: significantLevelMeasuresByKey(
      SIGNIFICANT_LEVEL_TIMEFRAMES,
      levelRecords,
      ({ level }) => level.sourceTimeframe,
      ({ sessionId }) => sessionId,
    ),
    levelsByStatus: significantLevelMeasuresByKey(
      SIGNIFICANT_LEVEL_STATUSES,
      levelRecords,
      ({ level }) => level.currentStatus as Exclude<SignificantLevelStatus, "removed">,
      ({ sessionId }) => sessionId,
    ),
    twentyPlusRecorded: significantLevelMeasure(
      levels.filter((level) => level.producedTwentyPlus).length,
      levels.filter((level) => level.producedTwentyPlus).map((level) => level.createdInSessionId),
    ),
    marketEvents: significantLevelMeasure(
      marketEvents.length,
      marketEvents.map(({ marketEvent }) => marketEvent.sessionId),
    ),
    marketEventsByKind: significantLevelMeasuresByKey(
      SIGNIFICANT_LEVEL_MARKET_EVENT_KINDS,
      marketEvents,
      ({ marketEvent }) => marketEvent.kind,
      ({ marketEvent }) => marketEvent.sessionId,
    ),
    marketEventsByPhase: significantLevelMeasuresByKey(
      SIGNIFICANT_LEVEL_PHASES,
      marketEvents,
      ({ marketEvent }) => marketEvent.phase,
      ({ marketEvent }) => marketEvent.sessionId,
    ),
    confirmedEpisodes: significantLevelMeasure(
      episodes.length,
      episodes.map(({ episode }) => episode.sessionId),
    ),
    episodesByClassification: significantLevelMeasuresByKey(
      ["FBD", "FBO"],
      episodes,
      ({ episode }) => episode.classification,
      ({ episode }) => episode.sessionId,
    ),
    episodesByPhase: significantLevelMeasuresByKey(
      SIGNIFICANT_LEVEL_PHASES,
      episodes,
      ({ episode }) => episode.phase,
      ({ episode }) => episode.sessionId,
    ),
    interactionSessions: significantLevelMeasure(
      interactionSessionIds.length,
      interactionSessionIds,
    ),
    unavailableInteractionSessions: significantLevelMeasure(
      unavailableInteractionSessionIds.length,
      unavailableInteractionSessionIds,
    ),
    firstBreakDenominator: knownFirstBreakDays.length,
    firstBreak: {
      IBH: significantLevelMeasure(
        knownFirstBreakDays.filter((day) => day.firstBreakSide === "IBH").length,
        knownFirstBreakDays.filter((day) => day.firstBreakSide === "IBH").map((day) => day.sessionId),
      ),
      IBL: significantLevelMeasure(
        knownFirstBreakDays.filter((day) => day.firstBreakSide === "IBL").length,
        knownFirstBreakDays.filter((day) => day.firstBreakSide === "IBL").map((day) => day.sessionId),
      ),
    },
    noRecordedFirstBreak: significantLevelMeasure(
      interactionDays.filter((day) => day.firstBreakSide === null).length,
      interactionDays.filter((day) => day.firstBreakSide === null).map((day) => day.sessionId),
    ),
    dayTypeDenominator: knownDayTypeDays.length,
    dayTypes: significantLevelMeasuresByKey(
      ["IBN", "IBH", "IBL", "IBB"],
      knownDayTypeDays,
      (day) => day.dayType!,
      (day) => day.sessionId,
    ),
    unclassifiedDayType: significantLevelMeasure(
      interactionDays.filter((day) => day.dayType === null).length,
      interactionDays.filter((day) => day.dayType === null).map((day) => day.sessionId),
    ),
    byDay: significantLevelPeriods(periodFacts, (rthDate) => rthDate),
    byWeek: significantLevelPeriods(periodFacts, mondayForRthDate),
    byMonth: significantLevelPeriods(periodFacts, (rthDate) => rthDate.slice(0, 7)),
    byYear: significantLevelPeriods(periodFacts, (rthDate) => rthDate.slice(0, 4)),
  };
}

function derivedHistoricalIbBreakCode(session: HistoricalIbSession): string | null {
  if (session.dayType === null) return null;
  if (session.dayType === "IBN") return "IBN";
  if (session.rthClose === null || session.closeDisposition === null) return null;
  const distance = (value: number) => Math.max(0, Math.round(value * 100) / 100).toFixed(2);
  if (session.dayType === "IBH") {
    return session.closeDisposition === "ABOVE_IBH"
      ? `IBH+${distance(session.rthClose - session.lockedIbh)}`
      : "IBH-";
  }
  if (session.dayType === "IBL") {
    return session.closeDisposition === "BELOW_IBL"
      ? `IBL+${distance(session.lockedIbl - session.rthClose)}`
      : "IBL-";
  }
  if (session.closeDisposition === "ABOVE_IBH") {
    return `IBBH+${distance(session.rthClose - session.lockedIbh)}`;
  }
  if (session.closeDisposition === "BELOW_IBL") {
    return `IBBL+${distance(session.lockedIbl - session.rthClose)}`;
  }
  return "IBB-";
}

export function historicalIbBreakCode(session: HistoricalIbSession): string | null {
  return session.breakCode?.trim() || derivedHistoricalIbBreakCode(session);
}

export function normalizeHistoricalIbSession(
  session: HistoricalIbSession,
): HistoricalIbSession {
  return {
    ...session,
    breakCode: historicalIbBreakCode(session),
    deepestReturnPoints: session.deepestReturnPoints ?? null,
  };
}

export function historicalBreakCodeFamily(
  session: HistoricalIbSession,
): HistoricalBreakCodeFamily | null {
  const code = historicalIbBreakCode(session);
  if (code === null) return null;
  if (code === "IBN") return "IBN";
  if (code === "IBH-") return "IBH-";
  if (code.startsWith("IBH+")) return "IBH+";
  if (code === "IBL-") return "IBL-";
  if (code.startsWith("IBL+")) return "IBL+";
  if (code.startsWith("IBBH+")) return "IBBH+";
  if (code.startsWith("IBBL+")) return "IBBL+";
  if (code === "IBB-") return "IBB-";
  return null;
}

export function deriveHistoricalBreakCodeStatistics(
  sessions: HistoricalIbSession[],
): HistoricalBreakCodeStatistics {
  const familyNames: HistoricalBreakCodeFamily[] = [
    "IBN", "IBH+", "IBH-", "IBL+", "IBL-", "IBBH+", "IBBL+", "IBB-",
  ];
  const resolved = sessions
    .map(historicalBreakCodeFamily)
    .filter((family): family is HistoricalBreakCodeFamily => family !== null);
  const counts = Object.fromEntries(
    familyNames.map((family) => [family, resolved.filter((value) => value === family).length]),
  ) as Record<HistoricalBreakCodeFamily, number>;
  return {
    classifiedDays: resolved.length,
    unavailableDays: sessions.length - resolved.length,
    families: Object.fromEntries(
      familyNames.map((family) => [family, statisticRate(counts[family], resolved.length)]),
    ) as Record<HistoricalBreakCodeFamily, StatisticRate>,
  };
}

export function deriveHistoricalIbDaySummary(
  session: HistoricalIbSession,
): WeeklyDaySummary {
  const missingFields: SessionMissingField[] = [];
  if (session.status === "MISSING_DATA") missingFields.push("RTH_PATH_COVERAGE");
  const edgeStatus: ReturnInsideStatus =
    session.firstBreakSide === null
      ? "NOT_APPLICABLE"
      : session.returnedToIb === true
        ? "YES"
        : session.returnedToIb === false
          ? "NO"
          : "UNKNOWN";
  const historicalThresholdStatus = (fraction: number): ReturnInsideStatus => {
    if (session.firstBreakSide === null) return "NOT_APPLICABLE";
    if (session.returnedToIb === false) return "NO";
    if (session.deepestReturnPoints !== null && session.deepestReturnPoints !== undefined) {
      return session.deepestReturnPoints + 1e-9 >= session.lockedIbWidthPoints * fraction
        ? "YES"
        : "NO";
    }
    if (session.dayType === "IBB") return "YES";
    return "UNKNOWN";
  };
  return {
    sessionId: session.id,
    rthDate: session.rthDate,
    completed: session.status === "OK",
    finalIbWidth: session.lockedIbWidthPoints,
    dayType: session.dayType,
    firstBreakSide: session.firstBreakSide,
    returnedInsideAfterBreak: session.returnedToIb === true,
    returnInsideStatus: edgeStatus,
    returnDepthStatus: {
      EDGE: edgeStatus,
      QUARTER: historicalThresholdStatus(0.25),
      MIDPOINT: historicalThresholdStatus(0.5),
      THREE_QUARTER: historicalThresholdStatus(0.75),
      OPPOSITE_EDGE: historicalThresholdStatus(1),
    },
    closeDisposition: session.closeDisposition,
    missingFields
  };
}

export function deriveHistoricalCoreIbStatistics(
  sessions: HistoricalIbSession[],
): CoreIbStatistics {
  return deriveCoreIbStatisticsFromDays(
    sessions
      .map(deriveHistoricalIbDaySummary)
      .sort((left, right) => left.rthDate.localeCompare(right.rthDate)),
  );
}

export function deriveCoreIbStatisticsFromDays(
  days: WeeklyDaySummary[],
): CoreIbStatistics {
  const period = summarizeDaySummaries(days);
  const widths = days
    .map((day) => day.finalIbWidth)
    .filter((width): width is number => width !== null);
  const classifiedDayTypeDays = days.filter((day) => day.dayType !== null).length;
  const dayTypeRates = {
    IBN: statisticRate(period.dayTypeCounts.IBN, classifiedDayTypeDays),
    IBH: statisticRate(period.dayTypeCounts.IBH, classifiedDayTypeDays),
    IBL: statisticRate(period.dayTypeCounts.IBL, classifiedDayTypeDays),
    IBB: statisticRate(period.dayTypeCounts.IBB, classifiedDayTypeDays)
  };
  const recordedFirstBreakDays = period.recordedBreakDays;
  const returnYes = days.filter((day) => day.returnInsideStatus === "YES").length;
  const returnNo = days.filter((day) => day.returnInsideStatus === "NO").length;
  const returnUnknown = days.filter(
    (day) => day.returnInsideStatus === "UNKNOWN",
  ).length;
  const knownReturnDenominator = returnYes + returnNo;
  const returnDepthNames: PostBreakReturnDepth[] = [
    "EDGE", "QUARTER", "MIDPOINT", "THREE_QUARTER", "OPPOSITE_EDGE",
  ];
  const returnDepth = Object.fromEntries(returnDepthNames.map((depth) => {
    const yes = days.filter((day) => day.returnDepthStatus[depth] === "YES").length;
    const no = days.filter((day) => day.returnDepthStatus[depth] === "NO").length;
    const unknown = days.filter((day) => day.returnDepthStatus[depth] === "UNKNOWN").length;
    const notApplicable = days.filter(
      (day) => day.returnDepthStatus[depth] === "NOT_APPLICABLE",
    ).length;
    const knownDenominator = yes + no;
    return [depth, {
      yes,
      no,
      unknown,
      notApplicable,
      knownDenominator,
      yesRatePct: knownDenominator === 0 ? null : (yes / knownDenominator) * 100,
    }];
  })) as CoreIbStatistics["returnDepth"];
  const availableCloseDays = days.filter((day) => day.closeDisposition !== null).length;

  return {
    journaledDays: period.journaledDays,
    completedDays: period.completedDays,
    incompleteDays: period.incompleteDays,
    finalIbAvailableDays: period.finalIbAvailableDays,
    classifiedDayTypeDays,
    recordedFirstBreakDays,
    availableCloseDays,
    missingDataCount: period.missingDataCount,
    ibWidth: numericDistribution(widths),
    dayTypeRates,
    unclassifiedDayTypeDays: period.unclassifiedDayTypeCount,
    firstBreakRates: {
      high: statisticRate(period.firstBreakCounts.high, recordedFirstBreakDays),
      low: statisticRate(period.firstBreakCounts.low, recordedFirstBreakDays)
    },
    noRecordedFirstBreakDays: period.firstBreakCounts.notRecorded,
    returnInside: {
      yes: returnYes,
      no: returnNo,
      unknown: returnUnknown,
      knownDenominator: knownReturnDenominator,
      yesRatePct: knownReturnDenominator === 0
        ? null
        : (returnYes / knownReturnDenominator) * 100
    },
    returnDepth,
    closeDispositionRates: {
      ABOVE_IBH: statisticRate(
        period.closeDispositionCounts.ABOVE_IBH,
        availableCloseDays,
      ),
      INSIDE_OR_ON_IB: statisticRate(
        period.closeDispositionCounts.INSIDE_OR_ON_IB,
        availableCloseDays,
      ),
      BELOW_IBL: statisticRate(
        period.closeDispositionCounts.BELOW_IBL,
        availableCloseDays,
      )
    },
    unavailableCloseDays: period.unavailableCloseCount,
    days
  };
}

const HISTORICAL_IB_REQUIRED_HEADERS = [
  "rth_date",
  "status",
  "missing_data_details",
  "locked_IBH",
  "locked_IBL",
  "locked_IB_width_points",
  "CP_07_30",
  "CP_07_30_position_pct",
  "first_break",
  "returned_to_IB",
  "day_type",
  "RTH_close",
  "final_disposition",
  "contract",
  "source_year"
] as const;

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function nullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requiredNumber(value: string, field: string, rowNumber: number): number {
  const parsed = nullableNumber(value);
  if (parsed === null) throw new Error(`Row ${rowNumber}: ${field} is missing or invalid.`);
  return parsed;
}

export function parseHistoricalIbReferenceCsv(
  text: string,
  sourceFileName: string,
  contentSha256: string,
  importedAt: string,
  cohort: HistoricalIbCohort,
): HistoricalIbImportPreview {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return {
      cohort,
      sourceFileName,
      contentSha256,
      rowCount: 0,
      completeRowCount: 0,
      missingRowCount: 0,
      duplicateDateCount: 0,
      years: [],
      blockingErrors: ["The selected CSV is empty."],
      sessions: []
    };
  }
  const headers = rows[0].map((header) => header.trim());
  const missingHeaders = HISTORICAL_IB_REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length > 0) {
    return {
      cohort,
      sourceFileName,
      contentSha256,
      rowCount: Math.max(0, rows.length - 1),
      completeRowCount: 0,
      missingRowCount: 0,
      duplicateDateCount: 0,
      years: [],
      blockingErrors: [`Missing required columns: ${missingHeaders.join(", ")}.`],
      sessions: []
    };
  }
  const column = new Map(headers.map((header, index) => [header, index]));
  const get = (row: string[], name: string): string => row[column.get(name)!]?.trim() ?? "";
  const errors: string[] = [];
  const parsedSessions: HistoricalIbSession[] = [];
  const cohortSlug = cohort === "REFERENCE" ? "reference" : "forward-observation";
  const batchId = `ib-history:${cohortSlug}:${contentSha256.slice(0, 24)}`;
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 1;
    try {
      const rthDate = get(row, "rth_date");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rthDate)) {
        throw new Error(`Row ${rowNumber}: rth_date is missing or invalid.`);
      }
      const sourceYear = get(row, "source_year");
      if (!/^\d{4}$/.test(sourceYear) || rthDate.slice(0, 4) !== sourceYear) {
        throw new Error(`Row ${rowNumber}: source_year does not match rth_date.`);
      }
      const status = get(row, "status");
      if (status !== "OK" && status !== "MISSING_DATA") {
        throw new Error(`Row ${rowNumber}: status must be OK or MISSING_DATA.`);
      }
      const firstBreakRaw = get(row, "first_break");
      const firstBreakSide: FirstBreakSide =
        firstBreakRaw === "IBH" || firstBreakRaw === "IBL" ? firstBreakRaw : null;
      if (firstBreakRaw !== "" && firstBreakRaw.toLowerCase() !== "none" && firstBreakSide === null) {
        throw new Error(`Row ${rowNumber}: first_break is not recognized.`);
      }
      const returnedRaw = get(row, "returned_to_IB").toLowerCase();
      const returnedToIb = returnedRaw === "true"
        ? true
        : returnedRaw === "false"
          ? false
          : null;
      if (returnedRaw !== "" && returnedToIb === null) {
        throw new Error(`Row ${rowNumber}: returned_to_IB is not recognized.`);
      }
      const deepestReturnRaw = column.has("deepest_return_points")
        ? get(row, "deepest_return_points")
        : "";
      const deepestReturnPoints = nullableNumber(deepestReturnRaw);
      if (deepestReturnRaw !== "" && deepestReturnPoints === null) {
        throw new Error(`Row ${rowNumber}: deepest_return_points is invalid.`);
      }
      if (deepestReturnPoints !== null && deepestReturnPoints < 0) {
        throw new Error(`Row ${rowNumber}: deepest_return_points cannot be negative.`);
      }
      const dayTypeRaw = get(row, "day_type");
      const dayType: DayType | null = ["IBN", "IBH", "IBL", "IBB"].includes(dayTypeRaw)
        ? dayTypeRaw as DayType
        : null;
      if (dayTypeRaw !== "" && dayType === null) {
        throw new Error(`Row ${rowNumber}: day_type is not recognized.`);
      }
      const dispositionRaw = get(row, "final_disposition").toLowerCase();
      const closeDisposition: CloseDisposition | null =
        dispositionRaw === "close above ibh"
          ? "ABOVE_IBH"
          : dispositionRaw === "close inside ib"
            ? "INSIDE_OR_ON_IB"
            : dispositionRaw === "close below ibl"
              ? "BELOW_IBL"
              : null;
      if (dispositionRaw !== "" && closeDisposition === null) {
        throw new Error(`Row ${rowNumber}: final_disposition is not recognized.`);
      }
      const lockedIbh = requiredNumber(get(row, "locked_IBH"), "locked_IBH", rowNumber);
      const lockedIbl = requiredNumber(get(row, "locked_IBL"), "locked_IBL", rowNumber);
      const lockedIbWidthPoints = requiredNumber(
        get(row, "locked_IB_width_points"),
        "locked_IB_width_points",
        rowNumber,
      );
      if (lockedIbh < lockedIbl || Math.abs((lockedIbh - lockedIbl) - lockedIbWidthPoints) > 0.001) {
        throw new Error(`Row ${rowNumber}: locked IB edges and width do not reconcile.`);
      }
      const suppliedBreakCode = column.has("break_code")
        ? get(row, "break_code") || null
        : null;
      const parsedSession: HistoricalIbSession = {
        id: `${batchId}:${rthDate}`,
        batchId,
        cohort,
        sourceFileName,
        sourceRowNumber: rowNumber,
        rthDate,
        sourceYear,
        contract: get(row, "contract") || null,
        status,
        missingDataDetails: get(row, "missing_data_details") || null,
        lockedIbh,
        lockedIbl,
        lockedIbWidthPoints,
        cp0730: nullableNumber(get(row, "CP_07_30")),
        cp0730PositionPct: nullableNumber(get(row, "CP_07_30_position_pct")),
        forecastInputs: null,
        firstBreakSide,
        returnedToIb,
        deepestReturnPoints,
        dayType,
        breakCode: suppliedBreakCode,
        rthClose: nullableNumber(get(row, "RTH_close")),
        closeDisposition,
        importedAt
      };
      const earlyColumns = ["ONH", "ONL", "IB15_H", "IB15_L"];
      const early = earlyColumns.map((name) => column.has(name) ? nullableNumber(get(row, name)) : null);
      if (earlyColumns.some((name, i) => column.has(name) && get(row, name) !== "" && early[i] === null)) {
        throw new Error(`Row ${rowNumber}: an ON or 15R price is invalid.`);
      }
      if (early.every((value) => value !== null)) {
        const [onHigh, onLow, fifteenHigh, fifteenLow] = early as number[];
        if (onHigh < onLow || fifteenHigh < fifteenLow || fifteenHigh > lockedIbh || fifteenLow < lockedIbl) {
          throw new Error(`Row ${rowNumber}: ON/15R edges do not reconcile with the final IB.`);
        }
        parsedSession.forecastInputs = { onHigh, onLow, fifteenHigh, fifteenLow };
      }
      const reconstructedBreakCode = derivedHistoricalIbBreakCode(parsedSession);
      if (
        suppliedBreakCode !== null &&
        reconstructedBreakCode !== null &&
        suppliedBreakCode !== reconstructedBreakCode
      ) {
        throw new Error(`Row ${rowNumber}: break_code does not reconcile with day type and close.`);
      }
      parsedSessions.push({
        ...parsedSession,
        breakCode: suppliedBreakCode ?? reconstructedBreakCode,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  const dateCounts = new Map<string, number>();
  for (const session of parsedSessions) {
    dateCounts.set(session.rthDate, (dateCounts.get(session.rthDate) ?? 0) + 1);
  }
  const duplicateDateCount = [...dateCounts.values()].filter((count) => count > 1)
    .reduce((total, count) => total + count, 0);
  if (duplicateDateCount > 0) {
    errors.push(`${duplicateDateCount} rows use duplicated RTH dates.`);
  }
  return {
    cohort,
    sourceFileName,
    contentSha256,
    rowCount: rows.length - 1,
    completeRowCount: parsedSessions.filter((session) => session.status === "OK").length,
    missingRowCount: parsedSessions.filter((session) => session.status === "MISSING_DATA").length,
    duplicateDateCount,
    years: [...new Set(parsedSessions.map((session) => session.sourceYear))].sort(),
    blockingErrors: errors,
    sessions: parsedSessions
  };
}

export function historicalIbBatchFromPreview(
  preview: HistoricalIbImportPreview,
  importedAt: string,
): HistoricalIbImportBatch {
  if (preview.blockingErrors.length > 0) {
    throw new Error("Resolve the import preview errors before importing.");
  }
  return {
    id: preview.sessions[0]?.batchId ?? `ib-history:${preview.cohort === "REFERENCE" ? "reference" : "forward-observation"}:${preview.contentSha256.slice(0, 24)}`,
    cohort: preview.cohort,
    sourceFileName: preview.sourceFileName,
    contentSha256: preview.contentSha256,
    importedAt,
    schemaVersion: preview.studyPack ? 5 : 4,
    ...(preview.studyPack ? { studyPack: preview.studyPack } : {}),
    rowCount: preview.rowCount,
    completeRowCount: preview.completeRowCount,
    missingRowCount: preview.missingRowCount,
    duplicateDateCount: preview.duplicateDateCount,
    years: preview.years
  };
}

/** Aggregate an explicit set of derived journal days without inferring missing results. */
export function summarizeDaySummaries(
  days: WeeklyDaySummary[],
): SessionPeriodStatistics {
  const widths = days
    .map((day) => day.finalIbWidth)
    .filter((width): width is number => width !== null);
  const dayTypeCounts: Record<DayType, number> = {
    IBN: 0,
    IBH: 0,
    IBL: 0,
    IBB: 0
  };
  const closeDispositionCounts: Record<CloseDisposition, number> = {
    ABOVE_IBH: 0,
    INSIDE_OR_ON_IB: 0,
    BELOW_IBL: 0
  };
  for (const day of days) {
    if (day.dayType) dayTypeCounts[day.dayType] += 1;
    if (day.closeDisposition) closeDispositionCounts[day.closeDisposition] += 1;
  }
  const recordedBreakDays = days.filter((day) => day.firstBreakSide !== null).length;

  return {
    journaledDays: days.length,
    completedDays: days.filter((day) => day.completed).length,
    incompleteDays: days.filter((day) => !day.completed).length,
    finalIbAvailableDays: widths.length,
    medianIbWidth: median(widths),
    dayTypeCounts,
    unclassifiedDayTypeCount: days.filter((day) => day.dayType === null).length,
    firstBreakCounts: {
      high: days.filter((day) => day.firstBreakSide === "IBH").length,
      low: days.filter((day) => day.firstBreakSide === "IBL").length,
      notRecorded: days.filter((day) => day.firstBreakSide === null).length
    },
    returnedInsideAfterBreakDays: days.filter(
      (day) => day.returnedInsideAfterBreak,
    ).length,
    recordedBreakDays,
    closeDispositionCounts,
    unavailableCloseCount: days.filter((day) => day.closeDisposition === null).length,
    missingDataCount: days.reduce(
      (total, day) => total + day.missingFields.length,
      0,
    )
  };
}

export function deriveWeeklySessionSummaries(
  sessions: JournalSession[],
  tickSize = 0.25,
): WeeklySessionSummary[] {
  const grouped = new Map<string, WeeklyDaySummary[]>();
  for (const session of sessions) {
    const weekStart = mondayForRthDate(session.rthDate);
    const days = grouped.get(weekStart) ?? [];
    days.push(deriveWeeklyDaySummary(session, tickSize));
    grouped.set(weekStart, days);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([weekStart, unsortedDays]) => {
      const days = [...unsortedDays].sort((left, right) =>
        left.rthDate.localeCompare(right.rthDate));

      return {
        weekStart,
        weekEnd: addCalendarDays(weekStart, 4),
        ...summarizeDaySummaries(days),
        days
      };
    });
}

function finalCalendarDateOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
  nextMonth.setUTCDate(0);
  return isoCalendarDate(nextMonth);
}

export function deriveMonthlySessionSummaries(
  sessions: JournalSession[],
  tickSize = 0.25,
): MonthlySessionSummary[] {
  const grouped = new Map<string, JournalSession[]>();
  for (const session of sessions) {
    const month = session.rthDate.slice(0, 7);
    const monthSessions = grouped.get(month) ?? [];
    monthSessions.push(session);
    grouped.set(month, monthSessions);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, monthSessions]) => {
      const days = monthSessions
        .map((session) => deriveWeeklyDaySummary(session, tickSize))
        .sort((left, right) => left.rthDate.localeCompare(right.rthDate));
      return {
        month,
        monthStart: `${month}-01`,
        monthEnd: finalCalendarDateOfMonth(month),
        ...summarizeDaySummaries(days),
        weeks: deriveWeeklySessionSummaries(monthSessions, tickSize),
        days
      };
    });
}

export function deriveYearlySessionSummaries(
  sessions: JournalSession[],
  tickSize = 0.25,
): YearlySessionSummary[] {
  const grouped = new Map<string, JournalSession[]>();
  for (const session of sessions) {
    const year = session.rthDate.slice(0, 4);
    const yearSessions = grouped.get(year) ?? [];
    yearSessions.push(session);
    grouped.set(year, yearSessions);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([year, yearSessions]) => {
      const days = yearSessions
        .map((session) => deriveWeeklyDaySummary(session, tickSize))
        .sort((left, right) => left.rthDate.localeCompare(right.rthDate));
      return {
        year,
        yearStart: `${year}-01-01`,
        yearEnd: `${year}-12-31`,
        ...summarizeDaySummaries(days),
        months: deriveMonthlySessionSummaries(yearSessions, tickSize),
        days
      };
    });
}

export function createJournalSession(
  rthDate: string,
  now: string,
  profile: JournalProfile = DEFAULT_JOURNAL,
): JournalSession {
  return {
    recordVersion: 21,
    forecast: null,
    forecastUpdates: [],
    forecastCoverage: { news: "unknown", fbd: "unknown", levels: "unknown" },
    journalId: profile.id,
    market: structuredClone(profile.template),
    id: `${profile.id === "es" ? "ES" : profile.id}:${rthDate}`,
    rthDate,
    templateId: profile.template.id,
    instrument: profile.template.instrument,
    contractStatus: profile.template.requiresContract && profile.defaultContract && (!profile.contractEffectiveDate || rthDate >= profile.contractEffectiveDate) ? "known" : "unknown",
    contract: profile.template.requiresContract && (!profile.contractEffectiveDate || rthDate >= profile.contractEffectiveDate) ? profile.defaultContract ?? null : null,
    calendarStatus: "UNVERIFIED",
    displayTimeZone: profile.template.canonicalTimeZone,
    preOpenSnapshots: [],
    cpObservations: [],
    cpObservationHistory: [],
    contractHistory: [],
    overnight: {
      high: null,
      low: null,
      status: "pending",
      rthOpen: null,
      rthOpenStatus: "pending",
      confirmedAt: null
    },
    overnightHistory: [],
    fifteenMinute: {
      high: null,
      low: null,
      cp: null,
      status: "pending",
      note: null,
      confirmedAt: null
    },
    fifteenMinuteHistory: [],
    aPeriod: {
      high: null,
      low: null,
      cp: null,
      status: "pending",
      note: null,
      confirmedAt: null
    },
    aPeriodHistory: [],
    bSnapshots: [],
    bSnapshotHistory: [],
    bPeriod: {
      high: null,
      low: null,
      cp: null,
      status: "pending",
      note: null,
      confirmedAt: null
    },
    bPeriodHistory: [],
    marketContextItems: [],
    marketContextHistory: [],
    rthObservations: [],
    rthObservationHistory: [],
    rthRangeHistory: [],
    sessionNotes: [],
    close: {
      rthHigh: null,
      rthLow: null,
      price: null,
      observedAt: null,
      recordedAt: null,
      note: null,
      pathComplete: false,
      finishedAt: null
    },
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeJournalSession(
  stored: Partial<JournalSession> & Pick<JournalSession, "id" | "rthDate">,
): JournalSession {
  const updatedAt = stored.updatedAt ?? new Date(0).toISOString();
  const range = stored.fifteenMinute ?? {
    high: null,
    low: null,
    cp: null,
    status: "pending",
    note: null,
    confirmedAt: null
  };
  const confirmed = range.high !== null && range.low !== null;

  return {
    recordVersion: 21,
    ...(stored.studyReplay ? { studyReplay: stored.studyReplay } : {}),
    journalId: stored.journalId ?? "es",
    market: stored.market ?? structuredClone(ES_STUDY_TEMPLATE),
    forecast: stored.forecast ?? null,
    forecastUpdates: stored.forecastUpdates ?? [],
    ...(stored.onForecastUpdates ? { onForecastUpdates: stored.onForecastUpdates } : {}),
    forecastCoverage: stored.forecastCoverage ?? { news: "unknown", fbd: "unknown", levels: "unknown" },
    id: stored.id,
    rthDate: stored.rthDate,
    templateId: stored.templateId ?? "ES-RTH-PT-v1",
    instrument: stored.instrument ?? "ES",
    contractStatus:
      stored.contractStatus ?? (stored.contract ? "known" : "unknown"),
    contract: stored.contract ?? null,
    calendarStatus: stored.calendarStatus ?? "UNVERIFIED",
    displayTimeZone: stored.displayTimeZone ?? "America/Los_Angeles",
    preOpenSnapshots: stored.preOpenSnapshots ?? [],
    cpObservations: stored.cpObservations ?? [],
    cpObservationHistory: stored.cpObservationHistory ?? [],
    contractHistory: stored.contractHistory ?? [],
    overnight: stored.overnight ?? {
      high: null,
      low: null,
      status: "pending",
      rthOpen: null,
      rthOpenStatus: "pending",
      confirmedAt: null
    },
    overnightHistory: stored.overnightHistory ?? [],
    fifteenMinute: {
      ...(range.rangeInputs ? { rangeInputs: range.rangeInputs } : {}),
      high: range.high ?? null,
      low: range.low ?? null,
      cp: range.cp ?? null,
      status: range.status ?? (confirmed ? "confirmed" : "pending"),
      note: range.note ?? null,
      confirmedAt: range.confirmedAt ?? null
    },
    fifteenMinuteHistory: stored.fifteenMinuteHistory ?? [],
    aPeriod: stored.aPeriod ?? {
      high: null,
      low: null,
      cp: null,
      status: "pending",
      note: null,
      confirmedAt: null
    },
    aPeriodHistory: stored.aPeriodHistory ?? [],
    bSnapshots: stored.bSnapshots ?? [],
    bSnapshotHistory: stored.bSnapshotHistory ?? [],
    bPeriod: stored.bPeriod ?? {
      high: null,
      low: null,
      cp: null,
      status: "pending",
      note: null,
      confirmedAt: null
    },
    bPeriodHistory: stored.bPeriodHistory ?? [],
    marketContextItems: stored.marketContextItems ?? [],
    marketContextHistory: stored.marketContextHistory ?? [],
    rthObservations: (stored.rthObservations ?? []).map((observation) => ({
      ...observation,
      cpObservationId: observation.cpObservationId ??
        (stored.cpObservations ?? []).find((candidate) =>
          candidate.source === "rth-observation" &&
          candidate.observedAt === observation.observedAt &&
          candidate.price === observation.price &&
          candidate.id.includes(observation.recordedAt))?.id ?? null,
    })),
    rthObservationHistory: stored.rthObservationHistory ?? [],
    rthRangeHistory: stored.rthRangeHistory ?? [],
    sessionNotes: (stored.sessionNotes ?? (
      (stored as typeof stored & {
        rthNotes?: Array<Omit<SessionNote, "phase" | "link">>;
      }).rthNotes ?? []
    ).map((note) => ({ ...note, phase: "RTH" as const }))).map((note) => ({
      ...note,
      link: "link" in note ? note.link ?? null : null,
    })),
    close: {
      rthHigh: stored.close?.rthHigh ?? null,
      rthLow: stored.close?.rthLow ?? null,
      price: stored.close?.price ?? null,
      observedAt: stored.close?.observedAt ?? null,
      recordedAt: stored.close?.recordedAt ?? null,
      note: stored.close?.note ?? null,
      pathComplete: stored.close?.pathComplete ?? false,
      finishedAt: stored.close?.finishedAt ?? null,
    },
    createdAt: stored.createdAt ?? updatedAt,
    updatedAt
  };
}

export function latestPreOpenSnapshot(
  session: JournalSession,
): PreOpenSnapshot | null {
  return session.preOpenSnapshots.at(-1) ?? null;
}

export function latestCpObservation(
  session: JournalSession,
): CpObservation | null {
  return session.cpObservations.reduce<CpObservation | null>(
    (latest, observation) =>
      latest === null || observation.observedAt >= latest.observedAt
        ? observation
        : latest,
    null,
  );
}

export function withDisplayTimeZone(
  session: JournalSession,
  displayTimeZone: string,
  updatedAt: string,
): JournalSession {
  if (!displayTimeZone.trim()) throw new Error("Choose a display timezone.");
  return {
    ...session,
    displayTimeZone,
    updatedAt
  };
}

export function withStandaloneCpObservation(
  session: JournalSession,
  price: Price,
  observedAt: string,
  recordedAt: string,
  formingOvernightEndsAt: string,
): JournalSession {
  if (!Number.isFinite(price)) throw new Error("Enter a valid current price.");
  price = roundPriceToTick(price, session.market.tickSize);
  const observation: CpObservation = {
    id: `cp:${recordedAt}:${session.cpObservations.length + 1}`,
    price,
    observedAt,
    timePrecision: "exact",
    source: "standalone",
    recordedAt,
    formingPeriods: formingPricePeriods(session, observedAt),
  };
  const latestForming = latestPreOpenSnapshot(session);
  const canExtendFormingOvernight =
    session.overnight.status !== "confirmed" &&
    observedAt < formingOvernightEndsAt &&
    latestForming !== null &&
    (latestForming.formingOvernightHigh !== null ||
      latestForming.formingOvernightLow !== null);
  const extendedHigh = !canExtendFormingOvernight
    ? latestForming?.formingOvernightHigh ?? null
    : latestForming.formingOvernightHigh === null
      ? price
      : Math.max(latestForming.formingOvernightHigh, price);
  const extendedLow = !canExtendFormingOvernight
    ? latestForming?.formingOvernightLow ?? null
    : latestForming.formingOvernightLow === null
      ? price
      : Math.min(latestForming.formingOvernightLow, price);
  const formingRangeExpanded =
    canExtendFormingOvernight &&
    (extendedHigh !== latestForming.formingOvernightHigh ||
      extendedLow !== latestForming.formingOvernightLow);
  const extensionSnapshot: PreOpenSnapshot | null = formingRangeExpanded
    ? {
        id: `preopen:${recordedAt}:${session.preOpenSnapshots.length + 1}`,
        formingOvernightHigh: extendedHigh,
        formingOvernightLow: extendedLow,
        note: null,
        recordedAt: observedAt,
        cpObservationId: observation.id
      }
    : null;
  return reconcileFormingPriceRanges({
    ...session,
    preOpenSnapshots: extensionSnapshot
      ? [...session.preOpenSnapshots, extensionSnapshot]
      : session.preOpenSnapshots,
    cpObservations: [...session.cpObservations, observation],
    updatedAt: recordedAt
  });
}

function sortCpObservations(observations: CpObservation[]): CpObservation[] {
  return [...observations].sort(
    (left, right) =>
      left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id),
  );
}

function replaceCpAtSourceTime(
  observations: CpObservation[],
  source: CpObservation["source"],
  observedAt: string,
  replacement: CpObservation | null,
): CpObservation[] {
  const remaining = observations.filter(
    (observation) =>
      observation.source !== source || observation.observedAt !== observedAt,
  );
  return replacement
    ? sortCpObservations([...remaining, replacement])
    : remaining;
}

function sortPreOpenSnapshots(snapshots: PreOpenSnapshot[]): PreOpenSnapshot[] {
  return [...snapshots].sort(
    (left, right) =>
      left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id),
  );
}

export function withRemovedStandaloneCpObservation(
  session: JournalSession,
  observationId: string,
  removedAt: string,
): JournalSession {
  const prior = session.cpObservations.find(
    (observation) => observation.id === observationId,
  );
  if (!prior || prior.source !== "standalone") {
    throw new Error("That dashboard CP observation is no longer active.");
  }
  const linkedSnapshot = session.preOpenSnapshots.find(
    (snapshot) => snapshot.cpObservationId === observationId,
  ) ?? null;
  const historyEntry: CpObservationHistoryEntry = {
    id: `cp-history:${removedAt}:removed`,
    observationId,
    action: "removed",
    prior,
    resulting: null,
    priorPreOpenSnapshot: linkedSnapshot,
    occurredAt: removedAt,
  };
  return reconcileFormingPriceRanges({
    ...session,
    preOpenSnapshots: session.preOpenSnapshots.filter(
      (snapshot) => snapshot.cpObservationId !== observationId,
    ),
    cpObservations: session.cpObservations.filter(
      (observation) => observation.id !== observationId,
    ),
    cpObservationHistory: [...session.cpObservationHistory, historyEntry],
    close: { ...session.close, pathComplete: false, finishedAt: null },
    updatedAt: removedAt,
  });
}

export function withCorrectedStandaloneCpObservation(session: JournalSession, observationId: string,
  price: Price, observedAt: string, correctedAt: string): JournalSession {
  if (!Number.isFinite(price)) throw new Error('Enter a valid current price.');
  price = roundPriceToTick(price, session.market.tickSize);
  const prior = session.cpObservations.find(p => p.id === observationId);
  if (!prior || prior.source !== 'standalone') throw new Error('That dashboard price is no longer active.');
  const trackedFormation = prior.formingPeriods?.length || session.cpObservationHistory.some(e =>
    e.observationId === observationId && e.prior?.formingPeriods?.length);
  const resulting: CpObservation = { ...prior, price, observedAt,
    // Corrections can move a tracked price between formation periods, including a now-confirmed checkpoint.
    formingPeriods: trackedFormation ? formingPricePeriods({ ...session,
      fifteenMinute: { ...session.fifteenMinute, status: 'pending' }, aPeriod: { ...session.aPeriod, status: 'pending' },
      bPeriod: { ...session.bPeriod, status: 'pending' } }, observedAt) : [],
  };
  return reconcileFormingPriceRanges({ ...session,
    cpObservations: sortCpObservations(session.cpObservations.map(p => p.id === observationId ? resulting : p)),
    cpObservationHistory: [...session.cpObservationHistory, { id: `cp-history:${correctedAt}:corrected`,
      observationId, action: 'corrected', prior, resulting, priorPreOpenSnapshot: null, occurredAt: correctedAt }],
    close: { ...session.close, pathComplete: false, finishedAt: null }, updatedAt: correctedAt });
}

export function withUndoneStandaloneCpCorrection(session: JournalSession, historyEntryId: string, undoneAt: string): JournalSession {
  const entry = session.cpObservationHistory.find(e => e.id === historyEntryId);
  if (entry?.action !== 'corrected' || !entry.prior || !session.cpObservations.some(p => p.id === entry.observationId))
    throw new Error('That dashboard price correction can no longer be undone.');
  return reconcileFormingPriceRanges({ ...session,
    cpObservations: sortCpObservations(session.cpObservations.map(p => p.id === entry.observationId ? entry.prior! : p)),
    cpObservationHistory: [...session.cpObservationHistory, { id: `cp-history:${undoneAt}:undo-correction`,
      observationId: entry.observationId, action: 'undo_correction', prior: entry.resulting, resulting: entry.prior,
      priorPreOpenSnapshot: null, occurredAt: undoneAt }], updatedAt: undoneAt });
}

export function withUndoneStandaloneCpRemoval(
  session: JournalSession,
  historyEntryId: string,
  undoneAt: string,
): JournalSession {
  const sourceEntry = session.cpObservationHistory.find(
    (entry) => entry.id === historyEntryId,
  );
  if (sourceEntry?.action !== "removed" || !sourceEntry.prior) {
    throw new Error("That dashboard CP removal can no longer be undone.");
  }
  if (session.cpObservations.some(
    (observation) => observation.id === sourceEntry.observationId,
  )) {
    throw new Error("That dashboard CP observation is already active.");
  }
  const historyEntry: CpObservationHistoryEntry = {
    id: `cp-history:${undoneAt}:undo-removal`,
    observationId: sourceEntry.observationId,
    action: "undo_removal",
    prior: null,
    resulting: sourceEntry.prior,
    priorPreOpenSnapshot: sourceEntry.priorPreOpenSnapshot,
    occurredAt: undoneAt,
  };
  return reconcileFormingPriceRanges({
    ...session,
    preOpenSnapshots: sourceEntry.priorPreOpenSnapshot
      ? sortPreOpenSnapshots([
          ...session.preOpenSnapshots,
          sourceEntry.priorPreOpenSnapshot,
        ])
      : session.preOpenSnapshots,
    cpObservations: sortCpObservations([
      ...session.cpObservations,
      sourceEntry.prior,
    ]),
    cpObservationHistory: [...session.cpObservationHistory, historyEntry],
    updatedAt: undoneAt,
  });
}

export function createSignificantLevel(
  session: JournalSession,
  update: SignificantLevelUpdate,
  originAt: string | null,
  cpObservedAt: string | null,
  now: string,
): { level: SignificantLevel; session: JournalSession } {
  update = roundManualPriceFields(update, session.market.tickSize);
  if (update.shape === "single_price" && update.price === null) {
    throw new Error("Enter the Significant Level price.");
  }
  if (
    update.shape === "price_zone" &&
    (update.zoneLow === null || update.zoneHigh === null)
  ) {
    throw new Error("Enter both Significant Level zone boundaries.");
  }
  if (
    update.shape === "price_zone" &&
    update.zoneLow !== null &&
    update.zoneHigh !== null &&
    update.zoneLow > update.zoneHigh
  ) {
    throw new Error("Zone low cannot be above zone high.");
  }
  if (update.originTimePrecision === "unknown" && originAt !== null) {
    throw new Error("Unknown origin time cannot have an origin timestamp.");
  }
  if (update.originTimePrecision !== "unknown" && originAt === null) {
    throw new Error("Choose the market origin date and time.");
  }
  if (update.currentPrice !== null && cpObservedAt === null) {
    throw new Error("Choose the CP observation time.");
  }
  if (update.producedTwentyPlus && update.qualifyingMoveDirection === null) {
    throw new Error("Choose the direction of the 20+ point move.");
  }
  if (
    update.qualifyingMovePoints != null &&
    (!update.producedTwentyPlus || update.qualifyingMovePoints < 20)
  ) {
    throw new Error("A qualifying move must be at least 20 points.");
  }

  const levelId = `${session.journalId}:level:${now}`;
  const cpObservation: CpObservation | null =
    update.currentPrice === null
      ? null
      : {
          id: `cp:${now}:${session.cpObservations.length + 1}`,
          price: update.currentPrice,
          observedAt: cpObservedAt!,
          timePrecision: "exact",
          source: "significant-level"
        };
  const created: SignificantLevelLifecycleEvent = {
    id: `level-event:${now}:created`,
    action: "created",
    priorStatus: null,
    resultingStatus: "active",
    occurredAt: now,
    source: "manual"
  };
  const level: SignificantLevel = {
    id: levelId,
    instrument: session.instrument,
    createdInSessionId: session.id,
    createdInRthDate: session.rthDate,
    levelType: update.levelType,
    shape: update.shape,
    price: update.shape === "single_price" ? update.price : null,
    zoneLow: update.shape === "price_zone" ? update.zoneLow : null,
    zoneHigh: update.shape === "price_zone" ? update.zoneHigh : null,
    originTimePrecision: update.originTimePrecision,
    originAt,
    sourceTimeframe: update.sourceTimeframe ?? "unknown",
    producedTwentyPlus: update.producedTwentyPlus ?? false,
    qualifyingMoveDirection: update.producedTwentyPlus
      ? update.qualifyingMoveDirection ?? null
      : null,
    qualifyingMovePoints: update.producedTwentyPlus
      ? update.qualifyingMovePoints ?? null
      : null,
    label: update.label?.trim() || null,
    note: update.note?.trim() || null,
    notes: [],
    marketEvents: [],
    episodes: [],
    showOnMap: false,
    linkedCpObservationId: cpObservation?.id ?? null,
    createdAt: now,
    currentStatus: "active",
    lifecycleEvents: [created],
    revisionHistory: [],
    updatedAt: now
  };

  return {
    level,
    session: cpObservation
      ? {
          ...session,
          cpObservations: [...session.cpObservations, cpObservation],
          updatedAt: now
        }
      : session
  };
}

export function withSignificantLevelMapVisibility(
  level: SignificantLevel,
  showOnMap: boolean,
  changedAt: string,
): SignificantLevel {
  if (level.currentStatus === "removed") {
    throw new Error("That Significant Level is no longer available.");
  }
  return { ...level, showOnMap, updatedAt: changedAt };
}

export function withSignificantLevelNote(
  level: SignificantLevel,
  text: string,
  observedAt: string,
  recordedAt: string,
): SignificantLevel {
  if (level.currentStatus === "removed") {
    throw new Error("That Significant Level is no longer available.");
  }
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Enter a level note.");
  const note: SignificantLevelNote = {
    id: `level-note:${recordedAt}:${level.notes.length + 1}`,
    text: trimmed,
    observedAt,
    recordedAt,
    removedAt: null,
  };
  return {
    ...level,
    notes: [...level.notes, note].sort(
      (left, right) => left.observedAt.localeCompare(right.observedAt),
    ),
    updatedAt: recordedAt,
  };
}

export function withRemovedSignificantLevelNote(
  level: SignificantLevel,
  noteId: string,
  removedAt: string,
): SignificantLevel {
  if (!level.notes.some((note) => note.id === noteId && note.removedAt === null)) {
    throw new Error("That level note is unavailable.");
  }
  return {
    ...level,
    notes: level.notes.map((note) => note.id === noteId
      ? { ...note, removedAt }
      : note),
    updatedAt: removedAt,
  };
}

export function withSignificantLevelMarketEvent(
  level: SignificantLevel,
  update: SignificantLevelMarketEventUpdate,
  recordedAt: string,
): SignificantLevel {
  if (level.currentStatus !== "active") {
    throw new Error("Only an active Significant Level can receive a new interaction.");
  }
  if(duplicateManualLevelEvent(level,update.kind,update.observedAt,update.sessionId))
    throw new Error("This observation is already recorded at that time. Add a note or choose a different time.");
  const marketEvent: SignificantLevelMarketEvent = {
    id: `level-market-event:${recordedAt}:${level.marketEvents.length + 1}`,
    kind: update.kind,
    levelId: level.id,
    sessionId: update.sessionId,
    rthDate: update.rthDate,
    observedAt: update.observedAt,
    phase: update.phase,
    observedPrice: update.observedPrice,
    linkedEvents: update.linkedEvents.map((event) => ({ ...event })),
    note: update.note?.trim() || null,
    recordedAt,
    removedAt: null,
  };
  return {
    ...level,
    marketEvents: [...level.marketEvents, marketEvent].sort(
      (left, right) => left.observedAt.localeCompare(right.observedAt),
    ),
    updatedAt: recordedAt,
  };
}

export function withRemovedSignificantLevelMarketEvent(
  level: SignificantLevel,
  marketEventId: string,
  removedAt: string,
): SignificantLevel {
  if (!level.marketEvents.some(
    (marketEvent) => marketEvent.id === marketEventId && marketEvent.removedAt === null,
  )) {
    throw new Error("That Significant Level interaction is unavailable.");
  }
  return {
    ...level,
    marketEvents: level.marketEvents.map((marketEvent) =>
      marketEvent.id === marketEventId
        ? { ...marketEvent, removedAt }
        : marketEvent),
    updatedAt: removedAt,
  };
}

export function withRestoredSignificantLevelMarketEvent(level:SignificantLevel,id:string,restoredAt:string):SignificantLevel {
  if(level.currentStatus!=='active'||!level.marketEvents.some(event=>event.id===id&&event.removedAt))
    throw new Error('That removed observation is unavailable.');
  return {...level,marketEvents:level.marketEvents.map(event=>event.id===id?{...event,removedAt:null}:event),updatedAt:restoredAt};
}

export function withConfirmedSignificantLevelEpisode(
  level: SignificantLevel,
  update: SignificantLevelEpisodeUpdate,
  confirmedAt: string,
): SignificantLevel {
  if (level.currentStatus === "removed") {
    throw new Error("That Significant Level is no longer available.");
  }
  if (update.evidence.levelId !== level.id) {
    throw new Error("The recorded interaction belongs to a different Significant Level.");
  }
  if (!["crossover", "zone_traversed"].includes(update.evidence.kind)) {
    throw new Error("FBD/FBO confirmation requires recorded crossover evidence.");
  }
  const expectedDirection = update.classification === "FBD"
    ? "below_to_above"
    : "above_to_below";
  if (update.evidence.direction !== expectedDirection) {
    throw new Error(`${update.classification} does not match the recorded crossover direction.`);
  }
  if (level.episodes.some(
    (episode) =>
      episode.evidenceInteractionId === update.evidence.id &&
      episode.removedAt === null,
  )) {
    throw new Error("That recorded interaction is already confirmed.");
  }
  const episode: SignificantLevelEpisode = {
    id: `level-episode:${confirmedAt}:${level.episodes.length + 1}`,
    classification: update.classification,
    levelId: level.id,
    sessionId: update.sessionId,
    rthDate: update.rthDate,
    observedAt: update.observedAt,
    phase: update.phase,
    evidenceInteractionId: update.evidence.id,
    evidenceKind: update.evidence.kind,
    evidenceDirection: update.evidence.direction,
    priorCp: update.evidence.priorCp,
    priorObservedAt: update.evidence.priorObservedAt,
    laterCp: update.evidence.laterCp,
    laterObservedAt: update.evidence.laterObservedAt,
    crossingTimeKnown: false,
    linkedEvents: update.linkedEvents.map((event) => ({ ...event })),
    note: update.note?.trim() || null,
    confirmedAt,
    removedAt: null,
  };
  return {
    ...level,
    episodes: [...level.episodes, episode].sort(
      (left, right) => left.observedAt.localeCompare(right.observedAt),
    ),
    updatedAt: confirmedAt,
  };
}

export function withRemovedSignificantLevelEpisode(
  level: SignificantLevel,
  episodeId: string,
  removedAt: string,
): SignificantLevel {
  if (!level.episodes.some(
    (episode) => episode.id === episodeId && episode.removedAt === null,
  )) {
    throw new Error("That confirmed FBD/FBO episode is unavailable.");
  }
  return {
    ...level,
    episodes: level.episodes.map((episode) => episode.id === episodeId
      ? { ...episode, removedAt }
      : episode),
    updatedAt: removedAt,
  };
}

function significantLevelSnapshot(
  level: SignificantLevel,
): SignificantLevelRevisionSnapshot {
  return {
    levelType: level.levelType,
    shape: level.shape,
    price: level.price,
    zoneLow: level.zoneLow,
    zoneHigh: level.zoneHigh,
    originTimePrecision: level.originTimePrecision,
    originAt: level.originAt,
    sourceTimeframe: level.sourceTimeframe,
    producedTwentyPlus: level.producedTwentyPlus,
    qualifyingMoveDirection: level.qualifyingMoveDirection,
    qualifyingMovePoints: level.qualifyingMovePoints,
    label: level.label,
    note: level.note,
    linkedCpObservationId: level.linkedCpObservationId,
    currentStatus: level.currentStatus,
  };
}

function validateSignificantLevelUpdate(
  update: SignificantLevelUpdate,
  originAt: string | null,
  cpObservedAt: string | null,
): void {
  if (update.shape === "single_price" && update.price === null) {
    throw new Error("Enter the Significant Level price.");
  }
  if (
    update.shape === "price_zone" &&
    (update.zoneLow === null || update.zoneHigh === null)
  ) {
    throw new Error("Enter both Significant Level zone boundaries.");
  }
  if (
    update.shape === "price_zone" &&
    update.zoneLow !== null &&
    update.zoneHigh !== null &&
    update.zoneLow > update.zoneHigh
  ) {
    throw new Error("Zone low cannot be above zone high.");
  }
  if (update.originTimePrecision === "unknown" && originAt !== null) {
    throw new Error("Unknown origin time cannot have an origin timestamp.");
  }
  if (update.originTimePrecision !== "unknown" && originAt === null) {
    throw new Error("Choose the market origin date and time.");
  }
  if (update.currentPrice !== null && cpObservedAt === null) {
    throw new Error("Choose the CP observation time.");
  }
  if (update.producedTwentyPlus && update.qualifyingMoveDirection === null) {
    throw new Error("Choose the direction of the 20+ point move.");
  }
  if (
    update.qualifyingMovePoints != null &&
    (!update.producedTwentyPlus || update.qualifyingMovePoints < 20)
  ) {
    throw new Error("A qualifying move must be at least 20 points.");
  }
}

function replaceSignificantLevelCp(
  session: JournalSession,
  level: SignificantLevel,
  price: Price | null,
  observedAt: string | null,
  changedAt: string,
): { cpObservations: CpObservation[]; cpObservation: CpObservation | null } {
  const existing = level.linkedCpObservationId
    ? session.cpObservations.find(
        (observation) => observation.id === level.linkedCpObservationId,
      ) ?? null
    : null;
  const remaining = level.linkedCpObservationId
    ? session.cpObservations.filter(
        (observation) => observation.id !== level.linkedCpObservationId,
      )
    : session.cpObservations;
  if (price === null) return { cpObservations: remaining, cpObservation: null };
  if (observedAt === null) throw new Error("Choose the CP observation time.");
  const cpObservation: CpObservation = {
    id: existing?.id ?? `cp:${changedAt}:${remaining.length + 1}`,
    price,
    observedAt,
    timePrecision: "exact",
    source: "significant-level",
  };
  return {
    cpObservations: sortCpObservations([...remaining, cpObservation]),
    cpObservation,
  };
}

export function withCorrectedSignificantLevel(
  session: JournalSession,
  level: SignificantLevel,
  update: SignificantLevelUpdate,
  originAt: string | null,
  cpObservedAt: string | null,
  correctedAt: string,
  preserveLinkedCp = false,
): { level: SignificantLevel; session: JournalSession } {
  update = roundManualPriceFields(update, session.market.tickSize);
  if (level.currentStatus === "removed") {
    throw new Error("That Significant Level is no longer active in the journal.");
  }
  validateSignificantLevelUpdate(update, originAt, cpObservedAt);
  const replacement = preserveLinkedCp ? {
    cpObservations: session.cpObservations,
    cpObservation: session.cpObservations.find((cp) => cp.id === level.linkedCpObservationId) ?? null,
  } : replaceSignificantLevelCp(
    session,
    level,
    update.currentPrice,
    cpObservedAt,
    correctedAt,
  );
  const prior = significantLevelSnapshot(level);
  const correctedBase: SignificantLevel = {
    ...level,
    levelType: update.levelType,
    shape: update.shape,
    price: update.shape === "single_price" ? update.price : null,
    zoneLow: update.shape === "price_zone" ? update.zoneLow : null,
    zoneHigh: update.shape === "price_zone" ? update.zoneHigh : null,
    originTimePrecision: update.originTimePrecision,
    originAt,
    sourceTimeframe: update.sourceTimeframe ?? "unknown",
    producedTwentyPlus: update.producedTwentyPlus ?? false,
    qualifyingMoveDirection: update.producedTwentyPlus
      ? update.qualifyingMoveDirection ?? null
      : null,
    qualifyingMovePoints: update.producedTwentyPlus
      ? update.qualifyingMovePoints ?? null
      : null,
    label: update.label?.trim() || null,
    note: update.note?.trim() || null,
    linkedCpObservationId: preserveLinkedCp ? level.linkedCpObservationId : replacement.cpObservation?.id ?? null,
    updatedAt: correctedAt,
  };
  const historyEntry: SignificantLevelRevisionEntry = {
    id: `level-revision:${correctedAt}:corrected`,
    action: "corrected",
    prior,
    resulting: significantLevelSnapshot(correctedBase),
    priorLinkedCp: level.linkedCpObservationId
      ? session.cpObservations.find(
          (observation) => observation.id === level.linkedCpObservationId,
        ) ?? null
      : null,
    resultingLinkedCp: replacement.cpObservation,
    occurredAt: correctedAt,
  };
  const corrected: SignificantLevel = {
    ...correctedBase,
    revisionHistory: [...(level.revisionHistory ?? []), historyEntry],
  };
  return {
    level: corrected,
    session: {
      ...session,
      cpObservations: replacement.cpObservations,
      updatedAt: correctedAt,
    },
  };
}

export function dailyLowSignificantLevelId(sessionId: string): string {
  return `level:daily-low:${sessionId}`;
}

export function upsertFinishedSessionDailyLow(
  session: JournalSession,
  existingLevel: SignificantLevel | null,
  recordedAt: string,
  tickSize = 0.25,
): SignificantLevel | null {
  if (session.close.finishedAt === null) {
    throw new Error("Finish the day before creating its Daily Low.");
  }
  const { rthLow, price: closePrice } = session.close;
  if (rthLow === null || closePrice === null) {
    throw new Error("Confirmed RTH low and close are required for the Daily Low.");
  }
  if (closePrice < rthLow + tickSize) return null;

  const id = dailyLowSignificantLevelId(session.id);
  if (existingLevel?.id !== undefined && existingLevel.id !== id) {
    throw new Error("The existing Daily Low belongs to another session.");
  }
  if (existingLevel?.currentStatus === "removed") return null;

  if (existingLevel) {
    if (
      existingLevel.levelType === "low" &&
      existingLevel.shape === "single_price" &&
      existingLevel.price === rthLow &&
      existingLevel.sourceTimeframe === "daily"
    ) {
      return existingLevel;
    }
    const prior = significantLevelSnapshot(existingLevel);
    const correctedBase: SignificantLevel = {
      ...existingLevel,
      levelType: "low",
      shape: "single_price",
      price: rthLow,
      zoneLow: null,
      zoneHigh: null,
      sourceTimeframe: "daily",
      updatedAt: recordedAt,
    };
    const historyEntry: SignificantLevelRevisionEntry = {
      id: `level-revision:${recordedAt}:rth-close`,
      action: "corrected",
      prior,
      resulting: significantLevelSnapshot(correctedBase),
      priorLinkedCp: null,
      resultingLinkedCp: null,
      occurredAt: recordedAt,
    };
    return {
      ...correctedBase,
      revisionHistory: [...(existingLevel.revisionHistory ?? []), historyEntry],
    };
  }

  return {
    id,
    instrument: session.instrument,
    createdInSessionId: session.id,
    createdInRthDate: session.rthDate,
    levelType: "low",
    shape: "single_price",
    price: rthLow,
    zoneLow: null,
    zoneHigh: null,
    originTimePrecision: "unknown",
    originAt: null,
    sourceTimeframe: "daily",
    producedTwentyPlus: false,
    qualifyingMoveDirection: null,
    qualifyingMovePoints: null,
    label: `${session.rthDate} Daily Low`,
    note: null,
    notes: [],
    marketEvents: [],
    episodes: [],
    showOnMap: false,
    linkedCpObservationId: null,
    createdAt: recordedAt,
    currentStatus: "active",
    lifecycleEvents: [{
      id: `level-event:${recordedAt}:created-rth-low`,
      action: "created",
      priorStatus: null,
      resultingStatus: "active",
      occurredAt: recordedAt,
      source: "rth_close",
    }],
    revisionHistory: [],
    updatedAt: recordedAt,
  };
}

export function withRemovedSignificantLevel(
  session: JournalSession,
  level: SignificantLevel,
  removedAt: string,
): { level: SignificantLevel; session: JournalSession; historyEntryId: string } {
  if (level.currentStatus === "removed") {
    throw new Error("That Significant Level is already removed.");
  }
  const prior = significantLevelSnapshot(level);
  const priorLinkedCp = level.linkedCpObservationId
    ? session.cpObservations.find(
        (observation) => observation.id === level.linkedCpObservationId,
      ) ?? null
    : null;
  const lifecycleEvent: SignificantLevelLifecycleEvent = {
    id: `level-event:${removedAt}:removed`,
    action: "removed",
    priorStatus: level.currentStatus,
    resultingStatus: "removed",
    occurredAt: removedAt,
    source: "manual",
  };
  const removedBase: SignificantLevel = {
    ...level,
    currentStatus: "removed",
    lifecycleEvents: [...level.lifecycleEvents, lifecycleEvent],
    updatedAt: removedAt,
  };
  const historyEntry: SignificantLevelRevisionEntry = {
    id: `level-revision:${removedAt}:removed`,
    action: "removed",
    prior,
    resulting: significantLevelSnapshot(removedBase),
    priorLinkedCp,
    resultingLinkedCp: null,
    occurredAt: removedAt,
  };
  return {
    level: {
      ...removedBase,
      revisionHistory: [...(level.revisionHistory ?? []), historyEntry],
    },
    session: {
      ...session,
      cpObservations: priorLinkedCp
        ? session.cpObservations.filter(
            (observation) => observation.id !== priorLinkedCp.id,
          )
        : session.cpObservations,
      updatedAt: removedAt,
    },
    historyEntryId: historyEntry.id,
  };
}

export function withUndoneSignificantLevelChange(
  session: JournalSession,
  level: SignificantLevel,
  historyEntryId: string,
  undoneAt: string,
): { level: SignificantLevel; session: JournalSession } {
  const sourceEntry = (level.revisionHistory ?? []).find(
    (entry) => entry.id === historyEntryId,
  );
  if (!sourceEntry || !["corrected", "removed"].includes(sourceEntry.action)) {
    throw new Error("That Significant Level change can no longer be undone.");
  }
  if (!sourceEntry.prior) throw new Error("The prior Significant Level is unavailable.");
  const currentLinkedCp = level.linkedCpObservationId
    ? session.cpObservations.find(
        (observation) => observation.id === level.linkedCpObservationId,
      ) ?? null
    : null;
  const withoutCurrentCp = currentLinkedCp
    ? session.cpObservations.filter((observation) => observation.id !== currentLinkedCp.id)
    : session.cpObservations;
  const restoredCpObservations = sourceEntry.priorLinkedCp
    ? sortCpObservations([...withoutCurrentCp, sourceEntry.priorLinkedCp])
    : withoutCurrentCp;
  const prior = sourceEntry.prior;
  const undoLifecycle: SignificantLevelLifecycleEvent | null =
    sourceEntry.action === "removed"
      ? {
          id: `level-event:${undoneAt}:removal-undone`,
          action: "removal_undone",
          priorStatus: level.currentStatus,
          resultingStatus: prior.currentStatus,
          occurredAt: undoneAt,
          source: "manual",
        }
      : null;
  const restoredBase: SignificantLevel = {
    ...level,
    ...prior,
    lifecycleEvents: undoLifecycle
      ? [...level.lifecycleEvents, undoLifecycle]
      : level.lifecycleEvents,
    updatedAt: undoneAt,
  };
  const historyEntry: SignificantLevelRevisionEntry = {
    id: `level-revision:${undoneAt}:undo`,
    action: sourceEntry.action === "corrected" ? "undo_correction" : "undo_removal",
    prior: significantLevelSnapshot(level),
    resulting: significantLevelSnapshot(restoredBase),
    priorLinkedCp: currentLinkedCp,
    resultingLinkedCp: sourceEntry.priorLinkedCp,
    occurredAt: undoneAt,
  };
  return {
    level: {
      ...restoredBase,
      revisionHistory: [...(level.revisionHistory ?? []), historyEntry],
    },
    session: {
      ...session,
      cpObservations: restoredCpObservations,
      updatedAt: undoneAt,
    },
  };
}

export function withSignificantLevelLifecycleAction(
  level: SignificantLevel,
  action: SignificantLevelStatusAction,
  now: string,
  archiveDetails?: SignificantLevelArchiveDetails,
): SignificantLevel {
  const allowed =
    (action === "retired" && level.currentStatus === "active") ||
    (action === "invalidated" && level.currentStatus === "active") ||
    (action === "restored" && level.currentStatus === "retired") ||
    (action === "invalidation_corrected" &&
      level.currentStatus === "invalidated");
  if (!allowed) {
    throw new Error(`Cannot ${action.replaceAll("_", " ")} an ${level.currentStatus} level.`);
  }
  if (archiveDetails && !["breakdown", "fbd_low_broken", "no_longer_tracking", "duplicate", "other"].includes(archiveDetails.reason)) {
    throw new Error("Choose an archive reason.");
  }
  if (archiveDetails?.reason === "other" && !archiveDetails.note?.trim()) throw new Error("Add a note for the archive reason.");
  const resultingStatus: SignificantLevelStatus =
    action === "retired"
      ? "retired"
      : action === "invalidated"
        ? "invalidated"
        : "active";
  const lifecycleEvent: SignificantLevelLifecycleEvent = {
    id: `level-event:${now}:${action}`,
    action,
    priorStatus: level.currentStatus,
    resultingStatus,
    occurredAt: now,
    archiveDetails: archiveDetails ? { ...archiveDetails, note: archiveDetails.note?.trim() || null } : undefined,
    source: "manual"
  };
  return {
    ...level,
    currentStatus: resultingStatus,
    lifecycleEvents: [...level.lifecycleEvents, lifecycleEvent],
    updatedAt: now
  };
}

function priceSide(price: Price, level: Price, tickSize: number): -1 | 0 | 1 {
  const epsilon = 1e-9;
  if (price <= level - tickSize + epsilon) return -1;
  if (price >= level + tickSize - epsilon) return 1;
  return 0;
}

export function deriveSignificantLevelInteractions(
  levels: SignificantLevel[],
  cpObservations: CpObservation[],
  tickSize = 0.25,
): SignificantLevelInteraction[] {
  const ordered = [...cpObservations].sort(
    (left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.id.localeCompare(right.id),
  );
  const interactions: SignificantLevelInteraction[] = [];

  for (const level of levels.filter((candidate) => candidate.currentStatus === "active")) {
    // A completed range cannot interact with prices from its own formation.
    if (level.sessionEdge?.status === 'forming') continue;
    const path = level.sessionEdge ? ordered.filter(p => Date.parse(p.observedAt) >= Date.parse(level.sessionEdge!.availableAt)) : ordered;
    for (let index = 0; index < path.length; index += 1) {
      const later = path[index];
      const prior = path[index - 1] ?? null;
      if (level.shape === "single_price" && level.price !== null) {
        if (Math.abs(later.price - level.price) < 1e-9) {
          interactions.push({
            id: `${level.id}:touch:${later.id}`,
            levelId: level.id,
            kind: "touch",
            direction: null,
            priorCp: prior?.price ?? null,
            priorObservedAt: prior?.observedAt ?? null,
            laterCp: later.price,
            laterObservedAt: later.observedAt,
            crossingTimeKnown: false
          });
        }
        if (prior) {
          const before = priceSide(prior.price, level.price, tickSize);
          const after = priceSide(later.price, level.price, tickSize);
          if (before !== 0 && after !== 0 && before !== after) {
            interactions.push({
              id: `${level.id}:crossover:${prior.id}:${later.id}`,
              levelId: level.id,
              kind: "crossover",
              direction: before < after ? "below_to_above" : "above_to_below",
              priorCp: prior.price,
              priorObservedAt: prior.observedAt,
              laterCp: later.price,
              laterObservedAt: later.observedAt,
              crossingTimeKnown: false
            });
          }
        }
        continue;
      }

      if (
        !prior ||
        level.zoneLow === null ||
        level.zoneHigh === null
      ) continue;
      const priorBelow = prior.price <= level.zoneLow - tickSize + 1e-9;
      const priorAbove = prior.price >= level.zoneHigh + tickSize - 1e-9;
      const laterBelow = later.price <= level.zoneLow - tickSize + 1e-9;
      const laterAbove = later.price >= level.zoneHigh + tickSize - 1e-9;
      const laterInside =
        later.price >= level.zoneLow + tickSize - 1e-9 &&
        later.price <= level.zoneHigh - tickSize + 1e-9;
      if ((priorBelow && laterAbove) || (priorAbove && laterBelow)) {
        interactions.push({
          id: `${level.id}:zone-traversed:${prior.id}:${later.id}`,
          levelId: level.id,
          kind: "zone_traversed",
          direction: priorBelow ? "below_to_above" : "above_to_below",
          priorCp: prior.price,
          priorObservedAt: prior.observedAt,
          laterCp: later.price,
          laterObservedAt: later.observedAt,
          crossingTimeKnown: false
        });
      } else if ((priorBelow || priorAbove) && laterInside) {
        interactions.push({
          id: `${level.id}:zone-entered:${prior.id}:${later.id}`,
          levelId: level.id,
          kind: "zone_entered",
          direction: priorBelow ? "below_to_inside" : "above_to_inside",
          priorCp: prior.price,
          priorObservedAt: prior.observedAt,
          laterCp: later.price,
          laterObservedAt: later.observedAt,
          crossingTimeKnown: false
        });
      }
    }
  }
  return interactions.sort((left, right) =>
    left.laterObservedAt.localeCompare(right.laterObservedAt),
  );
}

export function withPreOpenUpdate(
  session: JournalSession,
  update: PreOpenUpdate,
  observedAt: string,
  now: string,
  preserveCp = false,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  if (
    update.formingOvernightHigh !== null &&
    update.formingOvernightLow !== null &&
    update.formingOvernightHigh < update.formingOvernightLow
  ) {
    throw new Error("Forming ON high must be greater than or equal to ON low.");
  }

  const normalizedContract =
    update.contractStatus === "known" ? update.contract?.trim() || null : null;
  if (update.contractStatus === "known" && normalizedContract === null) {
    throw new Error("Enter the exact contract or keep contract status Unknown.");
  }

  const contractChanged =
    session.contractStatus !== update.contractStatus ||
    session.contract !== normalizedContract;
  const hasObservation =
    update.formingOvernightHigh !== null ||
    update.formingOvernightLow !== null ||
    update.cp !== null ||
    Boolean(update.note?.trim());
  if (!contractChanged && !hasObservation) {
    throw new Error("Enter a forming level, CP, note, or contract update first.");
  }

  const cpObservation: CpObservation | null =
    update.cp === null
      ? null
      : {
          id: `cp:${now}:${session.cpObservations.length + 1}`,
          price: update.cp,
          observedAt,
          timePrecision: "exact",
          source: "preopen"
        };
  const formingOvernightHigh =
    update.cp !== null && update.formingOvernightHigh !== null
      ? Math.max(update.formingOvernightHigh, update.cp)
      : update.formingOvernightHigh;
  const formingOvernightLow =
    update.cp !== null && update.formingOvernightLow !== null
      ? Math.min(update.formingOvernightLow, update.cp)
      : update.formingOvernightLow;
  const snapshot: PreOpenSnapshot = {
    id: `preopen:${now}:${session.preOpenSnapshots.length + 1}`,
    formingOvernightHigh,
    formingOvernightLow,
    note: update.note?.trim() || null,
    recordedAt: observedAt,
    cpObservationId: cpObservation?.id ?? null
  };

  return {
    ...session,
    contractStatus: update.contractStatus,
    contract: normalizedContract,
    preOpenSnapshots: [...session.preOpenSnapshots, snapshot],
    cpObservations: preserveCp ? session.cpObservations : replaceCpAtSourceTime(
      session.cpObservations,
      "preopen",
      observedAt,
      cpObservation,
    ),
    contractHistory: contractChanged
      ? [
          ...session.contractHistory,
          {
            status: update.contractStatus,
            contract: normalizedContract,
            changedAt: now
          }
        ]
      : session.contractHistory,
    updatedAt: now
  };
}

export function withOvernightUpdate(
  session: JournalSession,
  update: OvernightUpdate,
  now: string,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  const edges = sortRangeEdges(update.high, update.low);
  if (
    update.high === null &&
    update.low === null &&
    update.rthOpen === null
  ) {
    throw new Error("Enter an overnight edge or RTH opening price first.");
  }
  if (update.confirm && (update.high === null || update.low === null)) {
    throw new Error("Both completed ON edges are required for confirmation.");
  }

  const overnight: OvernightCheckpoint = {
    high: edges.high,
    low: edges.low,
    status: update.confirm ? "confirmed" : "pending",
    rthOpen: update.rthOpen,
    rthOpenStatus: update.rthOpen === null ? "pending" : "recorded",
    confirmedAt: update.confirm ? now : null
  };

  return {
    ...session,
    overnight,
    overnightHistory: [
      ...session.overnightHistory,
      { ...overnight, recordedAt: now }
    ],
    updatedAt: now
  };
}

export function withFifteenMinuteRange(
  session: JournalSession,
  update: FifteenMinuteUpdate,
  checkpointObservedAt: string,
  now: string,
  confirm = true,
  preserveCp = false,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  const edges = sortRangeEdges(update.high, update.low);

  if (
    update.high === null &&
    update.low === null &&
    update.cp === null &&
    !update.note?.trim()
  ) {
    throw new Error("Enter a 15R edge, CP, or note first.");
  }

  const confirmed = confirm && update.high !== null && update.low !== null;
  const cpObservation: CpObservation | null =
    update.cp === null
      ? null
      : {
          id: `cp:${now}:${session.cpObservations.length + 1}`,
          price: update.cp,
          observedAt: checkpointObservedAt,
          timePrecision: "exact",
          source: "checkpoint-15m"
        };
  const fifteenMinute: RangeCheckpoint = {
    rangeInputs: manualRangeInputs(session, '15R', edges),
    high: edges.high,
    low: edges.low,
    cp: preserveCp ? session.fifteenMinute.cp : update.cp,
    status: confirmed ? "confirmed" : "pending",
    note: update.note?.trim() || null,
    confirmedAt: confirmed ? now : null
  };

  return reconcileFormingPriceRanges({
    ...session,
    fifteenMinute,
    fifteenMinuteHistory: [
      ...session.fifteenMinuteHistory,
      { ...fifteenMinute, recordedAt: now, observedAt: checkpointObservedAt }
    ],
    cpObservations: preserveCp ? session.cpObservations : replaceCpAtSourceTime(
      session.cpObservations,
      "checkpoint-15m",
      checkpointObservedAt,
      cpObservation,
    ),
    close: {
      ...session.close,
      pathComplete: false,
      finishedAt: null
    },
    updatedAt: now
  });
}

export function withAPeriodUpdate(
  session: JournalSession,
  update: FifteenMinuteUpdate,
  checkpointObservedAt: string,
  now: string,
  confirm = true,
  preserveCp = false,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  const edges = sortRangeEdges(update.high, update.low);
  if (
    update.high === null &&
    update.low === null &&
    update.cp === null &&
    !update.note?.trim()
  ) {
    throw new Error("Enter an A-period edge, CP, or note first.");
  }
  if (
    edges.high !== null &&
    session.fifteenMinute.high !== null &&
    edges.high < session.fifteenMinute.high
  ) {
    throw new Error("A high cannot be below the completed 15R high.");
  }
  if (
    edges.low !== null &&
    session.fifteenMinute.low !== null &&
    edges.low > session.fifteenMinute.low
  ) {
    throw new Error("A low cannot be above the completed 15R low.");
  }

  const confirmed = confirm && update.high !== null && update.low !== null;
  const cpObservation: CpObservation | null =
    update.cp === null
      ? null
      : {
          id: `cp:${now}:${session.cpObservations.length + 1}`,
          price: update.cp,
          observedAt: checkpointObservedAt,
          timePrecision: "exact",
          source: "checkpoint-a"
        };
  const aPeriod: RangeCheckpoint = {
    rangeInputs: manualRangeInputs(session, 'A', edges),
    high: edges.high,
    low: edges.low,
    cp: preserveCp ? session.aPeriod.cp : update.cp,
    status: confirmed ? "confirmed" : "pending",
    note: update.note?.trim() || null,
    confirmedAt: confirmed ? now : null
  };

  return reconcileFormingPriceRanges({
    ...session,
    aPeriod,
    aPeriodHistory: [
      ...session.aPeriodHistory,
      { ...aPeriod, recordedAt: now, observedAt: checkpointObservedAt }
    ],
    cpObservations: preserveCp ? session.cpObservations : replaceCpAtSourceTime(
      session.cpObservations,
      "checkpoint-a",
      checkpointObservedAt,
      cpObservation,
    ),
    close: {
      ...session.close,
      pathComplete: false,
      finishedAt: null
    },
    updatedAt: now
  });
}

export function withDevelopingBSnapshot(
  session: JournalSession,
  update: FifteenMinuteUpdate,
  checkpointObservedAt: string,
  now: string,
  preserveCp = false,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  const edges = sortRangeEdges(update.high, update.low);
  if (
    update.high === null &&
    update.low === null &&
    update.cp === null &&
    !update.note?.trim()
  ) {
    throw new Error("Enter a developing B value, CP, or note first.");
  }

  const cpObservation: CpObservation | null =
    update.cp === null
      ? null
      : {
          id: `cp:${now}:${session.cpObservations.length + 1}`,
          price: update.cp,
          observedAt: checkpointObservedAt,
          timePrecision: "exact",
          source: "checkpoint-b-snapshot"
        };
  const prior = [...session.bSnapshots].reverse().find(
    (candidate) => candidate.observedAt === checkpointObservedAt,
  ) ?? null;
  const snapshot: DevelopingBSnapshot = {
    rangeInputs: manualRangeInputs(session, 'B', edges),
    id: prior?.id ?? `b-snapshot:${now}:${session.bSnapshots.length + 1}`,
    high: edges.high,
    low: edges.low,
    cp: preserveCp ? prior?.cp ?? null : update.cp,
    note: update.note?.trim() || null,
    observedAt: checkpointObservedAt,
    recordedAt: now
  };

  return reconcileFormingPriceRanges({
    ...session,
    bSnapshots: prior
      ? session.bSnapshots.map((candidate) =>
          candidate.id === prior.id ? snapshot : candidate)
      : [...session.bSnapshots, snapshot],
    bSnapshotHistory: prior
      ? [
          ...session.bSnapshotHistory,
          {
            id: `b-snapshot-history:${now}:corrected`,
            action: "corrected",
            prior,
            resulting: snapshot,
            occurredAt: now,
          },
        ]
      : session.bSnapshotHistory,
    cpObservations: preserveCp ? session.cpObservations : replaceCpAtSourceTime(
      session.cpObservations,
      "checkpoint-b-snapshot",
      checkpointObservedAt,
      cpObservation,
    ),
    updatedAt: now
  });
}

export function withBPeriodUpdate(
  session: JournalSession,
  update: FifteenMinuteUpdate,
  checkpointObservedAt: string,
  now: string,
  confirm = true,
  preserveCp = false,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  if (
    update.high === null &&
    update.low === null &&
    update.cp === null &&
    !update.note?.trim()
  ) {
    throw new Error("Enter a B-period edge, CP, or note first.");
  }

  const edges = sortRangeEdges(update.high, update.low);
  const confirmed = confirm && edges.high !== null && edges.low !== null;
  const cpObservation: CpObservation | null =
    update.cp === null
      ? null
      : {
          id: `cp:${now}:${session.cpObservations.length + 1}`,
          price: update.cp,
          observedAt: checkpointObservedAt,
          timePrecision: "exact",
          source: "checkpoint-b"
        };
  const bPeriod: RangeCheckpoint = {
    rangeInputs: manualRangeInputs(session, 'B', edges),
    high: edges.high,
    low: edges.low,
    cp: preserveCp ? session.bPeriod.cp : update.cp,
    status: confirmed ? "confirmed" : "pending",
    note: update.note?.trim() || null,
    confirmedAt: confirmed ? now : null
  };

  return reconcileFormingPriceRanges({
    ...session,
    bPeriod,
    bPeriodHistory: [...session.bPeriodHistory, { ...bPeriod, recordedAt: now, observedAt: checkpointObservedAt }],
    cpObservations: preserveCp ? session.cpObservations : replaceCpAtSourceTime(
      session.cpObservations,
      "checkpoint-b",
      checkpointObservedAt,
      cpObservation,
    ),
    close: {
      ...session.close,
      pathComplete: false,
      finishedAt: null
    },
    updatedAt: now
  });
}

export function withMarketContextItem(
  session: JournalSession,
  update: MarketContextUpdate,
  eventAt: string,
  recordedAt: string,
): JournalSession {
  const name = validateMarketContextUpdate(update);
  const holiday = update.holiday ? validateHolidayContext(update.holiday, update.eventDate) : undefined;

  const item: MarketContextItem = {
    id: `context:${recordedAt}:${session.marketContextItems.length + 1}`,
    name,
    eventDate: update.eventDate,
    eventAt: holiday ? holidayDayStart(update.eventDate, holiday.timeZone) : eventAt,
    ...(holiday ? { holiday } : {}),
    note: update.note?.trim() || null,
    source: "manual",
    recordedAt
  };

  return {
    ...session,
    marketContextItems: [...session.marketContextItems, item].sort(
      (left, right) =>
        left.eventAt.localeCompare(right.eventAt) ||
        left.recordedAt.localeCompare(right.recordedAt),
    ),
    updatedAt: recordedAt
  };
}

function sortMarketContextItems(items: MarketContextItem[]): MarketContextItem[] {
  return [...items].sort(
    (left, right) =>
      left.eventAt.localeCompare(right.eventAt) ||
      left.recordedAt.localeCompare(right.recordedAt),
  );
}

function validateMarketContextUpdate(update: MarketContextUpdate): string {
  const name = update.name.trim();
  if (!name) throw new Error("Enter an event name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(update.eventDate)) {
    throw new Error("Enter a valid event date.");
  }
  return name;
}

export function withCorrectedMarketContextItem(
  session: JournalSession,
  itemId: string,
  update: MarketContextUpdate,
  eventAt: string,
  correctedAt: string,
): JournalSession {
  const prior = session.marketContextItems.find((item) => item.id === itemId);
  if (!prior) throw new Error("That news/event entry is no longer active.");
  const name = validateMarketContextUpdate(update);
  const holiday = update.holiday ? validateHolidayContext(update.holiday, update.eventDate) : undefined;
  const resulting: MarketContextItem = {
    ...prior,
    name,
    eventDate: update.eventDate,
    eventAt: holiday ? holidayDayStart(update.eventDate, holiday.timeZone) : eventAt,
    holiday,
    ...(holiday ? {priceMove:undefined} : {}),
    note: update.note?.trim() || null,
  };
  const historyEntry: MarketContextHistoryEntry = {
    id: `context-history:${correctedAt}:corrected`,
    itemId,
    action: "corrected",
    prior,
    resulting,
    occurredAt: correctedAt,
  };
  return {
    ...session,
    marketContextItems: sortMarketContextItems(
      session.marketContextItems.map((item) => item.id === itemId ? resulting : item),
    ),
    marketContextHistory: [...session.marketContextHistory, historyEntry],
    updatedAt: correctedAt,
  };
}

export function withRemovedMarketContextItem(
  session: JournalSession,
  itemId: string,
  removedAt: string,
): JournalSession {
  const prior = session.marketContextItems.find((item) => item.id === itemId);
  if (!prior) throw new Error("That news/event entry is no longer active.");
  const historyEntry: MarketContextHistoryEntry = {
    id: `context-history:${removedAt}:removed`,
    itemId,
    action: "removed",
    prior,
    resulting: null,
    occurredAt: removedAt,
  };
  return {
    ...session,
    marketContextItems: session.marketContextItems.filter((item) => item.id !== itemId),
    marketContextHistory: [...session.marketContextHistory, historyEntry],
    updatedAt: removedAt,
  };
}

export function withUndoneMarketContextChange(
  session: JournalSession,
  historyEntryId: string,
  undoneAt: string,
): JournalSession {
  const sourceEntry = session.marketContextHistory.find(
    (entry) => entry.id === historyEntryId,
  );
  if (!sourceEntry || !["corrected", "removed"].includes(sourceEntry.action)) {
    throw new Error("That news/event change can no longer be undone.");
  }
  if (!sourceEntry.prior) throw new Error("The prior news/event entry is unavailable.");
  const current = session.marketContextItems.find(
    (item) => item.id === sourceEntry.itemId,
  ) ?? null;
  const restored = sourceEntry.prior;
  const historyEntry: MarketContextHistoryEntry = {
    id: `context-history:${undoneAt}:undo`,
    itemId: sourceEntry.itemId,
    action: sourceEntry.action === "corrected" ? "undo_correction" : "undo_removal",
    prior: current,
    resulting: restored,
    occurredAt: undoneAt,
  };
  return {
    ...session,
    marketContextItems: sortMarketContextItems([
      ...session.marketContextItems.filter((item) => item.id !== sourceEntry.itemId),
      restored,
    ]),
    marketContextHistory: [...session.marketContextHistory, historyEntry],
    updatedAt: undoneAt,
  };
}

export function withRthObservation(
  session: JournalSession,
  update: RthObservationUpdate,
  observedAt: string,
  recordedAt: string,
  rthWindowStart: string,
  rthWindowEnd: string,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  if (!Number.isFinite(update.price)) {
    throw new Error("Enter a valid observed price.");
  }
  if (observedAt <= rthWindowStart || observedAt >= rthWindowEnd) {
    throw new Error("Enter a time after the IB ends and before the study close.");
  }

  const cpObservation: CpObservation = {
    id: `cp:${recordedAt}:${session.cpObservations.length + 1}`,
    price: update.price,
    observedAt,
    timePrecision: "exact",
    source: "rth-observation"
  };
  const observation: RthObservation = {
    id: `rth:${recordedAt}:${session.rthObservations.length + 1}`,
    price: update.price,
    observedAt,
    recordedAt,
    note: update.note?.trim() || null,
    cpObservationId: cpObservation.id
  };

  return {
    ...session,
    rthObservations: [...session.rthObservations, observation].sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.recordedAt.localeCompare(right.recordedAt),
    ),
    cpObservations: [...session.cpObservations, cpObservation],
    close: {
      ...session.close,
      pathComplete: false,
      finishedAt: null
    },
    updatedAt: recordedAt
  };
}

function validateSessionNoteWindow(
  observedAt: string,
  windowStart: string,
  windowEnd: string,
): void {
  if (observedAt < windowStart || observedAt >= windowEnd) {
    throw new Error("The note time must fall inside its selected session phase.");
  }
}

export function withSessionNote(
  session: JournalSession,
  phase: SessionNotePhase,
  text: string,
  observedAt: string,
  recordedAt: string,
  windowStart: string,
  windowEnd: string,
  link: SessionNoteLink | null = null,
): JournalSession {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Enter a note.");
  validateSessionNoteWindow(observedAt, windowStart, windowEnd);
  const note: SessionNote = {
    id: `session-note:${recordedAt}:${session.sessionNotes.length + 1}`,
    phase,
    observedAt,
    recordedAt,
    text: trimmed,
    link,
  };
  return {
    ...session,
    sessionNotes: [...session.sessionNotes, note].sort(
      (left, right) =>
        left.observedAt.localeCompare(right.observedAt) ||
        left.recordedAt.localeCompare(right.recordedAt),
    ),
    updatedAt: recordedAt,
  };
}

export function withCorrectedSessionNote(
  session: JournalSession,
  noteId: string,
  text: string,
  observedAt: string,
  correctedAt: string,
  windowStart: string,
  windowEnd: string,
  link: SessionNoteLink | null = null,
): JournalSession {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("A note cannot be empty. Remove it instead.");
  validateSessionNoteWindow(observedAt, windowStart, windowEnd);
  if (!session.sessionNotes.some((note) => note.id === noteId)) {
    throw new Error("The session note is unavailable.");
  }
  return {
    ...session,
    sessionNotes: session.sessionNotes
      .map((note) => note.id === noteId
        ? { ...note, text: trimmed, observedAt, link }
        : note)
      .sort(
        (left, right) =>
          left.observedAt.localeCompare(right.observedAt) ||
          left.recordedAt.localeCompare(right.recordedAt),
      ),
    updatedAt: correctedAt,
  };
}

export function withRemovedSessionNote(
  session: JournalSession,
  noteId: string,
  removedAt: string,
): JournalSession {
  if (!session.sessionNotes.some((note) => note.id === noteId)) {
    throw new Error("The session note is unavailable.");
  }
  return {
    ...session,
    sessionNotes: session.sessionNotes.filter((note) => note.id !== noteId),
    updatedAt: removedAt,
  };
}

function validateRthObservationChange(
  update: RthObservationUpdate,
  observedAt: string,
  rthWindowStart: string,
  rthWindowEnd: string,
): void {
  if (!Number.isFinite(update.price)) {
    throw new Error("Enter a valid observed price.");
  }
  if (observedAt <= rthWindowStart || observedAt >= rthWindowEnd) {
    throw new Error("Enter a time after the IB ends and before the study close.");
  }
}

function linkedCpObservation(
  session: JournalSession,
  observation: RthObservation,
): CpObservation | null {
  if (observation.cpObservationId) {
    return session.cpObservations.find(
      (candidate) => candidate.id === observation.cpObservationId,
    ) ?? null;
  }
  return session.cpObservations.find((candidate) =>
    candidate.source === "rth-observation" &&
    candidate.observedAt === observation.observedAt &&
    candidate.price === observation.price &&
    candidate.id.includes(observation.recordedAt)) ?? null;
}

function replaceRthObservationCp(
  session: JournalSession,
  prior: RthObservation,
  resulting: RthObservation | null,
  changedAt: string,
): { observation: RthObservation | null; cpObservations: CpObservation[] } {
  const linkedCp = linkedCpObservation(session, prior);
  const remaining = session.cpObservations.filter(
    (candidate) => candidate.id !== linkedCp?.id,
  );
  if (resulting === null) {
    return { observation: null, cpObservations: remaining };
  }
  const cpObservation: CpObservation = {
    id: linkedCp?.id ?? `cp:${changedAt}:${remaining.length + 1}`,
    price: resulting.price,
    observedAt: resulting.observedAt,
    timePrecision: "exact",
    source: "rth-observation"
  };
  return {
    observation: { ...resulting, cpObservationId: cpObservation.id },
    cpObservations: [...remaining, cpObservation]
  };
}

function sortRthObservations(observations: RthObservation[]): RthObservation[] {
  return [...observations].sort(
    (left, right) =>
      left.observedAt.localeCompare(right.observedAt) ||
      left.recordedAt.localeCompare(right.recordedAt),
  );
}

export function withCorrectedRthObservation(
  session: JournalSession,
  observationId: string,
  update: RthObservationUpdate,
  observedAt: string,
  correctedAt: string,
  rthWindowStart: string,
  rthWindowEnd: string,
): JournalSession {
  update = roundManualPriceFields(update, session.market.tickSize);
  validateRthObservationChange(update, observedAt, rthWindowStart, rthWindowEnd);
  const prior = session.rthObservations.find(
    (observation) => observation.id === observationId,
  );
  if (!prior) throw new Error("That RTH observation is no longer active.");

  const replacement = replaceRthObservationCp(
    session,
    prior,
    {
      ...prior,
      price: update.price,
      observedAt,
      note: update.note?.trim() || null
    },
    correctedAt,
  );
  const resulting = replacement.observation!;
  const historyEntry: RthObservationHistoryEntry = {
    id: `rth-history:${correctedAt}:corrected`,
    observationId,
    action: "corrected",
    prior,
    resulting,
    occurredAt: correctedAt
  };

  return {
    ...session,
    rthObservations: sortRthObservations(
      session.rthObservations.map((observation) =>
        observation.id === observationId ? resulting : observation),
    ),
    cpObservations: replacement.cpObservations,
    rthObservationHistory: [...session.rthObservationHistory, historyEntry],
    close: { ...session.close, pathComplete: false, finishedAt: null },
    updatedAt: correctedAt
  };
}

export function withRemovedRthObservation(
  session: JournalSession,
  observationId: string,
  removedAt: string,
): JournalSession {
  const prior = session.rthObservations.find(
    (observation) => observation.id === observationId,
  );
  if (!prior) throw new Error("That RTH observation is no longer active.");
  const replacement = replaceRthObservationCp(session, prior, null, removedAt);
  const historyEntry: RthObservationHistoryEntry = {
    id: `rth-history:${removedAt}:removed`,
    observationId,
    action: "removed",
    prior,
    resulting: null,
    occurredAt: removedAt
  };
  return {
    ...session,
    rthObservations: session.rthObservations.filter(
      (observation) => observation.id !== observationId,
    ),
    cpObservations: replacement.cpObservations,
    rthObservationHistory: [...session.rthObservationHistory, historyEntry],
    close: { ...session.close, pathComplete: false, finishedAt: null },
    updatedAt: removedAt
  };
}

export function withUndoneRthObservationChange(
  session: JournalSession,
  historyEntryId: string,
  undoneAt: string,
): JournalSession {
  const sourceEntry = session.rthObservationHistory.find(
    (entry) => entry.id === historyEntryId,
  );
  if (!sourceEntry || !["corrected", "removed"].includes(sourceEntry.action)) {
    throw new Error("That RTH change can no longer be undone.");
  }
  if (!sourceEntry.prior) throw new Error("The prior observation is unavailable.");

  const current = session.rthObservations.find(
    (observation) => observation.id === sourceEntry.observationId,
  ) ?? null;
  const cpSource = current ?? sourceEntry.resulting ?? sourceEntry.prior;
  const replacement = replaceRthObservationCp(
    session,
    cpSource,
    sourceEntry.prior,
    undoneAt,
  );
  const restored = replacement.observation!;
  const withoutCurrent = session.rthObservations.filter(
    (observation) => observation.id !== sourceEntry.observationId,
  );
  const historyEntry: RthObservationHistoryEntry = {
    id: `rth-history:${undoneAt}:undo`,
    observationId: sourceEntry.observationId,
    action: sourceEntry.action === "corrected" ? "undo_correction" : "undo_removal",
    prior: current,
    resulting: restored,
    occurredAt: undoneAt
  };

  return {
    ...session,
    rthObservations: sortRthObservations([...withoutCurrent, restored]),
    cpObservations: replacement.cpObservations,
    rthObservationHistory: [...session.rthObservationHistory, historyEntry],
    close: { ...session.close, pathComplete: false, finishedAt: null },
    updatedAt: undoneAt
  };
}

export function withSessionClose(
  session: JournalSession,
  price: Price,
  note: string | null,
  observedAt: string,
  recordedAt: string,
  rthHigh: Price | null = null,
  rthLow: Price | null = null,
): JournalSession {
  if (!Number.isFinite(price)) throw new Error("Enter a valid RTH close price.");
  ({ price, rthHigh, rthLow } = roundManualPriceFields({ price, rthHigh, rthLow }, session.market.tickSize));
  if ((rthHigh === null) !== (rthLow === null)) {
    throw new Error("Enter both the final RTH high and RTH low.");
  }
  if (rthHigh !== null && rthLow !== null) {
    if (!Number.isFinite(rthHigh) || !Number.isFinite(rthLow)) {
      throw new Error("Enter valid final RTH high and low prices.");
    }
    if (rthHigh < rthLow) {
      throw new Error("Final RTH high cannot be below the final RTH low.");
    }
    if (price > rthHigh || price < rthLow) {
      throw new Error("RTH close must be inside the confirmed RTH high and low.");
    }
    if (session.rthObservations.some(
      (observation) => observation.price > rthHigh || observation.price < rthLow,
    )) {
      throw new Error("Confirmed RTH high and low must contain every recorded RTH price.");
    }
  }
  const cpObservation: CpObservation = {
    id: `cp:${recordedAt}:${session.cpObservations.length + 1}`,
    price,
    observedAt,
    timePrecision: "exact",
    source: "rth-close"
  };
  return {
    ...session,
    close: {
      rthHigh,
      rthLow,
      price,
      observedAt,
      recordedAt,
      note: note?.trim() || null,
      pathComplete: false,
      finishedAt: null
    },
    cpObservations: replaceCpAtSourceTime(
      session.cpObservations,
      "rth-close",
      observedAt,
      cpObservation,
    ),
    updatedAt: recordedAt
  };
}

export function withClosingReview(
  session: JournalSession,
  pathComplete: boolean,
  now: string,
): JournalSession {
  if (session.close.price === null) {
    throw new Error("Record the RTH close before finishing the day.");
  }
  if (session.close.rthHigh === null || session.close.rthLow === null) {
    throw new Error("Confirm the final RTH high and RTH low before finishing the day.");
  }
  return {
    ...session,
    close: {
      ...session.close,
      pathComplete,
      finishedAt: now
    },
    updatedAt: now
  };
}

export { deriveLowTracking,deriveLowRecoveryTracking,lowTrackingHasContractGap, lowTrackingLabels } from "./lowTracking";
export { levelPriceRole } from './levelPriceRole';
export type { LevelPriceRole } from './levelPriceRole';
export { detectAoiLevels, AOI_RULE_VERSION, ES_AOI_RESEARCH_RULES } from './aoiResearch';
export type { AoiHour, AoiRules, AoiFinding } from './aoiResearch';
export { BACKTEST_DEFINITION, BACKTEST_LABEL, backtestJournalLevel } from './breakoutBacktests';
export type { BreakoutBacktestEvidence } from './breakoutBacktests';
export { eventWindowsAt, eventFamily, EVENT_WINDOW, scheduledEventState, withScheduledEvents } from './eventWindows';
export type { ScheduledEvent, ScheduleProvider } from './eventWindows';
export { deriveIbRead, firstRecordedIbBreak } from './ibRead';
export { deriveLevelActivityStatistics, levelActivityStatisticsJob, deriveLevelVisitHistory,deriveLevelBacktestEvidence,deriveLevelSupersessionLinks } from './levelActivityStatistics';
export type {LevelBacktestEvidence,LevelBacktestDefense} from './levelBacktests';
export {deriveLevelRecordedEvents} from './levelActivityStatistics';
export {matchingPriceLevelEvent,duplicateManualLevelEvent} from './levelRecordedEvents';
export type {LevelRecordedEvent} from './levelRecordedEvents';
export type {LevelVisit,LevelReclaimCycle,LevelVisitHistory,LevelVisitResponse,QualifiedLowReference} from './levelVisits';
export type { LevelActivityStatistics, LevelActivityFact, LevelActivityKind,LevelSupersession } from './levelActivityStatistics';
export type { IbReadInput, ReadPrice, ReadReference, ReferenceRead } from './ibRead';
export { deriveLiveMarketMemory, summarizeMarketMemory, recoveryPath, marketMemoryDistance, describeMarketMemory, unpackMarketMemoryLibrary, memoryContractMatches } from './marketMemory';
export type { MarketMemory, MarketMemoryLibrary, PackedMarketMemoryLibrary, RecoveryRecord, MemoryLandmark } from './marketMemory';
export { describeAuctionFlow, deriveSessionAuctionRead, deriveRecentAuctionRead, completedAuctionRangeFromPriceDay } from './auctionRead';
export type { AuctionRead, AuctionState, RecentAuctionRead, CompletedAuctionRange } from './auctionRead';

export {dayReviewRanges,withFinalDayReview} from './finalDayReview';
export type {ReviewPeriod,DayReviewInput,DayReviewWindows} from './finalDayReview';
