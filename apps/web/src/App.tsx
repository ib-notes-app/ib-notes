import {WorkspaceRangeEditor,WorkspacePhaseRecords} from './WorkspacePeriod';
import {PHONE_TEST,phoneState,phoneStates} from './phoneTestMode';
import {useWorkspaceNavigation} from './WorkspaceNavigation';
import {WorkspaceDashboard,WorkspaceLevelCache,useWorkspaceActivePhase,type WorkspaceDestination} from './WorkspaceDashboard';
import {useWorkspaceLevels} from './useWorkspaceLevels';
import {WorkspaceDialog} from './WorkspaceDialog';
import {workspaceClock,workspaceWindows,workspacePrice,applyWorkspaceEntry,undoWorkspaceEntry,workspaceFormatPrice,workspaceRecordedRange,type WorkspaceEntry,type WorkspacePhase} from './workspaceModel';
import { collapseNearbyMapObservations, mapMoveThreshold, mapObservationX } from "./mapGeometry";
import { formationSteps } from "./formationSteps";
import { MapEdgeLabels } from './MapEdgeLabels';
import { IbCodeBadge, currentSessionIbCode } from './IbCodeBadge';
import { MapLevelMarkers } from './MapLevelMarkers';
import { mapLevelReferences, type MapLevelReference } from './mapLevelReferences';
import { SignificantLevelForm } from "./SignificantLevelForm";
import { levelTypeLabels, levelTimeframeLabels, displayLevelLabel } from './LevelChoices';
import { ScheduledEventsPanel } from './ScheduledEventsPanel';
import {NewsResultEditor} from './NewsResultEditor';
import {buildShareNewsSections} from './shareNews';
import {buildShareVisitedLevels} from './shareVisitedLevels';
import {withNewsResult,withOfficialNewsResults,type NewsResult} from '@ib-field-notes/domain';
import { EventWindowTags } from './EventWindowTags';
import { StudyPackGuide, packTitle, packTypes, studyGroupLabel, ibForecastUse } from './StudyPackLabels';
import { ContextHistoryPreview, type ContextImportPreview } from './ContextHistory';
import type { ContextBatch } from '@ib-field-notes/domain';
import { StudyPackDetails } from './StudyPackDetails';
import { MonthlyPackPreview, type MonthlyImportPreview } from './MonthlyStudyPacks';
import { MONTHLY_PACK_MAX_BYTES, type MonthlyPackBatch, type MonthlyLevelFilter } from '@ib-field-notes/domain';
import { FbdHistoryPreview, type FbdImportPreview } from './FbdHistory';
import { LevelsWorkspace } from './LevelsWorkspace';
import { LevelStatistics } from './LevelStatistics';
import {IbStatistics,IbStatisticDays,historicalSessionSearchMatches,type IbStatsView,type IbDaySelector} from './IbStatistics';
import {ReviewScrollContext,ReviewScrollMemory,reuseJournalHistory,useReviewHome,useReviewScroll} from './ReviewNavigation';
import type { FbdBatch } from '@ib-field-notes/domain';
import { PriceHistoryPreview, type PriceImportPreview } from './PriceHistory';
import { ReviewDayList, ReviewDayDetail, type ReviewPackFilter } from './ReviewDays';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { ImportedHistoryBatches } from './ImportedHistoryBatches';
import { type PriceHistoryBatch } from '@ib-field-notes/domain';
import { inspectHistoryFile, studyPackCompatibility } from '@ib-field-notes/domain';
import { targetJournalReplay, replayLevelApplies, type ParsedJournalReplay } from '@ib-field-notes/domain';
import { withScheduledEvents, type ScheduledEvent } from '@ib-field-notes/domain';
import { LevelTrackingContext, LevelPriceTracking } from "./LevelPriceTracking";
import { NearbyLevels, type NearbyPriceSide, type NearbyLevelTier } from './NearbyLevels';
import { LevelQualityContext, LevelQualityBadge, useLevelQualitySources } from './LevelQuality';
import {LevelSupersessionContext,nearbyLevelSupersessions} from './LevelSupersession';
import {levelQuality,strongestQuality,type LevelQuality} from './levelQuality';
import { LevelDayRead } from './LevelDayRead';
import {LevelVisits} from './LevelVisits';
import {LevelActivity,levelObservationLabel as significantLevelMarketEventLabel} from './LevelActivity';
import {EventMoveContext,EventMoveSheet,LevelEventMoveSummary,useEventMoveHistory} from './EventPriceMoves';
import {withEventPriceMove,type EventPriceMoveLink} from '@ib-field-notes/domain';
import {levelActivityScope} from './levelActivityScope';
import { DeferredDetails } from './DeferredDetails';
import { AppErrorBoundary } from './AppErrorBoundary';
import { AppBuildLabel, SupportReport } from './SupportReport';
import {ReviewSections} from './ReviewSections';
import { StartHere } from './StartHere';
import { SessionPhaseMemory,type DashboardPhase } from './SessionPhasePanels';
import {DayTimeline,type DayTimelineMemory} from './DayTimeline';
import {failurePatternLabel} from './levelRoles';
import type {SessionTimelineItem} from './dayTimelineModel';
// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber, roundPriceToTick } from "@ib-field-notes/domain";

import { Temporal } from "@js-temporal/polyfill";
import { periodShareDateAt } from './periodShareSummary';
import { LevelArchiveControl, archiveReasonLabels } from "./LevelArchiveControl";
import type { SignificantLevelArchiveDetails } from "@ib-field-notes/domain";
import { useKeyboardVisibility } from "./useKeyboardVisibility";
import { loadForecastPacks } from './forecastPreparation';
import { APeriodWorkspace, FifteenReview, type ARangeEntry } from "./APeriodWorkspace";
import { JournalContext, journalClock, useJournalClock, useCurrentRthDate } from "./journalClock";
import { InstrumentSetup } from "./InstrumentSetup";
import {
  DEFAULT_JOURNAL,
  type JournalProfile,
  carryRangeEdgesForward,
  buildForecastTraining,
  enrichForecastExamples,
  captureForecast,
  resolveForecastPrior,
  type ForecastPriorDay,
  createSignificantLevel,
  createJournalSession,
  deriveBExtensions,
  deriveClosingOutcome,
  deriveCoreIbStatistics,
  deriveHistoricalBreakCodeStatistics,
  deriveHistoricalCoreIbStatistics,
  deriveHistoricalIbDaySummary,
  deriveFinalIb,
  deriveMonthlySessionSummaries,
  deriveRange,
  deriveRangeExtensions,
  deriveRecordedBreakDayType,
  deriveRthObservationStates,
  deriveRecordedRthRange,
  withRthRangeCorrection,
  deriveSessionFinalIb,
  deriveSessionRecordedIb,
  deriveSessionMissingFields,
  deriveSignificantLevelInteractions,
  sessionLevelCatalog,
  deriveWeeklySessionSummaries,
  deriveYearlySessionSummaries,
  dailyLowSignificantLevelId,
  historicalIbBatchFromPreview,
  historicalBreakCodeFamily,
  historicalIbBreakCode,
  type DevelopingBSnapshot,
  type CoreIbStatistics,
  type FifteenMinuteUpdate,
  type HistoricalIbCohort,
  type HistoricalIbImportBatch,
  type HistoricalIbImportPreview,
  type HistoricalIbSession,
  latestCpObservation,
  latestPreOpenSnapshot,
  significantLevelDistanceFromPrice,
  type JournalSession,
  type MarketContextItem,
  type MarketContextUpdate,
  type HolidayContext,
  holidayDayStart,
  holidaySummary,
  type MonthlySessionSummary,
  type OvernightUpdate,
  type PreOpenUpdate,
  type RangeCheckpoint,
  type RthObservation,
  type SessionNote,
  type SessionNoteLink,
  type SessionNotePhase,
  type RthObservationUpdate,
  type SignificantLevel,
  type SignificantLevelEpisode,
  type SignificantLevelEpisodeClassification,
  type SignificantLevelEpisodePhase,
  type SignificantLevelInteraction,
  type SignificantLevelMarketEvent,
  type SignificantLevelMarketEventKind,
  type SignificantLevelPreferences,
  type SignificantLevelStatusAction,
  type SignificantLevelUpdate,
  type SessionMissingField,
  type SessionPeriodStatistics,
  type WeeklyDaySummary,
  type WeeklySessionSummary,
  type YearlySessionSummary,
  upsertFinishedSessionDailyLow,
  withPreOpenUpdate,
  withCorrectedMarketContextItem,
  withCorrectedRthObservation,
  withCorrectedSessionNote,
  withCorrectedSignificantLevel,
  withAPeriodUpdate,
  withBPeriodUpdate,
  withDevelopingBSnapshot,
  withDisplayTimeZone,
  withClosingReview,
  withOvernightUpdate,
  withFifteenMinuteRange,
  withMarketContextItem,
  withRthObservation,
  withSessionNote,
  withRemovedStandaloneCpObservation,
  withRemovedMarketContextItem,
  withRemovedRthObservation,
  withRemovedSessionNote,
  withRemovedSignificantLevel,
  withRemovedSignificantLevelEpisode,
  withRemovedSignificantLevelMarketEvent,
  withRestoredSignificantLevelMarketEvent,
  withRemovedSignificantLevelNote,
  withConfirmedSignificantLevelEpisode,
  withSignificantLevelLifecycleAction,
  withSignificantLevelMapVisibility,
  withSignificantLevelMarketEvent,
  withSignificantLevelNote,
  withSessionClose,
  withStandaloneCpObservation,
  withCorrectedStandaloneCpObservation,
  withUndoneStandaloneCpCorrection,
  priceRangeChanges,
  withUndoneStandaloneCpRemoval,
  withUndoneMarketContextChange,
  withUndoneSignificantLevelChange,
  withUndoneRthObservationChange
} from "@ib-field-notes/domain";
import {
  checkpointInstant,
  checkpointInstant as calendarInstant,
  displayCheckpoint,
  ES_TEMPLATE,
  isPotentialRthDate,
  nextPotentialRthDate,
  previousPotentialRthDate,
  resolveLaunchRthDate,
  sessionObservationInstant,
  type SupportedDisplayTimeZone
} from "@ib-field-notes/session-templates";
import type { StorageStatus, TrashedJournalSession } from "@ib-field-notes/storage-port";
import {
  acquireWriterLease,
  SqliteJournalRepository,
  type WriterLease
} from "@ib-field-notes/storage-sqlite-web";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { subscribeToPwaState, updateServiceWorker } from "./pwa";
import {
  appendSelectedShareContent,
  buildDailyShareText,
  buildShortPostShareText,
  DEFAULT_SHORT_POST_SHARE_OPTIONS,
  type ShortPostShareOptions,
} from "./sharePreview";
import {
  buildImageCardSvg,
  DEFAULT_IMAGE_CARD_OPTIONS,
  imageCardPngBlob,
  type ImageCardOptions,
} from "./imageCard";
import {
  buildMonthlyFullShareText,
  buildMonthlyImageCardSvg,
  buildMonthlyShortShareText,
  buildWeeklyFullShareText,
  buildWeeklyImageCardSvg,
  buildWeeklyShortShareText,
  buildYearlyFullShareText,
  buildYearlyImageCardSvg,
  buildYearlyShortShareText,
} from "./weeklyShare";
import { formatTickRoundedPrice } from "./mapFormatting";
import { buildShareLevelOptions, type ShareLevelOption } from './shareLevels';
import { ForecastCard } from "./ForecastCard";
import {useDashboardShareRead,type ShareForecastSources} from './useDashboardShareRead';
import {SHARE_CONTAINERS,DASHBOARD_SHARE_DETAILS,DEFAULT_DASHBOARD_SHARE_DETAILS,buildDashboardShareCard,dashboardShareText,
  type ShareContainer,type DashboardShareDetails} from './dashboardShare';
import {buildDashboardImageCard} from './dashboardImageCard';
import {readShareTimeZone,rememberShareTimeZone,sessionForSharing,shareTimeZoneLabel} from './shareTimeZone';
import {deriveCompactShareFacts} from './sharePreview';
import {ShareLevelPicker} from './ShareLevelPicker';
import {buildNearbyShareLevelOptions} from './shareLevels';
import {levelMapRole} from './mapLevelReferences';
import { OvernightStudyProvider, OvernightStudySummary } from './OvernightStudy';
import { awaitForecastUpdateWrites } from './forecastUpdateHistory';
import { ContextWorkspace, ContextRecap } from "./ContextWorkspace";
import { withContextPackEvents, type ContextMatch } from "@ib-field-notes/domain";

const TIME_ZONES: ReadonlyArray<{
  id: SupportedDisplayTimeZone;
  label: string;
}> = [
  { id: "America/Los_Angeles", label: "Pacific Time" },
  { id: "America/Denver", label: "Mountain Time" },
  { id: "America/Chicago", label: "Central Time" },
  { id: "America/New_York", label: "Eastern Time" },
  { id: "UTC", label: "UTC" }
];

const DEFAULT_SIGNIFICANT_LEVEL_PROXIMITY_TICKS = 400;

function historicalCohortLabel(cohort: HistoricalIbCohort): string {
  return studyGroupLabel(cohort);
}

type PersistenceState = "unknown" | "granted" | "not-granted" | "unavailable";
type SessionPanel =
  | "settings"
  | "instrument-setup"
  | "dashboard"
  | "workspace-forecast"
  | "workspace-structure"
  | "review-menu"
  | "preopen"
  | "overnight"
  | "context"
  | "event"
  | "levels"
  | "level-library"
  | "level-detail"
  | "notes"
  | "session-notes"
  | "share"
  | "statistics-ib"
  | "statistics-levels"
  | "historical-library-manage"
  | "trash"
  | "session-actions"
  | "a-period"
  | "b-snapshot"
  | "b-period"
  | "rth"
  | "rth-period"
  | "close";
type DashboardStatus = "not-started" | "partial" | "complete" | "optional";
type EntryOrigin = "dashboard" | "level-library" | "level-detail" | "context";
const recordChoices = [
  { panel: "rth", label: "Price" }, { panel: "event", label: "Event" },
  { panel: "levels", label: "Level" }, { panel: "notes", label: "Note" },
] as const;
const reviewPanels: SessionPanel[] = ["review-menu", "statistics-ib", "statistics-levels"];
type ReviewPanel='review-menu'|'statistics-ib'|'statistics-levels';
const levelPanels: SessionPanel[] = ["level-library"];
const workspaceTitles: Record<SessionPanel,string> = {
  dashboard:'Today',settings:'Settings','instrument-setup':'Add instrument',
  'workspace-forecast':'Forecast','workspace-structure':'Structure','review-menu':'Review',
  preopen:'Overnight update',overnight:'Overnight range',context:'Context',event:'News or event',
  levels:'Add level','level-library':'Levels','level-detail':'Level details',notes:'Add note',
  'session-notes':'Day timeline',share:'Share', 'statistics-ib':'IB stats','statistics-levels':'Level stats',
  'historical-library-manage':'Study packs',trash:'Trash','session-actions':'Manage session',
  'a-period':'A period','b-snapshot':'B snapshot','b-period':'Final IB',rth:'Record price',
  'rth-period':'RTH range',close:'Close and review',
};

function parentPanelFor(panel: SessionPanel, entryOrigin: EntryOrigin): SessionPanel {
  if (panel === "levels" || panel === "event" || panel === "notes") return entryOrigin;
  if (panel === "level-library" && entryOrigin === "context") return "context";
  if (panel === "instrument-setup") return "settings";
  if (["historical-library-manage", "trash", "session-actions"].includes(panel)) return "settings";
  if (panel === "close") return "rth-period";
  if (panel === "b-snapshot") return "b-period";
  if (reviewPanels.includes(panel) && panel !== "review-menu") return "review-menu";
  if (levelPanels.includes(panel)) return "level-library";
  return "dashboard";
}

function sessionTimeZoneLabel(session: JournalSession): string {
  const instant = journalClock(session.market).checkpointInstant(session.rthDate, session.market.checkpoints.overnightLock);
  return new Intl.DateTimeFormat("en-US", { timeZone: session.displayTimeZone, timeZoneName: "short" }).formatToParts(new Date(instant.epochMilliseconds)).find((part) => part.type === "timeZoneName")?.value ?? session.displayTimeZone;
}

function parsePrice(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sessionNoteWindow(
  session: JournalSession,
  phase: SessionNotePhase,
): { start: string; end: string } {
  const { template: ES_TEMPLATE, checkpointInstant, sessionObservationInstant } = journalClock(session.market);
  if (phase === "ON") {
    return {
      start: sessionObservationInstant(session.rthDate, ES_TEMPLATE.overnightStart).toString(),
      end: checkpointInstant(
        session.rthDate,
        ES_TEMPLATE.checkpoints.overnightLock,
      ).toString(),
    };
  }
  if (phase === "IB") {
    return {
      start: checkpointInstant(
        session.rthDate,
        ES_TEMPLATE.checkpoints.overnightLock,
      ).toString(),
      end: checkpointInstant(
        session.rthDate,
        ES_TEMPLATE.checkpoints.ibLock,
      ).toString(),
    };
  }
  return {
    start: checkpointInstant(
      session.rthDate,
      ES_TEMPLATE.checkpoints.ibLock,
    ).toString(),
    end: checkpointInstant(
      session.rthDate,
      ES_TEMPLATE.checkpoints.studyClose,
    ).toString(),
  };
}

function significantLevelEpisodePhase(
  session: JournalSession,
  observedAt: string,
): SignificantLevelEpisodePhase {
  const { template: ES_TEMPLATE, checkpointInstant } = journalClock(session.market);
  const observed = Temporal.Instant.from(observedAt);
  const compare = (localTime: string) => Temporal.Instant.compare(
    observed,
    checkpointInstant(session.rthDate, localTime),
  );
  if (compare(ES_TEMPLATE.checkpoints.overnightLock) < 0) return "ON";
  if (compare(ES_TEMPLATE.checkpoints.fifteenMinuteLock) < 0) return "15R";
  if (compare(ES_TEMPLATE.checkpoints.aLock) < 0) return "A";
  if (compare(ES_TEMPLATE.checkpoints.ibLock) < 0) return "B";
  if (compare(ES_TEMPLATE.checkpoints.studyClose) <= 0) return "RTH";
  return "POST_RTH";
}

function significantLevelEpisodePhaseLabel(
  phase: SignificantLevelEpisodePhase,
): string {
  if (phase === "ON") return "Overnight";
  if (phase === "15R") return "15R formation";
  if (phase === "A") return "A period";
  if (phase === "B") return "B period";
  if (phase === "RTH") return "Post-lock RTH";
  return "Post-RTH";
}

function sessionNotesForPhase(
  session: JournalSession,
  phase: SessionNotePhase,
): SessionNote[] {
  return session.sessionNotes.filter((note) => note.phase === phase);
}

type SessionNoteLinkOption = {
  value: string;
  link: SessionNoteLink;
};

function sessionNoteLinkOptions(
  session: JournalSession,
  phase: SessionNotePhase,
  significantLevels: SignificantLevel[],
): SessionNoteLinkOption[] {
  const options: SessionNoteLinkOption[] = [];
  const add = (link: SessionNoteLink) => options.push({
    value: `${link.kind}:${link.targetId}`,
    link,
  });
  const latestCp = latestCpObservation(session);
  if (latestCp) {
    add({
      kind: "cp",
      targetId: latestCp.id,
      label: `CP ${formatPrice(latestCp.price)} · ${formatClockTime(
        formatObservationTime(latestCp.observedAt, session.displayTimeZone),
      )}`,
    });
  }

  const addCheckpoint = (
    targetId: string,
    label: string,
    range: { high: number | null; low: number | null },
  ) => {
    if (range.high === null && range.low === null) return;
    add({
      kind: "checkpoint",
      targetId,
      label: `${label} · ${formatPrice(range.low)}–${formatPrice(range.high)}`,
    });
  };
  if (phase === "ON") {
    addCheckpoint("overnight", "ON range", session.overnight);
  } else if (phase === "IB") {
    addCheckpoint("15r", "15R", session.fifteenMinute);
    addCheckpoint("a-period", "A period", session.aPeriod);
    addCheckpoint("b-period", "B / Final IB", session.bPeriod);
  } else {
    const finalIb = deriveSessionFinalIb(session);
    if (finalIb) addCheckpoint("final-ib", "Final IB", finalIb);
  }

  const window = sessionNoteWindow(session, phase);
  session.marketContextItems
    .filter((item) => item.holiday ? item.eventDate === session.rthDate : item.eventAt >= window.start && item.eventAt < window.end)
    .forEach((item) => add({
      kind: "event",
      targetId: item.id,
      label: `Event · ${item.name} · ${item.holiday ? 'All day' : formatClockTime(
        formatObservationTime(item.eventAt, session.displayTimeZone),
      )}`,
    }));
  significantLevels
    .filter((level) => level.currentStatus !== "removed")
    .forEach((level) => add({
      kind: "significant_level",
      targetId: level.id,
      label: `Level · ${significantLevelName(level)}`,
    }));
  return options;
}

async function getOrCreateSession(
  repository: SqliteJournalRepository,
  rthDate: string,
  profile: JournalProfile = DEFAULT_JOURNAL,
  persist = true,
): Promise<{ session: JournalSession; created: boolean;stored:boolean }> {
  const sessionId = `${profile.id === "es" ? "ES" : profile.id}:${rthDate}`;
  const saved = await repository.getSession(sessionId);
  if (saved) return { session: saved, created: false,stored:true };

  const created = createJournalSession(
    rthDate,
    Temporal.Now.instant().toString(),
    profile,
  );
  if(persist)await repository.saveSession(created);
  return { session: created, created: persist,stored:persist };
}

function downloadFile(name: string, contents: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatPrice(value: number | null): string {
  return value === null ? "Pending" : formatPriceNumber(value);
}

function checkpointLockReached(rthDate: string, localTime: string): boolean {
  return Temporal.Instant.compare(
    Temporal.Now.instant(),
    checkpointInstant(rthDate, localTime),
  ) >= 0;
}

function currentTimeInZone(timeZone: string): string {
  return Temporal.Now.instant()
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });
}

function useCurrentTimeInZone(timeZone: string): string {
  const [localTime, setLocalTime] = useState(() => currentTimeInZone(timeZone));

  useEffect(() => {
    let timeoutId: number;
    const refreshAtNextMinute = () => {
      setLocalTime(currentTimeInZone(timeZone));
      const delay = 60_000 - (Date.now() % 60_000) + 50;
      timeoutId = window.setTimeout(refreshAtNextMinute, delay);
    };
    refreshAtNextMinute();
    return () => window.clearTimeout(timeoutId);
  }, [timeZone]);

  return localTime;
}

function usePeriodShareOptions() {
  const { template } = useJournalClock();
  useCurrentTimeInZone(template.canonicalTimeZone);
  const asOfDate = periodShareDateAt(Temporal.Now.instant().toString(), template.canonicalTimeZone);
  return useMemo(() => ({ asOfDate }), [asOfDate]);
}

function formatClockTime(localTime: string): string {
  const [hour, minute] = localTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return localTime;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatCalendarDate(calendarDate: string): string {
  try {
    return Temporal.PlainDate.from(calendarDate).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch {
    return calendarDate;
  }
}

function formatCalendarMonth(calendarDate: string): string {
  try {
    return Temporal.PlainDate.from(calendarDate).toLocaleString("en-US", {
      month: "long",
      year: "numeric"
    });
  } catch {
    return calendarDate.slice(0, 7);
  }
}

function formatMonthName(monthNumber: number): string {
  try {
    return Temporal.PlainDate.from(
      `2024-${String(monthNumber).padStart(2, "0")}-01`,
    ).toLocaleString("en-US", { month: "short" });
  } catch {
    return String(monthNumber);
  }
}

function formatObservationTime(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant)
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });
}

function formatCheckpointTime(
  rthDate: string,
  localTime: string,
  displayTimeZone: SupportedDisplayTimeZone,
): string {
  return formatClockTime(displayCheckpoint(rthDate, localTime, displayTimeZone));
}

type StructureRange = {
  id: string;
  label: string;
  high: number;
  low: number;
  status: string;
  column: 0 | 1 | 2;
  inherited?:boolean;
};

function hasRangeData(range: RangeCheckpoint): boolean {
  return range.high !== null || range.low !== null || range.cp !== null;
}

function structureMapTitle(range: StructureRange | null): string {
  if (!range) return "IB formation";
  if (range.id === "b-final") return "Initial Balance";
  if (range.id === "b") return "Forming IB";
  if (range.id === "a") return "A-period structure";
  if (range.id === "15r") return "15R structure";
  return "IB formation";
}

function formatRangePosition(
  price: number | null,
  range: StructureRange,
): string {
  if (price === null) return "Not recorded";
  if (price > range.high) return `Above +${formatPriceNumber(price - range.high)}`;
  if (price < range.low) return `Below -${formatPriceNumber(range.low - price)}`;
  const width = range.high - range.low;
  if (width === 0) return "At range";
  return `${(((price - range.low) / width) * 100).toFixed(1)}%`;
}

type MapReferenceTone = "overnight" | "ib" | "significant";

type MapReferenceLabel = {
  id: string;
  shortLabel: string;
  price: number;
  tone: MapReferenceTone;
};

function MapReferenceLabelLayer({
  references,
  levels,
  topFor,
}: {
  references: MapReferenceLabel[];
  levels: MapLevelReference[];
  topFor: (price: number) => number;
}) {
  return <>
    <MapEdgeLabels references={references.filter((reference): reference is MapReferenceLabel & { tone: 'ib' | 'overnight' } =>
      reference.tone !== 'significant')} topFor={topFor} />
    {levels.length > 0 && <MapLevelMarkers references={levels} topFor={topFor} />}
  </>;
}

function StructureMap({
  session,
  finalIb,
  significantLevels,
  levelMapReferences,
}: {
  session: JournalSession;
  finalIb: ReturnType<typeof deriveFinalIb>;
  significantLevels: SignificantLevel[];
  levelMapReferences: Map<string, MapLevelReference>;
}) {
  const { template: ES_TEMPLATE, checkpointInstant, sessionObservationInstant, checkpointLockReached, formatCheckpointTime } = useJournalClock();
  const activePhase=useWorkspaceActivePhase(session);
  const latestCp = latestCpObservation(session);
  const latestPreOpen = latestPreOpenSnapshot(session);
  const overnightHigh = session.overnight.high ?? latestPreOpen?.formingOvernightHigh ?? null;
  const overnightLow = session.overnight.low ?? latestPreOpen?.formingOvernightLow ?? null;
  const hasA = hasRangeData(session.aPeriod) || session.aPeriodHistory.length > 0;
  const hasB =
    hasRangeData(session.bPeriod) ||
    session.bPeriodHistory.length > 0 ||
    session.bSnapshots.length > 0;
  const effectiveA = carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
  const effectiveB = carryRangeEdgesForward(
    session.bPeriod,
    session.fifteenMinute,
    effectiveA,
    ...session.bSnapshots,
  );
  const fifteenMinuteLockReached = checkpointLockReached(
    session.rthDate,
    ES_TEMPLATE.checkpoints.fifteenMinuteLock,
  );
  const aLockReached = checkpointLockReached(
    session.rthDate,
    ES_TEMPLATE.checkpoints.aLock,
  );
  const ibLockReached = checkpointLockReached(
    session.rthDate,
    ES_TEMPLATE.checkpoints.ibLock,
  );
  if(ibLockReached&&!finalIb)finalIb=deriveSessionRecordedIb(session,Temporal.Now.instant().toString());
  const confirmedIb=deriveSessionFinalIb(session);
  const formationRanges: StructureRange[] = [];
  if (session.fifteenMinute.high !== null && session.fifteenMinute.low !== null) {
    formationRanges.push({
      id: "15r",
      label: "15R",
      high: session.fifteenMinute.high,
      low: session.fifteenMinute.low,
      status: !fifteenMinuteLockReached
        ? "Forming"
        : session.fifteenMinute.status === "confirmed" ? "Confirmed" : "Recorded",
      column: 0,
    });
  }
  if ((hasA||activePhase==='A') && effectiveA.high !== null && effectiveA.low !== null) {
    formationRanges.push({
      id: "a",
      label: "A",
      high: effectiveA.high,
      low: effectiveA.low,
      inherited:!hasA,
      status: !hasA?'Inherited 15R · Forming':!aLockReached
        ? "Forming"
        : session.aPeriod.status === "confirmed" ? "Confirmed" : "Recorded",
      column: 1,
    });
  }
  if ((hasB||activePhase==='B') && effectiveB.high !== null && effectiveB.low !== null) {
    formationRanges.push({
      id: finalIb ? "b-final" : "b",
      label: finalIb ? (confirmedIb?"B / FINAL IB":"B / RECORDED IB") : "B",
      high: finalIb?.high ?? effectiveB.high,
      low: finalIb?.low ?? effectiveB.low,
      inherited:!hasB,
      status: !hasB?'Inherited range · Forming':finalIb
        ? (confirmedIb?"Locked":"Recorded")
        : ibLockReached ? "Needs IB range" : "Forming",
      column: 2,
    });
  }
  const primaryRange = formationRanges.at(-1) ?? null;

  const activeLevels = significantLevels.filter(
    (level) => level.currentStatus === "active" && level.sessionEdge?.sessionId !== session.id,
  );
  const edgeShown = (code: string) => significantLevels.find(level =>
    level.sessionEdge?.sessionId === session.id && level.sessionEdge.code === code)?.showOnMap ?? true;
  const markers = activeLevels.flatMap(level => levelMapReferences.has(level.id) ? [levelMapReferences.get(level.id)!] : []);
  const levelReferences = activeLevels.flatMap((level) => {
    const shortLabel = displayLevelLabel(level) || `Significant ${level.levelType}`;
    const marker = levelMapReferences.get(level.id);
    const role = marker?.role ?? 'reference';
    const quality=marker?.quality??'common';
    const label = `${marker?.code ?? ''} ${significantLevelName(level)} · ${role}`.trim();
    if (level.shape === "single_price" && level.price !== null) {
      return [{
        id: level.id,
        label,
        role,
        quality,
        shortLabel,
        price: level.price,
      }];
    }
    return [
      level.zoneLow === null
        ? null
        : {
            id: `${level.id}:low`,
            label: `${label} low`,
            role,
            quality,
            shortLabel: `${shortLabel} low`,
            price: level.zoneLow,
          },
      level.zoneHigh === null
        ? null
        : {
            id: `${level.id}:high`,
            label: `${label} high`,
            role,
            quality,
            shortLabel: `${shortLabel} high`,
            price: level.zoneHigh,
          },
    ].filter((reference): reference is {
      id: string;
      label: string;
      shortLabel: string;
      role: MapLevelReference['role'];
      quality:LevelQuality;
      price: number;
    } =>
      reference !== null);
  });
  const { high: rthHigh, low: rthLow } = deriveRecordedRthRange(session);
  const contextCount =
    (overnightHigh !== null || overnightLow !== null ? 1 : 0) +
    (rthHigh !== null || rthLow !== null ? 1 : 0) +
    activeLevels.length;
  const overnightReferences = [
    overnightHigh === null ? null : { id: "onh", label: "ONH", price: overnightHigh },
    overnightLow === null ? null : { id: "onl", label: "ONL", price: overnightLow },
  ].filter((reference): reference is { id: string; label: string; price: number } =>
    reference !== null && edgeShown(reference.label));

  if (!primaryRange && overnightReferences.length === 0 && levelReferences.length === 0) {
    return (
      <>
        <div className="section-heading map-heading">
          <div>
            <p className="eyebrow">Current structure</p>
            <h2>IB formation</h2>
          </div>
          <span className="status-dot">Awaiting data</span>
        </div>
        <p className="empty-state">
          Start with ON high and low, or open A to record the opening range. Your map builds as you add observations.
        </p>
        {contextCount > 0 && (
          <MapContext
            session={session}
            count={contextCount}
            overnightHigh={overnightHigh}
            overnightLow={overnightLow}
            rthHigh={rthHigh}
            rthLow={rthLow}
            rthFinal={session.close.rthHigh !== null && session.close.rthLow !== null}
            levels={activeLevels}
          />
        )}
      </>
    );
  }

  if (!primaryRange) {
    const sessionStartMs = sessionObservationInstant(
      session.rthDate,
      ES_TEMPLATE.overnightStart,
    ).epochMilliseconds;
    const studyCloseMs = checkpointInstant(
      session.rthDate,
      ES_TEMPLATE.checkpoints.studyClose,
    ).epochMilliseconds;
    const preFormationObservations = [...session.cpObservations]
      .filter((observation) => {
        const observedMs = Temporal.Instant.from(observation.observedAt).epochMilliseconds;
        return observedMs >= sessionStartMs && observedMs <= studyCloseMs;
      })
      .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
    const overnightValues = [
      ...overnightReferences.map((reference) => reference.price),
      ...preFormationObservations.map((observation) => observation.price),
      ...levelReferences.map((reference) => reference.price),
    ];
    const overnightMin = Math.min(...overnightValues);
    const overnightMax = Math.max(...overnightValues);
    const overnightSpan = Math.max(overnightMax - overnightMin, ES_TEMPLATE.tickSize * 16);
    const overnightPadding = Math.max(ES_TEMPLATE.tickSize * 4, overnightSpan * 0.1);
    const overnightScaleMin = overnightMin - overnightPadding;
    const overnightScaleMax = overnightMax + overnightPadding;
    const overnightScaleSpan = overnightScaleMax - overnightScaleMin;
    const overnightTopFor = (price: number) =>
      ((overnightScaleMax - price) / overnightScaleSpan) * 100;
    const firstObservationMs = preFormationObservations.length > 0
      ? Temporal.Instant.from(preFormationObservations[0].observedAt).epochMilliseconds
      : null;
    const lastObservationMs = preFormationObservations.length > 0
      ? Temporal.Instant.from(preFormationObservations.at(-1)!.observedAt).epochMilliseconds
      : null;
    const overnightXFor = (observedAt: string) => {
      const observedMs = Temporal.Instant.from(observedAt).epochMilliseconds;
      if (
        firstObservationMs === null ||
        lastObservationMs === null ||
        firstObservationMs === lastObservationMs
      ) return 6;
      return 6 +
        ((observedMs - firstObservationMs) / (lastObservationMs - firstObservationMs)) * 88;
    };
    const overnightPathPoints = preFormationObservations.map((observation) => ({
      ...observation,
      x: overnightXFor(observation.observedAt),
      y: overnightTopFor(observation.price),
    }));
    const overnightAxisStart = preFormationObservations[0]
      ? formatClockTime(formatObservationTime(
          preFormationObservations[0].observedAt,
          session.displayTimeZone,
        ))
      : formatCheckpointTime(
          session.rthDate,
          ES_TEMPLATE.overnightStart,
          session.displayTimeZone as SupportedDisplayTimeZone,
        );
    const overnightAxisEnd = preFormationObservations.at(-1)
      ? formatClockTime(formatObservationTime(
          preFormationObservations.at(-1)!.observedAt,
          session.displayTimeZone,
        ))
      : formatCheckpointTime(
          session.rthDate,
          ES_TEMPLATE.checkpoints.overnightLock,
          session.displayTimeZone as SupportedDisplayTimeZone,
        );

    return (
      <>
        <div className="section-heading map-heading">
          <div>
            <p className="eyebrow">Current structure</p>
            <h2>Overnight references</h2>
          </div>
          <span className="status-dot map-status">
            {session.overnight.status === "confirmed" ? "Locked" : "Forming"}
          </span>
        </div>
        <div className="map-shell" data-edge-markers={overnightReferences.length > 0} data-level-markers={markers.length > 0} role="group" aria-label="Current market structure map">
          <div className="map-formation-canvas">
            {overnightReferences.map((reference) => (
              <span
                key={reference.id}
                className="on-reference-line" role="img"
                style={{ top: `${overnightTopFor(reference.price)}%` }}
                aria-label={`${reference.label} ${formatPriceNumber(reference.price)}`}
              />
            ))}
            {levelReferences.map((reference) => (
              <span
                key={reference.id}
                className="significant-level-reference-line" data-role={reference.role} data-quality={reference.quality} role="img"
                style={{ top: `${overnightTopFor(reference.price)}%` }}
                aria-label={`${reference.label} ${formatPriceNumber(reference.price)}`}
              />
            ))}
            <MapReferenceLabelLayer
              levels={markers}
              references={[
                ...overnightReferences.map((reference) => ({
                  ...reference,
                  shortLabel: reference.label,
                  tone: "overnight" as const,
                })),
                ...levelReferences.map((reference) => ({
                  ...reference,
                  tone: "significant" as const,
                })),
              ]}
              topFor={overnightTopFor}
            />
            {overnightPathPoints.length > 1 && (
              <svg
                className="ib-recorded-path"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={overnightPathPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
            {overnightPathPoints.map((point, index) => (
              <span
                key={point.id}
                className="ib-path-dot" role="img"
                data-latest={index === overnightPathPoints.length - 1}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-label={`${formatPriceNumber(point.price)} at ${formatClockTime(formatObservationTime(
                  point.observedAt,
                  session.displayTimeZone,
                ))}`}
              />
            ))}
          </div>
          <div className="map-overnight-axis" role="group" aria-label="Recorded overnight time span">
            <span>{overnightAxisStart}</span>
            <strong>Overnight</strong>
            <span>{overnightAxisEnd}</span>
          </div>
        </div>
        {contextCount > 0 && (
          <MapContext
            session={session}
            count={contextCount}
            overnightHigh={overnightHigh}
            overnightLow={overnightLow}
            rthHigh={rthHigh}
            rthLow={rthLow}
            rthFinal={session.close.rthHigh !== null && session.close.rthLow !== null}
            levels={activeLevels}
          />
        )}
      </>
    );
  }

  const formationStartMs = checkpointInstant(
    session.rthDate,
    ES_TEMPLATE.checkpoints.overnightLock,
  ).epochMilliseconds;
  const fifteenLockMs = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.fifteenMinuteLock).epochMilliseconds;
  const aLockMs = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.aLock).epochMilliseconds;
  const ibLockMs = checkpointInstant(
    session.rthDate,
    ES_TEMPLATE.checkpoints.ibLock,
  ).epochMilliseconds;
  const studyCloseMs = checkpointInstant(
    session.rthDate,
    ES_TEMPLATE.checkpoints.studyClose,
  ).epochMilliseconds;
  const recordedObservations = [...session.cpObservations]
    .filter((observation) => {
      const observedMs = Temporal.Instant.from(observation.observedAt).epochMilliseconds;
      return observedMs >= formationStartMs && observedMs <= studyCloseMs;
    })
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  const formingSteps = formationRanges.flatMap((range) => {
    if(range.inherited)return []; // Carried bounds are references, not a saved path or range step.
    const history = range.column === 0 ? session.fifteenMinuteHistory
      : range.column === 1 ? session.aPeriodHistory
      : [...session.bPeriodHistory, ...session.bSnapshots];
    const starts = [formationStartMs, fifteenLockMs, aLockMs];
    const ends = [fifteenLockMs, aLockMs, ibLockMs];
    const initial = formationRanges.filter(r => r.column < range.column).at(-1);
    return formationSteps(range, history, starts[range.column], ends[range.column], range.column, initial).map((step, stepIndex) => ({ ...step, column: range.column,
        id: `${range.id}:${stepIndex}`, label: range.label }));
  });
  const ibReferenceBackground = (edge: "high" | "low") => {
    const end = Math.max(0, ...formingSteps.filter(step => step[edge] === primaryRange[edge]).map(step => step.left + step.width));
    return `linear-gradient(to right, rgb(244 92 169 / 18%) ${end}%, rgb(244 92 169 / 65%) ${end}%)`;
  };
  const formationValues = formingSteps.flatMap((range) => [range.high, range.low]);
  const mapValues = [
    ...overnightReferences.map((reference) => reference.price),
    ...formationValues,
    ...recordedObservations.map((observation) => observation.price),
    ...levelReferences.map((reference) => reference.price),
  ];
  const mapMin = Math.min(...mapValues);
  const mapMax = Math.max(...mapValues);
  const mapSpan = Math.max(mapMax - mapMin, ES_TEMPLATE.tickSize * 16);
  const scalePadding = Math.max(ES_TEMPLATE.tickSize * 4, mapSpan * 0.1);
  const scaleMin = mapMin - scalePadding;
  const scaleMax = mapMax + scalePadding;
  const scaleSpan = scaleMax - scaleMin;
  const topFor = (price: number) => ((scaleMax - price) / scaleSpan) * 100;
  const midpoint = primaryRange.low + (primaryRange.high - primaryRange.low) / 2;
  const largeMoveThreshold = mapMoveThreshold(ES_TEMPLATE.tickSize, mapSpan);
  const formationObservations = recordedObservations.filter((observation) =>
    Temporal.Instant.from(observation.observedAt).epochMilliseconds <= ibLockMs);
  const rthObservations = collapseNearbyMapObservations(
    recordedObservations.filter((observation) =>
      Temporal.Instant.from(observation.observedAt).epochMilliseconds > ibLockMs),
    largeMoveThreshold,
  );
  const plottedObservations = [...formationObservations, ...rthObservations];
  const firstRthObservationMs = rthObservations.length > 0
    ? Temporal.Instant.from(rthObservations[0].observedAt).epochMilliseconds
    : null;
  const lastRthObservationMs = rthObservations.length > 0
    ? Temporal.Instant.from(rthObservations.at(-1)!.observedAt).epochMilliseconds
    : null;
  const xFor = (observedAt: string) => mapObservationX(
    Temporal.Instant.from(observedAt).epochMilliseconds,
    [formationStartMs, fifteenLockMs, aLockMs, ibLockMs],
    firstRthObservationMs, lastRthObservationMs,
  );
  const pathPoints = plottedObservations.map((observation) => ({
    ...observation,
    x: xFor(observation.observedAt),
    y: topFor(observation.price),
  }));

  return (
    <>
      <div className="section-heading map-heading">
        <div>
          <p className="eyebrow">Current structure</p>
          <h2>{structureMapTitle(primaryRange)}</h2>
        </div>
        <span className="status-dot map-status">{primaryRange?.status ?? "Recorded"}</span>
      </div>
      <div className="map-shell" data-edge-markers="true" data-level-markers={markers.length > 0} role="group" aria-label="Current market structure map">
        <div className="map-formation-canvas">
          {overnightReferences.map((reference) => (
            <span
              key={reference.id}
              className="on-reference-line" role="img"
              style={{ top: `${topFor(reference.price)}%` }}
              aria-label={`${reference.label} ${formatPriceNumber(reference.price)}`}
            />
          ))}
          {levelReferences.map((reference) => (
            <span
              key={reference.id}
              className="significant-level-reference-line" data-role={reference.role} data-quality={reference.quality} role="img"
              style={{ top: `${topFor(reference.price)}%` }}
              aria-label={`${reference.label} ${formatPriceNumber(reference.price)}`}
            />
          ))}
          {finalIb && (
            <div
              className="map-rth-ib-band"
              style={{
                top: `${topFor(primaryRange.high)}%`,
                bottom: `${100 - topFor(primaryRange.low)}%`,
              }}
              aria-hidden="true"
            />
          )}
          {formingSteps.map((range) => (
            <div
              key={range.id}
              className="map-formation-step" role="img"
              data-stage={range.column}
              style={{
                left: `${range.left}%`,
                width: `${range.width}%`,
                top: `${topFor(range.high)}%`,
                bottom: `${100 - topFor(range.low)}%`,
              }}
              aria-label={`${range.label} ${formatPriceNumber(range.low)} to ${formatPriceNumber(range.high)}`}
            />
          ))}
          {(
            <>
              {edgeShown('IBH') && <span
                className="ib-reference-line high" data-forming={!finalIb} role="img"
                style={{ top: `${topFor(primaryRange.high)}%`, background: ibReferenceBackground("high") }}
                aria-label={`IBH ${formatPriceNumber(primaryRange.high)}`}
              />}
              <span className="ib-reference-line midpoint" style={{ top: `${topFor(midpoint)}%` }} aria-hidden="true" />
              {edgeShown('IBL') && <span
                className="ib-reference-line low" data-forming={!finalIb} role="img"
                style={{ top: `${topFor(primaryRange.low)}%`, background: ibReferenceBackground("low") }}
                aria-label={`IBL ${formatPriceNumber(primaryRange.low)}`}
              />}
            </>
          )}
          <MapReferenceLabelLayer
            levels={markers}
            references={[
              ...overnightReferences.map((reference) => ({
                ...reference,
                shortLabel: reference.label,
                tone: "overnight" as const,
              })),
              ...levelReferences.map((reference) => ({
                ...reference,
                tone: "significant" as const,
              })),
              ...([
                {
                  id: "ibh",
                  shortLabel: "IBH",
                  price: primaryRange.high,
                  tone: "ib" as const,
                },
                {
                  id: "ibl",
                  shortLabel: "IBL",
                  price: primaryRange.low,
                  tone: "ib" as const,
                },
              ].filter(reference => edgeShown(reference.shortLabel))),
            ]}
            topFor={topFor}
          />
          {pathPoints.length > 1 && (
            <svg
              className="ib-recorded-path"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={pathPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
          {pathPoints.map((point, index) => (
            <span
              key={point.id}
              className="ib-path-dot" role="img"
              data-latest={index === pathPoints.length - 1}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              aria-label={`${formatPriceNumber(point.price)} at ${formatClockTime(formatObservationTime(
                point.observedAt,
                session.displayTimeZone,
              ))}`}
            />
          ))}
        </div>
        <div className="map-stage-axis" role="group" aria-label="IB formation stages">
          <span data-recorded={formationRanges.some((range) => range.column === 0)}>15R</span>
          <span data-recorded={formationRanges.some((range) => range.column === 1)}>A</span>
          <span data-recorded={formationRanges.some((range) => range.column === 2)}>B/IB</span>
          <span data-recorded={pathPoints.some((point) => point.x > 45)}>RTH</span>
        </div>
      </div>
      <dl className="geometry-grid map-geometry">
        <div><dt>IB range</dt><dd>{formatPriceNumber(primaryRange.high - primaryRange.low)} <small>pts</small></dd></div>
        <div><dt>Midpoint</dt><dd>{formatTickRoundedPrice(midpoint, ES_TEMPLATE.tickSize)}</dd></div>
        <div className="map-price-position"><dt>Price in range<small>0% low · 100% high</small></dt><dd>{formatRangePosition(latestCp?.price ?? null, primaryRange)}</dd></div>
      </dl>
      {formationRanges.length > 0 && (
        <details className="map-ranges-detail">
          <summary>Period ranges <span className="detail-count">{formationRanges.length}</span></summary>
          <p className="map-detail-help">Steps show your saved range updates, not the exact time of each high or low.</p>
          <div className="map-range-list">
            {formationRanges.map((range) => (
              <div key={range.id}>
                <span><strong>{range.label}</strong><small>{range.status}</small></span>
                <span>{formatPriceNumber(range.high)}<small>High</small></span>
                <span>{formatPriceNumber(range.low)}<small>Low</small></span>
              </div>
            ))}
          </div>
        </details>
      )}
      {contextCount > 0 && (
        <MapContext
          session={session}
          count={contextCount}
          overnightHigh={overnightHigh}
          overnightLow={overnightLow}
          rthHigh={rthHigh}
          rthLow={rthLow}
          rthFinal={session.close.rthHigh !== null && session.close.rthLow !== null}
          levels={activeLevels}
        />
      )}
    </>
  );
}

function MapContext({
  session,
  count,
  overnightHigh,
  overnightLow,
  rthHigh,
  rthLow,
  rthFinal,
  levels,
}: {
  session: JournalSession;
  count: number;
  overnightHigh: number | null;
  overnightLow: number | null;
  rthHigh: number | null;
  rthLow: number | null;
  rthFinal: boolean;
  levels: SignificantLevel[];
}) {
  return (
    <details className="map-ranges-detail map-context-detail">
      <summary>Other map levels <span className="detail-count">{count}</span></summary>
      <div className="map-context-list">
        {(overnightHigh !== null || overnightLow !== null) && (
          <div><strong>ON</strong><span>{formatPrice(overnightHigh)} – {formatPrice(overnightLow)}</span></div>
        )}
        <OvernightStudySummary session={session}/>
        {(rthHigh !== null || rthLow !== null) && (
          <div><strong>{rthFinal ? "Final RTH" : "Recorded RTH"}</strong><span>{formatPrice(rthHigh)} – {formatPrice(rthLow)}</span></div>
        )}
        {levels.map((level) => (
          <div key={level.id}>
            <strong>{displayLevelLabel(level) || `Significant ${level.levelType}`}</strong>
            <span>
              {level.shape === "single_price"
                ? formatPrice(level.price)
                : `${formatPrice(level.zoneHigh)} – ${formatPrice(level.zoneLow)}`}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}

function checkpointDashboardStatus(
  checkpoint: RangeCheckpoint,
  historyLength: number,
  lockReached = true,
): DashboardStatus {
  if (checkpoint.status === "confirmed" && lockReached) return "complete";
  if (
    historyLength > 0 ||
    checkpoint.high !== null ||
    checkpoint.low !== null ||
    checkpoint.cp !== null ||
    checkpoint.note !== null
  ) {
    return "partial";
  }
  return "not-started";
}

function preOpenDashboardStatus(session: JournalSession): DashboardStatus {
  const latestPreOpen = latestPreOpenSnapshot(session);
  if (
    latestPreOpen?.formingOvernightHigh !== null &&
    latestPreOpen?.formingOvernightHigh !== undefined &&
    latestPreOpen.formingOvernightLow !== null
  ) {
    return "complete";
  }
  if (session.preOpenSnapshots.length > 0 || session.contractHistory.length > 0) {
    return "partial";
  }
  return "not-started";
}

function overnightDashboardStatus(session: JournalSession): DashboardStatus {
  if (session.overnight.status === "confirmed") return "complete";
  if (
    session.overnightHistory.length > 0 ||
    session.overnight.high !== null ||
    session.overnight.low !== null ||
    session.overnight.rthOpen !== null
  ) {
    return "partial";
  }
  return "not-started";
}

function onDashboardStatus(session: JournalSession): DashboardStatus {
  if (session.overnight.status === "confirmed") return "complete";
  if (
    preOpenDashboardStatus(session) !== "not-started" ||
    overnightDashboardStatus(session) !== "not-started" ||
    sessionNotesForPhase(session, "ON").length > 0
  ) {
    return "partial";
  }
  return "not-started";
}

function ibDashboardStatus(
  session: JournalSession,
  finalIb: ReturnType<typeof deriveFinalIb>,
  lockReached = true,
): DashboardStatus {
  if (finalIb && lockReached) return "complete";
  const checkpoints = [session.fifteenMinute, session.aPeriod, session.bPeriod];
  if (
    session.fifteenMinuteHistory.length > 0 ||
    session.aPeriodHistory.length > 0 ||
    session.bPeriodHistory.length > 0 ||
    session.bSnapshots.length > 0 ||
    sessionNotesForPhase(session, "IB").length > 0 ||
    checkpoints.some(
      (checkpoint) =>
        checkpoint.high !== null ||
        checkpoint.low !== null ||
        checkpoint.cp !== null ||
        checkpoint.note !== null,
    )
  ) {
    return "partial";
  }
  return "not-started";
}

function rthDashboardStatus(session: JournalSession): DashboardStatus {
  if (session.close.finishedAt) return "complete";
  if (
    session.rthObservations.length > 0 ||
    sessionNotesForPhase(session, "RTH").length > 0 ||
    session.close.price !== null
  ) {
    return "partial";
  }
  return "not-started";
}

function marketContextSummary(session: JournalSession): string {
  const firstEvent = session.marketContextItems[0];
  if (!firstEvent) return "Add context";
  const firstTime = firstEvent.holiday ? 'All day' : formatClockTime(
    formatObservationTime(firstEvent.eventAt, session.displayTimeZone),
  );
  return session.marketContextItems.length === 1
    ? firstTime
    : `${firstTime} · ${session.marketContextItems.length} events`;
}

function dashboardStatusLabel(status: DashboardStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "optional":
      return "Optional";
    default:
      return "Not started";
  }
}

type DashboardLevelPair = {
  state: string;
  highLabel: string;
  high: number | null;
  lowLabel: string;
  low: number | null;
};

function displayedIbEdges(
  session: JournalSession,
  finalIb: ReturnType<typeof deriveFinalIb>,
): Pick<DashboardLevelPair, "high" | "low"> {
  if (finalIb) return { high: finalIb.high, low: finalIb.low };
  const highs = [
    session.fifteenMinute.high,
    session.aPeriod.high,
    ...session.bSnapshots.map((snapshot) => snapshot.high),
    session.bPeriod.high,
  ].filter((price): price is number => price !== null);
  const lows = [
    session.fifteenMinute.low,
    session.aPeriod.low,
    ...session.bSnapshots.map((snapshot) => snapshot.low),
    session.bPeriod.low,
  ].filter((price): price is number => price !== null);
  return {
    high: highs.length > 0 ? Math.max(...highs) : null,
    low: lows.length > 0 ? Math.min(...lows) : null,
  };
}

function dashboardLevels(
  session: JournalSession,
  finalIb: ReturnType<typeof deriveFinalIb>,
): { on: DashboardLevelPair; ib: DashboardLevelPair; rth: DashboardLevelPair } {
  const latestPreOpen = latestPreOpenSnapshot(session);
  const ibEdges = displayedIbEdges(session, finalIb);
  const rth = deriveRecordedRthRange(session);

  return {
    on: {
      state: session.overnight.status === "confirmed" ? "Locked" : "Forming",
      highLabel: "ONH",
      high: session.overnight.high ?? latestPreOpen?.formingOvernightHigh ?? null,
      lowLabel: "ONL",
      low: session.overnight.low ?? latestPreOpen?.formingOvernightLow ?? null,
    },
    ib: {
      state: finalIb ? "Locked" : "Developing",
      highLabel: "IBH",
      high: ibEdges.high,
      lowLabel: "IBL",
      low: ibEdges.low,
    },
    rth: {
      state: session.close.finishedAt ? "Final" : rth.high !== null || rth.low !== null ? "Recorded" : "Pending",
      highLabel: "H",
      high: rth.high,
      lowLabel: "L",
      low: rth.low,
    },
  };
}

function finalIbForSession(session: JournalSession): ReturnType<typeof deriveFinalIb> {
  return deriveSessionFinalIb(session);
}

const MISSING_FIELD_LABELS: Record<SessionMissingField, string> = {
  CONTRACT: "Exact contract not supplied",
  OVERNIGHT_RANGE: "Completed overnight range pending",
  RTH_OPEN: "RTH opening price not supplied",
  FIFTEEN_MINUTE_RANGE: "Completed 15R range pending",
  A_PERIOD: "Completed A period pending",
  B_PERIOD: "Completed B period pending",
  FINAL_IB: "Final IB unavailable",
  RTH_PATH_COVERAGE: "Full RTH break and return coverage not confirmed"
};

function sessionMissingItems(
  session: JournalSession,
  finalIb: ReturnType<typeof deriveFinalIb>,
): string[] {
  return deriveSessionMissingFields(session, finalIb).map(
    (field) => MISSING_FIELD_LABELS[field],
  );
}

function sessionHasOwnJournalData(session: JournalSession): boolean {
  const finalIb = finalIbForSession(session);
  return (
    onDashboardStatus(session) !== "not-started" ||
    ibDashboardStatus(session, finalIb) !== "not-started" ||
    rthDashboardStatus(session) !== "not-started" ||
    session.marketContextItems.length > 0 ||
    session.cpObservations.length > 0
  );
}

function sessionHasJournalData(
  session: JournalSession,
  significantLevels: SignificantLevel[],
): boolean {
  return (
    sessionHasOwnJournalData(session) ||
    significantLevels.some((level) => level.createdInSessionId === session.id)
  );
}

function historyCompletionStatus(
  session: JournalSession,
  significantLevels: SignificantLevel[],
): DashboardStatus {
  if (session.close.finishedAt) return "complete";
  return sessionHasJournalData(session, significantLevels) ? "partial" : "not-started";
}

function historyDayType(
  session: JournalSession,
  finalIb: ReturnType<typeof deriveFinalIb>,
): string {
  const { template: ES_TEMPLATE } = journalClock(session.market);
  const closingOutcome = deriveClosingOutcome(session, finalIb, ES_TEMPLATE.tickSize);
  if (session.close.finishedAt && closingOutcome?.breakCode) {
    return compactBreakCode(closingOutcome.breakCode);
  }
  return deriveRecordedBreakDayType(
    session.rthObservations,
    finalIb,
    ES_TEMPLATE.tickSize,
  ) ?? "Day type pending";
}

function sessionHistorySearchText(
  session: JournalSession,
  significantLevels: SignificantLevel[],
): string {
  const finalIb = finalIbForSession(session);
  const completion = historyCompletionStatus(session, significantLevels);
  const date = Temporal.PlainDate.from(session.rthDate);
  const notes = [
    ...session.preOpenSnapshots.map((snapshot) => snapshot.note),
    session.fifteenMinute.note,
    session.aPeriod.note,
    ...session.bSnapshots.map((snapshot) => snapshot.note),
    session.bPeriod.note,
    ...session.marketContextItems.flatMap((item) => [item.name, item.note]),
    ...session.rthObservations.map((observation) => observation.note),
    ...session.sessionNotes.map((note) => note.text),
    session.close.note,
    ...significantLevels
      .filter((level) => level.createdInSessionId === session.id)
      .flatMap((level) => [level.label, level.note, level.levelType]),
  ];
  return [
    session.rthDate,
    formatCalendarDate(session.rthDate),
    `${date.month}/${date.day}/${date.year}`,
    session.contract,
    session.instrument,
    historyDayType(session, finalIb),
    dashboardStatusLabel(completion),
    ...notes,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLocaleLowerCase();
}

function historySearchMatches(
  session: JournalSession,
  significantLevels: SignificantLevel[],
  query: string,
): boolean {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const searchText = sessionHistorySearchText(session, significantLevels);
  return terms.every((term) => searchText.includes(term));
}

function CheckpointStrip({ session, activePanel, onOpen }: {
  session: JournalSession; activePanel: SessionPanel; onOpen: (panel: SessionPanel) => void;
}) {
  const { template: ES_TEMPLATE, checkpointLockReached, formatCheckpointTime } = useJournalClock();
  // Refresh emphasis only. The selected form belongs to the user, never the clock.
  useCurrentTimeInZone(session.displayTimeZone);
  const cp = ES_TEMPLATE.checkpoints;
  const beforeOpen = !checkpointLockReached(session.rthDate, cp.overnightLock);
  const finalIb = deriveFinalIb(session.aPeriod, session.bPeriod);
  const contextSaved = session.marketContextItems.length > 0 || session.sessionNotes.length > 0;
  const steps: { label: string; panel: SessionPanel; time: string | null; saved: boolean; partial: boolean; active: boolean }[] = [
    { label: "CTX", panel: "context", time: null, saved: contextSaved, partial: false, active: activePanel === "context" },
    { label: "ON", panel: beforeOpen ? "preopen" : "overnight", time: cp.overnightLock,
      saved: session.overnight.status === "confirmed", partial: session.preOpenSnapshots.length > 0 || session.overnight.high !== null || session.overnight.low !== null,
      active: activePanel === "preopen" || activePanel === "overnight" },
    { label: "A", panel: "a-period", time: cp.overnightLock,
      saved: session.aPeriod.status === "confirmed", partial: hasRangeData(session.aPeriod) || hasRangeData(session.fifteenMinute), active: activePanel === "a-period" },
    { label: "B", panel: "b-period", time: cp.aLock,
      saved: finalIb !== null, partial: hasRangeData(session.bPeriod), active: activePanel === "b-period" || activePanel === "b-snapshot" },
    { label: "RTH", panel: "rth-period", time: cp.ibLock,
      saved: session.close.finishedAt !== null, partial: session.rthObservations.length > 0 || session.close.price !== null,
      active: activePanel === "rth-period" || activePanel === "close" },
  ];
  const current = beforeOpen ? "ON" : !checkpointLockReached(session.rthDate, cp.aLock) ? "A"
    : !checkpointLockReached(session.rthDate, cp.ibLock) ? "B" : "RTH";
  return <nav className="checkpoint-strip" aria-label="Daily checkpoints">
    {steps.map((step) => <button key={step.label} type="button" aria-label={step.label}
      title={step.label === "CTX" ? "Context" : undefined} aria-pressed={step.active}
      data-current={current === step.label} data-saved={step.saved}
      onClick={() => onOpen(step.panel)}>
      <strong>{step.label}</strong>
      {step.time ? <time>{formatCheckpointTime(session.rthDate, step.time, session.displayTimeZone as SupportedDisplayTimeZone)}</time> : <span className="checkpoint-caption">Context</span>}
      <small>{step.saved ? "Saved" : step.partial ? "Partial" : step.label === "CTX" ? "Optional" : current === step.label ? "Now" : "Pending"}</small>
    </button>)}
  </nav>;
}

function SessionDashboard({
  session,
  finalIb,
  significantLevels,
  levelMapReferences,
  recordedDayType,
  closingOutcome,
  priorSessionTrashCount,
  forecastPrior,
  forecastHistory,
  forecastBatches,
  forecastLevels,
  forecastSessions,
  forecastNews,
  forecastLowBatches,
  forecastPriceBatches,
  forecastRepository,
  contextLevels,
  levelDistance,
  onOpenLevel,
  onPrepareForecast,
  onOpenTrash
}: {
  session: JournalSession;
  finalIb: ReturnType<typeof deriveFinalIb>;
  significantLevels: SignificantLevel[];
  levelMapReferences: Map<string, MapLevelReference>;
  recordedDayType: ReturnType<typeof deriveRecordedBreakDayType>;
  closingOutcome: ReturnType<typeof deriveClosingOutcome>;
  priorSessionTrashCount: number;
  forecastPrior: ForecastPriorDay | null | undefined;
  forecastHistory: HistoricalIbSession[];
  forecastBatches: HistoricalIbImportBatch[];
  forecastLevels: SignificantLevel[];
  forecastSessions: JournalSession[];
  forecastNews: ContextBatch[];
  forecastLowBatches: FbdBatch[];
  forecastPriceBatches: PriceHistoryBatch[];
  forecastRepository: JournalRepository | null;
  contextLevels:SignificantLevel[];
  levelDistance:number;
  onOpenLevel:(id:string)=>void;
  onPrepareForecast: () => Promise<void>;
  onOpenTrash: () => void;
}) {
  const finalizedCode = session.close.finishedAt !== null
    ? closingOutcome?.breakCode ?? null
    : null;
  const dayTypeTitle = finalizedCode
    ? compactBreakCode(finalizedCode)
    : recordedDayType ?? "Day type pending";
  const currentCode=currentSessionIbCode(session);
  const dayState = finalizedCode ? "finalized" : "in-progress";
  return (
    <section
      className="session-dashboard"
      data-day-state={dayState}
      aria-labelledby="session-dashboard-title"
    >
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h2 id="session-dashboard-title">{currentCode
            ? <IbCodeBadge code={currentCode} closed={!!session.close.finishedAt}/>
            : dayTypeTitle}</h2>
        </div>
        <span className="dashboard-day-state" data-state={dayState}>
          {finalizedCode ? "Finalized" : "In progress"}
        </span>
      </div>
      <div className="dashboard-grid today-dashboard-grid">
        <ForecastCard dashboard session={session} prior={forecastPrior} historical={forecastHistory} batches={forecastBatches} levels={forecastLevels}
          contextLevels={contextLevels} levelDistance={levelDistance} onOpenLevel={onOpenLevel}
          sessions={forecastSessions} news={forecastNews} lowBatches={forecastLowBatches} priceBatches={forecastPriceBatches} repository={forecastRepository} onPrepare={onPrepareForecast} />
        <section className="map-card dashboard-inline-map">
          <StructureMap
            session={session}
            finalIb={finalIb}
            significantLevels={significantLevels}
            levelMapReferences={levelMapReferences}
          />
        </section>
      </div>
      {priorSessionTrashCount > 0 && (
        <button
          className="dashboard-trash-button"
          type="button"
          aria-label={`Trash · ${priorSessionTrashCount} prior session${priorSessionTrashCount === 1 ? "" : "s"} for this day`}
          onClick={onOpenTrash}
        >
          Trash · {priorSessionTrashCount} prior session{priorSessionTrashCount === 1 ? "" : "s"} for this day
        </button>
      )}
    </section>
  );
}

function compactBreakCode(code: string): string {
  const match = code.match(/^([A-Z]+)\+(\d+(?:\.\d+)?)$/);
  if (!match) return code;
  return `${match[1]} +${Number(match[2]).toString()}`;
}

function PeriodStatistics({
  summary
}: {
  summary: SessionPeriodStatistics;
}) {
  return (
    <>
      <div className="weekly-primary-stats">
        <span><small>Journaled</small><strong>{summary.journaledDays}</strong></span>
        <span><small>Complete</small><strong>{summary.completedDays}</strong></span>
        <span><small>Incomplete</small><strong>{summary.incompleteDays}</strong></span>
        <span><small>Final IB</small><strong>{summary.finalIbAvailableDays}</strong></span>
        <span><small>Median width</small><strong>{formatPrice(summary.medianIbWidth)}</strong></span>
        <span><small>Missing items</small><strong>{summary.missingDataCount}</strong></span>
      </div>

      <section className="weekly-stat-section" aria-label="Day types">
        <h3>Day types</h3>
        <div className="weekly-count-grid">
          <span>IBN <strong>{summary.dayTypeCounts.IBN}</strong></span>
          <span>IBH <strong>{summary.dayTypeCounts.IBH}</strong></span>
          <span>IBL <strong>{summary.dayTypeCounts.IBL}</strong></span>
          <span>IBB <strong>{summary.dayTypeCounts.IBB}</strong></span>
          <span>Pending <strong>{summary.unclassifiedDayTypeCount}</strong></span>
        </div>
      </section>

      <section className="weekly-stat-section" aria-label="Recorded break behavior">
        <h3>Recorded break behavior</h3>
        <div className="weekly-count-grid">
          <span>High first <strong>{summary.firstBreakCounts.high}</strong></span>
          <span>Low first <strong>{summary.firstBreakCounts.low}</strong></span>
          <span>Not recorded <strong>{summary.firstBreakCounts.notRecorded}</strong></span>
          <span>
            Edge retested <strong>{summary.returnedInsideAfterBreakDays}/{summary.recordedBreakDays}</strong>
          </span>
        </div>
      </section>

      <section className="weekly-stat-section" aria-label="Recorded closes">
        <h3>Recorded closes</h3>
        <div className="weekly-count-grid">
          <span>Above IBH <strong>{summary.closeDispositionCounts.ABOVE_IBH}</strong></span>
          <span>Inside IB <strong>{summary.closeDispositionCounts.INSIDE_OR_ON_IB}</strong></span>
          <span>Below IBL <strong>{summary.closeDispositionCounts.BELOW_IBL}</strong></span>
          <span>Unavailable <strong>{summary.unavailableCloseCount}</strong></span>
        </div>
      </section>
    </>
  );
}

type WeeklyCommentaryItem = { id: string; label: string; line: string };

function weeklyCommentaryItems(sessions: JournalSession[]): WeeklyCommentaryItem[] {
  const items: WeeklyCommentaryItem[] = [];
  for (const session of sessions) {
    sessionCommentaryItems(session).forEach((note) => {
      items.push({
        id: `${session.id}:${note.id}`,
        label: `${session.rthDate} · ${note.label}`,
        line: `${session.rthDate} · ${note.label}: ${note.text}`,
      });
    });
  }
  return items;
}

function WeeklyShareAction({
  week,
  sessions,
  zone,
}: {
  week: WeeklySessionSummary;
  sessions: JournalSession[];
  zone: string;
}) {
  const shareOptions = usePeriodShareOptions();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>("short");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("ready");
  const sourceSessions = useMemo(
    () => sessions.filter((session) => week.days.some((day) => day.sessionId === session.id)),
    [sessions, week.days],
  );
  const instrument = sourceSessions[0]?.instrument ?? "Instrument";
  const commentaryItems = useMemo(
    () => weeklyCommentaryItems(sourceSessions),
    [sourceSessions],
  );
  const selectedCommentary = useMemo(
    () => commentaryItems
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.line),
    [commentaryItems, selectedIds],
  );
  const generatedShortText = useMemo(
    () => buildWeeklyShortShareText(week, instrument, selectedCommentary, shareOptions),
    [week, instrument, selectedCommentary, shareOptions],
  );
  const [shortDraft, setShortDraft] = useState(generatedShortText);
  const fullText = useMemo(
    () => buildWeeklyFullShareText(week, instrument, selectedCommentary, shareOptions),
    [week, instrument, selectedCommentary, shareOptions],
  );
  const imageCard = useMemo(
    () => buildWeeklyImageCardSvg(week, instrument, selectedCommentary, {...shareOptions,sessions:sourceSessions,timeZone:zone}),
    [week, instrument, selectedCommentary, shareOptions,sourceSessions,zone],
  );
  const imageUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageCard.svg)}`,
    [imageCard.svg],
  );
  const nativeShareAvailable = typeof navigator.share === "function";
  const shortCount = Array.from(shortDraft).length;
  const shortOverLimit = shortCount > 280;
  const fullCount = Array.from(fullText).length;
  const text = format === "short" ? shortDraft : fullText;

  useEffect(() => setShortDraft(generatedShortText), [generatedShortText]);
  useEffect(() => setShareStatus("ready"), [format, shortDraft, fullText, imageCard.svg]);

  function toggleCommentary(id: string, checked: boolean): void {
    setSelectedIds((current) => checked
      ? [...current, id]
      : current.filter((candidate) => candidate !== id));
  }

  async function copy(): Promise<void> {
    try {
      await copyShareText(text);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  async function share(): Promise<void> {
    if (format === "image" || !nativeShareAvailable || (format === "short" && shortOverLimit)) return;
    try {
      await navigator.share({ title: `IB Notes week of ${week.weekStart}`, text });
      setShareStatus("shared");
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : "error");
    }
  }

  async function downloadImage(): Promise<void> {
    if (imageCard.overflow) return;
    try {
      const png = await imageCardPngBlob(imageCard.svg);
      downloadFile(`ib-notes-week-${week.weekStart}.png`, png, "image/png");
      setShareStatus("downloaded");
    } catch {
      setShareStatus("error");
    }
  }

  if (!open) {
    return (
      <button className="secondary-action weekly-share-open" type="button" onClick={() => setOpen(true)}>
        Share week
      </button>
    );
  }

  const statusText = shareStatus === "copied"
    ? "Weekly share text copied."
    : shareStatus === "shared"
      ? "Share sheet completed."
      : shareStatus === "downloaded"
        ? "Weekly 1080 × 1350 PNG downloaded."
        : shareStatus === "cancelled"
          ? "Share cancelled. Nothing was sent by IB Notes."
          : shareStatus === "error"
            ? "The weekly share format could not be prepared."
            : "Nothing leaves this device until you choose Copy, Share, or Download.";

  return (
    <WorkspaceDialog title="Share week" className="workspace-share-sheet" onClose={()=>setOpen(false)} dismissAriaLabel="Close" manageHistory>
    <section className="weekly-share-card" aria-label={`Share week of ${week.weekStart}`}>

      <div className="share-format-switch" aria-label="Weekly share format">
        <button type="button" aria-pressed={format === "short"} onClick={() => setFormat("short")}>
          <strong>Short Post</strong><span>280 characters</span>
        </button>
        <button type="button" aria-pressed={format === "full"} onClick={() => setFormat("full")}>
          <strong>Full Recap</strong><span>Long form</span>
        </button>
        <button type="button" aria-pressed={format === "image"} onClick={() => setFormat("image")}>
          <strong>Image Card</strong><span>4:5 PNG</span>
        </button>
      </div>

      {commentaryItems.length > 0 && (
        <details className="share-options">
          <summary>Choose commentary to include</summary>
          <div className="share-options-content">
            <fieldset className="share-option-group">
              <legend>Session notes · choose to include</legend>
              <p>Weekly statistics always remain. Each note requires an explicit selection.</p>
              {commentaryItems.map((item) => (
                <label key={item.id} className="share-checkbox share-optional-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => toggleCommentary(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </details>
      )}

      {format === "short" ? (
        <>
          <label className="share-draft-field">
            <span>Edit weekly short post</span>
            <textarea
              aria-label="Weekly Short Post share text"
              value={shortDraft}
              onChange={(event) => setShortDraft(event.target.value)}
              rows={9}
            />
          </label>
          <div className="share-character-count" data-over-limit={shortOverLimit}>
            <strong>{shortCount} / 280</strong>
            <span>{shortOverLimit ? "Shorten the draft before sharing." : "Within the short-post budget."}</span>
          </div>
        </>
      ) : format === "full" ? (
        <>
          <pre className="share-preview-text" aria-label="Weekly Full Recap share text">{fullText}</pre>
          <div className="share-character-count">
            <strong>{fullCount} characters</strong><span>Long-form draft · no limit applied.</span>
          </div>
        </>
      ) : (
        <>
          <div className="share-image-frame" aria-label="Weekly Image Card preview">
            <img src={imageUrl} alt={imageCard.altText} />
          </div>
          <div className="share-image-resolution">
            <strong>1080 × 1350 PNG</strong><span>4:5 portrait · generated locally</span>
          </div>
          {imageCard.overflow && (
            <p className="share-image-overflow" role="alert">
              The selected commentary needs {imageCard.omittedLineCount} more line{imageCard.omittedLineCount === 1 ? "" : "s"}.
              Remove a note before downloading.
            </p>
          )}
        </>
      )}

      {format === "image" ? (
        <button className="primary-action" type="button" disabled={imageCard.overflow} onClick={() => void downloadImage()}>
          Download PNG
        </button>
      ) : (
        <div className="share-actions">
          <button className="secondary-action" type="button" onClick={() => void copy()}>Copy text</button>
          <button
            className="primary-action"
            type="button"
            disabled={!nativeShareAvailable || (format === "short" && shortOverLimit)}
            onClick={() => void share()}
          >
            Share…
          </button>
        </div>
      )}
      <p className="share-preview-status" role="status" aria-live="polite">{statusText}</p>
    </section>
    </WorkspaceDialog>
  );
}

function MonthlyShareAction({
  month,
  sessions,
}: {
  month: MonthlySessionSummary;
  sessions: JournalSession[];
}) {
  const shareOptions = usePeriodShareOptions();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>("short");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("ready");
  const sourceSessions = useMemo(
    () => sessions.filter((session) => month.days.some((day) => day.sessionId === session.id)),
    [sessions, month.days],
  );
  const instrument = sourceSessions[0]?.instrument ?? "Instrument";
  const commentaryItems = useMemo(
    () => weeklyCommentaryItems(sourceSessions),
    [sourceSessions],
  );
  const selectedCommentary = useMemo(
    () => commentaryItems
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.line),
    [commentaryItems, selectedIds],
  );
  const generatedShortText = useMemo(
    () => buildMonthlyShortShareText(month, instrument, selectedCommentary, shareOptions),
    [month, instrument, selectedCommentary, shareOptions],
  );
  const [shortDraft, setShortDraft] = useState(generatedShortText);
  const fullText = useMemo(
    () => buildMonthlyFullShareText(month, instrument, selectedCommentary, shareOptions),
    [month, instrument, selectedCommentary, shareOptions],
  );
  const imageCard = useMemo(
    () => buildMonthlyImageCardSvg(month, instrument, selectedCommentary, shareOptions),
    [month, instrument, selectedCommentary, shareOptions],
  );
  const imageUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageCard.svg)}`,
    [imageCard.svg],
  );
  const nativeShareAvailable = typeof navigator.share === "function";
  const shortCount = Array.from(shortDraft).length;
  const shortOverLimit = shortCount > 280;
  const fullCount = Array.from(fullText).length;
  const text = format === "short" ? shortDraft : fullText;

  useEffect(() => setShortDraft(generatedShortText), [generatedShortText]);
  useEffect(() => setShareStatus("ready"), [format, shortDraft, fullText, imageCard.svg]);

  function toggleCommentary(id: string, checked: boolean): void {
    setSelectedIds((current) => checked
      ? [...current, id]
      : current.filter((candidate) => candidate !== id));
  }

  async function copy(): Promise<void> {
    try {
      await copyShareText(text);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  async function share(): Promise<void> {
    if (format === "image" || !nativeShareAvailable || (format === "short" && shortOverLimit)) return;
    try {
      await navigator.share({ title: `IB Notes ${month.month}`, text });
      setShareStatus("shared");
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : "error");
    }
  }

  async function downloadImage(): Promise<void> {
    if (imageCard.overflow) return;
    try {
      const png = await imageCardPngBlob(imageCard.svg);
      downloadFile(`ib-notes-month-${month.month}.png`, png, "image/png");
      setShareStatus("downloaded");
    } catch {
      setShareStatus("error");
    }
  }

  if (!open) {
    return (
      <button className="secondary-action weekly-share-open" type="button" onClick={() => setOpen(true)}>
        Share month
      </button>
    );
  }

  const statusText = shareStatus === "copied"
    ? "Monthly share text copied."
    : shareStatus === "shared"
      ? "Share sheet completed."
      : shareStatus === "downloaded"
        ? "Monthly 1080 × 1350 PNG downloaded."
        : shareStatus === "cancelled"
          ? "Share cancelled. Nothing was sent by IB Notes."
          : shareStatus === "error"
            ? "The monthly share format could not be prepared."
            : "Nothing leaves this device until you choose Copy, Share, or Download.";

  return (
    <WorkspaceDialog title="Share month" className="workspace-share-sheet" onClose={()=>setOpen(false)} dismissAriaLabel="Close" manageHistory>
    <section className="weekly-share-card" aria-label={`Share month ${month.month}`}>

      <div className="share-format-switch" aria-label="Monthly share format">
        <button type="button" aria-pressed={format === "short"} onClick={() => setFormat("short")}>
          <strong>Short Post</strong><span>280 characters</span>
        </button>
        <button type="button" aria-pressed={format === "full"} onClick={() => setFormat("full")}>
          <strong>Full Recap</strong><span>Long form</span>
        </button>
        <button type="button" aria-pressed={format === "image"} onClick={() => setFormat("image")}>
          <strong>Image Card</strong><span>4:5 PNG</span>
        </button>
      </div>

      {commentaryItems.length > 0 && (
        <details className="share-options">
          <summary>Choose commentary to include</summary>
          <div className="share-options-content">
            <fieldset className="share-option-group">
              <legend>Session notes · choose to include</legend>
              <p>Monthly statistics always remain. Each note requires an explicit selection.</p>
              {commentaryItems.map((item) => (
                <label key={item.id} className="share-checkbox share-optional-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => toggleCommentary(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </details>
      )}

      {format === "short" ? (
        <>
          <label className="share-draft-field">
            <span>Edit monthly short post</span>
            <textarea
              aria-label="Monthly Short Post share text"
              value={shortDraft}
              onChange={(event) => setShortDraft(event.target.value)}
              rows={9}
            />
          </label>
          <div className="share-character-count" data-over-limit={shortOverLimit}>
            <strong>{shortCount} / 280</strong>
            <span>{shortOverLimit ? "Shorten the draft before sharing." : "Within the short-post budget."}</span>
          </div>
        </>
      ) : format === "full" ? (
        <>
          <pre className="share-preview-text" aria-label="Monthly Full Recap share text">{fullText}</pre>
          <div className="share-character-count">
            <strong>{fullCount} characters</strong><span>Long-form draft · no limit applied.</span>
          </div>
        </>
      ) : (
        <>
          <div className="share-image-frame" aria-label="Monthly Image Card preview">
            <img src={imageUrl} alt={imageCard.altText} />
          </div>
          <div className="share-image-resolution">
            <strong>1080 × 1350 PNG</strong><span>4:5 portrait · generated locally</span>
          </div>
          {imageCard.overflow && (
            <p className="share-image-overflow" role="alert">
              The selected commentary needs {imageCard.omittedLineCount} more line{imageCard.omittedLineCount === 1 ? "" : "s"}.
              Remove a note before downloading.
            </p>
          )}
        </>
      )}

      {format === "image" ? (
        <button className="primary-action" type="button" disabled={imageCard.overflow} onClick={() => void downloadImage()}>
          Download PNG
        </button>
      ) : (
        <div className="share-actions">
          <button className="secondary-action" type="button" onClick={() => void copy()}>Copy text</button>
          <button
            className="primary-action"
            type="button"
            disabled={!nativeShareAvailable || (format === "short" && shortOverLimit)}
            onClick={() => void share()}
          >
            Share…
          </button>
        </div>
      )}
      <p className="share-preview-status" role="status" aria-live="polite">{statusText}</p>
    </section>
    </WorkspaceDialog>
  );
}

function YearlyShareAction({
  year,
  sessions,
}: {
  year: YearlySessionSummary;
  sessions: JournalSession[];
}) {
  const shareOptions = usePeriodShareOptions();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ShareFormat>("short");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("ready");
  const sourceSessions = useMemo(
    () => sessions.filter((session) => year.days.some((day) => day.sessionId === session.id)),
    [sessions, year.days],
  );
  const instrument = sourceSessions[0]?.instrument ?? "Instrument";
  const commentaryItems = useMemo(
    () => weeklyCommentaryItems(sourceSessions),
    [sourceSessions],
  );
  const selectedCommentary = useMemo(
    () => commentaryItems
      .filter((item) => selectedIds.includes(item.id))
      .map((item) => item.line),
    [commentaryItems, selectedIds],
  );
  const generatedShortText = useMemo(
    () => buildYearlyShortShareText(year, instrument, selectedCommentary, shareOptions),
    [year, instrument, selectedCommentary, shareOptions],
  );
  const [shortDraft, setShortDraft] = useState(generatedShortText);
  const fullText = useMemo(
    () => buildYearlyFullShareText(year, instrument, selectedCommentary, shareOptions),
    [year, instrument, selectedCommentary, shareOptions],
  );
  const imageCard = useMemo(
    () => buildYearlyImageCardSvg(year, instrument, selectedCommentary, shareOptions),
    [year, instrument, selectedCommentary, shareOptions],
  );
  const imageUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageCard.svg)}`,
    [imageCard.svg],
  );
  const nativeShareAvailable = typeof navigator.share === "function";
  const shortCount = Array.from(shortDraft).length;
  const shortOverLimit = shortCount > 280;
  const fullCount = Array.from(fullText).length;
  const text = format === "short" ? shortDraft : fullText;

  useEffect(() => setShortDraft(generatedShortText), [generatedShortText]);
  useEffect(() => setShareStatus("ready"), [format, shortDraft, fullText, imageCard.svg]);

  function toggleCommentary(id: string, checked: boolean): void {
    setSelectedIds((current) => checked
      ? [...current, id]
      : current.filter((candidate) => candidate !== id));
  }

  async function copy(): Promise<void> {
    try {
      await copyShareText(text);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  async function share(): Promise<void> {
    if (format === "image" || !nativeShareAvailable || (format === "short" && shortOverLimit)) return;
    try {
      await navigator.share({ title: `IB Notes ${year.year}`, text });
      setShareStatus("shared");
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : "error");
    }
  }

  async function downloadImage(): Promise<void> {
    if (imageCard.overflow) return;
    try {
      const png = await imageCardPngBlob(imageCard.svg);
      downloadFile(`ib-notes-year-${year.year}.png`, png, "image/png");
      setShareStatus("downloaded");
    } catch {
      setShareStatus("error");
    }
  }

  if (!open) {
    return (
      <button className="secondary-action weekly-share-open" type="button" onClick={() => setOpen(true)}>
        Share year
      </button>
    );
  }

  const statusText = shareStatus === "copied"
    ? "Yearly share text copied."
    : shareStatus === "shared"
      ? "Share sheet completed."
      : shareStatus === "downloaded"
        ? "Yearly 1080 × 1350 PNG downloaded."
        : shareStatus === "cancelled"
          ? "Share cancelled. Nothing was sent by IB Notes."
          : shareStatus === "error"
            ? "The yearly share format could not be prepared."
            : "Nothing leaves this device until you choose Copy, Share, or Download.";

  return (
    <WorkspaceDialog title="Share year" className="workspace-share-sheet" onClose={()=>setOpen(false)} dismissAriaLabel="Close" manageHistory>
    <section className="weekly-share-card" aria-label={`Share year ${year.year}`}>

      <div className="share-format-switch" aria-label="Yearly share format">
        <button type="button" aria-pressed={format === "short"} onClick={() => setFormat("short")}>
          <strong>Short Post</strong><span>280 characters</span>
        </button>
        <button type="button" aria-pressed={format === "full"} onClick={() => setFormat("full")}>
          <strong>Full Recap</strong><span>Long form</span>
        </button>
        <button type="button" aria-pressed={format === "image"} onClick={() => setFormat("image")}>
          <strong>Image Card</strong><span>4:5 PNG</span>
        </button>
      </div>

      {commentaryItems.length > 0 && (
        <details className="share-options">
          <summary>Choose commentary to include</summary>
          <div className="share-options-content">
            <fieldset className="share-option-group">
              <legend>Session notes · choose to include</legend>
              <p>Yearly statistics always remain. Each note requires an explicit selection.</p>
              {commentaryItems.map((item) => (
                <label key={item.id} className="share-checkbox share-optional-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) => toggleCommentary(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        </details>
      )}

      {format === "short" ? (
        <>
          <label className="share-draft-field">
            <span>Edit yearly short post</span>
            <textarea
              aria-label="Yearly Short Post share text"
              value={shortDraft}
              onChange={(event) => setShortDraft(event.target.value)}
              rows={9}
            />
          </label>
          <div className="share-character-count" data-over-limit={shortOverLimit}>
            <strong>{shortCount} / 280</strong>
            <span>{shortOverLimit ? "Shorten the draft before sharing." : "Within the short-post budget."}</span>
          </div>
        </>
      ) : format === "full" ? (
        <>
          <pre className="share-preview-text" aria-label="Yearly Full Recap share text">{fullText}</pre>
          <div className="share-character-count">
            <strong>{fullCount} characters</strong><span>Long-form draft · no limit applied.</span>
          </div>
        </>
      ) : (
        <>
          <div className="share-image-frame" aria-label="Yearly Image Card preview">
            <img src={imageUrl} alt={imageCard.altText} />
          </div>
          <div className="share-image-resolution">
            <strong>1080 × 1350 PNG</strong><span>4:5 portrait · generated locally</span>
          </div>
          {imageCard.overflow && (
            <p className="share-image-overflow" role="alert">
              The selected commentary needs {imageCard.omittedLineCount} more line{imageCard.omittedLineCount === 1 ? "" : "s"}.
              Remove a note before downloading.
            </p>
          )}
        </>
      )}

      {format === "image" ? (
        <button className="primary-action" type="button" disabled={imageCard.overflow} onClick={() => void downloadImage()}>
          Download PNG
        </button>
      ) : (
        <div className="share-actions">
          <button className="secondary-action" type="button" onClick={() => void copy()}>Copy text</button>
          <button
            className="primary-action"
            type="button"
            disabled={!nativeShareAvailable || (format === "short" && shortOverLimit)}
            onClick={() => void share()}
          >
            Share…
          </button>
        </div>
      )}
      <p className="share-preview-status" role="status" aria-live="polite">{statusText}</p>
    </section>
    </WorkspaceDialog>
  );
}

function ContributingDayButton({
  day,
  onOpenSession
}: {
  day: WeeklyDaySummary;
  onOpenSession: (rthDate: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Open session ${day.rthDate}`}
      onClick={() => onOpenSession(day.rthDate)}
    >
      <span>
        <strong>{formatCalendarDate(day.rthDate)}</strong>
        <small>{day.dayType ?? "Day type pending"}</small>
      </span>
      <span>
        <strong>{day.finalIbWidth === null ? "IB pending" : `${formatPriceNumber(day.finalIbWidth)} pts`}</strong>
        <small>
          {day.missingFields.length === 0
            ? "Data complete"
            : `${day.missingFields.length} missing`}
        </small>
      </span>
    </button>
  );
}

function HistorySessionList({
  sessions,
  significantLevels,
  onOpenSession,
  label,
}: {
  sessions: JournalSession[];
  significantLevels: SignificantLevel[];
  onOpenSession: (rthDate: string) => void;
  label: string;
}) {
  return (
    <ol className="history-list" aria-label={label}>
      {sessions.map((savedSession) => {
        const finalIb = finalIbForSession(savedSession);
        const completion = historyCompletionStatus(savedSession, significantLevels);
        const missingCount = sessionMissingItems(savedSession, finalIb).length;
        return (
          <li key={savedSession.id}>
            <button
              className="history-row"
              type="button"
              aria-label={`Open session ${savedSession.rthDate}`}
              onClick={() => onOpenSession(savedSession.rthDate)}
            >
              <span className="history-row-topline">
                <time dateTime={savedSession.rthDate}>
                  {formatCalendarDate(savedSession.rthDate)}
                </time>
                <span className="history-completion" data-status={completion}>
                  {dashboardStatusLabel(completion)}
                </span>
              </span>
              <strong>{historyDayType(savedSession, finalIb)}</strong>
              <span className="history-row-details">
                <span><small>IBH</small>{formatPrice(finalIb?.high ?? null)}</span>
                <span><small>IBL</small>{formatPrice(finalIb?.low ?? null)}</span>
                <span>
                  <small>Data</small>
                  {missingCount === 0
                    ? "Complete"
                    : `${missingCount} missing`}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function HistoryPanel({
  sessions,
  significantLevels,
  onOpenSession, historicalSessions, priceBatches, contextBatches, repository, zone, packFilter, onClearPackFilter,active,homeRequest,
}: {
  sessions: JournalSession[];
  significantLevels: SignificantLevel[];
  onOpenSession: (rthDate: string) => void;
  historicalSessions: HistoricalIbSession[]; priceBatches: PriceHistoryBatch[]; contextBatches: ContextBatch[]; repository: JournalRepository; zone: string;
  packFilter: ReviewPackFilter | null; onClearPackFilter: () => void;
  active:boolean;homeRequest:number;
}) {
  const { template: ES_TEMPLATE } = useJournalClock();
  const currentDate=useCurrentRthDate();
  const [mode, setMode] = useState<"days" | "weeks" | "months" | "years">("days");
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayPage,setDayPage]=useState(0);
  useReviewHome(homeRequest,()=>setSelectedDate(null));
  const scroll=useReviewScroll<HTMLDivElement>(`days:${packFilter?.kind??'all'}:${packFilter?.id??''}:${selectedDate??mode}`,active);
  const daily = useMemo(() => historicalSessions.filter(row => {
    if (!packFilter) return true;
    if (packFilter.kind === 'monthly') return row.rthDate.startsWith(`${packFilter.id}-`);
    return packFilter.kind === 'daily' && row.batchId === packFilter.id;
  }), [historicalSessions, packFilter]);
  const prices = useMemo(() => {
    if (packFilter?.kind === 'monthly') return priceBatches.map(batch => ({ ...batch,
      days: batch.days.filter(day => day.date.startsWith(`${packFilter.id}-`)) })).filter(b => b.days.length);
    return priceBatches.filter(batch => !packFilter || packFilter.kind === 'price' && batch.id === packFilter.id);
  }, [priceBatches, packFilter]);
  const contexts = useMemo(() => {
    if (packFilter?.kind === 'monthly') return contextBatches.map(batch => ({ ...batch,
      events: batch.events.filter(e => e.sessionDate.startsWith(`${packFilter.id}-`)) })).filter(b => b.events.length);
    return contextBatches.filter(b => !packFilter || packFilter.kind === 'context' && b.id === packFilter.id);
  }, [contextBatches, packFilter]);
  const matchingContexts = useMemo(() => contexts.map(b => ({...b, events: b.events.filter(e => `${e.sessionDate} ${e.name} ${e.referencePeriod}`.toLowerCase().includes(query.trim().toLowerCase()))})).filter(b => b.events.length), [contexts, query]);
  const matchingDaily = useMemo(() => daily.filter(row => !query.trim() || historicalSessionSearchMatches(row, query.trim())), [daily, query]);
  const matchingPrices = useMemo(() => prices.map(batch => ({ ...batch, days: batch.days.filter(day => `${day.date} ${day.contract}`.toLowerCase().includes(query.trim().toLowerCase())) })).filter(batch => batch.days.length), [prices, query]);
  const noJournals = useMemo(() => [] as JournalSession[], []);
  const normalizedQuery = query.trim();
  const matchingSessions = useMemo(
    () => normalizedQuery.length === 0
      ? sessions
      : sessions.filter((savedSession) =>
          historySearchMatches(savedSession, significantLevels, normalizedQuery)),
    [normalizedQuery, sessions, significantLevels],
  );
  const weeks = useMemo(
    () => deriveWeeklySessionSummaries(sessions, ES_TEMPLATE.tickSize),
    [sessions],
  );
  const months = useMemo(
    () => deriveMonthlySessionSummaries(sessions, ES_TEMPLATE.tickSize),
    [sessions],
  );
  const years = useMemo(
    () => deriveYearlySessionSummaries(sessions, ES_TEMPLATE.tickSize),
    [sessions],
  );

  if (selectedDate) return <div ref={scroll}><ReviewDayDetail key={selectedDate} date={selectedDate} journals={packFilter?.kind === 'context' || packFilter?.kind === 'monthly' || !packFilter ? sessions : noJournals} daily={packFilter?.kind === 'context' ? historicalSessions : daily} prices={packFilter?.kind === 'context' ? priceBatches : prices} contextBatches={contextBatches}
    repository={repository} zone={zone} onBack={() => setSelectedDate(null)} onOpenJournal={onOpenSession} /></div>;
  return (
    <div ref={scroll}>
    <section className="history-card" aria-labelledby="history-heading">
      <div className="section-heading history-heading">
        <div>
          <p className="eyebrow">Your journal and study packs</p>
          <h2 id="history-heading">{normalizedQuery||packFilter?'Days':({days:'Days',weeks:'Weeks',months:'Months',years:'Years'}[mode])}</h2>
        </div>

      </div>
      <p className="history-helper">
        Open a day to see your journal, IB summary, price map and any news events.
      </p>
      <div className="history-search" role="search" aria-label="Find saved days">
        <label htmlFor="history-search-input">Find a day</label>
        <div>
          <input
            id="history-search-input"
            type="search"
            value={query}
            onChange={(event) => {setQuery(event.target.value);setDayPage(0);}}
            placeholder="Date, contract, day type or note"
            autoComplete="off"
          />
          {normalizedQuery.length > 0 && (
            <button type="button" onClick={() => {setQuery("");setDayPage(0);}}>Clear</button>
          )}
        </div>

      </div>
      {packFilter && <p className="review-pack-filter">Showing {packFilter.title} <button type="button" onClick={onClearPackFilter}>Show all days</button></p>}
      {normalizedQuery.length === 0 && !packFilter && (
        <div className="history-mode-switch" aria-label="History view">
        <button
          type="button"
          aria-label="Show days"
          aria-pressed={mode === "days"}
          onClick={() => setMode("days")}
        >
          Days
        </button>
        <button
          type="button"
          aria-label="Show weeks"
          aria-pressed={mode === "weeks"}
          onClick={() => setMode("weeks")}
        >
          Weeks
        </button>
        <button
          type="button"
          aria-label="Show months"
          aria-pressed={mode === "months"}
          onClick={() => setMode("months")}
        >
          Months
        </button>
        <button
          type="button"
          aria-label="Show years"
          aria-pressed={mode === "years"}
          onClick={() => setMode("years")}
        >
          Years
        </button>
        </div>
      )}
      {mode !== "days" && !query && !packFilter && <p className="history-helper">Recaps use your journal entries. Imported days remain available in Days.</p>}
      {(mode === 'days' || normalizedQuery.length > 0 || packFilter) ? (
        <ReviewDayList page={dayPage} onPageChange={setDayPage} currentDate={currentDate} journals={packFilter?.kind === 'monthly' ? matchingSessions.filter(s => s.rthDate.startsWith(packFilter.id + '-')) : packFilter ? noJournals : matchingSessions} daily={matchingDaily} prices={matchingPrices} contexts={matchingContexts} onOpen={date => { if (contexts.some(b => b.events.some(e => e.sessionDate === date)) || daily.some(row => row.rthDate === date) || prices.some(batch => batch.days.some(day => day.date === date))) setSelectedDate(date); else onOpenSession(date); }} />
      ) : sessions.length === 0 ? <p>No journal days yet. Week, month and year recaps use your own entries.</p> : mode === "weeks" ? (
        <ol className="weekly-history-list" aria-label="Weekly summaries">
          {weeks.map((week) => (
            <li key={week.weekStart}>
              <details className="weekly-history-row" data-current-period={currentDate>=week.weekStart&&currentDate<=week.weekEnd||undefined}>
                <summary aria-label={`Week of ${week.weekStart}`} aria-current={currentDate>=week.weekStart&&currentDate<=week.weekEnd?'date':undefined}>
                  <span>
                    <small className={currentDate>=week.weekStart&&currentDate<=week.weekEnd?'review-current-label':undefined}>
                      {currentDate>=week.weekStart&&currentDate<=week.weekEnd?'Current week':'Week'}</small>
                    <strong>
                      {formatCalendarDate(week.weekStart)} – {formatCalendarDate(week.weekEnd)}
                    </strong>
                  </span>
                  <span>{week.journaledDays} day{week.journaledDays === 1 ? "" : "s"}</span>
                </summary>
                <div className="weekly-summary-body">
                  <PeriodStatistics summary={week} />
                  <WeeklyShareAction week={week} sessions={sessions} zone={zone} />

                  <div className="weekly-source-days">
                    <h3>Contributing days</h3>
                    {week.days.map((day) => (
                      <ContributingDayButton
                        key={day.sessionId}
                        day={day}
                        onOpenSession={onOpenSession}
                      />
                    ))}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      ) : mode === "months" ? (
        <ol className="weekly-history-list" aria-label="Monthly summaries">
          {months.map((month) => (
            <li key={month.month}>
              <details className="weekly-history-row monthly-history-row" data-current-period={currentDate.slice(0,7)===month.month||undefined}>
                <summary aria-label={`Month ${month.month}`} aria-current={currentDate.slice(0,7)===month.month?'date':undefined}>
                  <span>
                    <small className={currentDate.slice(0,7)===month.month?'review-current-label':undefined}>
                      {currentDate.slice(0,7)===month.month?'Current month':'Month'}</small>
                    <strong>{formatCalendarMonth(month.monthStart)}</strong>
                  </span>
                  <span>{month.journaledDays} day{month.journaledDays === 1 ? "" : "s"}</span>
                </summary>
                <div className="weekly-summary-body">
                  <PeriodStatistics summary={month} />
                  <MonthlyShareAction month={month} sessions={sessions} />

                  <div className="monthly-source-weeks">
                    <h3>Weeks and contributing days</h3>
                    {month.weeks.map((week) => (
                      <section key={week.weekStart} className="monthly-source-week">
                        <header>
                          <strong>
                            {formatCalendarDate(week.weekStart)} – {formatCalendarDate(week.weekEnd)}
                          </strong>
                          <span>{week.journaledDays} day{week.journaledDays === 1 ? "" : "s"}</span>
                        </header>
                        <div className="weekly-source-days">
                          {week.days.map((day) => (
                            <ContributingDayButton
                              key={day.sessionId}
                              day={day}
                              onOpenSession={onOpenSession}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="weekly-history-list" aria-label="Yearly summaries">
          {years.map((year) => (
            <li key={year.year}>
              <details className="weekly-history-row yearly-history-row" data-current-period={currentDate.slice(0,4)===year.year||undefined}>
                <summary aria-label={`Year ${year.year}`} aria-current={currentDate.slice(0,4)===year.year?'date':undefined}>
                  <span>
                    <small className={currentDate.slice(0,4)===year.year?'review-current-label':undefined}>
                      {currentDate.slice(0,4)===year.year?'Current year':'Year'}</small>
                    <strong>{year.year}</strong>
                  </span>
                  <span>{year.journaledDays} day{year.journaledDays === 1 ? "" : "s"}</span>
                </summary>
                <div className="weekly-summary-body">
                  <PeriodStatistics summary={year} />
                  <YearlyShareAction year={year} sessions={sessions} />

                  <div className="monthly-source-weeks yearly-source-months">
                    <h3>Months and contributing days</h3>
                    {year.months.map((month) => (
                      <section key={month.month} className="monthly-source-week yearly-source-month">
                        <header>
                          <strong>{formatCalendarMonth(month.monthStart)}</strong>
                          <span>{month.journaledDays} day{month.journaledDays === 1 ? "" : "s"}</span>
                        </header>
                        <div className="weekly-source-days">
                          {month.days.map((day) => (
                            <ContributingDayButton
                              key={day.sessionId}
                              day={day}
                              onOpenSession={onOpenSession}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section></div>
  );
}

function CoreStatisticsPanel({
  sessions,
  historicalSessions,
  onOpenSession,
  source, onSourceChange,active,homeRequest,
}: {
  sessions: JournalSession[];
  historicalSessions: HistoricalIbSession[];
  onOpenSession: (rthDate: string) => void;
  source: "journal" | HistoricalIbCohort; onSourceChange: (source: "journal" | HistoricalIbCohort) => void;
  active:boolean;homeRequest:number;
}) {
  const { template: ES_TEMPLATE } = useJournalClock();
  const [selectedResearchYears, setSelectedResearchYears] = useState<string[]>([]);
  const [showAllResearchYears, setShowAllResearchYears] = useState(false);
  const [researchYearPickerSlot, setResearchYearPickerSlot] = useState<number | "compare" | null>(null);
  const [researchInspection, setResearchInspection] = useState<{
    title: string;
    select:(entries:HistoricalIbSession[])=>HistoricalIbSession[];
    scope: "selection" | "cohort";
  } | null>(null);
  const [journalInspection, setJournalInspection] = useState<{
    title: string;
    select:IbDaySelector;
  } | null>(null);
  const [view,setView]=useState<IbStatsView>("outcomes");
  useReviewHome(homeRequest,()=>{setJournalInspection(null);setResearchInspection(null);});
  const scroll=useReviewScroll(`ib:${source}:${view}`,active&&!researchInspection&&!journalInspection);
  const years = useMemo(
    () => deriveYearlySessionSummaries(sessions, ES_TEMPLATE.tickSize),
    [sessions],
  );
  const statistics = useMemo(
    () => deriveCoreIbStatistics(sessions, ES_TEMPLATE.tickSize),
    [sessions],
  );
  const annualStatistics = useMemo(
    () => years.map((year) => ({
      year: year.year,
      statistics: deriveCoreIbStatistics(
        sessions.filter((savedSession) => savedSession.rthDate.startsWith(year.year)),
        ES_TEMPLATE.tickSize,
      )
    })),
    [sessions, years],
  );
  const cohortHistoricalSessions = useMemo(
    () => source === "journal"
      ? []
      : historicalSessions.filter((entry) => entry.cohort === source),
    [historicalSessions, source],
  );
  const researchYears = useMemo(
    () => [...new Set(cohortHistoricalSessions.map((entry) => entry.sourceYear))].sort(),
    [cohortHistoricalSessions],
  );
  useEffect(() => {
    setSelectedResearchYears((current) => {
      const available = current.filter((year) => researchYears.includes(year)).slice(0, 2);
      if (available.length > 0 || researchYears.length === 0) return available;
      return [researchYears.at(-1)!];
    });
  }, [researchYears]);
  const filteredHistoricalSessions = useMemo(
    () => {
      if (source === "journal") return [];
      return showAllResearchYears
        ? cohortHistoricalSessions
        : cohortHistoricalSessions.filter((entry) => selectedResearchYears.includes(entry.sourceYear));
    },
    [cohortHistoricalSessions, selectedResearchYears, showAllResearchYears, source],
  );
  const researchStatistics = useMemo(
    () => deriveHistoricalCoreIbStatistics(filteredHistoricalSessions),
    [filteredHistoricalSessions],
  );
  const researchBreakCodeStatistics = useMemo(
    () => deriveHistoricalBreakCodeStatistics(filteredHistoricalSessions),
    [filteredHistoricalSessions],
  );
  const researchAnnualStatistics = useMemo(
    () => researchYears
      .filter((year) => showAllResearchYears || selectedResearchYears.includes(year))
      .map((year) => ({
      year,
      statistics: deriveHistoricalCoreIbStatistics(
        filteredHistoricalSessions.filter((entry) => entry.sourceYear === year),
      )
    })),
    [filteredHistoricalSessions, researchYears, selectedResearchYears, showAllResearchYears],
  );
  const researchMonths = useMemo(() => {
    const grouped = new Map<string, HistoricalIbSession[]>();
    for (const entry of filteredHistoricalSessions) {
      const month = entry.rthDate.slice(0, 7);
      grouped.set(month, [...(grouped.get(month) ?? []), entry]);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, entries]) => ({
        month,
        entries,
        statistics: deriveHistoricalCoreIbStatistics(entries)
      }));
  }, [filteredHistoricalSessions]);
  const visibleInspection = useMemo(() => {
    if (!researchInspection) return null;
    return {
      ...researchInspection,
      sessions:researchInspection.select(researchInspection.scope==='cohort'?cohortHistoricalSessions:filteredHistoricalSessions)
    };
  }, [cohortHistoricalSessions, filteredHistoricalSessions, researchInspection]);
  const showResearchInspection = (
    title: string,
    select:(entries:HistoricalIbSession[])=>HistoricalIbSession[],
    scope: "selection" | "cohort" = "selection",
  ) => {
    setResearchInspection({ title, select, scope });
  };
  const changeSource = (next: "journal" | HistoricalIbCohort) => {
    onSourceChange(next);
    setSelectedResearchYears([]);
    setShowAllResearchYears(false);
    setResearchYearPickerSlot(null);
    setView("outcomes");
    setJournalInspection(null);
    setResearchInspection(null);
  };
  const chooseResearchYear = (year: string) => {
    setSelectedResearchYears((current) => {
      if (researchYearPickerSlot === "compare") {
        return current.includes(year) ? current : [...current, year].slice(0, 2);
      }
      if (typeof researchYearPickerSlot === "number") {
        return current.map((candidate, index) => index === researchYearPickerSlot ? year : candidate)
          .filter((candidate, index, years) => years.indexOf(candidate) === index);
      }
      return [year];
    });
    setShowAllResearchYears(false);
    setResearchYearPickerSlot(null);
    setResearchInspection(null);
  };
  const removeResearchYear = (index: number) => {
    setSelectedResearchYears((current) => current.filter((_, candidateIndex) => candidateIndex !== index));
    setShowAllResearchYears(false);
    setResearchYearPickerSlot(null);
    setResearchInspection(null);
  };
  const activeSessions = source === "journal" ? sessions.length : filteredHistoricalSessions.length;

  const returnRateLabel = (stats: CoreIbStatistics) => stats.returnInside.yesRatePct === null
    ? "—"
    : `${stats.returnInside.yes}/${stats.returnInside.knownDenominator}`;

  const comparedMonths = useMemo(() => Array.from(
    { length: 12 },
    (_, index) => {
      const monthNumber = index + 1;
      const monthSuffix = `-${String(monthNumber).padStart(2, "0")}`;
      return {
        monthNumber,
        byYear: Object.fromEntries(selectedResearchYears.map((year) => [
          year,
          researchMonths.find((month) => month.month === `${year}${monthSuffix}`) ?? null,
        ])) as Record<string, (typeof researchMonths)[number] | null>
      };
    },
  ).filter(comparison=>Object.values(comparison.byYear).some(Boolean)), [researchMonths, selectedResearchYears]);

  if (source === "journal" && journalInspection) {
    const selectedIds=new Set(journalInspection.select(statistics));
    return <IbStatisticDays title={journalInspection.title} days={statistics.days.filter(day=>selectedIds.has(day.sessionId))}
      sourceLabel="My journal" active={active} onBack={()=>setJournalInspection(null)} onOpenSession={onOpenSession}/>;
  }
  if (source !== "journal" && visibleInspection) {
    return <IbStatisticDays title={visibleInspection.title}
      days={visibleInspection.sessions.map(deriveHistoricalIbDaySummary)} historicalSessions={visibleInspection.sessions}
      sourceLabel={source==='REFERENCE'?'Forecast history':'Comparison history'} active={active} onBack={()=>setResearchInspection(null)}/>;
  }
  const researchTools=source!=="journal"?<details className="stat-disclosure level-stat-section"><summary>Years and months</summary>
          <div className="research-year-selector" aria-label="Research year selection">
            <div className="research-year-tray">
              <span>Viewing</span>
              {selectedResearchYears.map((year, index) => (
                <div className="research-year-chip" key={year}>
                  <button
                    type="button"
                    aria-expanded={researchYearPickerSlot === index}
                    onClick={() => {
                      setShowAllResearchYears(false);
                      setResearchYearPickerSlot((current) => current === index ? null : index);
                    }}
                  >
                    {year}
                  </button>
                  {selectedResearchYears.length === 2 ? (
                    <button
                      type="button"
                      aria-label={`Remove ${year} from comparison`}
                      onClick={() => removeResearchYear(index)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
              {selectedResearchYears.length === 1 && researchYears.length > 1 ? (
                <button
                  type="button"
                  className="research-add-year"
                  aria-expanded={researchYearPickerSlot === "compare"}
                  onClick={() => setResearchYearPickerSlot((current) => current === "compare" ? null : "compare")}
                >
                  + Compare year
                </button>
              ) : null}
            </div>
            {researchYearPickerSlot !== null ? (
              <div className="research-year-options" aria-label="Available research years">
                {researchYears
                  .filter((year) => {
                    if (researchYearPickerSlot === "compare") return !selectedResearchYears.includes(year);
                    if (typeof researchYearPickerSlot === "number") {
                      return year === selectedResearchYears[researchYearPickerSlot] || !selectedResearchYears.includes(year);
                    }
                    return true;
                  })
                  .map((year) => (
                    <button
                      type="button"
                      key={year}
                      aria-pressed={typeof researchYearPickerSlot === "number" && selectedResearchYears[researchYearPickerSlot] === year}
                      onClick={() => chooseResearchYear(year)}
                    >
                      {year}
                    </button>
                  ))}
              </div>
            ) : null}
            <button
              type="button"
              className="research-all-years"
              aria-pressed={showAllResearchYears}
              onClick={() => {
                setShowAllResearchYears(true);
                setResearchYearPickerSlot(null);
                setResearchInspection(null);
              }}
            >
              All years summary
            </button>
          </div>

          {!showAllResearchYears ? <details className="research-months stat-disclosure" aria-label="Research month breakdown"><summary>Compare months</summary>
            <header>
              <h3>{selectedResearchYears.length === 2 ? "Monthly comparison" : "Monthly breakdown"}</h3>
              <span>{selectedResearchYears.length === 2 ? selectedResearchYears.join(" vs ") : `${researchMonths.length} months`}</span>
            </header>
            {selectedResearchYears.length === 2 ? (
              <div className="research-month-comparison">
                <div className="research-month-comparison-heading" aria-hidden="true">
                  <span>Month</span>
                  {selectedResearchYears.map((year) => <strong key={year}>{year}</strong>)}
                </div>
                {comparedMonths.map((comparison) => (
                  <div className="research-month-comparison-row" key={comparison.monthNumber}>
                    <strong>{formatMonthName(comparison.monthNumber)}</strong>
                    {selectedResearchYears.map((year) => {
                      const month = comparison.byYear[year];
                      return month ? (
                        <button
                          type="button"
                          key={year}
                          aria-label={`${formatMonthName(comparison.monthNumber)} ${year}, ${month.statistics.journaledDays} days`}
                          onClick={() => showResearchInspection(
                            `${formatCalendarMonth(`${month.month}-01`)} source dates`,
                            entries=>entries.filter(entry=>entry.rthDate.startsWith(month.month+'-')),
                          )}
                        >
                          <span><strong>{month.statistics.journaledDays}</strong><small>days</small></span>
                          <span><strong>{month.statistics.ibWidth.median===null?'—':month.statistics.ibWidth.median.toFixed(1)}</strong><small>typical IB · pt</small></span>
                          <span><strong>{returnRateLabel(month.statistics)}</strong><small>edge retest</small></span>
                        </button>
                      ) : <span className="research-month-empty" key={year} aria-label={`${year}: no recorded days`}>—</span>;
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="research-month-single-year">
                {researchMonths.map((month) => (
                  <button
                    type="button"
                    key={month.month}
                    onClick={() => showResearchInspection(
                      `${formatCalendarMonth(`${month.month}-01`)} source dates`,
                      entries=>entries.filter(entry=>entry.rthDate.startsWith(month.month+'-')),
                    )}
                  >
                    <span>
                      <strong>{formatCalendarMonth(`${month.month}-01`)}</strong>
                      <small>{month.statistics.journaledDays} days</small>
                    </span>
                    <span>
                      <strong>{month.statistics.ibWidth.median===null?'—':month.statistics.ibWidth.median.toFixed(1)}</strong>
                      <small>Typical IB · pt</small>
                    </span>
                    <span>
                      <strong>{returnRateLabel(month.statistics)}</strong>
                      <small>Edge retest</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="history-helper">Edge retest shows days that returned to the broken edge out of days with a recorded result. — means no recorded data.</p>
          </details> : null}

  </details>:null;
  const inspect=(title:string,select:IbDaySelector)=>{
    if(source==='journal')setJournalInspection({title,select});
    else showResearchInspection(title,entries=>{
      const selectedIds=new Set(select(deriveHistoricalCoreIbStatistics(entries)));
      return entries.filter(day=>selectedIds.has(day.id));
    });
  };
  return <section ref={scroll} className={`history-card statistics-card${source!=="journal"?" research-statistics":""}`}
    aria-label={`${source==="journal"?"Local Journal":historicalCohortLabel(source)} statistics`}>
    <h2>IB stats</h2>
    <label className="stats-source-choice">Use data from
      <select aria-label="Use data from" value={source} onChange={event=>changeSource(event.target.value as "journal"|HistoricalIbCohort)}>
        <option value="journal">My journal</option><option value="REFERENCE">Forecast history</option><option value="FORWARD_OBSERVATION">Comparison history</option>
      </select>
    </label>
    <p className="history-helper">{source==='journal'?'Results from the days you recorded.':source==='REFERENCE'
      ?'IB Pack records available for forecast learning.':'IB Pack records kept for independent comparison. These do not train the forecast.'}</p>
    {source!=='journal'&&activeSessions>0&&<p className="ib-stat-selection">{showAllResearchYears?'All imported years':selectedResearchYears.join(' + ')} · Change years in Details</p>}
    {activeSessions===0?<p className="empty-state">{source==='journal'
      ?'No journal days yet. Record a day on Today, or choose installed pack data above.'
      :'No IB Pack records in this group yet. Add a pack in Study packs.'}</p>
      :<IbStatistics statistics={source==='journal'?statistics:researchStatistics}
        annualStatistics={source==='journal'?annualStatistics:researchAnnualStatistics} view={view} onViewChange={setView}
        onInspect={inspect} detailsTools={researchTools} historicalBreakCodes={source==='journal'?null:researchBreakCodeStatistics}
        onInspectCode={family=>showResearchInspection(`${family} break-code days`,entries=>entries.filter(day=>historicalBreakCodeFamily(day)===family))}
        onBrowseAll={source==='journal'?undefined:()=>showResearchInspection('All imported days',entries=>entries,'cohort')}/>
    }
  </section>;
}

function HistoricalLibraryPanel({
  monthlyPreview, monthlyBatches, levelIds, onViewReferences, onImportMonthly, onRemoveMonthly, onViewDays,
  replayPreview, onImportReplay, onLoadRecent,
  contextPreview, contextBatches, onImportContext, onRemoveContext, onOpenContext,
  fbdPreview, fbdBatches, onImportFbd, onRemoveFbd, onOpenFbd,
  pricePreview, priceBatches, onImportPrice, onRemovePrice, onOpenPrices, onOpenDaily,
  selectedFileName, importing, onClearSelection,
  batches,
  preview,
  importConflict,
  removeConfirmationId,
  onCsvLearning,
  onSelectFile,
  onImport,
  onBeginRemove,
  onCancelRemove,
  onConfirmRemove
}: {
  monthlyPreview: MonthlyImportPreview | null; monthlyBatches: MonthlyPackBatch[];
  levelIds: string[]; onViewReferences: (filter: MonthlyLevelFilter) => void;
  onImportMonthly: () => Promise<void>; onRemoveMonthly: (id: string) => Promise<void>; onViewDays: (month: string) => void;
  replayPreview: ParsedJournalReplay | null; onImportReplay: () => Promise<void>; onLoadRecent: () => Promise<void>;
  contextPreview: ContextImportPreview | null; contextBatches: ContextBatch[]; onImportContext: () => Promise<void>;
  onRemoveContext: (id: string) => Promise<void>; onOpenContext: (id: string) => void;
  fbdPreview: FbdImportPreview | null; fbdBatches: FbdBatch[]; onImportFbd: () => Promise<void>;
  onRemoveFbd: (id: string) => Promise<void>; onOpenFbd: (batchId: string) => void;
  pricePreview: PriceImportPreview | null;
  priceBatches: PriceHistoryBatch[];
  onImportPrice: () => Promise<void>;
  onRemovePrice: (id: string) => Promise<void>;
  onOpenPrices: (batchId: string) => void;
  onOpenDaily: (batchId: string) => void;
  selectedFileName: string | null;
  importing: boolean;
  onClearSelection: () => void;
  batches: HistoricalIbImportBatch[];
  preview: HistoricalIbImportPreview | null;
  importConflict: string | null;
  removeConfirmationId: string | null;
  onCsvLearning: (enabled: boolean) => void;
  onSelectFile: (file: File) => void;
  onImport: () => void;
  onBeginRemove: (batchId: string) => void;
  onCancelRemove: () => void;
  onConfirmRemove: (batchId: string) => void;
}) {
  const journal = useContext(JournalContext);
  const [matchedFile, setMatchedFile] = useState<HistoricalIbImportPreview | null>(null);
  const comparison = preview?.studyPack ? studyPackCompatibility(preview.studyPack, journal.template).comparison : false;
  const needsConfirmation = !preview?.studyPack && journal.id !== "es";
  const needsMatch = needsConfirmation && matchedFile !== preview;
  return (
    <section className="history-card historical-library" aria-labelledby="historical-library-heading">
      <div className="section-heading">
        <div>
          <h2 id="historical-library-heading">Study packs</h2>
        </div>
      </div>
      <p className="history-helper">
        Add study material to {journal.name}. Choose a downloaded pack or a compatible CSV; the app sorts its contents for you.
      </p>
      <label className="historical-file-action" aria-disabled={importing}>
        Add a pack or CSV
        <input
          aria-label="Add a pack or CSV"
          type="file"
          accept=".csv,.json,application/json,text/csv"
          disabled={importing}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onSelectFile(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <StudyPackGuide />
      {monthlyPreview && <MonthlyPackPreview preview={monthlyPreview} template={journal.template} packs={monthlyBatches}
        availableBatchIds={new Set([...batches, ...priceBatches, ...fbdBatches, ...contextBatches].map(b => b.id).concat(levelIds))}
        busy={importing} onImport={onImportMonthly} />}
      {import.meta.env.MODE !== 'beta-rehearsal' && import.meta.env.MODE !== 'public-blank' && ['ES','MES'].includes(journal.template.instrument) && <button type="button" className="quiet-button" disabled={importing}
        onClick={() => void onLoadRecent()}>Load recent study days</button>}
      {import.meta.env.MODE !== 'beta-rehearsal' && import.meta.env.MODE !== 'public-blank' && ['ES','MES'].includes(journal.template.instrument) && <p className="history-helper">Load this replay while connected. Once added, the days work offline.</p>}
      {import.meta.env.MODE === 'beta-rehearsal' && <p className="notice-panel">No learning history is bundled in this rehearsal. Forecast comparisons need compatible Study Packs supplied separately. Learning history must be approved for distribution before forecast testing.</p>}
      {import.meta.env.MODE === 'public-blank' && <p className="notice-panel">No learning history is bundled. Your journal starts empty. Record your observations, or import compatible history you have permission to use. Historical forecast probabilities are unavailable without suitable learning history.</p>}
      {selectedFileName && <div className="history-selected-file" role="group" aria-label="Selected import file">
        <span>{selectedFileName}</span><button type="button" disabled={importing} onClick={onClearSelection}>Clear selection</button>
      </div>}

      {replayPreview && <section className="historical-preview" aria-label="Recent study days preview">
        <h3>Fill recent days</h3>
        <p><strong>{replayPreview.sessions.length} trading days · {replayPreview.sessions[0]!.rthDate}–{replayPreview.sessions.at(-1)!.rthDate}</strong></p>
        <p>IB maps, price entries, levels, dated news and replay forecasts in your normal journal. Existing days stay as you entered them.</p>
        <p>Historical replay · These estimates use today’s engine and the information available at each checkpoint. They do not count as live predictions or forecast learning.</p>
        <button type="button" className="primary-action" disabled={importing} onClick={() => void onImportReplay()}>
          {importing ? 'Filling days…' : 'Fill empty days'}</button>
        <details><summary>Source details</summary>{replayPreview.pack.info.notes.map(note => <p key={note}>{note}</p>)}</details>
      </section>}

      {preview && (
        <section className="historical-preview" aria-label="Historical import preview">
          <h3>Preview before import</h3>
          {preview.studyPack ? <StudyPackDetails pack={preview.studyPack} /> : <><p className="study-pack-title"><strong>{packTitle('daily')}</strong></p><p>{packTypes.daily.description}</p></>}
          <p>{ibForecastUse(preview.cohort)}</p>
          {!preview.studyPack && <details className="history-csv-options"><summary>CSV options</summary>
            <p>CSVs have no learning setting. Leave this off to browse the data without changing the forecast.</p>
            <label className="check-row"><input type="checkbox" disabled={importing} checked={preview.cohort === 'REFERENCE'}
              onChange={event => onCsvLearning(event.target.checked)} />Use these days for forecast learning</label>
          </details>}
          {!preview.studyPack && <dl>
            <div><dt>File</dt><dd>{preview.sourceFileName}</dd></div>
            <div><dt>Rows</dt><dd>{preview.rowCount}</dd></div>
            <div><dt>Complete</dt><dd>{preview.completeRowCount}</dd></div>
            <div><dt>Missing data</dt><dd>{preview.missingRowCount}</dd></div>
            <div><dt>Duplicate dates</dt><dd>{preview.duplicateDateCount}</dd></div>
            <div><dt>Years</dt><dd>{preview.years.join(", ") || "Unavailable"}</dd></div>
            <div><dt>ON / 15R inputs</dt><dd>{preview.sessions.filter((row) => row.forecastInputs).length} rows</dd></div>
          </dl>}
          {preview.blockingErrors.length > 0 && (
            <div className="historical-errors" role="alert">
              <strong>Import blocked</strong>
              {preview.blockingErrors.slice(0, 8).map((error) => <p key={error}>{error}</p>)}
              {preview.blockingErrors.length > 8 && (
                <p>{preview.blockingErrors.length - 8} more validation errors</p>
              )}
            </div>
          )}
          {importConflict && (
            <p className="historical-notice" role="status">
              {importConflict}
            </p>
          )}
          {comparison && <p className="study-source-note">Using {preview.studyPack!.instrument} history in your {journal.template.instrument} journal.</p>}
          {needsConfirmation && <label className="check-row"><input type="checkbox"
            checked={!needsMatch} onChange={(event) => setMatchedFile(event.target.checked ? preview : null)} />
            {`This file covers ${journal.template.instrument} and my chosen study hours.`}
          </label>}
          <button
            className="primary-action"
            type="button"
            disabled={importing || needsMatch || preview.blockingErrors.length > 0 || importConflict !== null}
            onClick={onImport}
          >
            {batches.some((batch) => batch.contentSha256 === preview.contentSha256 && batch.cohort === preview.cohort)
              ? preview.studyPack ? "Add pack details to existing library" : "Add ON / 15R fields to existing library" : "Add IB Pack"}
          </button>
        </section>
      )}

      {contextPreview && <ContextHistoryPreview preview={contextPreview} template={journal.template} batches={contextBatches} onImport={onImportContext} busy={importing} />}
      {fbdPreview && <FbdHistoryPreview preview={fbdPreview} template={journal.template} batches={fbdBatches} onImport={onImportFbd} busy={importing} />}
      {pricePreview && <PriceHistoryPreview key={pricePreview.parsed.contentSha256} preview={pricePreview} template={journal.template} batches={priceBatches} onImport={onImportPrice} />}
      <ImportedHistoryBatches contextBatches={contextBatches} onOpenContext={onOpenContext} onRemoveContext={onRemoveContext} fbdBatches={fbdBatches} onOpenFbd={onOpenFbd} onRemoveFbd={onRemoveFbd} batches={batches} priceBatches={priceBatches} removeConfirmationId={removeConfirmationId}
        monthlyPacks={monthlyBatches} levelIds={levelIds} onViewReferences={onViewReferences} onRemoveMonthly={onRemoveMonthly} onViewDays={onViewDays}
        onBeginRemove={onBeginRemove} onCancelRemove={onCancelRemove} onConfirmRemove={onConfirmRemove}
        onRemovePrice={onRemovePrice} onOpenPrices={onOpenPrices} onOpenDaily={onOpenDaily} />

    </section>
  );
}

function SessionActionsPanel({
  session,
  confirming,
  onBeginMove,
  onCancelMove,
  onConfirmMove,
}: {
  session: JournalSession;
  confirming: boolean;
  onBeginMove: () => void;
  onCancelMove: () => void;
  onConfirmMove: () => void;
}) {
  return (
    <section className="history-card session-actions-card" aria-labelledby="session-actions-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Current journal day</p>
          <h2 id="session-actions-heading">Session actions</h2>
        </div>
      </div>
      <div className="management-target"><strong>{session.instrument} · {formatCalendarDate(session.rthDate)}</strong>
        <span>{session.contract ?? 'Contract not recorded'}</span></div>
      <p className="history-helper">Move this saved version to Trash and open a clean day for the same date.
        The saved version stays available for restoration and is excluded from History and statistics.</p>
      {confirming ? (
        <div className="trash-confirmation" role="group" aria-label="Confirm move to Trash">
          <strong className="confirmation-target">{session.instrument} · {formatCalendarDate(session.rthDate)}</strong>
          <p>Move this entire session to Trash?</p>
          <button type="button" className="danger-action" onClick={onConfirmMove}>
            Confirm move to Trash
          </button>
          <button type="button" onClick={onCancelMove}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="danger-action" onClick={onBeginMove}>
          Move session to Trash
        </button>
      )}
    </section>
  );
}

function TrashPanel({
  entries,
  permanentDeleteConfirmationId,
  onRestore,
  onBeginPermanentDelete,
  onCancelPermanentDelete,
  onConfirmPermanentDelete,
}: {
  entries: TrashedJournalSession[];
  permanentDeleteConfirmationId: string | null;
  onRestore: (trashId: string) => void;
  onBeginPermanentDelete: (trashId: string) => void;
  onCancelPermanentDelete: () => void;
  onConfirmPermanentDelete: (trashId: string) => void;
}) {
  return (
    <section className="history-card trash-card" aria-labelledby="trash-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Restorable local records</p>
          <h2 id="trash-heading">Trash</h2>
        </div>
        <span>{entries.length}</span>
      </div>
      <p className="history-helper">
        Trashed sessions are excluded from History and statistics. Trash never
        expires automatically.
      </p>
      <p className="history-helper">Restore is available while the replacement day has no new entries. New journal data is never overwritten.</p>
      {entries.length === 0 ? (
        <p className="empty-state">Trash is empty.</p>
      ) : (
        <ol className="trash-list" aria-label="Trashed sessions">
          {entries.map(({ id, session: trashedSession, trashedAt }) => (
            <li key={id}>
              <div>
                <strong>{trashedSession.instrument} · {formatCalendarDate(trashedSession.rthDate)}</strong>
                <span>{trashedSession.contract ?? "Contract unavailable"}</span>
                <time dateTime={trashedAt}>Moved {new Date(trashedAt).toLocaleString('en-US',{
                  timeZone:trashedSession.displayTimeZone,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short',hour12:true,
                })}</time>
              </div>
              <button type="button" onClick={() => onRestore(id)}>
                Restore
              </button>
              {permanentDeleteConfirmationId === id ? (
                <div className="trash-confirmation" role="group" aria-label="Confirm permanent deletion">
                  <strong className="confirmation-target">{trashedSession.instrument} · {formatCalendarDate(trashedSession.rthDate)}</strong>
                  <p>Delete this session permanently? This cannot be undone.</p>
                  <button
                    type="button"
                    className="danger-action"
                    onClick={() => onConfirmPermanentDelete(id)}
                  >
                    Delete permanently
                  </button>
                  <button type="button" onClick={onCancelPermanentDelete}>Cancel</button>
                </div>
              ) : (
                <button
                  type="button"
                  className="quiet-danger-action"
                  onClick={() => onBeginPermanentDelete(id)}
                >
                  Delete permanently…
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DevelopingIbSummary({
  session,
  finalIb
}: {
  session: JournalSession;
  finalIb: ReturnType<typeof deriveFinalIb>;
}) {
  const { high, low } = displayedIbEdges(session, finalIb);

  return (
    <section className="developing-ib" aria-label={finalIb ? "Final Initial Balance" : "Developing Initial Balance"}>
      <div>
        <span>{finalIb ? "Final IB" : "Developing IB"}</span>
        <small>{finalIb ? "First-hour range confirmed" : "From supplied formation entries"}</small>
      </div>
      <dl>
        <div><dt>High</dt><dd>{formatPrice(high)}</dd></div>
        <div><dt>Low</dt><dd>{formatPrice(low)}</dd></div>
      </dl>
    </section>
  );
}

function FocusedStageCard({
  className = "",
  time,
  title,
  status,
  children
}: {
  className?: string;
  time: string;
  title: string;
  status: string;
  children: ReactNode;
}) {
  return (
    <section className={`stage-card focused-stage-card ${className}`}>
      <header className="focused-stage-heading">
        <span>
          <small>{time}</small>
          <h2>{title}</h2>
        </span>
        <strong>{status}</strong>
      </header>
      <div className="stage-content">{children}</div>
    </section>
  );
}

function PriceCaptureButton({session,latestCp,onClick}:{session:JournalSession;
  latestCp:Pick<JournalSession['cpObservations'][number],'price'|'observedAt'>|null;onClick:()=>void}) {
  const currentDate=useCurrentRthDate();
  const relation=session.rthDate===currentDate?'current':session.rthDate<currentDate?'past':'future';
  const dateLabel=formatCalendarDate(session.rthDate);
  return <button className="current-position" type="button" data-session-date={relation}
    aria-label={relation==='current'?(latestCp?'Update current price':'Record current price'):`Edit price for ${dateLabel}`}
    onClick={onClick}>
    <span>Price</span><strong>{relation!=='current'?'Edit':latestCp?formatPriceNumber(latestCp.price):'Add price'}</strong>
    {relation!=='current'?<small className="price-session-date">{relation==='past'?'Past':'Future'} · {dateLabel}</small>
      :latestCp&&<time dateTime={latestCp.observedAt}>{formatClockTime(formatObservationTime(latestCp.observedAt,session.displayTimeZone))}</time>}
  </button>;
}

export function App() {
  useKeyboardVisibility();
  // The accepted dashboard is the installed app's default; classic remains a recovery view.
  const [workspacePreview]=useState(()=>PHONE_TEST||new URLSearchParams(window.location.search).get('dashboard')!=='classic');
  const [workspaceOrigin,setWorkspaceOrigin]=useState<WorkspaceDestination>('forecast');
  const [workspaceReferences,setWorkspaceReferences]=useState<SignificantLevel[]>([]);
  const [workspaceNotice,setWorkspaceNotice]=useState('');
  const [workspaceLevelPanel,setWorkspaceLevelPanel]=useState<'level-library'|'level-detail'|null>(null);
  const [workspaceUndoAvailable,setWorkspaceUndoAvailable]=useState(false);
  const workspaceSaving=useRef(false);
  const workspaceUndo=useRef<{before:JournalSession;after:JournalSession}|null>(null);
  const workspaceScroll=useRef<Record<string,number>>({});
  const [profile, setProfile] = useState<JournalProfile>(DEFAULT_JOURNAL);
  const sessionRequest=useRef(0);
  const [workspaceDateLoading,setWorkspaceDateLoading]=useState(false);
  const [workspaceDateError,setWorkspaceDateError]=useState(false);
  const [workspacePendingSession,setWorkspacePendingSession]=useState<JournalSession|null>(null);
  const [workspacePeriodRequest,setWorkspacePeriodRequest]=useState<{id:number;journalId:string;date:string;phase:WorkspacePhase}|null>(null);
  const [switchingJournal, setSwitchingJournal] = useState(false);
  const { template: ES_TEMPLATE, checkpointInstant, sessionObservationInstant, displayCheckpoint, checkpointLockReached, formatCheckpointTime,
    resolveLaunchRthDate, previousPotentialRthDate, nextPotentialRthDate, isPotentialRthDate } = journalClock(profile.template);
  const repositoryRef = useRef<SqliteJournalRepository | null>(null);
  const leaseRef = useRef<WriterLease | null>(null);
  const [session, setSession] = useState<JournalSession | null>(null);
  useEffect(()=>{
    if(!PHONE_TEST)return;
    window.dispatchEvent(new CustomEvent('ib-phone-test-observations',{detail:{date:session?.rthDate,count:session?.cpObservations.length??0}}));
  },[session]);
  useEffect(()=>{
    if(!__IB_PHONE_TEST__)return;
    const reset=async()=>{
      if(!repositoryRef.current||workspaceSaving.current)return;
      try{
        await repositoryRef.current.reset();
        const {clearPhoneTestSeed}=await import('./PhoneTest');clearPhoneTestSeed();location.reload();
      }catch{setWorkspaceNotice('The isolated test reset failed. No other storage was touched.');}
    };
    window.addEventListener('ib-phone-test-reset',reset);return()=>window.removeEventListener('ib-phone-test-reset',reset);
  },[]);
  const [nearbySide, setNearbySide] = useState<{ scope: string; side: NearbyPriceSide } | null>(null);
  const [nearbyTier, setNearbyTier] = useState<{ scope: string; tier: NearbyLevelTier } | null>(null);
  const pendingForecastWriteRef = useRef<Promise<void>>(Promise.resolve());
  const pendingLevelObservationRef=useRef(new Set<string>());
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [persistence, setPersistence] = useState<PersistenceState>("unknown");
  const [message, setMessage] = useState("Opening the local field journal…");
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [migrationProof, setMigrationProof] = useState<boolean | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [activePanel, setActivePanel] = useState<SessionPanel>("dashboard");
  const workspaceNavigation=useWorkspaceNavigation(workspacePreview,activePanel,setActivePanel,'dashboard' as SessionPanel);
  useEffect(()=>{if(workspacePreview){workspaceUndo.current=null;setWorkspaceUndoAvailable(false);setWorkspaceNotice('');}},[workspacePreview,session?.id]);
  useEffect(()=>{
    if(!workspaceNotice)return;
    const timer=window.setTimeout(()=>setWorkspaceNotice(''),8000);return()=>clearTimeout(timer);
  },[workspaceNotice]);
  useEffect(()=>{
    if(workspacePreview&&(activePanel==='level-library'||activePanel==='level-detail'))setWorkspaceLevelPanel(activePanel);
  },[workspacePreview,activePanel]);
  useEffect(()=>{
    if(!workspacePreview||activePanel!=='dashboard'||!/^((Completed .* confirmed locally\.)|(Forming .* saved locally\.)|(Day finalized.*)|(Day finished provisionally.*))$/.test(message))return;
    const timer=window.setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(timer);
  },[workspacePreview,activePanel,message]);
  const [lastReviewPanel,setLastReviewPanel]=useState<ReviewPanel>('review-menu');
  const [visitedReviewPanels,setVisitedReviewPanels]=useState<ReviewPanel[]>([]);
  const [reviewHomeRequests,setReviewHomeRequests]=useState<Record<ReviewPanel,number>>({'review-menu':0,'statistics-ib':0,'statistics-levels':0});
  const [returnToReview,setReturnToReview]=useState(false);
  const reviewHistoryLoaded=useRef(false);
  const reviewRequest=useRef(0);
  const [reviewLoading,setReviewLoading]=useState(false);
  const [reviewError,setReviewError]=useState('');
  const reviewScroll=useMemo(()=>new ReviewScrollMemory(),[profile.id]);
  const phaseMemory=useMemo(()=>new Map<string,DashboardPhase[]>(),[profile.id]);
  const timelineMemory=useMemo<DayTimelineMemory>(()=>new Map(),[profile.id]);
  useEffect(()=>{
    document.addEventListener('click',reviewScroll.capture,true);
    for(const event of ['wheel','touchstart','keydown'])document.addEventListener(event,reviewScroll.cancelRestore,true);
    return()=>{
      document.removeEventListener('click',reviewScroll.capture,true);
      for(const event of ['wheel','touchstart','keydown'])document.removeEventListener(event,reviewScroll.cancelRestore,true);
      reviewScroll.cancelRestore();
    };
  },[reviewScroll]);
  useEffect(()=>{
    if(!reviewPanels.includes(activePanel))return;
    const panel=activePanel as ReviewPanel;
    setLastReviewPanel(panel);setVisitedReviewPanels(current=>current.includes(panel)?current:[...current,panel]);
  },[activePanel]);
  useEffect(()=>{
    setLastReviewPanel('review-menu');setVisitedReviewPanels([]);setReturnToReview(false);
    reviewHistoryLoaded.current=false;
    reviewRequest.current++;setReviewLoading(false);setReviewError('');
  },[profile.id]);
  const [entryOrigin, setEntryOrigin] = useState<EntryOrigin>("dashboard");
  const [sessionNotePhase, setSessionNotePhase] = useState<SessionNotePhase>("ON");
  const [editingMarketContextId, setEditingMarketContextId] = useState<string | null>(null);
  const [eventMoveEditor,setEventMoveEditor]=useState<{sessionId:string;eventId:string}|null>(null);
  useEffect(()=>setEventMoveEditor(null),[profile.id,session?.id]);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [significantLevelOpen, setSignificantLevelOpen] = useState(false);
  const [editingSignificantLevelId, setEditingSignificantLevelId] = useState<string | null>(null);
  const [lastArchivedLevelId, setLastArchivedLevelId] = useState<string | null>(null);
  const [significantLevels, setSignificantLevels] = useState<SignificantLevel[]>([]);
  const [significantLevelPreferences, setSignificantLevelPreferences] =
    useState<SignificantLevelPreferences>({
      instrument: ES_TEMPLATE.instrument,
      proximityPoints: DEFAULT_SIGNIFICANT_LEVEL_PROXIMITY_TICKS * ES_TEMPLATE.tickSize,
      updatedAt: new Date(0).toISOString(),
    });
  const [historySessions, setHistorySessions] = useState<JournalSession[]>([]);
  const [trackingSessions, setTrackingSessions] = useState<JournalSession[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (session && repositoryRef.current) {
      const current = session;
      setTrackingSessions(records => records?.some(record => record.journalId === current.journalId)
        ? reuseJournalHistory(records,records.some(record=>record.id===current.id)
          ?records.map(record=>record.id===current.id?current:record):[...records,current]) : null);
      void repositoryRef.current.listSessions(current.instrument).then(records => {
        if (!cancelled) setTrackingSessions(previous=>reuseJournalHistory(previous??[],records.some(record=>record.id===current.id)
          ?records.map(record=>record.id===current.id?current:record):[...records,current]));
      }).catch(() => { if (!cancelled) setTrackingSessions(null); });
    }
    return () => { cancelled = true; };
  }, [session]);

  const [trashedSessions, setTrashedSessions] = useState<TrashedJournalSession[]>([]);
  const [trashMoveConfirmation, setTrashMoveConfirmation] = useState(false);
  const [permanentDeleteConfirmationId, setPermanentDeleteConfirmationId] = useState<string | null>(null);
  const [historicalBatches, setHistoricalBatches] = useState<HistoricalIbImportBatch[]>([]);
  const [historicalSessions, setHistoricalSessions] = useState<HistoricalIbSession[]>([]);
  const [historicalPreview, setHistoricalPreview] = useState<HistoricalIbImportPreview | null>(null);
  const [monthlyPreview, setMonthlyPreview] = useState<MonthlyImportPreview | null>(null);
  const [monthlyBatches, setMonthlyBatches] = useState<MonthlyPackBatch[]>([]);
  const [replayPreview, setReplayPreview] = useState<ParsedJournalReplay | null>(null);
  const [replayText, setReplayText] = useState<string | null>(null);
  const [pricePreview, setPricePreview] = useState<PriceImportPreview | null>(null);
  const [contextBatches, setContextBatches] = useState<ContextBatch[]>([]);
  const [contextPreview, setContextPreview] = useState<ContextImportPreview | null>(null);
  const [fbdBatches, setFbdBatches] = useState<FbdBatch[]>([]);
  const qualitySources=useLevelQualitySources(repositoryRef.current,fbdBatches);
  const [fbdPreview, setFbdPreview] = useState<FbdImportPreview | null>(null);
  const [fbdHistoryPackId, setFbdHistoryPackId] = useState<string | undefined>();
  const [monthlyLevelFilter, setMonthlyLevelFilter] = useState<MonthlyLevelFilter | undefined>();
  const [focusedLevelId, setFocusedLevelId] = useState<string | undefined>();
  const [priceBatches, setPriceBatches] = useState<PriceHistoryBatch[]>([]);
  const [reviewPackFilter, setReviewPackFilter] = useState<ReviewPackFilter | null>(null);
  const [ibStatsSource, setIbStatsSource] = useState<"journal" | HistoricalIbCohort>("journal");
  const [historicalSelectedFileName, setHistoricalSelectedFileName] = useState<string | null>(null);
  const [historicalImporting, setHistoricalImporting] = useState(false);
  const historicalReadRequest = useRef(0);
  const [historicalCsvFile, setHistoricalCsvFile] = useState<File | null>(null);
  const [historicalRemoveConfirmationId, setHistoricalRemoveConfirmationId] = useState<string | null>(null);
  const [cpUndoHistoryId, setCpUndoHistoryId] = useState<string | null>(null);
  const [marketContextUndoHistoryId, setMarketContextUndoHistoryId] = useState<string | null>(null);
  const [rthUndoHistoryId, setRthUndoHistoryId] = useState<string | null>(null);
  const [significantLevelUndo, setSignificantLevelUndo] = useState<{
    levelId: string;
    historyEntryId: string;
  } | {levelId:string;eventId:string;action:'added'|'removed'} | null>(null);

  useEffect(() => {
    if(!reviewPanels.includes(activePanel))window.scrollTo({ top: 0, behavior: "instant" });
  }, [activePanel, session?.id]);

  useEffect(() => {
    return subscribeToPwaState((pwaState) => {
      setUpdateReady(pwaState.updateReady);
      setOfflineReady(pwaState.offlineReady);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    setActivePanel("dashboard");
    setEntryOrigin("dashboard");
    setSessionNotePhase("ON");
    setEditingMarketContextId(null);
    setSignificantLevelOpen(false);
    setEditingSignificantLevelId(null);
    setCpUndoHistoryId(null);
    setMarketContextUndoHistoryId(null);
    setRthUndoHistoryId(null);
    setSignificantLevelUndo(null);
  }, [session?.id]);


  useEffect(() => {
    let cancelled = false;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(() => {
        if (!cancelled) setOfflineReady(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lease = await acquireWriterLease();
        if (cancelled) {
          lease.release();
          return;
        }
        leaseRef.current = lease;
        if (!lease.writable) {
          setReadOnly(true);
          setMessage("This journal is open in another tab. Use that tab to keep recording.");
          return;
        }

        const repository = new SqliteJournalRepository();
        repositoryRef.current = repository;
        const status = await repository.initialize();
        const configured = status.profiles.find((item) => item.id === status.activeJournalId) ?? DEFAULT_JOURNAL;
        const ES_TEMPLATE = configured.template;
        const { resolveLaunchRthDate } = journalClock(ES_TEMPLATE);
        setProfile(configured);
        const rthDate = PHONE_TEST?phoneStates[phoneState()].date:resolveLaunchRthDate(Temporal.Now.instant());
        const opened = await getOrCreateSession(repository, rthDate, configured, !workspacePreview);
        const [levels, savedLevelPreferences, batches, importedSessions, trash, pricePacks, fbdPacks, contextPacks, monthlyPacks] = await Promise.all([
          repository.listSignificantLevels(ES_TEMPLATE.instrument),
          repository.getSignificantLevelPreferences(ES_TEMPLATE.instrument),
          repository.listHistoricalImportBatches(),
          repository.listHistoricalIbSessions(),
          repository.listTrashedSessions(ES_TEMPLATE.instrument),
          repository.listPriceHistoryBatches(), repository.listFbdBatches(), repository.listContextBatches(), repository.listMonthlyStudyPacks()
        ]);
        if (!cancelled) {
          setStorageStatus({
            ...status,
            sessionCount: status.sessionCount + (opened.created ? 1 : 0)
          });
          setSession(opened.session);
          setSignificantLevels(levels);
          setSignificantLevelPreferences(savedLevelPreferences ?? { instrument: ES_TEMPLATE.instrument,
            proximityPoints: DEFAULT_SIGNIFICANT_LEVEL_PROXIMITY_TICKS * ES_TEMPLATE.tickSize, updatedAt: new Date(0).toISOString() });
          setHistoricalBatches(batches);
          setPriceBatches(pricePacks);
          setFbdBatches(fbdPacks);
          setContextBatches(contextPacks);
          setMonthlyBatches(monthlyPacks);
          setHistoricalSessions(importedSessions);
          setTrashedSessions(trash);
          setMigrationProof(status.migrationProofPassed ? true : null);
          setMessage("Current session opened locally.");
        }

        if (navigator.storage?.persisted) {
          try {
            const persisted = await navigator.storage.persisted();
            if (!cancelled) setPersistence(persisted ? "granted" : "not-granted");
          } catch {
            // This optional browser status must not close a healthy journal.
            if (!cancelled) setPersistence("unavailable");
          }
        } else if (!cancelled) {
          setPersistence("unavailable");
        }
      } catch (error) {
        if (!cancelled) {
          repositoryRef.current?.close();
          repositoryRef.current = null;
          leaseRef.current?.release();
          leaseRef.current = null;
          setFatalError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      cancelled = true;
      repositoryRef.current?.close();
      repositoryRef.current = null;
      leaseRef.current?.release();
      leaseRef.current = null;
    };
  }, []);

  const overnightGeometry = useMemo(
    () =>
      session
        ? deriveRange({
            high: session.overnight.high,
            low: session.overnight.low,
            cp: null
          })
        : null,
    [session],
  );
  const aGeometry = useMemo(
    () => (session ? deriveRange(carryRangeEdgesForward(
      session.aPeriod,
      session.fifteenMinute,
    )) : null),
    [session],
  );
  const effectiveAPeriod = useMemo(
    () => session
      ? carryRangeEdgesForward(session.aPeriod, session.fifteenMinute)
      : null,
    [session],
  );
  const effectiveBPeriod = useMemo(
    () => session && effectiveAPeriod
      ? carryRangeEdgesForward(
          session.bPeriod,
          session.fifteenMinute,
          effectiveAPeriod,
          ...session.bSnapshots,
        )
      : null,
    [session, effectiveAPeriod],
  );
  const ibLockIsReached = session
    ? checkpointLockReached(session.rthDate, ES_TEMPLATE.checkpoints.ibLock)
    : false;
  const finalIb = useMemo(
    () => ibLockIsReached && session
      ? deriveSessionRecordedIb(session,Temporal.Now.instant().toString())
      : null,
    [session, ibLockIsReached],
  );
  const finalIbGeometry = useMemo(
    () => (finalIb ? deriveRange(finalIb) : null),
    [finalIb],
  );
  const rthStates = useMemo(
    () =>
      session
        ? deriveRthObservationStates(
            session.rthObservations,
            finalIb,
            ES_TEMPLATE.tickSize,
          )
        : [],
    [session, finalIb],
  );
  const recapRthStates = useMemo(() => {
    if (!session) return [];
    const closeObservation =
      session.close.price !== null &&
      session.close.observedAt !== null &&
      session.close.recordedAt !== null
        ? [{
            id: "session-close",
            price: session.close.price,
            observedAt: session.close.observedAt,
            recordedAt: session.close.recordedAt,
            note: session.close.note,
            cpObservationId: null
          }]
        : [];
    return deriveRthObservationStates(
      [...session.rthObservations, ...closeObservation],
      finalIb,
      ES_TEMPLATE.tickSize,
    );
  }, [session, finalIb]);
  const closingOutcome = useMemo(
    () =>
      session
        ? deriveClosingOutcome(session, finalIb, ES_TEMPLATE.tickSize)
        : null,
    [session, finalIb],
  );
  const latestCp = useMemo(
    () => (session ? latestCpObservation(session) : null),
    [session],
  );
  const journalLevels = useMemo(() => session
    ? sessionLevelCatalog(significantLevels, trackingSessions ?? [], session) : significantLevels,
    [session, significantLevels, trackingSessions]);
  const visibleSignificantLevels = useMemo(
    () =>
      session
        ? journalLevels.filter(
            (level) =>
              level.createdInRthDate <= session.rthDate &&
              replayLevelApplies(level, session, session.close.observedAt ?? Temporal.Now.instant().toString(), Temporal.Now.instant().toString()) &&
              level.currentStatus !== "removed",
          )
        : [],
    [session, journalLevels],
  );
  const nearbySignificantLevels = useMemo(
    () => visibleSignificantLevels.filter(
          (level) =>
            level.currentStatus === "active" &&
            (level.sessionEdge?.sessionId === session?.id || latestCp && significantLevelDistanceFromPrice(level, latestCp.price) <=
              significantLevelPreferences.proximityPoints),
        ),
    [latestCp, significantLevelPreferences.proximityPoints, visibleSignificantLevels, session?.id],
  );
  const mappedSignificantLevels = useMemo(
    () => nearbySignificantLevels.filter((level) => level.showOnMap),
    [nearbySignificantLevels],
  );
  const workspaceLevelRead=useWorkspaceLevels(session&&trackingSessions?{session,sessions:trackingSessions,levels:visibleSignificantLevels,
    sources:qualitySources,distance:significantLevelPreferences.proximityPoints}:null,workspacePreview);
  const levelSupersessions=useMemo(()=>workspacePreview?workspaceLevelRead.result.supersessions:session?nearbyLevelSupersessions(visibleSignificantLevels,trackingSessions,session,qualitySources,
    significantLevelPreferences.proximityPoints,Temporal.Now.instant().toString()):new Map(),
    [workspacePreview,workspaceLevelRead.result.supersessions,visibleSignificantLevels,trackingSessions,session,qualitySources,significantLevelPreferences.proximityPoints]);
  const levelMapReferences = useMemo(() => workspacePreview?workspaceLevelRead.result.mapReferences:session
    ? mapLevelReferences(visibleSignificantLevels, trackingSessions, session,qualitySources)
    : new Map<string, MapLevelReference>(), [workspacePreview,workspaceLevelRead.result.mapReferences,visibleSignificantLevels, trackingSessions, session,qualitySources]);
  const inlineEventMoveHistory=useEventMoveHistory(trackingSessions,visibleSignificantLevels,session,!workspacePreview);
  const eventMoveHistory=workspacePreview?workspaceLevelRead.result.eventMoves:inlineEventMoveHistory;
  const eventMoveSource=eventMoveEditor?(eventMoveEditor.sessionId===session?.id?session:trackingSessions?.find(day=>day.id===eventMoveEditor.sessionId))??null:null;
  const eventMoveItem=eventMoveSource?.marketContextItems.find(item=>item.id===eventMoveEditor?.eventId);
  const significantLevelInteractions = useMemo(
    () =>
      session
        ? deriveSignificantLevelInteractions(
            visibleSignificantLevels,
            session.cpObservations,
            ES_TEMPLATE.tickSize,
          )
        : [],
    [session, visibleSignificantLevels],
  );
  const backTarget = parentPanelFor(activePanel, entryOrigin);
  const displayedLevelPanel=activePanel==='level-library'||activePanel==='level-detail'?activePanel:workspacePreview?workspaceLevelPanel:null;
  const backLabel = backTarget === "dashboard" ? "Today"
    : backTarget === "settings" ? "Settings"
    : backTarget === "context" ? "Context"
    : backTarget === "rth-period" ? "RTH"
    : backTarget === "b-period" ? "B"
    : backTarget === "level-library" ? "Levels"
    : backTarget === "level-detail" ? "Level"
    : "Review";
  const recording = recordChoices.some((choice) => choice.panel === activePanel);
  const mainDestination = levelPanels.includes(activePanel) || (activePanel === "levels" && entryOrigin === "level-library")
    ? "level-library" : reviewPanels.includes(activePanel) ? "review-menu" : "dashboard";

  function openWorkspace(panel:SessionPanel,origin:WorkspaceDestination=workspaceOrigin){
    setWorkspaceOrigin(origin);setEntryOrigin('dashboard');
    if(reviewPanels.includes(panel))void openArchivePanel(panel as ReviewPanel);
    else setActivePanel(panel);
  }
  function closeWorkspace(){workspaceNavigation.close();}
  async function saveWorkspacePeriod(phase:WorkspacePhase,update:FifteenMinuteUpdate&{rthOpen?:number|null},done:()=>void,editFinalized:boolean,observedAt?:string,snapshot=false):Promise<string|null>{
    if(!session||!repositoryRef.current)return 'The journal is still opening.';
    if(workspaceSaving.current)return 'An entry is already being saved.';
    workspaceSaving.current=true;
    try{
      await awaitForecastUpdateWrites();
      let current=await repositoryRef.current.getSession(session.id)??session;
      if(current.close.finishedAt){
        if(!editFinalized)throw Error('Choose Edit finalized period first.');
        current={...current,close:{...current.close,finishedAt:null,pathComplete:false}};
      }
      const now=Temporal.Now.instant().toString(),clock=workspaceClock(current,now),window=clock.windows[phase];
      if(clock.unavailable)throw Error('This date is marked closed. Correct its calendar in Context first.');
      for(const value of [update.high,update.low,update.cp,update.rthOpen])if(value!==null&&value!==undefined)workspacePrice(String(value),current.market.tickSize);
      const ended=Temporal.Instant.compare(now,window.end)>=0;
      const at=observedAt??(ended?window.end:now);
      const locked=ended&&Temporal.Instant.compare(at,window.end)>=0;
      if(Temporal.Instant.compare(at,window.start)<0||Temporal.Instant.compare(at,window.end)>0||Temporal.Instant.compare(at,now)>0)throw Error("Keep the range time within the selected phase and no later than now.");
      const checkpoint=phase==='15R'?current.fifteenMinute:phase==='A'?current.aPeriod:phase==='B'?current.bPeriod:null;
      if(!snapshot&&checkpoint?.status==='confirmed'&&!locked)throw Error('This period is already confirmed. Keep its completed range time at the period end; use View entries to correct an earlier record.');
      let next:JournalSession;
      if(snapshot){
        if(phase!=='B')throw Error('A B snapshot must belong to B.');
        const snapshotAt=checkpointInstant(current.rthDate,current.market.checkpoints.bSnapshot).toString();
        if(Temporal.Instant.compare(now,snapshotAt)<0)throw Error('Wait until the B snapshot checkpoint, or record an observation at its actual time.');
        next=withDevelopingBSnapshot(current,update,snapshotAt,now,true);
      }else if(phase==='ON')next=locked?withOvernightUpdate(current,{...update,rthOpen:update.rthOpen===undefined?current.overnight.rthOpen:update.rthOpen,confirm:update.high!==null&&update.low!==null},now)
        :withPreOpenUpdate(current,{contractStatus:current.contractStatus,contract:current.contract,formingOvernightHigh:update.high,formingOvernightLow:update.low,cp:null,note:update.note},at,now,true);
      else if(phase==='RTH'){
        if(update.high===null||update.low===null)throw Error('Enter both RTH edges.');
        next=withRthRangeCorrection(current,update.high,update.low,now);
      }else{
        const save=phase==='15R'?withFifteenMinuteRange:phase==='A'?withAPeriodUpdate:withBPeriodUpdate;
        next=save(current,update,at,now,locked,true);
      }
      await repositoryRef.current.saveSession(next);setSession(selected=>selected?.id===next.id?next:selected);setMessage('');setWorkspaceNotice(`${phase} range saved.`);done();return null;
    }catch(error){return error instanceof Error?error.message:'Unable to save. Your input is preserved.';}
    finally{workspaceSaving.current=false;}
  }
  function workspacePeriodContent(phase:WorkspacePhase,done:()=>void,editFinalized:boolean,onBusy:(busy:boolean)=>void,formId:string,openedAt:string){
    if(!session)return null;
    const periodWindow=workspaceWindows(session)[phase];
    const rangeAt=Temporal.Instant.compare(openedAt,periodWindow.end)>=0?periodWindow.end:openedAt;
    const save=async(update:FifteenMinuteUpdate&{rthOpen?:number|null},at?:string,snapshot=false)=>{onBusy(true);try{return await saveWorkspacePeriod(phase,update,done,editFinalized,at??rangeAt,snapshot);}finally{onBusy(false);}};
    const clock=workspaceClock(session,Temporal.Now.instant().toString());
    const forming=latestPreOpenSnapshot(session);
    const range=workspaceRecordedRange(session,phase);
    const completed=Temporal.Instant.compare(openedAt,clock.windows[phase].end)>=0;
    return <><WorkspaceRangeEditor key={`${session.id}:${phase}`} formId={formId} rangeAt={rangeAt} timeZone={session.displayTimeZone} phase={phase} completed={completed} showCommentary={phase!=='RTH'} openPrice={phase==='ON'&&completed?session.overnight.rthOpen:undefined} high={range.high} low={range.low} note={phase==='B'?session.bPeriod.note:phase==='A'?session.aPeriod.note:phase==='15R'?session.fifteenMinute.note:phase==='ON'?forming?.note:null} onSave={save}/>
      {phase==='B'&&<details><summary>B snapshot</summary><BSnapshotForm snapshot={session.bSnapshots.at(-1)??null} inheritedRange={effectiveAPeriod??session.aPeriod} onSave={update=>save(update,undefined,true)}/></details>}
      {phase==='RTH'&&<button type="button" onClick={()=>{window.addEventListener('popstate',()=>openWorkspace('close'),{once:true});done();}}>{session.close.finishedAt?'Review close':'Close & finish day'}</button>}</>;
  }
  async function correctWorkspaceObservation(phase:WorkspacePhase,id:string,rth:boolean,update:RthObservationUpdate,time:string,editFinalized:boolean):Promise<string|null>{
    if(!session||!repositoryRef.current)return 'The journal is still opening.';
    if(workspaceSaving.current)return 'An entry is already being saved.';
    workspaceSaving.current=true;
    try{
      await awaitForecastUpdateWrites();let current=await repositoryRef.current.getSession(session.id)??session;
      if(current.close.finishedAt){if(!editFinalized)throw Error('Choose Edit finalized period first.');current={...current,close:{...current.close,finishedAt:null,pathComplete:false}};}
      workspacePrice(String(update.price),current.market.tickSize);
      const at=sessionObservationInstant(current.rthDate,time,current.displayTimeZone).toString(),window=workspaceWindows(current)[phase];
      if(Temporal.Instant.compare(at,window.start)<0||Temporal.Instant.compare(at,window.end)>=0)throw Error('Keep this observation within the selected phase.');
      const now=Temporal.Now.instant().toString();if(Temporal.Instant.compare(at,now)>0)throw Error('An observation cannot be in the future.');
      const next=rth?withCorrectedRthObservation(current,id,update,at,now,workspaceWindows(current).RTH.start,workspaceWindows(current).RTH.end):withCorrectedStandaloneCpObservation(current,id,update.price,at,now);
      await repositoryRef.current.saveSession(next);setSession(selected=>selected?.id===next.id?next:selected);setMessage('');setWorkspaceNotice('Observation corrected.');return null;
    }catch(error){return error instanceof Error?error.message:'Unable to save. Your input is preserved.';}
    finally{workspaceSaving.current=false;}
  }
  function workspacePeriodReview(phase:WorkspacePhase,editable=true,editFinalized=false){
    if(!session)return null;
    const window=workspaceWindows(session)[phase];
    const items=sessionTimelineItems(session,visibleSignificantLevels).filter(item=>{
      const checkpoint=phase==='ON'?'timeline:on':phase==='15R'?'timeline:15r':phase==='A'?'timeline:a':phase==='B'?'timeline:b':null;
      if(item.id===checkpoint||phase==='RTH'&&item.id==='timeline:close')return true;
      const t=Temporal.Instant.from(item.sortAt);
      return !item.allDay&&!['timeline:on','timeline:15r','timeline:a','timeline:b'].includes(item.id)&&Temporal.Instant.compare(t,window.start)>=0&&Temporal.Instant.compare(t,window.end)<0;
    });
    return <WorkspacePhaseRecords key={`${session.id}:${phase}`} session={session} items={items} renderActions={(item,done)=>{
      const rth=session.rthObservations.find(row=>item.id===`timeline:rth:${row.id}`);
      const cp=session.cpObservations.find(row=>item.id===`timeline:cp:${row.id}`&&row.source==='standalone');
      const observation=rth??cp;
      return editable&&observation?<RthObservationCorrectionForm kind={rth?'RTH':'CP'} observation={observation}
        localTime={formatObservationTime(observation.observedAt,session.displayTimeZone)} onCancel={done}
        onCorrect={async(update,time)=>{const error=await correctWorkspaceObservation(phase,observation.id,!!rth,update,time,editFinalized);if(!error)done();return error;}}
        onRemove={()=>{done();if(rth)void removeRthObservation(rth.id);else if(cp)void removeStandaloneCp(cp.id);}}/>:
        <p>{editable?'Use Edit period range to correct this range.':'Choose Edit finalized period before changing this day.'}</p>;
    }}/>;
  }
  async function saveWorkspacePrice(entry:WorkspaceEntry):Promise<string|null>{
    if(!session||!repositoryRef.current)return 'The journal is still opening.';
    if(workspaceSaving.current)return 'A price is already being saved.';
    workspaceSaving.current=true;
    try{
      await awaitForecastUpdateWrites();
      const current=await repositoryRef.current.getSession(session.id)??session;
      const next=applyWorkspaceEntry(current,entry,Temporal.Now.instant().toString());
      await repositoryRef.current.saveSession(next);setSession(selected=>selected?.id===next.id?next:selected);
      workspaceUndo.current={before:current,after:next};setWorkspaceUndoAvailable(true);setMessage('');
      setWorkspaceNotice(`${entry.kind==='CP'?'Recorded CP':'Period '+entry.kind.toLowerCase()} saved · ${workspaceFormatPrice(Number(entry.price),current.market.tickSize)}`);
      return null;
    }catch(error){return error instanceof Error?error.message:'Unable to save. Your input is preserved.';}
    finally{workspaceSaving.current=false;}
  }
  async function undoWorkspacePrice(){
    const saved=workspaceUndo.current;if(!saved||!repositoryRef.current||workspaceSaving.current)return;
    workspaceSaving.current=true;
    try{
      await awaitForecastUpdateWrites();
      const current=await repositoryRef.current.getSession(saved.after.id);if(!current)throw Error('The saved session is no longer available.');
      const next=undoWorkspaceEntry(saved.before,saved.after,current,Temporal.Now.instant().toString());
      await repositoryRef.current.saveSession(next);setSession(next);workspaceUndo.current=null;setWorkspaceUndoAvailable(false);setWorkspaceNotice('Entry undone.');
    }catch(error){setWorkspaceNotice(error instanceof Error?error.message:'Unable to undo. Use Day timeline.');}
    finally{workspaceSaving.current=false;}
  }

  function openLevels(levelId?: string) {
    setEntryOrigin('dashboard');
    setMonthlyLevelFilter(undefined);
    setFbdHistoryPackId(undefined);
    setFocusedLevelId(levelId);
    setActivePanel(levelId ? 'level-detail' : 'level-library');
  }

  function timelineEntryActions(item: SessionTimelineItem, done: () => void): ReactNode {
    if (!session) return null;
    const rth = session.rthObservations.find(entry => item.id === `timeline:rth:${entry.id}`);
    if (rth) {
      const state = rthStates.find(state => state.observation.id === rth.id);
      return <>
        {state && <p className="timeline-price-read">{relationshipLabel(state.relationship)}
          {state.transitions.map(transition => <small key={transition}>{transitionLabel(transition)}</small>)}</p>}
        <RthObservationCorrectionForm key={`${rth.id}:${session.updatedAt}`} observation={rth}
          localTime={formatObservationTime(rth.observedAt, session.displayTimeZone)} onCancel={done}
          onCorrect={(update, time) => { done(); void correctRthObservation(rth.id, update, time); }}
          onRemove={() => { done(); void removeRthObservation(rth.id); }} />
      </>;
    }
    const cp = session.cpObservations.find(entry => item.id === `timeline:cp:${entry.id}`);
    if (cp?.source === 'standalone' && (workspacePreview || cp.formingPeriods?.length || session.cpObservationHistory.some(e =>
      e.observationId === cp.id && e.prior?.formingPeriods?.length))) return <RthObservationCorrectionForm
      key={`${cp.id}:${session.updatedAt}`} kind="CP" observation={cp}
      localTime={formatObservationTime(cp.observedAt, session.displayTimeZone)} onCancel={done}
      onCorrect={(update, time) => { done(); void correctStandaloneCp(cp.id, update.price, time); }}
      onRemove={() => { done(); void removeStandaloneCp(cp.id); }} />;
    if (cp?.source === 'standalone') return <div className="timeline-entry-actions">
      <small>Remove only if this price was entered by mistake.</small>
      <button className="remove-action" type="button" aria-label={`Remove CP ${formatPriceNumber(cp.price)} at ${formatClockTime(formatObservationTime(cp.observedAt, session.displayTimeZone))}`}
        onClick={() => { done(); void removeStandaloneCp(cp.id); }}>Remove price</button>
    </div>;
    const note = session.sessionNotes.find(entry => item.id === `timeline:note:${entry.id}`);
    if (note) return <SessionNoteCorrectionForm key={`${note.id}:${session.updatedAt}`} note={note}
      localTime={formatObservationTime(note.observedAt, session.displayTimeZone)}
      linkOptions={sessionNoteLinkOptions(session, note.phase, visibleSignificantLevels)} onCancel={done}
      onCorrect={(text, time, link) => { done(); void correctSessionNote(note.id, text, time, link); }}
      onRemove={() => { done(); void removeSessionNote(note.id); }} />;
    const event = session.marketContextItems.find(entry => item.id === `timeline:event:${entry.id}`);
    if (event) return <div className="timeline-entry-actions">
      <button type="button" onClick={() => { setEntryOrigin('dashboard'); setEditingMarketContextId(event.id); setActivePanel('event'); }}>Edit event</button>
      <button className="remove-action" type="button" aria-label={`Remove event ${event.name}`}
        onClick={() => { done(); void removeMarketContext(event.id); }}>Remove event</button>
    </div>;
    const level = visibleSignificantLevels.find(level => item.id === `timeline:level-cp:${level.id}` ||
      level.episodes.some(entry => item.id === `timeline:level-episode:${entry.id}`) ||
      level.marketEvents.some(entry => item.id === `timeline:level-market-event:${entry.id}`));
    if (level) return <button type="button" onClick={() => openLevels(level.id)}>View level</button>;
    const panel: SessionPanel = item.id === 'timeline:forming-on' || cp?.source === 'preopen' ? 'preopen'
      : item.id === 'timeline:on' ? 'overnight'
      : ['timeline:15r', 'timeline:a'].includes(item.id) ? 'a-period'
      : item.id.startsWith('timeline:b-snapshot:') ? 'b-snapshot'
      : item.id === 'timeline:b' ? 'b-period' : item.id.startsWith('timeline:rth-range:') ? 'rth-period' : 'close';
    return <button type="button" onClick={() => setActivePanel(panel)}>Review {item.label}</button>;
  }

  function openRecord(panel: typeof recordChoices[number]["panel"], origin: EntryOrigin = "dashboard", holiday = false) {
    setEntryOrigin(origin);
    setAddingHoliday(holiday);
    setEditingMarketContextId(null);
    setEditingSignificantLevelId(null);
    setSignificantLevelOpen(true);
    if (session) {
      const phase = significantLevelEpisodePhase(session, Temporal.Now.instant().toString());
      setSessionNotePhase(phase === "ON" ? "ON" : ["15R", "A", "B"].includes(phase) ? "IB" : "RTH");
    }
    setActivePanel(panel);
  }

  async function switchJournal(id: string): Promise<void> {
    if (!repositoryRef.current || switchingJournal || id === profile.id) return;
    setSwitchingJournal(true);
    try {
      await pendingForecastWriteRef.current;
      await awaitForecastUpdateWrites();
      await repositoryRef.current.activateJournal(id);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setSwitchingJournal(false); }
  }

  async function addJournal(next: JournalProfile): Promise<string | null> {
    if (!repositoryRef.current) return "Your journal is still opening. Please try again.";
    try {
      await pendingForecastWriteRef.current;
      await awaitForecastUpdateWrites();
      await repositoryRef.current.addJournal(next);
      await repositoryRef.current.activateJournal(next.id);
      window.location.reload();
      return null;
    } catch (error) { return error instanceof Error ? error.message : String(error); }
  }

  async function addForecast(next: JournalSession): Promise<JournalSession> {
    if(PHONE_TEST)return next;
    if (!repositoryRef.current || next.forecast || next.overnight.status !== "confirmed" ||
        next.fifteenMinute.status !== "confirmed") return next;
    const [sessions, imported, batches] = await Promise.all([
      repositoryRef.current.listSessions(next.instrument),
      repositoryRef.current.listHistoricalIbSessions(),
      repositoryRef.current.listHistoricalImportBatches(),
    ]);
    const now = Temporal.Now.instant().toString();
    const prior = resolveForecastPrior({ session: next, sessions, historical: imported, batches,
      previousDate: previousPotentialRthDate, now });
    if (!prior) return next;
    const scope = { journalId: next.journalId, template: next.market, now };
    const rows = buildForecastTraining(imported, sessions, previousPotentialRthDate, significantLevels, batches);
    const { library, sources } = await loadForecastPacks(repositoryRef.current, imported, scope);
    return captureForecast({ session: next, prior, levels: significantLevels,
      training: enrichForecastExamples(rows, imported, library, scope), packSources: sources,
      tickSize: ES_TEMPLATE.tickSize,
      now,
      asOf: checkpointInstant(next.rthDate, ES_TEMPLATE.checkpoints.fifteenMinuteLock).toString(),
      liveUntil: checkpointInstant(next.rthDate, ES_TEMPLATE.checkpoints.aLock).toString() });
  }

  async function saveForecastInput(input: JournalSession): Promise<JournalSession> {
    const repository = repositoryRef.current!;
    const write = pendingForecastWriteRef.current.then(async () => {
      const next = await addForecast(input);
      await repository.saveSession(next);
      return next;
    });
    // Backup/restore must not overtake forecast preparation and its associated journal write.
    pendingForecastWriteRef.current = write.then(() => undefined, () => undefined);
    return write;
  }

  async function useContextPackEvents(matches: ContextMatch[]): Promise<void> {
    if (!session || !repositoryRef.current) throw new Error("The journal is not ready.");
    const next = withContextPackEvents(session, matches, Temporal.Now.instant().toString());
    await repositoryRef.current.saveSession(next);
    setSession(current => current?.id === next.id ? next : current);
    setMessage("Pack event saved to this day's context.");
  }

  async function confirm15R(update: FifteenMinuteUpdate): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is not ready.";
    try {
      const now = Temporal.Now.instant();
      const lock = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.fifteenMinuteLock);
      if (Temporal.Instant.compare(now, lock) < 0) throw new Error("Wait until the first 15 minutes end to confirm 15R.");
      if (update.high === null || update.low === null) throw new Error("Enter both completed 15R edges.");
      const next = await saveForecastInput(withFifteenMinuteRange(session, update, lock.toString(), now.toString(), true, true));
      setSession(next);
      setActivePanel("dashboard");
      setMessage("Completed 15R confirmed locally.");
      return null;
    } catch (error) { return error instanceof Error ? error.message : String(error); }
  }

  async function saveAEntry(entry: ARangeEntry): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is not ready.";
    try {
      const now = Temporal.Now.instant().toString();
      const next = entry.target === "15R"
        ? withFifteenMinuteRange(session, entry.update, entry.observedAt, now, false, true)
        : withAPeriodUpdate(session, entry.update, entry.observedAt, now, entry.confirm, true);
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel("dashboard");
      setMessage(entry.target === "15R" ? "Forming 15R update saved locally. Developing A includes these edges."
        : next.aPeriod.status === "confirmed" ? "Completed A period confirmed locally." : "Forming A-period update saved locally.");
      return null;
    } catch (error) { return error instanceof Error ? error.message : String(error); }
  }

  async function saveBSnapshot(update: FifteenMinuteUpdate): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const next = withDevelopingBSnapshot(
        session,
        update,
        checkpointInstant(
          session.rthDate,
          ES_TEMPLATE.checkpoints.bSnapshot,
        ).toString(),
        Temporal.Now.instant().toString(),
        true,
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel("dashboard");
      setMessage("B snapshot saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveBPeriod(update: FifteenMinuteUpdate): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const now = Temporal.Now.instant();
      const lock = checkpointInstant(
        session.rthDate,
        ES_TEMPLATE.checkpoints.ibLock,
      );
      const canConfirm = Temporal.Instant.compare(now, lock) >= 0;
      const next = withBPeriodUpdate(
        session,
        update,
        (canConfirm ? lock : now).toString(),
        now.toString(),
        canConfirm,
        true,
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel("dashboard");
      setMessage(
        deriveFinalIb(next.aPeriod, next.bPeriod)
          ? "Completed B and final IB confirmed locally."
          : next.bPeriod.status === "confirmed"
            ? "Completed B confirmed; final IB is waiting for completed A."
            : "Forming B-period update saved locally.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function savePrice(update: RthObservationUpdate, manualLocalTime: string | null): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is still opening.";
    try {
      const now = Temporal.Now.instant();
      const observedAt = manualLocalTime === null && resolveLaunchRthDate(now) === session.rthDate
        ? now.toString()
        : sessionObservationInstant(session.rthDate, manualLocalTime ?? currentTimeInZone(session.displayTimeZone), session.displayTimeZone).toString();
      const open = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.overnightLock);
      const lock = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.ibLock);
      const close = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.studyClose);
      // The recorded post-lock window starts one second after the checkpoint.
      // Compare instants: fractional seconds cannot safely be ordered as ISO text.
      const isRth = Temporal.Instant.compare(observedAt, lock.add({ seconds: 1 })) >= 0 &&
        Temporal.Instant.compare(observedAt, close) < 0;
      let next = isRth
        ? withRthObservation(session, update, observedAt, now.toString(), lock.toString(), close.toString())
        : withStandaloneCpObservation(session, update.price, observedAt, now.toString(), open.toString({ fractionalSecondDigits: 9 }));
      if (!isRth && update.note?.trim()) {
        const phase = Temporal.Instant.compare(observedAt, open) < 0 ? "ON"
          : Temporal.Instant.compare(observedAt, lock) < 0 ? "IB" : "RTH";
        const window = sessionNoteWindow(session, phase);
        next = withSessionNote(next, phase, update.note, observedAt, now.toString(), window.start, window.end);
      }
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setRthUndoHistoryId(null);
      setCpUndoHistoryId(null);
      setActivePanel("dashboard");
      const changes = priceRangeChanges(next, next.cpObservations.find(p => p.source === 'standalone' && p.recordedAt === now.toString())?.id ?? '');
      const rounded = roundPriceToTick(update.price,session.market.tickSize);
      const savedMessage = isRth ? "Price saved. Current price and RTH path updated." : changes.length
        ? `Price saved. ${[...new Set(changes.map(c => c.period))].join(', ')} range updated.` : "Current price recorded locally.";
      setMessage(savedMessage+(rounded!==update.price?` Rounded to ${formatPriceNumber(rounded)} (nearest tick).`:''));
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function saveSessionNote(
    phase: SessionNotePhase,
    text: string,
    manualLocalTime: string | null,
    link: SessionNoteLink | null = null,
  ): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is not ready.";
    try {
      const now = Temporal.Now.instant();
      const selectedSessionIsCurrent = resolveLaunchRthDate(now) === session.rthDate;
      const observedAt = manualLocalTime === null && selectedSessionIsCurrent
        ? now.toString()
        : sessionObservationInstant(
            session.rthDate,
            manualLocalTime ?? currentTimeInZone(session.displayTimeZone),
            session.displayTimeZone,
          ).toString();
      const window = sessionNoteWindow(session, phase);
      const next = withSessionNote(
        session,
        phase,
        text,
        observedAt,
        now.toString(),
        window.start,
        window.end,
        link,
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel(entryOrigin === "context" ? "context" : "dashboard");
      setMessage("Note saved locally.");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function removeStandaloneCp(observationId: string): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const next = withRemovedStandaloneCpObservation(
        session,
        observationId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setCpUndoHistoryId(next.cpObservationHistory.at(-1)?.id ?? null);
      setMessage("Price removed. Map and price-driven ranges recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function correctStandaloneCp(observationId: string, price: number, time: string): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const next = withCorrectedStandaloneCpObservation(session, observationId, price,
        sessionObservationInstant(session.rthDate, time, session.displayTimeZone).toString(), Temporal.Now.instant().toString());
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setCpUndoHistoryId(next.cpObservationHistory.at(-1)?.id ?? null);
      setMessage('Price corrected. Map and price-driven ranges recalculated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function undoStandaloneCpRemoval(): Promise<void> {
    if (!session || !repositoryRef.current || !cpUndoHistoryId) return;
    try {
      const undo = session.cpObservationHistory.find(e => e.id === cpUndoHistoryId)?.action === 'corrected'
        ? withUndoneStandaloneCpCorrection : withUndoneStandaloneCpRemoval;
      const next = undo(
        session,
        cpUndoHistoryId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setCpUndoHistoryId(null);
      setMessage("Price change undone. Ranges recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function correctRthObservation(
    observationId: string,
    update: RthObservationUpdate,
    localTime: string,
  ): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const now = Temporal.Now.instant().toString();
      const next = withCorrectedRthObservation(
        session,
        observationId,
        update,
        sessionObservationInstant(
          session.rthDate,
          localTime,
          session.displayTimeZone,
        ).toString(),
        now,
        checkpointInstant(
          session.rthDate,
          ES_TEMPLATE.checkpoints.ibLock,
        ).toString(),
        checkpointInstant(
          session.rthDate,
          ES_TEMPLATE.checkpoints.studyClose,
        ).toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setRthUndoHistoryId(next.rthObservationHistory.at(-1)?.id ?? null);
      setMessage("RTH observation corrected. Dependent structure recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeRthObservation(observationId: string): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const next = withRemovedRthObservation(
        session,
        observationId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setRthUndoHistoryId(next.rthObservationHistory.at(-1)?.id ?? null);
      setMessage("Mistaken RTH observation removed. Dependent structure recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function correctSessionNote(
    noteId: string,
    text: string,
    localTime: string,
    link: SessionNoteLink | null,
  ): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const note = session.sessionNotes.find((candidate) => candidate.id === noteId);
      if (!note) throw new Error("The session note is unavailable.");
      const window = sessionNoteWindow(session, note.phase);
      const next = withCorrectedSessionNote(
        session,
        noteId,
        text,
        sessionObservationInstant(
          session.rthDate,
          localTime,
          session.displayTimeZone,
        ).toString(),
        Temporal.Now.instant().toString(),
        window.start,
        window.end,
        link,
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setMessage(`${note.phase} note corrected locally.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeSessionNote(noteId: string): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const next = withRemovedSessionNote(
        session,
        noteId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setMessage("Session note removed permanently.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function undoRthObservationChange(): Promise<void> {
    if (!session || !repositoryRef.current || !rthUndoHistoryId) return;
    try {
      const next = withUndoneRthObservationChange(
        session,
        rthUndoHistoryId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setRthUndoHistoryId(null);
      setMessage("RTH change undone.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveRthRange(high: number, low: number): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is still opening.";
    try {
      const next = withRthRangeCorrection(session, high, low, Temporal.Now.instant().toString());
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setMessage("RTH range saved. Day remains open.");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function saveAndFinishDay(rthHigh: number, rthLow: number, price: number, note: string, pathComplete: boolean): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is still opening.";
    try {
      const now = Temporal.Now.instant().toString();
      const closed = withSessionClose(session, price, note,
        checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.studyClose).toString(), now, rthHigh, rthLow);
      const next = withClosingReview(closed, pathComplete, now);
      const dailyLowId = dailyLowSignificantLevelId(next.id);
      const existingDailyLow = significantLevels.find(
        (level) => level.id === dailyLowId,
      ) ?? null;
      const dailyLow = upsertFinishedSessionDailyLow(
        next,
        existingDailyLow,
        now,
        ES_TEMPLATE.tickSize,
      );
      if (dailyLow) {
        await repositoryRef.current.saveSignificantLevel(dailyLow, next);
        setSignificantLevels((current) => {
          const exists = current.some((level) => level.id === dailyLow.id);
          return exists
            ? current.map((level) => level.id === dailyLow.id ? dailyLow : level)
            : [...current, dailyLow];
        });
      } else {
        await repositoryRef.current.saveSession(next);
      }
      setSession(next);
      setActivePanel("dashboard");
      setMessage(
        pathComplete
          ? dailyLow
            ? "Day finalized. Confirmed RTH Low was carried forward as a Daily Low."
            : "Day finalized. Close did not finish above the RTH Low, so no Daily Low was carried forward."
          : dailyLow
            ? "Day finished provisionally. Confirmed RTH Low was carried forward as a Daily Low."
            : "Day finished provisionally and can be completed later.",
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function savePreOpen(
    update: PreOpenUpdate,
    localTime: string,
  ): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const now = Temporal.Now.instant().toString();
      const observedAt = sessionObservationInstant(
        session.rthDate,
        localTime,
        session.displayTimeZone,
      ).toString();
      const next = withPreOpenUpdate(session, update, observedAt, now, true);
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel("dashboard");
      setMessage("Pre-open update saved locally.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveMarketContext(
    update: MarketContextUpdate,
    localTime: string,
    itemId: string | null = null,
  ): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is not ready.";
    try {
      const changedAt = Temporal.Now.instant().toString();
      const eventAt = update.holiday ? holidayDayStart(update.eventDate, update.holiday.timeZone) : calendarInstant(
        update.eventDate,
        localTime,
        session.displayTimeZone,
      ).toString();
      let next = itemId
        ? withCorrectedMarketContextItem(
            session,
            itemId,
            update,
            eventAt,
            changedAt,
          )
        : withMarketContextItem(session, update, eventAt, changedAt);
      next = { ...next, forecastCoverage: { ...next.forecastCoverage, news: next.marketContextItems.length ? "reviewed" : "unknown" } };
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel(entryOrigin === "context" ? "context" : "dashboard");
      setMarketContextUndoHistoryId(
        itemId ? next.marketContextHistory.at(-1)?.id ?? null : null,
      );
      setEditingMarketContextId(null);
      setMessage(
        itemId
          ? `${update.name.trim()} corrected.`
          : `${update.name.trim()} added to market context.`,
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function addScheduledEvents(events: ScheduledEvent[],results:NewsResult[]=[]): Promise<void> {
    if (!session || !repositoryRef.current) throw new Error('Your journal is not available yet.');
    const at=Temporal.Now.instant().toString();
    const next = withOfficialNewsResults(withScheduledEvents(session, events, at),results,at);
    await repositoryRef.current.saveSession(next);
    setSession(current => current?.id === next.id ? next : current);
  }

  async function saveNewsResults(results:NewsResult[],manual?:{id:string;result:NewsResult|null}):Promise<void>{
    if(!session||!repositoryRef.current)throw new Error('Your journal is not available yet.');
    await pendingForecastWriteRef.current;await awaitForecastUpdateWrites();
    const latest=await repositoryRef.current.getSession(session.id);
    if(!latest||latest.createdAt!==session.createdAt)throw new Error('This day changed. Reopen it before saving the result.');
    const at=Temporal.Now.instant().toString();
    const next=manual?withNewsResult(latest,manual.id,manual.result,at):withOfficialNewsResults(latest,results,at);
    if(next===latest)return;
    await repositoryRef.current.saveSession(next);
    setSession(current=>current?.id===next.id?next:current);
    setMarketContextUndoHistoryId(next.marketContextHistory.at(-1)?.id??null);
    setMessage(manual?'News result saved.':'Released news results saved.');
  }

  async function saveEventMove(anchors:Omit<EventPriceMoveLink,'linkedAt'>|null):Promise<string|null> {
    if(!repositoryRef.current||!eventMoveEditor||!eventMoveSource)return 'The event is not available yet.';
    try {
      await pendingForecastWriteRef.current;
      await awaitForecastUpdateWrites();
      const original=await repositoryRef.current.getSession(eventMoveSource.id);
      if(!original||original.journalId!==profile.id)return 'That source day is no longer available.';
      const at=Temporal.Now.instant().toString();
      const next=withEventPriceMove(original,eventMoveEditor.eventId,anchors,at,levelActivityScope([original],original,at).windows);
      if(next!==original)await repositoryRef.current.saveSession(next);
      setSession(current=>current?.id===next.id?next:current);
      setTrackingSessions(records=>records?.map(day=>day.id===next.id?next:day)??null);
      setHistorySessions(records=>records.map(day=>day.id===next.id?next:day));
      if(session?.id===next.id)setMarketContextUndoHistoryId(next.marketContextHistory.at(-1)?.id??null);
      setMessage(anchors?'Price move linked. Level context follows your saved prices.':'Move link removed.');
      return null;
    }catch(error){return error instanceof Error?error.message:String(error);}
  }

  async function removeMarketContext(itemId: string): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      let next = withRemovedMarketContextItem(
        session,
        itemId,
        Temporal.Now.instant().toString(),
      );
      next = { ...next, forecastCoverage: { ...next.forecastCoverage, news: next.marketContextItems.length ? "reviewed" : "unknown" } };
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setMarketContextUndoHistoryId(next.marketContextHistory.at(-1)?.id ?? null);
      setEditingMarketContextId(null);
      setMessage("News/event entry removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function undoMarketContextChange(): Promise<void> {
    if (!session || !repositoryRef.current || !marketContextUndoHistoryId) return;
    try {
      let next = withUndoneMarketContextChange(
        session,
        marketContextUndoHistoryId,
        Temporal.Now.instant().toString(),
      );
      next = { ...next, forecastCoverage: { ...next.forecastCoverage, news: next.marketContextItems.length ? "reviewed" : "unknown" } };
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setMarketContextUndoHistoryId(null);
      setMessage("News/event change undone.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveSignificantLevel(
    update: SignificantLevelUpdate,
    originAt: string | null,
    levelId: string | null = null,
  ): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is still opening. Please try again.";
    try {
      const now = Temporal.Now.instant().toString();
      const existing = levelId
        ? significantLevels.find((level) => level.id === levelId) ?? null
        : null;
      if (levelId && !existing) throw new Error("That Significant Level is unavailable.");
      const created = existing
        ? withCorrectedSignificantLevel(
            session,
            existing,
            update,
            originAt,
            null,
            now,
            true,
          )
        : createSignificantLevel(session, update, originAt, null, now);
      await repositoryRef.current.saveSignificantLevel(
        created.level,
        workspacePreview ? created.session : created.session === session ? undefined : created.session,
      );
      setSignificantLevels((current) => existing
        ? current.map((level) => level.id === created.level.id ? created.level : level)
        : [...current, created.level]);
      setSession(created.session);
      setActivePanel(entryOrigin);
      setSignificantLevelUndo(
        existing
          ? {
              levelId: created.level.id,
              historyEntryId: created.level.revisionHistory?.at(-1)?.id ?? "",
            }
          : null,
      );
      setEditingSignificantLevelId(null);
      setSignificantLevelOpen(false);
      setMessage(
        existing
          ? "Price level updated."
          : "Significant Level added to the active list.",
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  async function changeSignificantLevelStatus(
    level: SignificantLevel,
    action: SignificantLevelStatusAction,
    details?: SignificantLevelArchiveDetails,
  ): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const next = withSignificantLevelLifecycleAction(
        level,
        action,
        Temporal.Now.instant().toString(),
        details,
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) =>
        [...current.filter(candidate => candidate.id !== next.id), next],
      );
      const labels = {
        retired: "Level retired and preserved in history.",
        restored: "Level restored to the active map.",
        invalidated: "Level marked invalidated and preserved in history.",
        invalidation_corrected: "Invalidation corrected; level returned to the active map."
      } as const;
      setLastArchivedLevelId(action === "retired" || action === "invalidated" ? level.id : null);
      setMessage(labels[action]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveSignificantLevelProximity(proximityPoints: number): Promise<void> {
    if (!repositoryRef.current) return;
    if (!Number.isFinite(proximityPoints) || proximityPoints <= 0) {
      setMessage("Enter a Significant Level proximity greater than zero.");
      return;
    }
    const next: SignificantLevelPreferences = {
      instrument: ES_TEMPLATE.instrument,
      proximityPoints,
      updatedAt: Temporal.Now.instant().toString(),
    };
    try {
      await repositoryRef.current.saveSignificantLevelPreferences(next);
      setSignificantLevelPreferences(next);
      setMessage(`Nearby Significant Levels now use ±${proximityPoints} points from CP.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function setSignificantLevelMapVisibility(
    level: SignificantLevel,
    showOnMap: boolean,
  ): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const next = withSignificantLevelMapVisibility(
        level,
        showOnMap,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setMessage(showOnMap
        ? "Level enabled on map."
        : "Level hidden from map.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function addSignificantLevelNote(
    level: SignificantLevel,
    text: string,
    localTime: string,
  ): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const now = Temporal.Now.instant().toString();
      const next = withSignificantLevelNote(
        level,
        text,
        sessionObservationInstant(
          session.rthDate,
          localTime,
          session.displayTimeZone,
        ).toString(),
        now,
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setMessage("Level note saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeSignificantLevelNote(
    level: SignificantLevel,
    noteId: string,
  ): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const next = withRemovedSignificantLevelNote(
        level,
        noteId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setMessage("Significant Level note removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function addSignificantLevelMarketEvent(
    level: SignificantLevel,
    kind: SignificantLevelMarketEventKind,
    localTime: string,
    observedPrice: number | null,
    linkedEventIds: string[],
    note: string,
  ): Promise<boolean> {
    if (!session || !repositoryRef.current) return false;
    if(pendingLevelObservationRef.current.has(level.id))return false;
    pendingLevelObservationRef.current.add(level.id);
    try {
      const observedAt = sessionObservationInstant(
        session.rthDate,
        localTime,
        session.displayTimeZone,
      ).toString();
      const recordedAt = Temporal.Now.instant().toString();
      if (Temporal.Instant.compare(observedAt, recordedAt) > 0)
        throw new Error("Choose a time that has already happened.");
      const clock=journalClock(session.market),close=session.close.observedAt??clock.checkpointInstant(session.rthDate,session.market.checkpoints.studyClose).toString();
      if(Temporal.Instant.compare(observedAt,clock.overnightStart(session.rthDate))<0||Temporal.Instant.compare(observedAt,close)>0)
        throw new Error("Choose a time within this day's overnight or regular session.");
      // Use the current overlay, including previously saved confirmations.
      const latest = significantLevels.find(candidate => candidate.id === level.id) ?? level;
      const next = withSignificantLevelMarketEvent(
        latest,
        {
          kind,
          sessionId: session.id,
          rthDate: session.rthDate,
          observedAt,
          phase: significantLevelEpisodePhase(session, observedAt),
          observedPrice,
          linkedEvents: session.marketContextItems
            .filter((item) => linkedEventIds.includes(item.id) && item.eventAt <= observedAt)
            .map((item) => ({
              itemId: item.id,
              name: item.name,
              eventAt: item.eventAt,
              ...(item.holiday ? { holiday: item.holiday } : {}),
            })),
          note,
        },
        recordedAt,
      );
      const updatedSession={...session,updatedAt:recordedAt};
      await repositoryRef.current.saveSignificantLevel(next,updatedSession);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setSignificantLevelUndo({levelId:next.id,eventId:next.marketEvents.find(event=>!event.removedAt&&event.kind===kind&&event.observedAt===observedAt)!.id,action:'added'});
      setMessage(
        `${significantLevelMarketEventLabel(level, kind)} recorded during ${
          significantLevelEpisodePhaseLabel(significantLevelEpisodePhase(session, observedAt))
        }.`
      );
      // This observation adds knowledge to the selected session without adding
      // a price or changing an earlier forecast. Price-based role evidence can
      // still supersede it at a later observation time.
      setSession(updatedSession);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      pendingLevelObservationRef.current.delete(level.id);
    }
  }

  async function removeSignificantLevelMarketEvent(
    level: SignificantLevel,
    marketEventId: string,
  ): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const next = withRemovedSignificantLevelMarketEvent(
        level,
        marketEventId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setSignificantLevelUndo({levelId:next.id,eventId:marketEventId,action:'removed'});
      setMessage("Significant Level visit removed from active review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function confirmSignificantLevelEpisode(
    level: SignificantLevel,
    interaction: SignificantLevelInteraction,
    classification: SignificantLevelEpisodeClassification,
    localTime: string,
    linkedEventIds: string[],
    note: string,
  ): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const observedAt = sessionObservationInstant(
        session.rthDate,
        localTime,
        session.displayTimeZone,
      ).toString();
      const confirmedAt = Temporal.Now.instant().toString();
      const next = withConfirmedSignificantLevelEpisode(
        level,
        {
          classification,
          sessionId: session.id,
          rthDate: session.rthDate,
          observedAt,
          phase: significantLevelEpisodePhase(session, observedAt),
          evidence: interaction,
          linkedEvents: session.marketContextItems
            .filter((item) =>
              linkedEventIds.includes(item.id) && item.eventAt <= observedAt)
            .map((item) => ({
              itemId: item.id,
              name: item.name,
              eventAt: item.eventAt,
              ...(item.holiday ? { holiday: item.holiday } : {}),
            })),
          note,
        },
        confirmedAt,
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setMessage(
        `${failurePatternLabel(classification)} confirmed by you and linked to ${significantLevelEpisodePhaseLabel(
          significantLevelEpisodePhase(session, observedAt),
        )}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeSignificantLevelEpisode(
    level: SignificantLevel,
    episodeId: string,
  ): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const next = withRemovedSignificantLevelEpisode(
        level,
        episodeId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSignificantLevel(next);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== next.id), next]);
      setMessage("Confirmed LBAF/LAAF episode removed from active review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeSignificantLevel(level: SignificantLevel): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const removed = withRemovedSignificantLevel(
        session,
        level,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSignificantLevel(removed.level, removed.session);
      setSession(removed.session);
      setSignificantLevels((current) => [...current.filter(candidate => candidate.id !== removed.level.id), removed.level]);
      setSignificantLevelUndo({
        levelId: removed.level.id,
        historyEntryId: removed.historyEntryId,
      });
      setEditingSignificantLevelId(null);
      setSignificantLevelOpen(false);
      setMessage("Price level removed. You can undo this below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function undoSignificantLevelChange(): Promise<void> {
    if (!session || !repositoryRef.current || !significantLevelUndo) return;
    const level = significantLevels.find(
      (candidate) => candidate.id === significantLevelUndo.levelId,
    );
    if (!level) return;
    try {
      if('eventId' in significantLevelUndo){
        const now=Temporal.Now.instant().toString();
        const restored=significantLevelUndo.action==='added'?withRemovedSignificantLevelMarketEvent(level,significantLevelUndo.eventId,now)
          :withRestoredSignificantLevelMarketEvent(level,significantLevelUndo.eventId,now);
        const nextSession={...session,updatedAt:now};
        await repositoryRef.current.saveSignificantLevel(restored,nextSession);
        setSignificantLevels(current=>current.map(candidate=>candidate.id===restored.id?restored:candidate));
        setSession(nextSession);setSignificantLevelUndo(null);setMessage('Level observation change undone.');return;
      }
      const restored = withUndoneSignificantLevelChange(
        session,
        level,
        significantLevelUndo.historyEntryId,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSignificantLevel(restored.level, restored.session);
      setSession(restored.session);
      setSignificantLevels((current) => current.map((candidate) =>
        candidate.id === restored.level.id ? restored.level : candidate));
      setSignificantLevelUndo(null);
      setMessage("Significant Level change undone.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveOvernight(update: OvernightUpdate): Promise<void> {
    if (!session || !repositoryRef.current) return;
    try {
      const next = await saveForecastInput(withOvernightUpdate(
        session,
        update,
        Temporal.Now.instant().toString(),
      ));
      setSession(next);
      setActivePanel("dashboard");
      setMessage(
        next.overnight.status === "confirmed"
          ? "Completed overnight range confirmed locally."
          : "Overnight range saved. Add both prices when you are ready to confirm it.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openSession(rthDate: string): Promise<void> {
    if (!repositoryRef.current) return;
    const request=++sessionRequest.current;
    let draft:JournalSession|null=null;
    try {
      setMessage(`Opening ${rthDate}…`);
      if(workspacePreview){
        setWorkspaceDateLoading(true);setWorkspaceDateError(false);
        draft=createJournalSession(rthDate,Temporal.Now.instant().toString(),profile);
        draft.displayTimeZone=session?.displayTimeZone??profile.template.canonicalTimeZone;
        // The header can show the requested date without replaying every level
        // against an empty temporary day, then replaying it all again on load.
        setWorkspacePendingSession(draft);
      }
      const opened = await getOrCreateSession(repositoryRef.current, rthDate, profile, !workspacePreview);
      if(request!==sessionRequest.current)return;
      if (opened.created) {
        setStorageStatus((current) =>
          current
            ? { ...current, sessionCount: current.sessionCount + 1 }
            : current,
        );
      }
      if(workspacePreview&&!opened.stored&&session)opened.session.displayTimeZone=session.displayTimeZone;
      const known=trackingSessions?.find(day=>day.id===opened.session.id);
      setSession(known?reuseJournalHistory([known],[opened.session])[0]!:opened.session);
      setMessage(`Session ${rthDate} opened locally.`);
    } catch (error) {
      if(request===sessionRequest.current){if(draft)setSession(draft);setWorkspaceDateError(true);setMessage(error instanceof Error ? error.message : String(error));}
    }finally{if(request===sessionRequest.current){setWorkspacePendingSession(null);setWorkspaceDateLoading(false);}}
  }

  async function openArchivePanel(
    panel: "review-menu" | "statistics-ib" | "statistics-levels",
  ): Promise<void> {
    if (!repositoryRef.current) return;
    const request=++reviewRequest.current;
    setActivePanel(panel);
    setReviewLoading(true);setReviewError('');setMessage('');
    try {
      const sessions = (await repositoryRef.current.listSessions(ES_TEMPLATE.instrument))
        .filter((savedSession) => sessionHasJournalData(savedSession, significantLevels));
      if(request!==reviewRequest.current)return;
      setHistorySessions(current=>reuseJournalHistory(current,sessions));
      reviewHistoryLoaded.current=true;
      setMessage("");
    } catch (error) {
      if(request===reviewRequest.current)setReviewError(error instanceof Error ? error.message : 'Saved days could not load.');
    } finally {if(request===reviewRequest.current)setReviewLoading(false);}
  }

  function openReviewedSession(date:string):void {
    setReturnToReview(true);setEntryOrigin('dashboard');setActivePanel('dashboard');
    if(date!==session?.rthDate)void openSession(date);
  }

  function resumeReview():void {
    setReturnToReview(false);
    if(!reviewPanels.includes(activePanel))void openArchivePanel(lastReviewPanel);
  }
  function openReviewSection(panel:ReviewPanel):void {
    setReviewHomeRequests(current=>({...current,[panel]:current[panel]+1}));
    void openArchivePanel(panel);
  }

  async function openTrashPanel(): Promise<void> {
    if (!repositoryRef.current) return;
    setActivePanel("trash");
    setPermanentDeleteConfirmationId(null);
    try {
      const trash = await repositoryRef.current.listTrashedSessions(ES_TEMPLATE.instrument);
      setTrashedSessions(trash);
      setMessage(`${trash.length} session${trash.length === 1 ? "" : "s"} in Trash.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function moveCurrentSessionToTrash(): Promise<void> {
    if (!repositoryRef.current || !session) return;
    try {
      const replacement = {
        ...createJournalSession(
          session.rthDate,
          Temporal.Now.instant().toString(),
          profile,
        ),
        displayTimeZone: session.displayTimeZone,
      };
      await repositoryRef.current.trashSession(
        session.id,
        replacement,
        Temporal.Now.instant().toString(),
      );
      const trash = await repositoryRef.current.listTrashedSessions(ES_TEMPLATE.instrument);
      setTrashedSessions(trash);
      setHistorySessions((current) => current.filter((entry) => entry.id !== session.id));
      setTrashMoveConfirmation(false);
        setSession(replacement);
      setActivePanel("dashboard");
      setMessage(`${session.rthDate} moved to Trash. A clean day is ready.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function restoreTrashedSession(trashId: string): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const entry = trashedSessions.find((item) => item.id === trashId);
      if (!entry) throw new Error("The trashed session is no longer available.");
      const active = await repositoryRef.current.getSession(entry.originalSessionId);
      if (active && sessionHasOwnJournalData(active)) {
        setMessage(
          `${entry.session.rthDate} now contains new journal data. Move that replacement session to Trash before restoring this prior version.`,
        );
        return;
      }
      const restored = await repositoryRef.current.restoreSession(
        trashId,
        active?.id ?? null,
      );
      const trash = await repositoryRef.current.listTrashedSessions(ES_TEMPLATE.instrument);
      setTrashedSessions(trash);
      setPermanentDeleteConfirmationId(null);
      setHistorySessions((current) => {
        const withoutRestoredDate = current.filter((item) => item.id !== restored.id);
        return sessionHasJournalData(restored, significantLevels)
          ? [restored, ...withoutRestoredDate]
          : withoutRestoredDate;
      });
      if (session?.id === restored.id) {
        setSession(restored);
        setActivePanel("dashboard");
      }
      if (!active) {
        setStorageStatus((current) => current
          ? { ...current, sessionCount: current.sessionCount + 1 }
          : current);
      }
      setMessage(`${restored.rthDate} restored from Trash.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function permanentlyDeleteTrashedSession(trashId: string): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      const deleted = trashedSessions.find((entry) => entry.id === trashId);
      await repositoryRef.current.deleteSessionPermanently(trashId);
      const trash = await repositoryRef.current.listTrashedSessions(ES_TEMPLATE.instrument);
      setTrashedSessions(trash);
      setPermanentDeleteConfirmationId(null);
      setMessage(`${deleted?.session.rthDate ?? "Session"} permanently deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function clearHistoricalSelection(): void {
    historicalReadRequest.current++;
    setHistoricalPreview(null);
    setMonthlyPreview(null);
    setReplayPreview(null); setReplayText(null);
    setPricePreview(null);
    setFbdPreview(null); setContextPreview(null);
    setHistoricalSelectedFileName(null);
    setHistoricalCsvFile(null);
    setMessage('File selection cleared. Imported history is still saved.');
  }

  async function selectHistoricalImportFile(file: File, csvCohort: HistoricalIbCohort = 'FORWARD_OBSERVATION'): Promise<void> {
    const request = ++historicalReadRequest.current;
    setHistoricalSelectedFileName(file.name);
    setHistoricalPreview(null);
    setMonthlyPreview(null);
    setReplayPreview(null); setReplayText(null);
    setPricePreview(null);
    setFbdPreview(null); setContextPreview(null);
    setHistoricalCsvFile(null);
    setMessage(`Reading ${file.name}…`);
    try {
      if (file.size > MONTHLY_PACK_MAX_BYTES) throw new Error('Monthly Study Packs have a 32 MB limit.');
      const text = await file.text();
      const result = await inspectHistoryFile(text, file.name, new Date().toISOString(), csvCohort);
      if (request !== historicalReadRequest.current) return;
      if (result.kind === 'monthly') {
        setMonthlyPreview({ parsed: result.parsed, text, fileName: file.name });
        setMessage('Study Pack checked. Review this month before adding it.');
      } else if (result.kind === 'replay') {
        targetJournalReplay(result.parsed, profile, new Date().toISOString());
        setReplayPreview(result.parsed); setReplayText(text);
        setMessage(`${result.parsed.sessions.length} replay days checked. Existing entries will be preserved.`);
      } else if (result.kind === 'context') {
        setContextPreview({ parsed: result.parsed, text, fileName: file.name });
        setMessage(`${result.parsed.events.length} events checked. Review the pack before importing.`);
      } else if (result.kind === 'fbd') {
        setFbdPreview({ parsed: result.parsed, text, fileName: file.name });
        setMessage(`${result.parsed.lows.length} significant lows checked. Review the pack before importing.`);
      } else if (result.kind === 'price') {
        setPricePreview({ parsed: result.parsed, text, fileName: file.name });
        setMessage(`${result.parsed.days.length} price-history days checked. Review the pack before importing.`);
      } else {
        const { preview } = result;
        if (preview.studyPack) {
          const compatibility = studyPackCompatibility(preview.studyPack, profile.template);
          if (compatibility.error) preview.blockingErrors.push(compatibility.error);
        } else setHistoricalCsvFile(file);
        setHistoricalPreview(preview);
        setMessage(preview.blockingErrors.length === 0
          ? `${preview.rowCount} history rows checked. Review the preview before importing.`
          : `Import preview found ${preview.blockingErrors.length} blocking validation error${preview.blockingErrors.length === 1 ? "" : "s"}.`);
      }
    } catch (error) {
      if (request !== historicalReadRequest.current) return;
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadRecentReplay(): Promise<void> {
    if (import.meta.env.MODE === 'beta-rehearsal' || import.meta.env.MODE === 'public-blank') return;
    setMessage('Loading recent study days…');
    try {
      const data = await import('./data/es-recent-journal.json');
      await selectHistoricalImportFile(new File([JSON.stringify(data.default)], 'ES-recent-30-sessions.replay.json', {type:'application/json'}));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function importRecentReplay(): Promise<void> {
    const repository = repositoryRef.current;
    if (!repository || !replayText || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      await awaitForecastUpdateWrites();
      const result = await repository.importJournalReplay(replayText);
      const [records, levels, stored] = await Promise.all([repository.listSessions(profile.template.instrument),
        repository.listSignificantLevels(profile.template.instrument), session ? repository.getSession(session.id) : Promise.resolve(null)]);
      setSignificantLevels(levels); setTrackingSessions(records); setHistorySessions(records);
      if (stored) setSession(stored);
      setStorageStatus(await repository.initialize());
      setReplayPreview(null); setReplayText(null); setHistoricalSelectedFileName(null);
      setMessage(`${result.addedDates.length} replay days added · ${result.skippedDates.length} existing days preserved · ${result.addedLevels} levels added. Browse them with the date arrows on Today.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setHistoricalImporting(false); }
  }

  async function importHistoricalPreview(): Promise<void> {
    if (!repositoryRef.current || !historicalPreview || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      const importedAt = historicalPreview.sessions[0]?.importedAt ?? new Date().toISOString();
      const batch = historicalIbBatchFromPreview(historicalPreview, importedAt);
      await repositoryRef.current.importHistoricalIbBatch(
        batch,
        historicalPreview.sessions,
      );
      setHistoricalBatches(await repositoryRef.current.listHistoricalImportBatches());
      setHistoricalSessions(await repositoryRef.current.listHistoricalIbSessions());
      setHistoricalPreview(null);
      setHistoricalCsvFile(null);
      setHistoricalSelectedFileName(null);
      setMessage(`IB Pack added: ${batch.rowCount} day${batch.rowCount === 1 ? "" : "s"}. Find it under Review → Days or IB stats.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setHistoricalImporting(false); }
  }

  async function refreshImportedPacks(): Promise<void> {
    const repository = repositoryRef.current;
    if (!repository) return;
    const [daily, rows, prices, lows, events, months] = await Promise.all([
      repository.listHistoricalImportBatches(), repository.listHistoricalIbSessions(), repository.listPriceHistoryBatches(),
      repository.listFbdBatches(), repository.listContextBatches(), repository.listMonthlyStudyPacks()]);
    setHistoricalBatches(daily); setHistoricalSessions(rows); setPriceBatches(prices);
    setFbdBatches(lows); setContextBatches(events); setMonthlyBatches(months);
  }
  async function importMonthlyPreview(): Promise<void> {
    if (!repositoryRef.current || !monthlyPreview || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      await pendingForecastWriteRef.current;
      await awaitForecastUpdateWrites();
      await repositoryRef.current.importMonthlyStudyPack(monthlyPreview.text, monthlyPreview.fileName);
      await refreshImportedPacks();
      setSignificantLevels(await repositoryRef.current.listSignificantLevels(profile.template.instrument));
      setMonthlyPreview(null); setHistoricalSelectedFileName(null);
      setMessage('Study Pack added. Its material is ready in Today, Levels and Review.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setHistoricalImporting(false); }
  }
  async function removeMonthlyBatch(id: string): Promise<void> {
    if (!repositoryRef.current || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      await awaitForecastUpdateWrites();
      await repositoryRef.current.removeMonthlyStudyPack(id);
      await refreshImportedPacks();
      setMessage('Study Pack removed. Your journal entries and saved forecasts are still saved.');
    } finally { setHistoricalImporting(false); }
  }

  async function importContextPreview(): Promise<void> {
    if (!repositoryRef.current || !contextPreview || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      await repositoryRef.current.importContextPack(contextPreview.text, contextPreview.fileName);
      setContextBatches(await repositoryRef.current.listContextBatches());
      setContextPreview(null); setHistoricalSelectedFileName(null);
      setMessage('Context Pack added. Find matching events in Today’s menu → Context or Review → Days.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setHistoricalImporting(false); }
  }
  async function removeContextBatch(id: string): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      await repositoryRef.current.removeContextBatch(id);
      setContextBatches(await repositoryRef.current.listContextBatches());
      setMessage('Context Pack removed. Your other packs and journal entries stay saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function importFbdPreview(): Promise<void> {
    if (!repositoryRef.current || !fbdPreview || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      await repositoryRef.current.importFbdHistory(fbdPreview.text, fbdPreview.fileName, fbdPreview.parsed.pack.info.cohort);
      setFbdBatches(await repositoryRef.current.listFbdBatches());
      setSignificantLevels(await repositoryRef.current.listSignificantLevels(profile.template.instrument));
      setFbdPreview(null); setContextPreview(null); setHistoricalCsvFile(null); setHistoricalSelectedFileName(null);
      setMessage('Low Pack added. Find its lows under Levels.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setHistoricalImporting(false); }
  }
  async function removeFbdBatch(id: string): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      await repositoryRef.current.removeFbdBatch(id);
      setFbdBatches(await repositoryRef.current.listFbdBatches());
      setMessage('Low Pack removed. Your other history and journal entries stay saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function importPricePreview(): Promise<void> {
    if (!repositoryRef.current || !pricePreview || historicalImporting) return;
    setHistoricalImporting(true);
    try {
      await repositoryRef.current.importPriceHistory(pricePreview.text, pricePreview.fileName, pricePreview.parsed.pack.info.cohort);
      setPriceBatches(await repositoryRef.current.listPriceHistoryBatches());
      setPricePreview(null);
      setFbdPreview(null); setContextPreview(null);
      setHistoricalCsvFile(null);
      setHistoricalSelectedFileName(null);
      setMessage('Price Action Pack added. Find them under Review → Days.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setHistoricalImporting(false); }
  }

  async function removePriceBatch(id: string): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      await repositoryRef.current.removePriceHistoryBatch(id);
      setPriceBatches(await repositoryRef.current.listPriceHistoryBatches());
      setMessage('Price Action Pack removed. Daily IB history and journal entries stay saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }

  async function removeHistoricalBatch(batchId: string): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      await repositoryRef.current.removeHistoricalImportBatch(batchId);
      setHistoricalBatches(await repositoryRef.current.listHistoricalImportBatches());
      setHistoricalSessions(await repositoryRef.current.listHistoricalIbSessions());
      setHistoricalRemoveConfirmationId(null);
      setMessage("Imported research batch removed. Manual journal sessions were unchanged.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function openCalendarSession(rthDate: string): void {
    if (!rthDate) return;
    try {
      if (!isPotentialRthDate(rthDate)) {
        setMessage(`${rthDate} is outside this journal’s study days. Choose another date.`);
        return;
      }
      void openSession(rthDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveContract(contract: string): Promise<string | null> {
    if (!session || !repositoryRef.current) return "The journal is not ready.";
    try {
      await pendingForecastWriteRef.current;
      await awaitForecastUpdateWrites();
      const useForNewDays = session.rthDate >= resolveLaunchRthDate(Temporal.Now.instant());
      const status = await repositoryRef.current.setContract(session.id, contract, useForNewDays, Temporal.Now.instant().toString());
      const saved = await repositoryRef.current.getSession(session.id);
      setStorageStatus(status);
      setProfile(status.profiles.find((item) => item.id === status.activeJournalId) ?? profile);
      if (saved) setSession(saved);
      setMessage(useForNewDays ? "Contract saved for this day and new sessions." : "Contract saved for this day only.");
      return null;
    } catch (error) { return error instanceof Error ? error.message : String(error); }
  }

  async function changeDisplayTimeZone(
    displayTimeZone: SupportedDisplayTimeZone,
  ): Promise<void> {
    if (!session || !repositoryRef.current || session.displayTimeZone === displayTimeZone) {
      return;
    }
    try {
      const next = withDisplayTimeZone(
        session,
        displayTimeZone,
        Temporal.Now.instant().toString(),
      );
      await repositoryRef.current.saveSession(next);
      setSession(next);
      setActivePanel("dashboard");
        const label = TIME_ZONES.find((zone) => zone.id === displayTimeZone)?.label
        ?? displayTimeZone;
      setMessage(`Times now shown in ${label}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function requestPersistence(): Promise<void> {
    if (!navigator.storage?.persist) {
      setPersistence("unavailable");
      return;
    }
    const granted = await navigator.storage.persist();
    setPersistence(granted ? "granted" : "not-granted");
  }

  async function exportDatabase(): Promise<void> {
    if (!repositoryRef.current || !session) return;
    await pendingForecastWriteRef.current;
    await awaitForecastUpdateWrites();
    const bytes = await repositoryRef.current.exportDatabase();
    downloadFile(
      `ib-field-notes-${session.rthDate}.sqlite3`,
      Uint8Array.from(bytes).buffer,
      "application/vnd.sqlite3",
    );
  }

  async function exportJson(): Promise<void> {
    if (!repositoryRef.current || !session) return;
    await pendingForecastWriteRef.current;
    await awaitForecastUpdateWrites();
    const json = await repositoryRef.current.exportJson();
    downloadFile(`ib-field-notes-${session.rthDate}.json`, json, "application/json");
  }

  async function restoreDatabase(file: File): Promise<void> {
    if (!repositoryRef.current) return;
    try {
      await pendingForecastWriteRef.current;
      await awaitForecastUpdateWrites();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const header = new TextDecoder().decode(bytes.slice(0, 16));
      if (header !== "SQLite format 3\u0000") {
        throw new Error("That file is not an IB Field Notes SQLite backup.");
      }
      const status = await repositoryRef.current.importDatabase(bytes);
      const restoredProfile = status.profiles.find((item) => item.id === status.activeJournalId) ?? DEFAULT_JOURNAL;
      if (JSON.stringify(restoredProfile.template) !== JSON.stringify(profile.template) || restoredProfile.id !== profile.id) {
        window.location.reload();
        return;
      }
      setStorageStatus(status);
      setProfile(restoredProfile);
      setMigrationProof(status.migrationProofPassed ? true : null);
      const rthDate = resolveLaunchRthDate(Temporal.Now.instant());
      const opened = await getOrCreateSession(repositoryRef.current, rthDate, restoredProfile);
      const [levels, restoredLevelPreferences, batches, importedSessions, trash, pricePacks, fbdPacks, contextPacks, monthlyPacks] = await Promise.all([
        repositoryRef.current.listSignificantLevels(ES_TEMPLATE.instrument),
        repositoryRef.current.getSignificantLevelPreferences(ES_TEMPLATE.instrument),
        repositoryRef.current.listHistoricalImportBatches(),
        repositoryRef.current.listHistoricalIbSessions(),
        repositoryRef.current.listTrashedSessions(ES_TEMPLATE.instrument),
        repositoryRef.current.listPriceHistoryBatches(), repositoryRef.current.listFbdBatches(), repositoryRef.current.listContextBatches(), repositoryRef.current.listMonthlyStudyPacks()
      ]);
      setSession(opened.session);
      setSignificantLevels(levels);
      setSignificantLevelPreferences(restoredLevelPreferences ?? {
        instrument: ES_TEMPLATE.instrument,
        proximityPoints: DEFAULT_SIGNIFICANT_LEVEL_PROXIMITY_TICKS * ES_TEMPLATE.tickSize,
        updatedAt: new Date(0).toISOString(),
      });
      setHistoricalBatches(batches);
      setPriceBatches(pricePacks);
      setFbdBatches(fbdPacks);
      setContextBatches(contextPacks);
      setMonthlyBatches(monthlyPacks);
      setHistoricalSessions(importedSessions);
      setTrashedSessions(trash);
      setHistoricalPreview(null);
      setMonthlyPreview(null);
      setPricePreview(null);
      setFbdPreview(null); setContextPreview(null);
      setHistoricalSelectedFileName(null);
      setHistoricalCsvFile(null);
      historicalReadRequest.current++;
      if (opened.created) {
        setStorageStatus((current) =>
          current
            ? { ...current, sessionCount: current.sessionCount + 1 }
            : current,
        );
      }
      setMessage("SQLite backup restored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function runMigrationProof(): Promise<void> {
    if (!repositoryRef.current) return;
    const passed = await repositoryRef.current.runMigrationProof();
    setMigrationProof(passed);
  }

  const historicalImportConflict = (() => {
    if (!historicalPreview) return null;
    if (historicalPreview.blockingErrors.length > 0) return null;
    const previewBatch = historicalIbBatchFromPreview(historicalPreview, new Date().toISOString());
    const existingBatch = historicalBatches.find((batch) => batch.id === previewBatch.id ||
      (batch.contentSha256 === previewBatch.contentSha256 && batch.cohort === previewBatch.cohort));
    if (existingBatch) {
      const canEnrich = historicalPreview.sessions.some((incoming) => incoming.forecastInputs &&
        historicalSessions.some((stored) => stored.batchId === existingBatch.id &&
          stored.rthDate === incoming.rthDate && !stored.forecastInputs));
      const canAttachPack = historicalPreview.studyPack && !existingBatch.studyPack;
      return canEnrich || canAttachPack ? null : "This source file is already imported with its available details.";
    }
    const previewDates = new Set(historicalPreview.sessions.map((entry) => entry.rthDate));
    const overlapCount = historicalSessions.filter(
      (entry) => entry.cohort === historicalPreview.cohort && previewDates.has(entry.rthDate),
    ).length;
    return overlapCount > 0
      ? `${overlapCount} date${overlapCount === 1 ? "" : "s"} already exist in ${historicalCohortLabel(historicalPreview.cohort)}. Remove or replace the overlapping batch first.`
      : null;
  })();

  if (fatalError) {
    return (
      <main className="app-shell">
        <section className="error-panel storage-recovery" role="alert">
          <p className="eyebrow">IB Notes</p>
          <h1>Your journal couldn’t open</h1>
          <p>The device couldn’t access your saved journal. Close IB Notes in the app switcher, then reopen it or try again below.</p>
          <p>Keep the app installed and its website data intact.</p>
          <button className="primary-action" type="button" onClick={() => window.location.reload()}>Retry opening</button>
          {updateReady && <button type="button" onClick={() => void updateServiceWorker(true)}>Update app</button>}
          <AppBuildLabel />
          <SupportReport screen="Storage recovery" />
          <details><summary>Error details</summary><p>{fatalError}</p></details>
        </section>
      </main>
    );
  }

  if (readOnly) {
    return (
      <main className="app-shell">
        <section className="notice-panel" role="status">
          <p className="eyebrow">Protected local journal</p>
          <h1>Already open in another tab</h1>
          <p>{message}</p>
        </section>
      </main>
    );
  }

  return (
    <JournalContext.Provider value={profile}>
    <ReviewScrollContext.Provider value={reviewScroll}>
    <SessionPhaseMemory.Provider value={phaseMemory}>
    <OvernightStudyProvider session={session} repository={repositoryRef.current} priceBatches={priceBatches}
      news={contextBatches} active={!PHONE_TEST&&(activePanel==='dashboard'||activePanel==='share'||workspacePreview&&activePanel==='workspace-forecast')} readOnly={PHONE_TEST||activePanel==='share'||workspacePreview&&!!session&&!sessionHasJournalData(session,significantLevels)}>
    <LevelQualityContext.Provider value={qualitySources}><LevelSupersessionContext.Provider value={levelSupersessions}>
    <EventMoveContext.Provider value={{entries:eventMoveHistory,onOpen:(sessionId,eventId)=>setEventMoveEditor({sessionId,eventId})}}>
    <main className={`app-shell${activePanel === "rth" ? " quick-price-mode" : ""}${workspacePreview?" workspace-preview":""}`} data-workspace-home={workspacePreview&&activePanel==='dashboard'} data-workspace-origin={workspaceOrigin} data-workspace-panel={activePanel} aria-busy={switchingJournal}>
      {(!workspacePreview||activePanel!=='dashboard')&&<header className="topbar">
        {activePanel === "dashboard" ? <>
          <h1><span className="brand-ib">IB</span> Notes</h1>
          <button type="button" className="settings-button" aria-label="Settings" onClick={() => setActivePanel("settings")}><span aria-hidden="true">⚙</span><span>Settings</span></button>
        </> : <h1 className="compact-session-label">{session?.instrument} · {session && formatCalendarDate(session.rthDate)} <span>{session && sessionTimeZoneLabel(session)}</span></h1>}
      </header>}



      {updateReady && (
        <div className="update-card" role="status">
          <span>An offline update is ready.</span>
          <button type="button" onClick={() => void updateServiceWorker(true)}>
            Update safely
          </button>
        </div>
      )}

      {session && !workspacePreview && activePanel === "dashboard" && <div className="dashboard-session-controls">
      <nav className="date-strip" aria-label="Session date">
        <button
          type="button"
          disabled={!session}
          aria-label="Previous session"
          onClick={() => {
            if (session) void openSession(previousPotentialRthDate(session.rthDate));
          }}
        >
          ‹
        </button>
        <label className="session-date-picker">
          <span className="session-date-readout">
            <strong>{session ? formatCalendarDate(session.rthDate) : "Loading…"}</strong>
            <span>Calendar</span>
          </span>
          <input
            type="date"
            aria-label="Choose session date"
            disabled={!session}
            value={session?.rthDate ?? ""}
            onChange={(event) => openCalendarSession(event.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          disabled={!session}
          aria-label="Next session"
          onClick={() => {
            if (session) void openSession(nextPotentialRthDate(session.rthDate));
          }}
        >
          ›
        </button>
      </nav></div>}


      {session && !workspacePreview && activePanel === "dashboard" && <div className="capture-toolbar">
        <PriceCaptureButton session={session} latestCp={latestCp} onClick={()=>openRecord('rth')}/>
        <div className="journal-switcher">
        <label><select aria-label="Instrument journal" value={profile.id} disabled={switchingJournal} onChange={(event) => void switchJournal(event.target.value)}>
          {(storageStatus?.profiles ?? [profile]).map((item) => <option key={item.id} value={item.id}>{item.name === item.template.instrument ? item.name : `${item.name} · ${item.template.instrument}`}</option>)}
        </select></label>
      </div>
      </div>}

      <p className={`global-message${message ? "" : " message-empty"}${workspacePreview&&/opened locally\.$/.test(message)?" workspace-startup":""}${activePanel === 'levels' && significantLevelOpen && /^(Current session|Session \d{4}-\d{2}-\d{2}) opened locally\.$/.test(message) ? ' level-entry-startup-message' : ''}`} role="status" aria-live="polite">{message}</p>
      {session&&activePanel==='dashboard'&&returnToReview&&<button className="research-overview-back review-return" type="button" onClick={resumeReview}>← Back to Review</button>}
      {lastArchivedLevelId && significantLevels.some(level => level.id === lastArchivedLevelId && ["retired", "invalidated"].includes(level.currentStatus)) && <button className="undo-action" type="button" onClick={() => {
        const level = significantLevels.find(item => item.id === lastArchivedLevelId)!;
        void changeSignificantLevelStatus(level, level.currentStatus === "retired" ? "restored" : "invalidation_corrected");
      }}>Undo archive</button>}


      {session && !workspacePreview && activePanel === "dashboard" && <>
        <CheckpointStrip session={session} activePanel={activePanel} onOpen={setActivePanel} />
        <div className="today-utilities" role="group" aria-label="Day actions">
          <button className="primary-action" type="button" onClick={() => {
            setSignificantLevelOpen(false); setActivePanel("share");
          }}>Share</button>
          <button type="button" onClick={() => {
            setSignificantLevelOpen(false); setActivePanel("session-notes");
          }}>Day timeline</button>
        </div>
      </>}

      <AppErrorBoundary embedded resetKey={`${session?.id}:${session?.updatedAt}:${activePanel}`}
        timeZone={session?.displayTimeZone}
        onReviewEntries={()=>setActivePanel('session-notes')} onOpenSettings={()=>setActivePanel('settings')}>
      {session&&workspacePreview&&<>
        <WorkspaceDashboard session={workspacePendingSession??session} sessions={trackingSessions??[]} levels={workspaceDateLoading?[]:nearbySignificantLevels.filter(l=>!levelSupersessions.get(l.id)?.hidden)}
          levelsLoading={workspaceLevelRead.loading} levelsError={workspaceLevelRead.error}
          periodRequest={workspacePeriodRequest}
          profiles={storageStatus?.profiles??[profile]} profileId={profile.id} hidden={activePanel!=='dashboard'} loading={workspaceDateLoading} loadError={workspaceDateError} savedDates={(trackingSessions??[]).filter(day=>day.journalId===profile.id&&sessionHasJournalData(day,significantLevels)).map(day=>day.rthDate)}
          onInstrument={id=>void switchJournal(id)} onDate={openCalendarSession} onSettings={()=>openWorkspace('settings')}
          onContext={()=>openWorkspace('context')} onShare={()=>PHONE_TEST?setWorkspaceNotice('Sharing is disabled for synthetic phone-test data.'):openWorkspace('share')} renderReview={workspacePeriodReview} renderPeriod={workspacePeriodContent}
          onOpen={destination=>{setWorkspaceReferences([]);if(destination==='levels'){setFocusedLevelId(undefined);setFbdHistoryPackId(undefined);setMonthlyLevelFilter(undefined);}
            openWorkspace(({forecast:'workspace-forecast',structure:'workspace-structure',levels:'level-library',review:'review-menu'} as const)[destination],destination);}}
          onLevel={members=>{setWorkspaceReferences(members);setWorkspaceOrigin('levels');setEntryOrigin('dashboard');setFocusedLevelId(undefined);setFbdHistoryPackId(undefined);setMonthlyLevelFilter(undefined);workspaceNavigation.openLevel('level-library',`journal:${members[0]!.id}`);}}
          onSave={saveWorkspacePrice} onUndo={()=>void undoWorkspacePrice()} notice={workspaceNotice} undoAvailable={workspaceUndoAvailable}/>
        {activePanel!=='dashboard'&&<header className="workspace-destination-toolbar">
          <h2 tabIndex={-1}>{activePanel==='level-library'&&workspaceNavigation.level?'Level details':activePanel==='levels'&&editingSignificantLevelId?'Edit level':activePanel==='event'?(addingHoliday?'Holiday':editingMarketContextId?'Edit news or event':'News or event'):workspaceTitles[activePanel]}</h2>
          <button type="button" onClick={workspaceNavigation.back}>Back</button>
          <button type="button" onClick={closeWorkspace}>Close</button>
          {activePanel==='review-menu'&&<button type="button" onClick={()=>setActivePanel('session-notes')}>Day timeline</button>}
          {(activePanel==='level-detail'||activePanel==='level-library'&&workspaceNavigation.level)&&workspaceReferences.length>1&&<label className="workspace-area-choice">Reference in this area
            <select aria-label="Reference in this area" value={activePanel==='level-library'?workspaceNavigation.level?.replace(/^journal:/,''):focusedLevelId} onChange={e=>activePanel==='level-library'?workspaceNavigation.replaceLevel(`journal:${e.target.value}`):openLevels(e.target.value)}>{workspaceReferences.map(l=><option key={l.id} value={l.id}>{l.sessionEdge?.code??l.label??'Reference'} · {workspaceFormatPrice(l.price??l.zoneLow!,session.market.tickSize)}</option>)}</select></label>}
        </header>}
        <section className="workspace-destination" hidden={activePanel!=='workspace-forecast'&&activePanel!=='workspace-structure'} aria-label={activePanel==='workspace-structure'?'Structure workspace':'Forecast workspace'}>
          {PHONE_TEST?<>{activePanel==='workspace-structure'?<section className="map-card"><StructureMap session={session} finalIb={finalIb} significantLevels={mappedSignificantLevels} levelMapReferences={levelMapReferences}/></section>:<p>Forecasts are disabled for synthetic phone-test data. No research history is loaded.</p>}</>:<ForecastCard dashboard focused visible={activePanel==='workspace-forecast'||activePanel==='workspace-structure'} presentation={activePanel==='workspace-structure'?'structure':'forecast'} session={session} prior={trackingSessions===null?undefined:resolveForecastPrior({session,sessions:trackingSessions,historical:historicalSessions,
            batches:historicalBatches,previousDate:previousPotentialRthDate,now:Temporal.Now.instant().toString()})}
            historical={historicalSessions} batches={historicalBatches} levels={significantLevels} sessions={trackingSessions??[]} news={contextBatches}
            lowBatches={fbdBatches} priceBatches={priceBatches} repository={repositoryRef.current} contextLevels={visibleSignificantLevels}
            levelDistance={significantLevelPreferences.proximityPoints} onOpenLevel={openLevels}
            onPrepare={async()=>{const next=await saveForecastInput(session);setSession(next);setMessage(next.forecast?'IB Forecast saved locally.':'Forecast inputs are not complete yet.');}}>
            {activePanel==='workspace-structure'&&<section className="map-card"><StructureMap session={session} finalIb={finalIb} significantLevels={mappedSignificantLevels} levelMapReferences={levelMapReferences}/></section>}
          </ForecastCard>}
        </section>
      </>}
      {session && !workspacePreview && activePanel === "dashboard" && (
        <SessionDashboard
          session={session}
          finalIb={finalIb}
          significantLevels={[...mappedSignificantLevels.filter(level => level.sessionEdge?.sessionId !== session.id), ...journalLevels.filter(level => level.sessionEdge?.sessionId === session.id).map(level => ({...level, showOnMap:level.currentStatus === "active" && level.showOnMap}))]}
          levelMapReferences={levelMapReferences}
          recordedDayType={deriveRecordedBreakDayType(
            session.rthObservations,
            finalIb,
            ES_TEMPLATE.tickSize,
          )}
          closingOutcome={closingOutcome}
          forecastPrior={trackingSessions === null ? undefined : resolveForecastPrior({ session, sessions: trackingSessions,
            historical: historicalSessions, batches: historicalBatches, previousDate: previousPotentialRthDate,
            now: Temporal.Now.instant().toString() })}
          forecastHistory={historicalSessions}
          forecastBatches={historicalBatches}
          forecastLevels={significantLevels}
          forecastSessions={trackingSessions ?? []}
          forecastNews={contextBatches}
          forecastLowBatches={fbdBatches}
          forecastPriceBatches={priceBatches}
          forecastRepository={repositoryRef.current}
          contextLevels={visibleSignificantLevels}
          levelDistance={significantLevelPreferences.proximityPoints}
          onOpenLevel={openLevels}
          onPrepareForecast={async () => {
            try {
              const next = await saveForecastInput(session);
              setSession(next);
              setMessage(next.forecast ? "IB Forecast saved locally." : "Forecast inputs are not complete yet.");
            } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
          }}
          priorSessionTrashCount={trashedSessions.filter(
            (entry) => entry.session.rthDate === session.rthDate,
          ).length}
          onOpenTrash={() => void openTrashPanel()}
        />
      )}

      {session && !workspacePreview && activePanel === "dashboard" && <NearbyLevels key={`${profile.id}:${session.id}`} levels={nearbySignificantLevels}
        initialSide={nearbySide?.scope === `${profile.id}:${session.id}` ? nearbySide.side : 'all'}
        onSideChange={side => setNearbySide({ scope: `${profile.id}:${session.id}`, side })}
        initialTier={nearbyTier?.scope === `${profile.id}:${session.id}` ? nearbyTier.tier : 'all'}
        onTierChange={tier => setNearbyTier({ scope: `${profile.id}:${session.id}`, tier })}
        mapReferences={levelMapReferences}
        sessions={trackingSessions} session={session} price={latestCp?.price ?? null}
        distance={significantLevelPreferences.proximityPoints} onOpen={openLevels}
        distanceControl={<SignificantLevelProximityControl proximityPoints={significantLevelPreferences.proximityPoints}
          onSave={(points) => void saveSignificantLevelProximity(points)} />} />}

      {session && !workspacePreview && (activePanel === "level-library" && entryOrigin === "context" || !["dashboard", "level-library", "statistics-levels", "review-menu", "statistics-ib"].includes(activePanel)) && (
        <button
          className={`back-dashboard-button${["a-period", "preopen", "overnight"].includes(activePanel) ? " a-back-button" : ""}`}
          type="button"
          onClick={() => setActivePanel(backTarget)}
        >
          ← {backLabel}
        </button>
      )}

      {session && mainDestination === 'review-menu' && <ReviewSections>
        <button type="button" aria-current={activePanel === 'review-menu' ? 'page' : undefined} onClick={() => openReviewSection('review-menu')}>Days</button>
        <button type="button" aria-current={activePanel === 'statistics-ib' ? 'page' : undefined} onClick={() => openReviewSection('statistics-ib')}>IB stats</button>
        <button type="button" aria-current={activePanel === 'statistics-levels' ? 'page' : undefined} onClick={() => openReviewSection('statistics-levels')}>Level stats</button>
      </ReviewSections>}

      {session&&reviewPanels.includes(activePanel)&&(reviewLoading||reviewError)&&<p className="review-load-status" role={reviewError?'alert':'status'}>
        {reviewError||'Loading saved days…'}{reviewError&&<button type="button" onClick={()=>void openArchivePanel(activePanel as ReviewPanel)}>Try again</button>}
      </p>}
      {session && recording && activePanel !== "rth" && activePanel !== "levels" && entryOrigin !== "context" && <nav className="record-tabs" aria-label="Record">
        {recordChoices.filter((choice) => choice.panel !== "rth").map((choice) => <button key={choice.panel} type="button"
          aria-pressed={activePanel === choice.panel} onClick={() => openRecord(choice.panel)}>{choice.label}</button>)}
      </nav>}

      <div className="content-grid focused-content-grid">
        {activePanel === "instrument-setup" && <InstrumentSetup profiles={storageStatus?.profiles ?? [profile]} onSave={addJournal} onCancel={() => setActivePanel("settings")} />}
        {session && activePanel === "share" && (
          <SharePreview key={`${session.journalId}:${session.id}:${session.createdAt}`}
            compact={workspacePreview}
            session={session}
            significantLevels={visibleSignificantLevels}
            nearbyLevels={nearbySignificantLevels}
            levelMapReferences={levelMapReferences}
            trackingSessions={trackingSessions}
            forecastSources={{historical:historicalSessions,batches:historicalBatches,levels:significantLevels,
              inputs:{sessions:trackingSessions??[],news:contextBatches,lowBatches:fbdBatches,priceBatches,repository:repositoryRef.current}}}
          />
        )}

        {session && activePanel === "session-notes" && (
          <DayTimeline
            key={`timeline:${session.id}`}
            session={session}
            items={sessionTimelineItems(session,visibleSignificantLevels)}
            memory={timelineMemory}
            renderActions={timelineEntryActions}
            undo={<div className="timeline-undo">
              {cpUndoHistoryId && <button className="undo-action" type="button" onClick={() => void undoStandaloneCpRemoval()}>Undo price change</button>}
              {rthUndoHistoryId && <button className="undo-action" type="button" onClick={() => void undoRthObservationChange()}>Undo RTH change</button>}
              {marketContextUndoHistoryId && <button className="undo-action" type="button" onClick={() => void undoMarketContextChange()}>Undo event change</button>}
            </div>}
            recap={session.close.finishedAt && <DeferredDetails key={session.id} summary="Day recap" className="timeline-recap">
              <DailyRecap session={session} finalIb={finalIb} closingOutcome={closingOutcome} rthStates={recapRthStates}
                significantLevels={visibleSignificantLevels} significantLevelInteractions={significantLevelInteractions} />
            </DeferredDetails>}
          />
        )}

        {session && displayedLevelPanel && (
          <WorkspaceLevelCache enabled={workspacePreview} active={activePanel==='level-library'||activePanel==='level-detail'}><LevelTrackingContext.Provider value={trackingSessions}><SignificantLevelLibrary
            key={`${displayedLevelPanel}:${session.id}:${fbdHistoryPackId ?? 'all'}:${focusedLevelId ?? 'all'}:${monthlyLevelFilter?.levelIds.join(',') ?? ''}`}
            active={activePanel==='level-library'||activePanel==='level-detail'}
            navigation={workspacePreview&&displayedLevelPanel==='level-library'?{selectedId:workspaceNavigation.level,onSelect:workspaceNavigation.selectLevel,
              backLabel:workspaceNavigation.levelParent&&workspaceNavigation.levelParent!=='level-library'?`← Back to ${workspaceTitles[workspaceNavigation.levelParent]}`:undefined}:undefined}
            focused={displayedLevelPanel === 'level-detail'}
            repository={repositoryRef.current!}
            lowBatches={fbdBatches}
            priceBatches={priceBatches}
            contextBatches={contextBatches}
            initialPackId={fbdHistoryPackId}
            initialLevelId={focusedLevelId}
            initialMonthlyFilter={monthlyLevelFilter}
            onPacks={() => setActivePanel('historical-library-manage')}
            undoAvailable={significantLevelUndo !== null}
            onUndo={() => void undoSignificantLevelChange()}
            session={session}
            levels={visibleSignificantLevels}
            interactions={significantLevelInteractions}
            latestCp={latestCp?.price ?? null}
            proximityPoints={significantLevelPreferences.proximityPoints}
            onSaveProximity={(points) => void saveSignificantLevelProximity(points)}
            onToggleMap={(level, enabled) =>
              void setSignificantLevelMapVisibility(level, enabled)}
            onAddNote={(level, text, localTime) =>
              void addSignificantLevelNote(level, text, localTime)}
            onRemoveNote={(level, noteId) =>
              void removeSignificantLevelNote(level, noteId)}
            onAddMarketEvent={(level, kind, localTime, observedPrice, eventIds, note) =>
              addSignificantLevelMarketEvent(
                level,
                kind,
                localTime,
                observedPrice,
                eventIds,
                note,
              )}
            onRemoveMarketEvent={(level, marketEventId) =>
              void removeSignificantLevelMarketEvent(level, marketEventId)}
            onConfirmEpisode={(level, interaction, classification, localTime, eventIds, note) =>
              void confirmSignificantLevelEpisode(
                level,
                interaction,
                classification,
                localTime,
                eventIds,
                note,
              )}
            onRemoveEpisode={(level, episodeId) =>
              void removeSignificantLevelEpisode(level, episodeId)}
            onLifecycleAction={(level, action, details) =>
              void changeSignificantLevelStatus(level, action, details)}
            onEdit={(levelId) => {
              const source = visibleSignificantLevels.find(level => level.id === levelId)?.sessionEdge;
              if (source) {
                if(workspacePreview){
                  setWorkspacePeriodRequest(previous=>({id:(previous?.id??0)+1,journalId:profile.id,date:source.rthDate,phase:source.code.startsWith('ON')?'ON':'B'}));
                  closeWorkspace();
                  if(source.rthDate!==session.rthDate)void openSession(source.rthDate);
                  return;
                }
                void openSession(source.rthDate).then(() => {
                  setEntryOrigin('dashboard');
                  setActivePanel(source.code.startsWith('ON') ? 'overnight' : 'b-period');
                });
                return;
              }
              setEditingSignificantLevelId(levelId);
              setEntryOrigin(activePanel === 'level-detail' ? 'level-detail' : 'level-library');
              setSignificantLevelOpen(true);
              setActivePanel("levels");
            }}
            onAdd={() => {
              setEditingSignificantLevelId(null);
              setEntryOrigin("level-library");
              setSignificantLevelOpen(true);
              setActivePanel("levels");
            }}
            onRemove={(level) => void removeSignificantLevel(level)}
          /></LevelTrackingContext.Provider></WorkspaceLevelCache>
        )}

        {session && repositoryRef.current && (activePanel==='review-menu'||visitedReviewPanels.includes('review-menu')) && <div className="review-panel-cache" hidden={activePanel!=='review-menu'||reviewLoading&&!reviewHistoryLoaded.current||!!reviewError} key={`days:${profile.id}`}>{PHONE_TEST?<p>Synthetic sessions are excluded from statistics and shared recaps. Use Day timeline above to inspect saved test observations.</p>:<HistoryPanel active={activePanel==='review-menu'} homeRequest={reviewHomeRequests['review-menu']}
          key={reviewPackFilter?.id ?? 'all-days'} sessions={historySessions} significantLevels={significantLevels}
          historicalSessions={historicalSessions} priceBatches={priceBatches} contextBatches={contextBatches} repository={repositoryRef.current} zone={session.displayTimeZone}
          packFilter={reviewPackFilter} onClearPackFilter={() => setReviewPackFilter(null)} onOpenSession={openReviewedSession} />}</div>}
        {session && (activePanel==='statistics-ib'||visitedReviewPanels.includes('statistics-ib')) && <div className="review-panel-cache" hidden={activePanel!=='statistics-ib'||reviewLoading&&!reviewHistoryLoaded.current||!!reviewError} key={`ib:${profile.id}`}><CoreStatisticsPanel active={activePanel==='statistics-ib'} homeRequest={reviewHomeRequests['statistics-ib']} sessions={historySessions} historicalSessions={historicalSessions}
          source={ibStatsSource} onSourceChange={setIbStatsSource} onOpenSession={openReviewedSession} /></div>}
        {session && (activePanel==='statistics-levels'||visitedReviewPanels.includes('statistics-levels')) && <div className="review-panel-cache" hidden={activePanel!=='statistics-levels'||reviewLoading&&!reviewHistoryLoaded.current||!!reviewError} key={`levels:${profile.id}`}><LevelStatistics active={activePanel==='statistics-levels'} homeRequest={reviewHomeRequests['statistics-levels']} sessions={historySessions} levels={significantLevels} session={session}
          batches={fbdBatches} repository={repositoryRef.current} onOpenSession={openReviewedSession} /></div>}

        {session && activePanel === "historical-library-manage" && (
          <HistoricalLibraryPanel
            levelIds={significantLevels.map(l => l.id)}
            onViewReferences={(filter) => { setEntryOrigin('dashboard'); setFocusedLevelId(undefined); setFbdHistoryPackId(undefined); setMonthlyLevelFilter(filter); setActivePanel('level-library'); }}
            monthlyPreview={monthlyPreview} monthlyBatches={monthlyBatches} onImportMonthly={importMonthlyPreview} onRemoveMonthly={removeMonthlyBatch}
            onViewDays={(month) => { setReviewPackFilter({ kind: 'monthly', id: month, title: month + ' Study Pack' }); void openArchivePanel('review-menu'); }}
            replayPreview={replayPreview} onImportReplay={importRecentReplay} onLoadRecent={loadRecentReplay}
            contextPreview={contextPreview} contextBatches={contextBatches} onImportContext={importContextPreview} onRemoveContext={removeContextBatch}
            onOpenContext={(id) => { const batch = contextBatches.find(b => b.id === id); if (batch) { setReviewPackFilter({ kind: 'context', id, title: packTitle('context', batch.info.instrument) }); void openArchivePanel('review-menu'); } }}
            fbdPreview={fbdPreview} fbdBatches={fbdBatches} onImportFbd={importFbdPreview} onRemoveFbd={removeFbdBatch}
            onOpenFbd={(batchId) => { setEntryOrigin('dashboard'); setFocusedLevelId(undefined); setMonthlyLevelFilter(undefined); setFbdHistoryPackId(batchId); setActivePanel('level-library'); }}
            pricePreview={pricePreview}
            priceBatches={priceBatches}
            onImportPrice={importPricePreview}
            onRemovePrice={removePriceBatch}
            onOpenPrices={(id) => { const batch = priceBatches.find(b => b.id === id); if (batch) { setReviewPackFilter({ kind: 'price', id, title: packTitle('price', batch.info.instrument) }); void openArchivePanel('review-menu'); } }}
            onOpenDaily={(id) => { const batch = historicalBatches.find(b => b.id === id); if (batch) { setReviewPackFilter({ kind: 'daily', id, title: packTitle('daily', batch.studyPack?.instrument) }); void openArchivePanel('review-menu'); } }}
            selectedFileName={historicalSelectedFileName}
            importing={historicalImporting}
            onClearSelection={clearHistoricalSelection}
            batches={historicalBatches}
            preview={historicalPreview}
            importConflict={historicalImportConflict}
            removeConfirmationId={historicalRemoveConfirmationId}
            onCsvLearning={(enabled) => { if (historicalCsvFile) void selectHistoricalImportFile(historicalCsvFile, enabled ? 'REFERENCE' : 'FORWARD_OBSERVATION'); }}
            onSelectFile={(file) => void selectHistoricalImportFile(file)}
            onImport={() => void importHistoricalPreview()}
            onBeginRemove={setHistoricalRemoveConfirmationId}
            onCancelRemove={() => setHistoricalRemoveConfirmationId(null)}
            onConfirmRemove={(batchId) => void removeHistoricalBatch(batchId)}
          />
        )}

        {session && activePanel === "session-actions" && (
          <SessionActionsPanel
            session={session}
            confirming={trashMoveConfirmation}
            onBeginMove={() => setTrashMoveConfirmation(true)}
            onCancelMove={() => setTrashMoveConfirmation(false)}
            onConfirmMove={() => void moveCurrentSessionToTrash()}
          />
        )}

        {session && activePanel === "trash" && (
          <TrashPanel
            entries={trashedSessions}
            permanentDeleteConfirmationId={permanentDeleteConfirmationId}
            onRestore={(trashId) => void restoreTrashedSession(trashId)}
            onBeginPermanentDelete={setPermanentDeleteConfirmationId}
            onCancelPermanentDelete={() => setPermanentDeleteConfirmationId(null)}
            onConfirmPermanentDelete={(trashId) => void permanentlyDeleteTrashedSession(trashId)}
          />
        )}

        {session && activePanel === "preopen" && (
        <section className="entry-card preopen-card">
          <div className="section-heading">
            <div>
              <h2>Overnight update</h2>
              <p className="eyebrow">Pre-open · ON forming</p>
            </div>
            <span className="status-dot">Provisional</span>
          </div>
          <PreOpenForm
            key={`${session.id}:${session.updatedAt}:preopen`}
            session={session}
            onSave={(update, localTime) =>
              void savePreOpen(update, localTime)
            }
          />
        </section>
        )}

      {session && activePanel === "settings" && (
        <section className="settings-page" aria-label="Settings">
          <h2>Settings</h2>
          <section className="entry-card settings-card settings-journal" aria-labelledby="settings-journal-heading">
          <header className="settings-section-heading"><h3 id="settings-journal-heading">Journal</h3><span>{session.instrument}</span></header>
          <p className="settings-section-intro">Your session, instrument and study material.</p>
          <div className="settings-field-group">
          <label>
            <span>Time zone</span>
            <select
              aria-label="Display timezone"
              value={session.displayTimeZone}
              onChange={(event) => void changeDisplayTimeZone(
                event.currentTarget.value as SupportedDisplayTimeZone,
              )}
            >
              {(TIME_ZONES.some((zone) => zone.id === session.displayTimeZone) ? TIME_ZONES : [...TIME_ZONES, { id: session.displayTimeZone, label: session.displayTimeZone }]).map((zone) => (
                <option key={zone.id} value={zone.id}>{zone.label}</option>
              ))}
            </select>
          </label>
          <p className="stage-helper">Display times for this day. Saved moments stay the same.</p>
          </div>
          {session.market.requiresContract && <ContractSettings key={`${session.id}:${session.contract}`} session={session}
            useForNewDays={session.rthDate >= resolveLaunchRthDate(Temporal.Now.instant())} onSave={saveContract} />}
          <div className="settings-action-list">
            <button type="button" className="settings-row-action settings-packs-button" aria-label="Study packs" onClick={() => setActivePanel('historical-library-manage')}>
              <span><strong>Study packs</strong><small>Add or manage learning history</small></span><span aria-hidden="true">→</span>
            </button>
            <button type="button" className="settings-row-action" aria-label="Add instrument" onClick={() => setActivePanel("instrument-setup")}>
              <span><strong>Add instrument</strong><small>A separate journal with its own hours</small></span><span aria-hidden="true">→</span>
            </button>
            <details className="review-tools settings-manage"><summary>Manage journal</summary>
              <div className="settings-manage-actions">
                <button type="button" onClick={() => void openTrashPanel()}>Trash · {trashedSessions.length}</button>
                <button type="button" onClick={() => { setTrashMoveConfirmation(false); setActivePanel('session-actions'); }}>Manage {session.rthDate}</button>
              </div>
            </details>
          </div>
          </section>
          <section className="entry-card settings-card settings-app" aria-labelledby="settings-app-heading">
            <header className="settings-section-heading"><h3 id="settings-app-heading">App</h3><span>This device</span></header>
            <p className="settings-section-intro">Help, backups and storage.</p>
            <StartHere />
            <details className="proof-panel">
              <summary>Backups &amp; storage</summary>
              <div className="proof-content">
                <p className="stage-helper">Includes every instrument journal on this device.</p>
                <div className="proof-actions settings-backup-actions">
                  <button type="button" aria-label="Export SQLite" onClick={() => void exportDatabase()}><strong>Export SQLite</strong><small>Restorable backup</small></button>
                  <button type="button" aria-label="Export JSON" onClick={() => void exportJson()}><strong>Export JSON</strong><small>Readable copy</small></button>
                </div>
                <label className="file-action settings-restore-action">
                  <span>Restore SQLite</span>
                  <input
                    type="file"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) void restoreDatabase(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <p className="stage-helper settings-restore-note">Restoring replaces all journals with the saved copy.</p>
                <details className="settings-storage-details">
                  <summary>Storage details</summary>
                  <dl className="proof-facts">
                    <div><dt>Engine</dt><dd>{storageStatus?.engine ?? "Opening…"}</dd></div>
                    <div><dt>SQLite</dt><dd>{storageStatus?.sqliteVersion ?? "—"}</dd></div>
                    <div><dt>Schema</dt><dd>{storageStatus?.schemaVersion ?? "—"}</dd></div>
                    <div><dt>Persistence</dt><dd>{persistence}</dd></div>
                    <div><dt>Offline shell</dt><dd>{offlineReady ? "ready" : "installing"}</dd></div>
                    <div><dt>Migration</dt><dd>{migrationProof === null ? "not run" : migrationProof ? "passed" : "failed"}</dd></div>
                  </dl>
                  <div className="proof-actions">
                    <button type="button" onClick={() => void requestPersistence()}>Request durable storage</button>
                    <button type="button" onClick={() => void runMigrationProof()}>Run migration proof</button>
                  </div>
                </details>
              </div>
            </details>
            <AppBuildLabel />
            <SupportReport screen="Settings" timeZone={session.displayTimeZone} />
          </section>
        </section>
      )}


        {session && <ContextWorkspace key={session.id} session={session} batches={contextBatches} active={activePanel === "context"}
          onAdd={kind => kind === 'holiday' ? openRecord('event', 'context', true) : openRecord(kind, "context")}
          onUseEvents={useContextPackEvents}
          schedule={<ScheduledEventsPanel key={session.id} session={session} onAdd={addScheduledEvents} onResults={saveNewsResults} />}
          savedEvents={<MarketContextList session={session} undoAvailable={marketContextUndoHistoryId !== null}
            onResult={async(id,result)=>{try{await saveNewsResults([],{id,result});return null;}catch(e){return e instanceof Error?e.message:'Could not save result.';}}}
            onLinkMove={id=>setEventMoveEditor({sessionId:session.id,eventId:id})}
            onEdit={(id) => { setEntryOrigin("context"); setEditingMarketContextId(id); setActivePanel("event"); }}
            onRemove={(id) => void removeMarketContext(id)} onUndo={() => void undoMarketContextChange()} />}
        />}

        {session && activePanel === "event" && (
          <section className="entry-card context-capture-card">
            <MarketContextForm
              key={`${session.id}:${editingMarketContextId ?? "new"}:${session.updatedAt}`}
              session={session}
              initialHoliday={addingHoliday}
              item={editingMarketContextId ? session.marketContextItems.find(item => item.id === editingMarketContextId) ?? null : null}
              onCancel={() => {
                setEditingMarketContextId(null);
                setActivePanel(entryOrigin === "context" ? "context" : "dashboard");
              }}
              onSave={(update, localTime) => saveMarketContext(update, localTime, editingMarketContextId)}
            />
          </section>
        )}

        {session && activePanel === "notes" && (
          <SessionNotesEntry session={session} phase={sessionNotePhase} onPhaseChange={setSessionNotePhase}
            notes={sessionNotesForPhase(session, sessionNotePhase)} significantLevels={nearbySignificantLevels}
            onCancel={() => setActivePanel(entryOrigin === "context" ? "context" : "dashboard")}
            onSave={(text, localTime, link) => saveSessionNote(sessionNotePhase, text, localTime, link)}
            onCorrect={(noteId, text, localTime, link) => void correctSessionNote(noteId, text, localTime, link)}
            onRemove={(noteId) => void removeSessionNote(noteId)} />
        )}

        {session && activePanel === "levels" && (
          <section className="entry-card shared-entry-card level-entry-card">
              {significantLevelOpen ? (
                <SignificantLevelForm
                  key={`${session.id}:${editingSignificantLevelId ?? "new"}`}
                  session={session}
                  level={editingSignificantLevelId
                    ? significantLevels.find(
                        (level) => level.id === editingSignificantLevelId,
                      ) ?? null
                    : null}
                  onCancel={() => {
                    setEditingSignificantLevelId(null);
                    setSignificantLevelOpen(false);
                    setActivePanel(entryOrigin);
                  }}
                  onSave={(update, originAt) =>
                    saveSignificantLevel(
                      update,
                      originAt,
                      editingSignificantLevelId,
                    )
                  }
                />
              ) : (
                <button
                  className="add-context-button"
                  type="button"
                  onClick={() => {
                    setEditingSignificantLevelId(null);
                    setSignificantLevelOpen(true);
                  }}
                >
                  Add Level
                </button>
              )}
          </section>
        )}

        {session && activePanel === "overnight" && (
          <FocusedStageCard className="overnight-card"
            time={formatCheckpointTime(
              session.rthDate,
              ES_TEMPLATE.checkpoints.overnightLock,
              session.displayTimeZone as SupportedDisplayTimeZone,
            )}
            title="Overnight complete"
            status={session.overnight.status === "confirmed" ? "Confirmed" : "Pending"}
          >
              <button className="text-action" type="button" onClick={() => setActivePanel("preopen")}>Forming ON updates</button>
              <OvernightForm
                key={`${session.id}:${session.updatedAt}:overnight`}
                session={session}
                onSave={(update) => void saveOvernight(update)}
              />
              {overnightGeometry && (
                <dl className="geometry-grid compact-geometry">
                  <div><dt>ON width</dt><dd>{formatPriceNumber(overnightGeometry.width)}</dd></div>
                  <div><dt>Midpoint</dt><dd>{formatPriceNumber(overnightGeometry.midpoint, 3)}</dd></div>
                  <div>
                    <dt>RTH open</dt>
                    <dd>{formatPrice(session.overnight.rthOpen)}</dd>
                  </div>
                </dl>
              )}
          </FocusedStageCard>
        )}

        {session && activePanel === "a-period" && <>
          <APeriodWorkspace key={`${session.id}:${session.updatedAt}:a`} session={session} onSave={saveAEntry} onConfirm15R={confirm15R} />
          {(aGeometry || deriveRange(session.fifteenMinute)) && <details className="formation-relations">
            <summary>Formation details</summary>
            <FifteenMinuteRelations session={session} />
            <APeriodRelations session={session} aPeriod={effectiveAPeriod ?? session.aPeriod} />
          </details>}
        </>}

        {session && activePanel === "b-snapshot" && (
          <FocusedStageCard
            time={formatCheckpointTime(
              session.rthDate,
              ES_TEMPLATE.checkpoints.bSnapshot,
              session.displayTimeZone as SupportedDisplayTimeZone,
            )}
            title="Developing B snapshot"
            status={session.bSnapshots.length > 0 ? "Recorded" : "Optional"}
          >
              <BSnapshotForm
                key={`${session.id}:${session.updatedAt}:b-snapshot`}
                snapshot={session.bSnapshots.at(-1) ?? null}
                inheritedRange={effectiveAPeriod ?? session.aPeriod}
                onSave={(update) => void saveBSnapshot(update)}
              />
          </FocusedStageCard>
        )}

        {session && activePanel === "b-period" && (
          <FocusedStageCard
            time={formatCheckpointTime(
              session.rthDate,
              ES_TEMPLATE.checkpoints.ibLock,
              session.displayTimeZone as SupportedDisplayTimeZone,
            )}
            title={ibLockIsReached ? "Completed B · Final IB" : "B forming · Final IB at lock"}
            status={finalIb
              ? "Confirmed"
              : ibLockIsReached ? "Pending confirmation" : "Forming"}
          >
              <button className="text-action" type="button" onClick={() => setActivePanel("b-snapshot")}>Add {formatCheckpointTime(session.rthDate, ES_TEMPLATE.checkpoints.bSnapshot, session.displayTimeZone as SupportedDisplayTimeZone)} snapshot</button>
              <RangeForm
                key={`${session.id}:${session.updatedAt}:b`}
                checkpoint={effectiveBPeriod ?? session.bPeriod}
                highLabel="B high"
                lowLabel="B low"
                noteLabel="B-period commentary"
                checkpointName="B period"
                onSave={(update) => void saveBPeriod(update)}
              />
              <BPeriodRelations
                session={session}
                aPeriod={effectiveAPeriod ?? session.aPeriod}
                bPeriod={effectiveBPeriod ?? session.bPeriod}
                finalIb={finalIb}
                finalIbGeometry={finalIbGeometry}
              />
          </FocusedStageCard>
        )}

        {session && activePanel === "rth" && <section className="quick-price-card" aria-label="Record price">
          <h2>Record price</h2>
          <RthObservationForm key={`${session.id}:price`} session={session} onSaveObservation={savePrice} />
          <nav className="record-tabs" aria-label="Record">
            {recordChoices.filter(choice => choice.panel !== "rth").map(choice => <button key={choice.panel} type="button" onClick={() => openRecord(choice.panel)}>{choice.label}</button>)}
          </nav>
        </section>}

        {session && activePanel === "rth-period" && (
          <FocusedStageCard
            time={`${formatCheckpointTime(
              session.rthDate,
              ES_TEMPLATE.checkpoints.ibLock,
              session.displayTimeZone as SupportedDisplayTimeZone,
            )}–${formatCheckpointTime(
              session.rthDate,
              ES_TEMPLATE.checkpoints.studyClose,
              session.displayTimeZone as SupportedDisplayTimeZone,
            )}`}
            title="RTH"
            status={
              session.rthObservations.length + sessionNotesForPhase(session, "RTH").length === 0
                ? "Ready"
                : `${session.rthObservations.length + sessionNotesForPhase(session, "RTH").length} recorded`
            }
          >
              <RthRangeForm key={`${session.id}:${session.updatedAt}`} session={session} onSave={saveRthRange}/>
              {activePanel === "rth-period" && <button className="close-day-action" type="button" onClick={() => setActivePanel("close")}>
                {session.close.finishedAt ? "Review close" : "Close & finish day"}
              </button>}
              <p className="stage-helper">On Today, select RTH and press Record price. Each observation updates your recorded path.</p>
          </FocusedStageCard>
        )}

        {session && activePanel === "close" && (
          <>
          <FocusedStageCard
            time={formatCheckpointTime(
              session.rthDate,
              ES_TEMPLATE.checkpoints.studyClose,
              session.displayTimeZone as SupportedDisplayTimeZone,
            )}
            title="Close and review"
            status={
              session.close.finishedAt
                ? closingOutcome?.status === "final"
                  ? "Final"
                  : "Provisional"
                : session.close.price === null
                  ? "Pending"
                  : "Review"
            }
          >
              <CloseReviewForm
                key={`${session.id}:${session.close.recordedAt ?? "empty"}`}
                session={session}
                closingOutcome={closingOutcome}
                onFinish={saveAndFinishDay}
              />
          </FocusedStageCard>
          {session.close.finishedAt && (
          <ForecastCard session={session} levels={significantLevels} sessions={trackingSessions ?? []}
            historical={historicalSessions} batches={historicalBatches} news={contextBatches} lowBatches={fbdBatches} repository={repositoryRef.current} />
          )}
          {session.close.finishedAt && (
          <DailyRecap
            session={session}
            finalIb={finalIb}
            closingOutcome={closingOutcome}
            rthStates={recapRthStates}
            significantLevels={visibleSignificantLevels}
            significantLevelInteractions={significantLevelInteractions}
          />
          )}
          </>
        )}
      </div>

      </AppErrorBoundary>
      {session && <nav className="main-navigation" aria-label="Main navigation">
        {([{ panel: "dashboard", label: "Today" }, { panel: "level-library", label: "Levels" }, { panel: "review-menu", label: "Review" }] as const).map((item) =>
          <button key={item.panel} type="button" disabled={workspacePreview&&(workspaceDateLoading||workspaceDateError)&&item.panel!=='dashboard'} aria-current={mainDestination === item.panel ? "page" : undefined}
            onClick={() => { if(workspacePreview){if(item.panel==="dashboard")closeWorkspace();else openWorkspace(item.panel,item.panel==="level-library"?"levels":"review");return;} setEntryOrigin("dashboard"); if (item.panel === "level-library") { setFbdHistoryPackId(undefined); setFocusedLevelId(undefined); setMonthlyLevelFilter(undefined); } if (item.panel === "review-menu") resumeReview(); else {setReturnToReview(false);setActivePanel(item.panel);} }}>{item.label}</button>)}
      </nav>}

      <footer>
        {workspacePreview?'Structure journal only · No trade recommendations.':'Structure journal only. No trade recommendations or alerts.'}
      </footer>
      {session&&eventMoveSource&&eventMoveItem&&<EventMoveSheet key={`${eventMoveSource.id}:${eventMoveItem.id}`}
        source={eventMoveSource} item={eventMoveItem} current={session} levels={visibleSignificantLevels}
        sessions={trackingSessions??[session]} onSave={saveEventMove} onClose={()=>setEventMoveEditor(null)}/>}
    </main></EventMoveContext.Provider></LevelSupersessionContext.Provider></LevelQualityContext.Provider>
    </OvernightStudyProvider>
    </SessionPhaseMemory.Provider>
    </ReviewScrollContext.Provider>
    </JournalContext.Provider>
  );
}

function RthObservationForm({
  session,
  onSaveObservation,
}: {
  session: JournalSession;
  onSaveObservation: (update: RthObservationUpdate, manualLocalTime: string | null) => Promise<string | null>;
}) {
  const [price, setPrice] = useState("");
  const currentLocalTime = useCurrentTimeInZone(session.displayTimeZone);
  const [manualLocalTime, setManualLocalTime] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const displayedLocalTime = manualLocalTime ?? currentLocalTime;

  return (
    <form className="quick-price-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsedPrice = parsePrice(price);
        if (parsedPrice === null) {
          setValidationMessage("Enter a valid observed price.");
          return;
        }
        if (saving) return;
        setSaving(true);
        setValidationMessage(await onSaveObservation({ price: parsedPrice, note }, manualLocalTime));
        setSaving(false);
      }}
    >
      <div className="quick-price-row">
        <label className="rth-price-field">
          <span>Observed price</span>
          <input
            autoFocus
            enterKeyHint="done"
            autoComplete="off"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
      <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save price"}</button>
      </div>
        <label className="rth-price-field context-picker-field">
          <span>Observation time · {sessionTimeZoneLabel(session)}</span>
          <span className="context-picker-readout">
            <strong>{formatClockTime(displayedLocalTime)}</strong>
            <em>{manualLocalTime === null ? "Auto · Change" : "Manual · Change"}</em>
          </span>
          <input
            className="native-picker-overlay"
            aria-label="Change recording time"
            type="time"
            required
            value={displayedLocalTime}
            onChange={(event) => setManualLocalTime(event.target.value)}
          />
        </label>
      <details className="optional-note">
        <summary>Add a note</summary>
        <label>
          <span>Observation note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </details>
      {validationMessage && <p className="form-validation" role="alert">{validationMessage}</p>}
    </form>
  );
}

function SessionNotesEntry({ session, phase, notes, significantLevels, onPhaseChange, onSave, onCancel, onCorrect, onRemove }: {
  session: JournalSession; phase: SessionNotePhase; notes: SessionNote[]; significantLevels: SignificantLevel[];
  onPhaseChange: (phase: SessionNotePhase) => void;
  onSave: (text: string, localTime: string | null, link: SessionNoteLink | null) => Promise<string | null>;
  onCancel: () => void;
  onCorrect: (noteId: string, text: string, localTime: string, link: SessionNoteLink | null) => void;
  onRemove: (noteId: string) => void;
}) {
  return <section className="entry-card context-capture-card note-entry-card">
    <SessionNoteForm key={`${session.id}:${session.updatedAt}:note`} session={session} phase={phase}
      significantLevels={significantLevels} onPhaseChange={onPhaseChange} onSave={onSave} onCancel={onCancel} />
    {notes.length > 0 && <details className="capture-saved-notes"><summary>Saved {phase} notes · {notes.length}</summary>
      <SessionNoteList session={session} notes={notes} significantLevels={significantLevels} onCorrect={onCorrect} onRemove={onRemove} />
    </details>}
  </section>;
}

function SessionNoteForm({ session, phase, significantLevels, onPhaseChange, onSave, onCancel }: {
  session: JournalSession; phase: SessionNotePhase; significantLevels: SignificantLevel[];
  onPhaseChange: (phase: SessionNotePhase) => void;
  onSave: (text: string, localTime: string | null, link: SessionNoteLink | null) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const currentLocalTime = useCurrentTimeInZone(session.displayTimeZone);
  const [manualLocalTime, setManualLocalTime] = useState<string | null>(null);
  const [selectedLinkValue, setSelectedLinkValue] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const displayedLocalTime = manualLocalTime ?? currentLocalTime;
  const linkOptions = sessionNoteLinkOptions(session, phase, significantLevels);

  return <form className="session-note-form context-capture-form" aria-label="Add note" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    if (!text.trim()) { setError("Write a note first."); return; }
    const link = linkOptions.find(option => option.value === selectedLinkValue)?.link ?? null;
    setBusy(true); setError(null);
    try { setError(await onSave(text, manualLocalTime, link)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }}>
    <header className="capture-form-heading"><h2>Add note</h2><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></header>
    <label><span>Note</span><textarea rows={3} required value={text} placeholder="What are you noticing?" onChange={event => setText(event.target.value)} /></label>
    <div className="capture-field-row">
      <label>Period<select aria-label="Note period" value={phase} onChange={event => {
        setSelectedLinkValue(""); setError(null); onPhaseChange(event.target.value as SessionNotePhase);
      }}><option value="ON">Overnight</option><option value="IB">IB</option><option value="RTH">RTH</option></select></label>
      <label className="context-picker-field"><span>Time · {sessionTimeZoneLabel(session)}</span>
        <span className="context-picker-readout" aria-hidden="true">{formatClockTime(displayedLocalTime)}</span>
        <input className="native-picker-overlay" aria-label={`Change ${phase} note time`} type="time" required value={displayedLocalTime}
          onChange={event => setManualLocalTime(event.target.value)} />
      </label>
    </div>
    <details className="capture-optional"><summary>Attach to an entry <small>optional</small></summary>
      <label>Related entry<select aria-label={`Attach ${phase} note to`} value={selectedLinkValue} onChange={event => setSelectedLinkValue(event.target.value)}>
        <option value="">No attachment</option>
        {linkOptions.map(option => <option key={option.value} value={option.value}>{option.link.label}</option>)}
      </select></label>
    </details>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : "Save note"}</button>
  </form>;
}

function SessionNoteList({
  session,
  notes,
  significantLevels,
  onCorrect,
  onRemove,
}: {
  session: JournalSession;
  notes: SessionNote[];
  significantLevels: SignificantLevel[];
  onCorrect: (
    noteId: string,
    text: string,
    localTime: string,
    link: SessionNoteLink | null,
  ) => void;
  onRemove: (noteId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (notes.length === 0) return <p className="stage-helper">No notes recorded in this phase.</p>;

  return (
    <ol className="observation-list" aria-label={`${notes[0].phase} notes`}>
      {notes.map((note) => {
        const localTime = formatObservationTime(note.observedAt, session.displayTimeZone);
        const selected = selectedId === note.id;
        return (
          <li className="rth-note-row" key={note.id}>
            <button
              className="observation-row-button"
              type="button"
              aria-expanded={selected}
              aria-label={`Review ${note.phase} note at ${formatClockTime(localTime)}`}
              onClick={() => setSelectedId(selected ? null : note.id)}
            >
              <span className="observation-row-heading">
                <time dateTime={note.observedAt}>{formatClockTime(localTime)}</time>
                <strong>Note</strong>
              </span>
              <p>{note.text}</p>
              {note.link && <small>Attached to {note.link.label}</small>}
            </button>
            {selected && (
              <SessionNoteCorrectionForm
                key={`${note.id}:${session.updatedAt}`}
                note={note}
                localTime={localTime}
                linkOptions={sessionNoteLinkOptions(session, note.phase, significantLevels)}
                onCancel={() => setSelectedId(null)}
                onCorrect={(text, correctedLocalTime, link) => {
                  setSelectedId(null);
                  onCorrect(note.id, text, correctedLocalTime, link);
                }}
                onRemove={() => {
                  setSelectedId(null);
                  onRemove(note.id);
                }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RthRangeForm({session,onSave}:{session:JournalSession;onSave:(high:number,low:number)=>Promise<string|null>}) {
  const range=deriveRecordedRthRange(session);
  const [high,setHigh]=useState(range.high===null?'':formatPriceNumber(range.high));
  const [low,setLow]=useState(range.low===null?'':formatPriceNumber(range.low));
  const [error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(false);
  return <div className="rth-running-range" role="group" aria-label="Running RTH range">
    <dl className="rth-range-readout"><div><dt>RTH high</dt><dd>{range.high===null?'—':formatPriceNumber(range.high)}</dd></div>
      <div><dt>RTH low</dt><dd>{range.low===null?'—':formatPriceNumber(range.low)}</dd></div></dl>
    <p className="stage-helper">Includes the IB. Price entries extend this range.</p>
    {!session.close.finishedAt&&<details className="optional-note" open={editing} onToggle={e=>setEditing(e.currentTarget.open)}><summary>Correct range</summary>
      <form noValidate onSubmit={async e=>{
        e.preventDefault();if(saving)return;
        const h=parsePrice(high),l=parsePrice(low);
        if(h===null||l===null){setError('Enter both RTH prices.');return;}
        setSaving(true);const result=await onSave(h,l);setError(result);setSaving(false);
        if(!result)setEditing(false);
      }}>
        <div className="close-extrema-grid"><label><span>RTH high</span><input inputMode="decimal" value={high} onChange={e=>setHigh(e.target.value)}/></label>
          <label><span>RTH low</span><input inputMode="decimal" value={low} onChange={e=>setLow(e.target.value)}/></label></div>
        {error&&<p role="alert">{error}</p>}
        <button type="submit" className="primary-button" disabled={saving}>{saving?'Saving…':'Save range'}</button>
        <p className="stage-helper">Saves the range and keeps today open.</p>
      </form>
    </details>}
  </div>;
}

function CloseReviewForm({
  session,
  closingOutcome,
  onFinish
}: {
  session: JournalSession;
  closingOutcome: ReturnType<typeof deriveClosingOutcome>;
  onFinish: (rthHigh: number, rthLow: number, price: number, note: string, pathComplete: boolean) => Promise<string | null>;
}) {
  const { template: ES_TEMPLATE, formatCheckpointTime } = useJournalClock();
  const range = deriveRecordedRthRange(session);
  const [rthHigh, setRthHigh] = useState(range.high === null ? "" : formatPriceNumber(range.high));
  const [rthLow, setRthLow] = useState(range.low === null ? "" : formatPriceNumber(range.low));
  const [price, setPrice] = useState(
    session.close.price === null ? "" : formatPriceNumber(session.close.price),
  );
  const [note, setNote] = useState(session.close.note ?? "");
  const [pathComplete, setPathComplete] = useState(session.close.pathComplete);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const closeDisposition =
    closingOutcome?.closeDisposition === "ABOVE_IBH"
      ? "Above IBH"
      : closingOutcome?.closeDisposition === "BELOW_IBL"
        ? "Below IBL"
        : closingOutcome?.closeDisposition === "INSIDE_OR_ON_IB"
          ? "Inside or on IB"
          : "Pending";

  return (
    <div className="close-review">
      <form noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const parsedHigh = parsePrice(rthHigh);
          const parsedLow = parsePrice(rthLow);
          const parsedPrice = parsePrice(price);
          if (parsedHigh === null || parsedLow === null || parsedPrice === null) {
            setError("Enter a valid RTH high, low, and close. Use numbers without commas.");
            return;
          }
          if (saving) return;
          setSaving(true);
          setError(await onFinish(parsedHigh, parsedLow, parsedPrice, note, pathComplete));
          setSaving(false);
        }}
      >
        <div className="period-form-heading"><h3>RTH close</h3>
          <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save & finish day"}</button></div>
        {error && <p className="form-validation" role="alert">{error}</p>}
        <p className="stage-helper">
          Confirm the final RTH extremes and close. Recorded observations are
          prefilled when available and remain editable.
        </p>
        <div className="close-extrema-grid">
          <label>
            <span>RTH high</span>
            <input
              inputMode="decimal"
              required
              value={rthHigh}
              onChange={(event) => setRthHigh(event.target.value)}
            />
          </label>
          <label>
            <span>RTH low</span>
            <input
              inputMode="decimal"
              required
              value={rthLow}
              onChange={(event) => setRthLow(event.target.value)}
            />
          </label>
          <label>
            <span>RTH close</span>
            <input
              inputMode="decimal"
              required
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
        </div>
        <div className="close-entry-row close-time-row">
          <div className="fixed-time-readout">
            <span>Recorded at</span>
            <strong>
              {formatCheckpointTime(
                session.rthDate,
                ES_TEMPLATE.checkpoints.studyClose,
                session.displayTimeZone as SupportedDisplayTimeZone,
              )}
            </strong>
          </div>
        </div>
        <details className="optional-note">
          <summary>Add a close note</summary>
          <label>
            <span>Close commentary</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </details>
          <label className="path-complete-control">
            <input
              type="checkbox"
              checked={pathComplete}
              onChange={(event) => setPathComplete(event.target.checked)}
            />
            <span>
              <strong>Path complete</strong>
              <small>All known IB breaks and returns are recorded through the close.</small>
            </span>
          </label>

        <p className="stage-helper">Leave unchecked to finish provisionally and complete the path later.</p>
      </form>

      {session.close.price !== null && (
        <section className="closing-outcome" aria-label="Recorded closing outcome">
          <div className="closing-outcome-heading">
            <div>
              <span>Recorded outcome</span>
              <strong>{closingOutcome?.dayType ?? "Not established"}</strong>
            </div>
            <em>{closingOutcome?.status ?? "provisional"}</em>
          </div>

          {closingOutcome ? (
            <dl className="closing-facts">
              <div><dt>Close location</dt><dd>{closeDisposition}</dd></div>
              <div><dt>Break code</dt><dd>{closingOutcome.breakCode ?? "Pending"}</dd></div>
              <div>
                <dt>IBH break</dt>
                <dd>{closingOutcome.highBreakRecorded ? "Recorded" : "Not recorded"}</dd>
              </div>
              <div>
                <dt>IBL break</dt>
                <dd>{closingOutcome.lowBreakRecorded ? "Recorded" : "Not recorded"}</dd>
              </div>
              <div>
                <dt>Outside close</dt>
                <dd>
                  {closingOutcome.outsideCloseDistance === null
                    ? "—"
                    : `${formatPriceNumber(closingOutcome.outsideCloseDistance)} pts`}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="outcome-pending">
              Final IB is still pending, so the closing classification is unavailable.
            </p>
          )}

        </section>
      )}
    </div>
  );
}

function DailyRecap({
  session,
  finalIb,
  closingOutcome,
  rthStates,
  significantLevels,
  significantLevelInteractions
}: {
  session: JournalSession;
  finalIb: ReturnType<typeof deriveFinalIb>;
  closingOutcome: ReturnType<typeof deriveClosingOutcome>;
  rthStates: ReturnType<typeof deriveRthObservationStates>;
  significantLevels: SignificantLevel[];
  significantLevelInteractions: ReturnType<typeof deriveSignificantLevelInteractions>;
}) {
  const formationRanges = [
    {
      label: "Overnight",
      high: session.overnight.high,
      low: session.overnight.low,
      status: session.overnight.status
    },
    {
      label: "15R",
      high: session.fifteenMinute.high,
      low: session.fifteenMinute.low,
      status: session.fifteenMinute.status
    },
    {
      label: "A period",
      high: session.aPeriod.high,
      low: session.aPeriod.low,
      status: session.aPeriod.status
    },
    {
      label: "B period",
      high: session.bPeriod.high,
      low: session.bPeriod.low,
      status: session.bPeriod.status
    },
    {
      label: "Final IB",
      high: finalIb?.high ?? null,
      low: finalIb?.low ?? null,
      status: finalIb ? "confirmed" : "pending"
    }
  ].map((item) => ({
    ...item,
    geometry: deriveRange({ high: item.high, low: item.low, cp: null })
  }));

  const missing = sessionMissingItems(session, finalIb);

  const commentary = sessionCommentaryItems(session).map((item) => ({
    label: item.label,
    note: item.text,
  }));

  const closeLocation =
    closingOutcome?.closeDisposition === "ABOVE_IBH"
      ? "close above IBH"
      : closingOutcome?.closeDisposition === "BELOW_IBL"
        ? "close below IBL"
        : closingOutcome?.closeDisposition === "INSIDE_OR_ON_IB"
          ? "close inside or on IB"
          : "close classification pending";
  const headline = closingOutcome?.dayType
    ? `${closingOutcome.dayType} · ${closeLocation} · ${closingOutcome.breakCode ?? "code pending"}`
    : `Outcome not established · ${closeLocation}`;

  return (
    <section className="recap-card" aria-labelledby="daily-recap-heading">
      <div className="recap-heading">
        <div>
          <p className="eyebrow">{session.rthDate} · {closingOutcome?.status ?? "provisional"}</p>
          <h2 id="daily-recap-heading">Daily recap</h2>
          <p>{headline}</p>
        </div>
        <span className="status-dot">
          {closingOutcome?.status === "final" ? "Final" : "Provisional"}
        </span>
      </div>

      <ContextRecap session={session} />

      <section className="recap-section">
        <h3>Formation ranges</h3>
        <dl className="recap-ranges">
          {formationRanges.map((range) => (
            <div key={range.label}>
              <dt>{range.label}</dt>
              <dd>
                <strong>{formatPrice(range.low)}–{formatPrice(range.high)}</strong>
                <span>
                  {range.geometry
                    ? `Width ${formatPriceNumber(range.geometry.width)} · Mid ${formatPriceNumber(range.geometry.midpoint, 3)}`
                    : range.status === "confirmed"
                      ? "Geometry unavailable"
                      : "Pending"}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="recap-section">
        <h3>Breaks and returns</h3>
        {rthStates.length === 0 ? (
          <p className="recap-empty">No post-lock observations were supplied.</p>
        ) : (
          <ol className="recap-path">
            {rthStates.map((state) => (
              <li key={state.observation.id}>
                <time dateTime={state.observation.observedAt}>
                  {formatClockTime(formatObservationTime(
                    state.observation.observedAt,
                    session.displayTimeZone,
                  ))}
                </time>
                <div>
                  <strong>
                    {formatPriceNumber(state.observation.price)}
                    {state.observation.id === "session-close" ? " · Close" : ""}
                  </strong>
                  <span>{relationshipLabel(state.relationship)}</span>
                  {state.transitions.map((transition) => (
                    <em key={transition}>{transitionLabel(transition)}</em>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="recap-section">
        <h3>Final outcome and close</h3>
        <dl className="recap-outcome">
          <div><dt>RTH high</dt><dd>{formatPrice(session.close.rthHigh)}</dd></div>
          <div><dt>RTH low</dt><dd>{formatPrice(session.close.rthLow)}</dd></div>
          <div><dt>Close</dt><dd>{formatPrice(session.close.price)}</dd></div>
          <div><dt>Day type</dt><dd>{closingOutcome?.dayType ?? "Not established"}</dd></div>
          <div><dt>Location</dt><dd>{closeLocation.replace("close ", "")}</dd></div>
          <div><dt>Break code</dt><dd>{closingOutcome?.breakCode ?? "Pending"}</dd></div>
        </dl>
      </section>

      {significantLevelInteractions.length > 0 && (
        <section className="recap-section">
          <h3>Significant Level interactions</h3>
          <ul className="recap-missing">
            {significantLevelInteractions.map((interaction) => {
              const level = significantLevels.find(
                (candidate) => candidate.id === interaction.levelId,
              );
              return (
                <li key={interaction.id}>
                  {significantLevelName(level)} · {significantLevelInteractionLabel(interaction)}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {missing.length > 0 && (
        <section className="recap-section">
          <h3>Missing information</h3>
          <ul className="recap-missing">
            {missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>
      )}

      {commentary.length > 0 && (
        <section className="recap-section">
          <h3>Commentary</h3>
          <ul className="recap-commentary">
            {commentary.map((item, index) => (
              <li key={`${item.label}:${index}`}>
                <strong>{item.label}</strong>
                <span>{item.note}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

async function copyShareText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy was unavailable in this browser.");
}

type ShareFormat = "short" | "full" | "image";
type ShareStatus = "ready" | "copied" | "shared" | "downloaded" | "cancelled" | "error";
type ShareOptionalItem = {
  id: string;
  label: string;
  line: string;
  kind: "commentary" | "level";
  levelOption?: ShareLevelOption;
};

type SessionCommentaryItem = {
  id: string;
  label: string;
  text: string;
  sortAt: string;
};

function sessionCommentaryItems(session: JournalSession,showTimes=true): SessionCommentaryItem[] {
  const { template: ES_TEMPLATE, checkpointInstant } = journalClock(session.market);
  const items: SessionCommentaryItem[] = [];
  const add = (
    id: string,
    label: string,
    text: string | null,
    sortAt: string,
  ) => {
    if (!text?.trim()) return;
    items.push({ id, label, text: text.trim(), sortAt });
  };
  const checkpoint = (localTime: string) =>
    checkpointInstant(session.rthDate, localTime).toString();
  const latestPreOpen = latestPreOpenSnapshot(session);

  if (latestPreOpen) {
    add("note:preopen", "Pre-open", latestPreOpen.note, latestPreOpen.recordedAt);
  }
  add(
    "note:15r",
    "15R",
    session.fifteenMinute.note,
    checkpoint(ES_TEMPLATE.checkpoints.fifteenMinuteLock),
  );
  add("note:a", "A period", session.aPeriod.note, checkpoint(ES_TEMPLATE.checkpoints.aLock));
  session.bSnapshots.forEach((snapshot) => add(
    `note:b-snapshot:${snapshot.id}`,
    `B snapshot${showTimes?` ${formatClockTime(formatObservationTime(snapshot.observedAt, session.displayTimeZone))}`:''}`,
    snapshot.note,
    snapshot.observedAt,
  ));
  add("note:b", "B period", session.bPeriod.note, checkpoint(ES_TEMPLATE.checkpoints.ibLock));
  session.rthObservations.forEach((observation) => add(
    `note:rth:${observation.id}`,
    `RTH${showTimes?` ${formatClockTime(formatObservationTime(observation.observedAt, session.displayTimeZone))}`:''}`,
    observation.note,
    observation.observedAt,
  ));
  session.sessionNotes.forEach((note) => add(
    `note:session:${note.id}`,
    `${note.phase}${showTimes?` ${formatClockTime(formatObservationTime(note.observedAt, session.displayTimeZone))}`:''}${
      note.link ? ` · ${note.link.label}` : ""
    }`,
    note.text,
    note.observedAt,
  ));
  add(
    "note:close",
    "Close",
    session.close.note,
    session.close.observedAt ?? checkpoint(ES_TEMPLATE.checkpoints.studyClose),
  );
  session.marketContextItems.forEach((item) => add(
    `note:event:${item.id}`,
    `${item.name} note`,
    item.note,
    item.eventAt,
  ));

  return items.sort(
    (left, right) => left.sortAt.localeCompare(right.sortAt) || left.id.localeCompare(right.id),
  );
}

function shareOptionalItems(
  session: JournalSession,
  significantLevels: SignificantLevel[],
  showTimes=true,
): ShareOptionalItem[] {
  const items: ShareOptionalItem[] = sessionCommentaryItems(session,showTimes).map((note) => ({
    id: note.id,
    label: note.label,
    line: `${note.label}: ${note.text}`,
    kind: "commentary" as const,
  }));

  for (const option of buildShareLevelOptions(session, significantLevels)) {
    items.push({id:option.id, label:option.label, line:option.line, kind:'level', levelOption:option});
  }

  return items;
}

function sessionTimelineItems(
  session: JournalSession,
  significantLevels: SignificantLevel[],
): SessionTimelineItem[] {
  const { template: ES_TEMPLATE, checkpointInstant } = journalClock(session.market);
  const items: SessionTimelineItem[] = [];
  const add = (item: SessionTimelineItem) => items.push(item);
  const checkpoint = (localTime: string) =>
    checkpointInstant(session.rthDate, localTime).toString();
  const rangeDetail = (low: number | null, high: number | null, cp: number | null = null) => {
    const range = low === null && high === null
      ? "Range pending"
      : `${formatPrice(low)}–${formatPrice(high)}`;
    return cp === null ? range : `${range} · CP ${formatPrice(cp)}`;
  };
  const latestPreOpen = latestPreOpenSnapshot(session);
  if (latestPreOpen) {
    const preOpenCp = latestPreOpen.cpObservationId
      ? session.cpObservations.find(
          (observation) => observation.id === latestPreOpen.cpObservationId,
        )?.price ?? null
      : null;
    add({
      id: "timeline:forming-on",
      sortAt: latestPreOpen.recordedAt,
      label: "Forming ON",
      phase: 'ON',
      detail: rangeDetail(
        latestPreOpen.formingOvernightLow,
        latestPreOpen.formingOvernightHigh,
        preOpenCp,
      ),
      commentary: latestPreOpen.note,
      attachment: null,
    });
  }
  if (session.overnight.low !== null || session.overnight.high !== null) {
    add({
      id: "timeline:on",
      sortAt: checkpoint(ES_TEMPLATE.checkpoints.overnightLock),
      label: "ON range",
      phase: 'ON',
      detail: rangeDetail(session.overnight.low, session.overnight.high),
      commentary: null,
      attachment: null,
    });
  }
  const addCheckpoint = (
    id: string,
    label: string,
    at: string,
    range: RangeCheckpoint,
  ) => {
    if (range.low === null && range.high === null && range.cp === null && !range.note) return;
    add({
      id,
      sortAt: at,
      label,
      phase: 'IB',
      price: range.cp,
      detail: rangeDetail(range.low, range.high, range.cp),
      commentary: range.note,
      attachment: null,
    });
  };
  addCheckpoint(
    "timeline:15r",
    "15R",
    checkpoint(ES_TEMPLATE.checkpoints.fifteenMinuteLock),
    session.fifteenMinute,
  );
  addCheckpoint(
    "timeline:a",
    "A period",
    checkpoint(ES_TEMPLATE.checkpoints.aLock),
    session.aPeriod,
  );
  session.bSnapshots.forEach((snapshot) => add({
    id: `timeline:b-snapshot:${snapshot.id}`,
    sortAt: snapshot.observedAt,
    label: "B snapshot",
    phase: 'IB',
    price: snapshot.cp,
    detail: rangeDetail(snapshot.low, snapshot.high, snapshot.cp),
    commentary: snapshot.note,
    attachment: null,
  }));
  addCheckpoint(
    "timeline:b",
    "B / Final IB",
    checkpoint(ES_TEMPLATE.checkpoints.ibLock),
    session.bPeriod,
  );
  session.marketContextItems.forEach((item) => add({
    id: `timeline:event:${item.id}`,
    sortAt: item.eventAt,
    label: item.holiday ? "Holiday" : "Event",
    detail: item.holiday ? `${item.name} · ${holidaySummary(item.holiday, session.displayTimeZone)}` : item.name,
    allDay: Boolean(item.holiday),
    commentary: item.note,
    attachment: null,
  }));
  const ownedCpIds = new Set([
    ...session.rthObservations.map((observation) => observation.cpObservationId).filter(Boolean),
    ...significantLevels.map((level) => level.linkedCpObservationId).filter(Boolean),
  ]);
  session.cpObservations
    .filter((observation) =>
      !ownedCpIds.has(observation.id) &&
      ["standalone", "preopen"].includes(observation.source))
    .forEach((observation) => add({
      id: `timeline:cp:${observation.id}`,
      sortAt: observation.observedAt,
      label: "Price",
      price: observation.price,
      tagObservation: true,
      detail: [formatPrice(observation.price), ...priceRangeChanges(session, observation.id).map(change =>
        `${change.period} ${change.edge === 'high' ? 'high' : 'low'} ${change.prior == null ? 'set to' : `moved from ${formatPrice(change.prior)} to`} ${formatPrice(change.price)}`)].join(' · '),
      commentary: null,
      attachment: null,
    }));
  significantLevels.forEach((level) => {
    if (level.linkedCpObservationId) {
      const observation = session.cpObservations.find(
        (candidate) => candidate.id === level.linkedCpObservationId,
      );
      if (observation) {
        add({
          id: `timeline:level-cp:${level.id}`,
          sortAt: observation.observedAt,
          label: "CP at level",
          price: observation.price,
          tagObservation: true,
          detail: `${formatPrice(observation.price)} · ${significantLevelName(level)}`,
          commentary: level.note,
          attachment: null,
        });
      }
    }
    level.episodes
      .filter((episode) => episode.removedAt === null && episode.sessionId === session.id)
      .forEach((episode) => add({
        id: `timeline:level-episode:${episode.id}`,
        sortAt: episode.observedAt,
        label: `${failurePatternLabel(episode.classification)} confirmed`,
        tagObservation: true,
        detail: `${significantLevelName(level)} · ${significantLevelEpisodePhaseLabel(
          episode.phase,
        )}`,
        commentary: episode.note,
        attachment: episode.linkedEvents.length > 0
          ? `Events · ${episode.linkedEvents.map((event) => event.name).join(", ")}`
          : "Significant Level",
      }));
    level.marketEvents
      .filter((marketEvent) =>
        marketEvent.removedAt === null && marketEvent.sessionId === session.id)
      .forEach((marketEvent) => add({
        id: `timeline:level-market-event:${marketEvent.id}`,
        sortAt: marketEvent.observedAt,
        label: significantLevelMarketEventLabel(level, marketEvent.kind),
        tagObservation: true,
        detail: `${significantLevelName(level)}${
          marketEvent.observedPrice === null
            ? ""
            : ` · ${formatPrice(marketEvent.observedPrice)}`
        } · ${significantLevelEpisodePhaseLabel(marketEvent.phase)}`,
        commentary: marketEvent.note,
        attachment: marketEvent.linkedEvents.length > 0
          ? `Events · ${marketEvent.linkedEvents.map((event) => event.name).join(", ")}`
          : "Significant Level",
      }));
  });
  const recordedIb=deriveSessionRecordedIb(session);
  deriveRthObservationStates(session.rthObservations,recordedIb,session.market.tickSize).forEach((state) => {
    const observation=state.observation,first=state.previousObservedAt===null;
    const high=state.transitions.includes('IBH_BREAK_RECORDED')||(first&&state.relationship==='ABOVE_IBH_BREAK');
    const low=state.transitions.includes('IBL_BREAK_RECORDED')||(first&&state.relationship==='BELOW_IBL_BREAK');
    const returned=state.relationship==='INSIDE_IB'&&(state.transitions.includes('RETURN_INSIDE_FROM_IBH_RECORDED')||state.transitions.includes('RETURN_INSIDE_FROM_IBL_RECORDED'));
    add({
    id: `timeline:rth:${observation.id}`,
    sortAt: observation.observedAt,
    label: high?'IBH break recorded · RTH price':low?'IBL break recorded · RTH price':returned?'Return inside IB recorded · RTH price':'RTH price',
    price: observation.price,
    tagObservation: true,
    detail: formatPrice(observation.price),
    commentary: observation.note,
    attachment: null,
  });});
  (session.rthRangeHistory ?? []).forEach((range,index) => add({
    id: `timeline:rth-range:${index}:${range.recordedAt}`, sortAt: range.observedAt ?? range.recordedAt,
    label: range.observedAt ? `RTH ${range.observedEdge??'range'} observation` : "RTH range correction",
    detail: range.observedEdge ? `${range.observedEdge==='high'?'H':'L'} ${formatPrice(range[range.observedEdge])}` : `H ${formatPrice(range.high)} · L ${formatPrice(range.low)}`,
    phase: 'POST_IB',
    commentary: range.observedAt ? "Observed by this time; exact extreme occurrence time unknown. Full RTH range retained separately." : "Range saved without closing the day. Entry time; extreme times unlisted.", attachment: null,
  }));
  session.sessionNotes.forEach((note) => add({
    id: `timeline:note:${note.id}`,
    sortAt: note.observedAt,
    label: `${note.phase} note`,
    detail: note.text,
    commentary: null,
    attachment: note.link?.label ?? `${note.phase} phase`,
  }));
  if (session.close.price !== null || session.close.note) {
    add({
      id: "timeline:close",
      sortAt: session.close.observedAt ?? checkpoint(ES_TEMPLATE.checkpoints.studyClose),
      label: "RTH close",
      phase: 'POST_IB',
      price: session.close.price,
      detail: session.close.rthHigh !== null && session.close.rthLow !== null
        ? `H ${formatPrice(session.close.rthHigh)} · L ${formatPrice(
            session.close.rthLow,
          )} · Close ${formatPrice(session.close.price)}`
        : formatPrice(session.close.price),
      commentary: session.close.note,
      attachment: null,
    });
  }
  return items.sort(
    (left, right) => left.sortAt.localeCompare(right.sortAt) || left.id.localeCompare(right.id),
  );
}

function SharePreview({
  session,
  significantLevels,
  levelMapReferences,
  trackingSessions,
  forecastSources,
  nearbyLevels,
  compact=false,
}: {
  session: JournalSession;
  significantLevels: SignificantLevel[];
  levelMapReferences: Map<string, MapLevelReference>;
  trackingSessions: JournalSession[] | null;
  forecastSources:ShareForecastSources;
  nearbyLevels:SignificantLevel[];
  compact?:boolean;
}) {
  const qualitySources = useContext(LevelQualityContext);
  const supersessions=useContext(LevelSupersessionContext);
  const snapshot=useDashboardShareRead(session,forecastSources);
  const [shareTimeZone,setShareTimeZone]=useState(()=>readShareTimeZone(session.journalId,session.displayTimeZone));
  const showTimes=shareTimeZone!=='none';
  const shareSession=useMemo(()=>sessionForSharing(session,shareTimeZone),[session,shareTimeZone]);
  const shareZones=useMemo(()=>[...TIME_ZONES,...[...new Set([session.displayTimeZone,shareTimeZone])]
    .filter(id=>id!=='none'&&!TIME_ZONES.some(zone=>zone.id===id)).map(id=>({id,label:id}))],
    [session.displayTimeZone,shareTimeZone]);
  const [container,setContainer]=useState<ShareContainer>('structure');
  const [dashboardDetails,setDashboardDetails]=useState<DashboardShareDetails>(DEFAULT_DASHBOARD_SHARE_DETAILS);
  const [selectedSections,setSelectedSections]=useState<ShareContainer[]>([]);
  const [selectedNearbyIds,setSelectedNearbyIds]=useState<string[]>([]);
  const [format, setFormat] = useState<ShareFormat>("short");
  const [shortPostOptions, setShortPostOptions] = useState<ShortPostShareOptions>(
    DEFAULT_SHORT_POST_SHARE_OPTIONS,
  );
  const [imageCardOptions, setImageCardOptions] = useState<ImageCardOptions>(
    DEFAULT_IMAGE_CARD_OPTIONS,
  );
  const [selectedOptionalIds, setSelectedOptionalIds] = useState<string[]>([]);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("ready");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const imageOptionsRef=useRef<HTMLDetailsElement>(null);
  const optionalItems = useMemo(
    () => shareOptionalItems(shareSession, significantLevels,showTimes),
    [shareSession, significantLevels,showTimes],
  );
  const selectedOptionalLines = useMemo(
    () => optionalItems
      .filter((item) => selectedOptionalIds.includes(item.id))
      .map((item) => item.line),
    [optionalItems, selectedOptionalIds],
  );
  const commentaryItems = useMemo(
    () => optionalItems.filter((item) => item.kind === "commentary"),
    [optionalItems],
  );
  const levelItems = useMemo(
    () => optionalItems.filter((item) => item.kind === "level"),
    [optionalItems],
  );
  const selectedCount = optionalItems.filter(item => selectedOptionalIds.includes(item.id)&&
    (format!=='image'||container!=='nearby'||item.kind==='commentary')).length+
    (format==='image'?(container==='nearby'?selectedNearbyIds.length:0):selectedSections.length);
  const publicCardInput={session:shareSession,read:snapshot.read,updates:snapshot.updates,overnight:snapshot.overnight,details:dashboardDetails,showTimes};
  const dashboardLines=selectedSections.map(section=>dashboardShareText(buildDashboardShareCard(section,publicCardInput)));
  const shortDashboardLines=selectedSections.map(section=>{
    const card=buildDashboardShareCard(section,publicCardInput);
    return `${card.title}: ${card.headline}${card.caption?` · ${card.caption}`:''}`;
  });
  const shareLines=[...selectedOptionalLines,...dashboardLines];
  const generatedShortPostText = useMemo(
    () => buildShortPostShareText(shareSession, { ...shortPostOptions,showTimes, selectedOptionalLines:[...selectedOptionalLines,...shortDashboardLines] }),
    [shareSession, shortPostOptions,showTimes, selectedOptionalLines, shortDashboardLines.join("\n")],
  );
  const [shortPostDraft, setShortPostDraft] = useState(generatedShortPostText);
  const fullText = useMemo(
    () => appendSelectedShareContent(buildDailyShareText(shareSession,shareSession.market.tickSize,showTimes), shareLines),
    [shareSession,showTimes, selectedOptionalLines, dashboardLines.join("\n")],
  );
  const selectedMapLevels = useMemo(() => {
    let nextCode = Math.max(0, ...[...levelMapReferences.values()].map(reference => Number(reference.code.slice(1))));
    return levelItems.filter(item => selectedOptionalIds.includes(item.id)).flatMap(item => {
      const option = item.levelOption;
      if (!option) return [];
      const marker = option.area.members.length === 1 ? levelMapReferences.get(option.area.members[0].id) : undefined;
      const quality = marker?.quality ?? strongestQuality(option.area.members.map(level =>
        levelQuality(level, trackingSessions, session, qualitySources, significantLevels).quality));
      const tier=strongestQuality(option.area.members.map(level=>levelQuality(level,trackingSessions,session,qualitySources,significantLevels).tier)) as 'common'|'rare'|'legendary';
      return [{...option.mapLevel, code:marker?.code ?? `L${++nextCode}`, role:marker?.role, quality,tier, detail:option.detail}];
    });
  }, [levelItems, selectedOptionalIds, levelMapReferences, trackingSessions, session, qualitySources, significantLevels]);
  const imageCommentary = useMemo(() => optionalItems
    .filter(item => item.kind === 'commentary' && selectedOptionalIds.includes(item.id))
    .map(item => item.line), [optionalItems, selectedOptionalIds]);
  const pickerItems=useMemo(()=>levelItems.flatMap(item=>item.levelOption?[{id:item.id,label:item.label,levelOption:item.levelOption,
    tier:strongestQuality(item.levelOption.area.members.map(level=>levelQuality(level,trackingSessions,session,qualitySources,significantLevels).tier)) as 'common'|'rare'|'legendary'}]:[]),
    [levelItems,trackingSessions,session,qualitySources,significantLevels]);
  const nearbyItems=useMemo(()=>buildNearbyShareLevelOptions(session,nearbyLevels.filter(level=>!supersessions.get(level.id)?.hidden))
    .map(option=>({id:option.id,label:option.label,levelOption:option,
      tier:strongestQuality(option.area.members.map(level=>levelQuality(level,trackingSessions,session,qualitySources,significantLevels).tier)) as 'common'|'rare'|'legendary'})),
    [session,nearbyLevels,supersessions,trackingSessions,qualitySources,significantLevels]);
  const selectedNearby=useMemo(()=>nearbyItems.filter(item=>selectedNearbyIds.includes(item.id)).map(item=>{
    const members=item.levelOption.area.members,member=members[0];
    const edge=members.length===1?member.sessionEdge?.code:undefined;
    return {...item.levelOption.mapLevel,tier:item.tier,quality:edge?.startsWith('IB')?'ib' as const:edge?'on' as const:item.tier,
      role:levelMapRole(member,trackingSessions,session)};
  }),[nearbyItems,selectedNearbyIds,trackingSessions,session]);
  const selectedCard=buildDashboardShareCard(container,{...publicCardInput,levels:selectedNearby});
  const comparisonUnavailable=snapshot.loading?'Reading saved forecasts…':selectedCard.comparisonUnavailable;
  const preparing=container!=='structure'&&(snapshot.loading||
    (container==='on-forecast'&&snapshot.overnight.loading)||
    ((container==='ib-forecast'||container==='post-ib')&&!session.close.finishedAt&&!!session.forecast&&
      forecastSources.historical.length>0&&!!snapshot.read.current&&!snapshot.read.ready&&!snapshot.read.historyError));
  const imageCard = useMemo(
    () => container==='structure'
      ? buildImageCardSvg(shareSession, { ...imageCardOptions,showTimes, selectedOptionalLines:imageCommentary }, selectedMapLevels)
      : buildDashboardImageCard(shareSession,selectedCard,[
          ...(container!=='nearby'?buildShareVisitedLevels(selectedMapLevels):[]),
          ...(imageCardOptions.includeEvents?buildShareNewsSections(shareSession,snapshot.read.now,showTimes):[]),
          ...(imageCommentary.length?[{title:'Selected notes',rows:imageCommentary.map(value=>({label:'Note',value}))}]:[]),
        ]),
    [shareSession,showTimes, imageCardOptions, imageCommentary, selectedMapLevels, container, JSON.stringify(selectedCard)],
  );
  const imageCardPreviewUrl = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageCard.svg)}`,
    [imageCard.svg],
  );
  const generatedImageCaption=imageCard.caption??imageCard.altText;
  const [captionEdit,setCaptionEdit]=useState<{source:string;text:string}|null>(null);
  const captionField=useRef<HTMLTextAreaElement>(null);
  // A changed selection must hide a stale edited draft before effects run.
  const imageCaption=captionEdit?.source===generatedImageCaption?captionEdit.text:generatedImageCaption;
  const imageCaptionCount=Array.from(imageCaption).length;
  const imageActionsDisabled=imageCard.overflow||preparing||(container==='nearby'&&!selectedNearby.length);
  useEffect(()=>{
    setCaptionEdit(null);
    if(captionField.current)captionField.current.scrollTop=0;
  },[generatedImageCaption]);


  useEffect(() => {
    setShortPostDraft(generatedShortPostText);
  }, [generatedShortPostText]);

  useEffect(() => {
    setSelectedOptionalIds([]);
  }, [session.id]);

  useEffect(() => {
    setShareStatus("ready");
  }, [format, shortPostDraft, fullText, imageCard.svg, imageCaption]);

  const text = format === "short" ? shortPostDraft : fullText;
  const shortPostCharacterCount = Array.from(shortPostDraft).length;
  const shortPostOverLimit = shortPostCharacterCount > 280;
  const fullRecapCharacterCount = Array.from(fullText).length;
  const nativeShareAvailable = typeof navigator.share === "function";

  function setShortPostOption(
    key: Exclude<keyof ShortPostShareOptions, "selectedOptionalLines">,
    checked: boolean,
  ): void {
    setShortPostOptions((current) => ({ ...current, [key]: checked }));
  }

  function setImageCardOption(
    key: Exclude<keyof ImageCardOptions, "selectedOptionalLines">,
    checked: boolean,
  ): void {
    setImageCardOptions((current) => ({ ...current, [key]: checked }));
  }

  function toggleOptionalItem(id: string, checked: boolean): void {
    setSelectedOptionalIds((current) =>
      checked
        ? [...current, id]
        : current.filter((candidate) => candidate !== id));
  }

  async function copy(): Promise<void> {
    try {
      await copyShareText(text);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    }
  }

  async function copyImageCaption():Promise<void>{
    if(imageActionsDisabled||!imageCaption.trim())return;
    try{
      await copyShareText(imageCaption);
      setShareStatus('copied');
    }catch{setShareStatus('error');}
  }

  async function share(): Promise<void> {
    if (format === "image" || !nativeShareAvailable || (format === "short" && shortPostOverLimit)) return;
    try {
      await navigator.share({
        title: `IB Notes ${session.rthDate}`,
        text,
      });
      setShareStatus("shared");
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : "error");
    }
  }

  async function downloadImageCard(): Promise<void> {
    if (imageCard.overflow||preparing) return;
    try {
      const png = await imageCardPngBlob(imageCard.svg);
      downloadFile(`ib-notes-${session.rthDate}${container==='structure'?'':`-${container}`}.png`, png, "image/png");
      setShareStatus("downloaded");
    } catch {
      setShareStatus("error");
    }
  }

  const statusText = shareStatus === "copied"
    ? format==='image'?"Caption copied.":"Share text copied."
    : shareStatus === "shared"
      ? "Share sheet completed."
      : shareStatus === "downloaded"
        ? "1080 × 1350 PNG downloaded."
      : shareStatus === "cancelled"
        ? "Share cancelled. Nothing was sent by IB Notes."
        : shareStatus === "error"
          ? "The selected share format could not be prepared."
          : "Nothing leaves this device until you choose Copy, Share, or Download.";

  const shareOptions = (
<details
        ref={imageOptionsRef}
        className="share-options"
        open={optionsOpen}
        onToggle={(event) => setOptionsOpen(event.currentTarget.open)}
      >
        <summary>Choose what to include <span className="share-selection-count">{selectedCount > 0 ? `${selectedCount} extra` : "Customize"}</span></summary>
        <div className="share-options-content">
          <label className="share-container-select"><span>Share timezone</span>
            <select aria-label="Share timezone" value={shareTimeZone} onChange={event=>{
              const zone=event.currentTarget.value;setShareTimeZone(zone);rememberShareTimeZone(session.journalId,zone);
            }}>
              <option value="none">None — minutes remaining</option>
              {shareZones.map(zone=><option key={zone.id} value={zone.id}>
                {zone.label==='UTC'?'UTC':`${zone.label} (${shareTimeZoneLabel(sessionForSharing(session,zone.id))})`}
              </option>)}
            </select>
            <small>None hides clock times and timezone labels. Forecast countdowns remain.</small>
          </label>
          {format === "short" && (
            <fieldset className="share-option-group">
              <legend>Post details</legend>
              <p>Your date, instrument and day type stay included.</p>
              {([
                ["includeOvernight", "Overnight range"],
                ["includeFinalIb", "Final IB"],
                ["includePath", "Recorded price path"],
                ["includeCurrentOrClose", "Latest price or close"],
                ["includeEvents", "News & events"],
                ["includeMissing", "Missing information"],
              ] as const).map(([key, label]) => (
                <label key={key} className="share-checkbox" data-detail={key}>
                  <input
                    type="checkbox"
                    checked={shortPostOptions[key]}
                    onChange={(event) => setShortPostOption(key, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          )}

          {format === "image" && container==='structure' && (
            <fieldset className="share-option-group">
              <legend>Card details</legend>
              <p>Your map and IB ranges stay included. Selected levels also appear on the map.</p>
              {([
                ["includeOvernight", "Overnight range"],
                ["includePath", "Recorded price path"],
                ["includeCurrentOrClose", "Latest price or close"],
                ["includeEvents", "News & events"],
              ] as const).map(([key, label]) => (
                <label key={key} className="share-checkbox" data-detail={key}>
                  <input
                    type="checkbox"
                    checked={imageCardOptions[key]}
                    onChange={(event) => setImageCardOption(key, event.target.checked)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          )}

          {commentaryItems.length > 0 && (
            <fieldset className="share-option-group">
              <legend>Your notes</legend>
              <p>
                Only the notes you select appear in this share.
              </p>
              {commentaryItems.map((item) => (
                <label key={item.id} className="share-checkbox share-optional-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedOptionalIds.includes(item.id)}
                    onChange={(event) => toggleOptionalItem(item.id, event.target.checked)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </fieldset>
          )}

          {format==='image'&&container!=='structure'&&<fieldset className="share-option-group">
            <legend>Card details</legend>
            {DASHBOARD_SHARE_DETAILS.filter(([id])=>id==='context'||id==='comparison'&&['ib-recap','on-recap','post-ib'].includes(container)||
              id==='outcomes'&&['ib-forecast','on-forecast'].includes(container)||id==='evidence'&&['ib-forecast','on-forecast','post-ib'].includes(container))
              .map(([id,label])=><label className="share-checkbox" key={id}><input type="checkbox"
                aria-label={id==='comparison'?label:undefined}
                aria-describedby={id==='comparison'&&comparisonUnavailable?'share-comparison-reason':undefined}
                disabled={id==='comparison'&&!!comparisonUnavailable}
                checked={dashboardDetails[id]&&!(id==='comparison'&&comparisonUnavailable)}
                onChange={e=>setDashboardDetails(v=>({...v,[id]:e.target.checked}))}/><span>{label}
                  {id==='comparison'&&comparisonUnavailable&&<small id="share-comparison-reason" className="share-detail-reason">{comparisonUnavailable}</small>}
                </span></label>)}
            <label className="share-checkbox"><input type="checkbox" checked={imageCardOptions.includeEvents}
              onChange={e=>setImageCardOption('includeEvents',e.target.checked)}/><span>News &amp; events</span></label>
          </fieldset>}
          {format!=='image'&&<fieldset className="share-option-group">
            <legend>Dashboard sections</legend><p>Add a compact read from a dashboard section.</p>
            {SHARE_CONTAINERS.filter(([id])=>id!=='structure'&&id!=='nearby').map(([id,label])=><label className="share-checkbox" key={id}>
              <input type="checkbox" checked={selectedSections.includes(id)} onChange={e=>setSelectedSections(v=>e.target.checked?[...v,id]:v.filter(k=>k!==id))}/><span>{label}</span>
            </label>)}
          </fieldset>}
          {format==='image'&&container==='nearby'
            ? <ShareLevelPicker key="nearby" title="Nearby levels to include" items={nearbyItems} selected={selectedNearbyIds}
                onToggle={(id,checked)=>setSelectedNearbyIds(v=>checked?[...v,id]:v.filter(k=>k!==id))}/>
            : <ShareLevelPicker key="visited" title="Levels visited today" items={pickerItems} selected={selectedOptionalIds} onToggle={toggleOptionalItem}/>}

        </div>
      </details>
  );

  return (
    <section className={`share-preview-card daily-share-card${compact?" workspace-daily-share":""}`} aria-labelledby="share-preview-heading">
      <header className="share-preview-heading">
        <div>
          <h2 id="share-preview-heading">Share Preview</h2>
        </div>
      </header>

      <div className="share-format-switch" aria-label="Share format">
        <button
          type="button"
          aria-pressed={format === "short"}
          onClick={() => setFormat("short")}
        >
          <strong>Short Post</strong>
          <span>280 characters</span>
        </button>
        <button
          type="button"
          aria-pressed={format === "full"}
          onClick={() => setFormat("full")}
        >
          <strong>Full Recap</strong>
          <span>All details</span>
        </button>
        <button
          type="button"
          aria-pressed={format === "image"}
          onClick={() => setFormat("image")}
        >
          <strong>Image Card</strong>
          <span>Save a picture</span>
        </button>
      </div>

      <div className="share-preview-intro"><p className="share-preview-helper">
        Choose a format, check the preview, then save or share.
      </p>{compact&&<button type="button" className="workspace-share-customize" onClick={()=>{
        setOptionsOpen(true);imageOptionsRef.current?.scrollIntoView({block:'start'});
        imageOptionsRef.current?.querySelector('summary')?.focus({preventScroll:true});
      }}>Customize</button>}</div>

      <div className="share-presentation-options">
      {format==='image'&&<label className="share-container-select"><span>Image content</span>
        <select aria-label="Image content" value={container} onChange={e=>setContainer(e.target.value as ShareContainer)}>
          {SHARE_CONTAINERS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </select>
        <small>One section per image. Choose another to make the next card.</small>
      </label>}
      </div>


      {!compact&&shareOptions}
      {format === "short" ? (
        <>
          <label className="share-draft-field">
            <span>Edit short post</span>
            <small>Choose facts first. Changing a selection rebuilds this draft.</small>
            <textarea
              aria-label="Short Post share text"
              value={shortPostDraft}
              onChange={(event) => setShortPostDraft(event.target.value)}
              rows={12}
            />
          </label>
          <div className="share-character-count" data-over-limit={shortPostOverLimit}>
            <strong>{shortPostCharacterCount} / 280</strong>
            <span>{shortPostOverLimit ? "Shorten the draft before sharing." : "Ready to share."}</span>
          </div>
        </>
      ) : format === "full" ? (
        <>
          <pre className="share-preview-text" aria-label="Full Recap share text">{fullText}</pre>
          <div className="share-character-count">
            <strong>{fullRecapCharacterCount} characters</strong>
            <span>No character limit.</span>
          </div>
        </>
      ) : (
        <>
          {preparing&&<p role="status">Preparing this section from your saved entries…</p>}
          {container==='nearby'&&!selectedNearby.length&&<p>Open “Choose what to include” to select nearby levels.</p>}
          {container!=='structure'&&snapshot.error&&<p role="status">{snapshot.error}</p>}
          <div className="share-image-frame" aria-label="Image Card preview" aria-busy={preparing}>
            <img src={imageCardPreviewUrl} alt={imageCard.altText} />
          </div>
          <div className="share-image-resolution">
            <strong>Portrait PNG</strong>
            <span>1080 × 1350</span>
          </div>
          {imageCard.overflow && (
            <div className="share-image-overflow" role="alert">
              <p>This card has more content than one image can hold. Turn off an optional detail, note or level to keep it readable.</p>
              <button type="button" className="quiet-button" onClick={()=>{
                setOptionsOpen(true);
                imageOptionsRef.current?.scrollIntoView({block:'start'});
                imageOptionsRef.current?.querySelector('summary')?.focus({preventScroll:true});
              }}>Edit image selections</button>
            </div>
          )}
        </>
      )}

      {format === "image" ? (
        <>
          <label className="share-draft-field share-caption-field">
            <span>Caption for your post</span>
            <small>Add your own sentence here. Changing image details rebuilds the caption.</small>
            <textarea ref={captionField} aria-label="Image caption" aria-describedby="image-caption-count" value={imageCaption}
              disabled={preparing} rows={4}
              onChange={event=>setCaptionEdit({source:generatedImageCaption,text:event.target.value})}/>
          </label>
          <div id="image-caption-count" className="share-character-count share-caption-count" data-over-limit={imageCaptionCount>280}>
            <strong>{imageCaptionCount} characters</strong>
            <span>{imageCaptionCount>280?'Over 280 · shorten for a regular X post.':'X target: 280 characters'}</span>
          </div>
          <div className="share-actions">
            <button className="secondary-action" type="button" disabled={imageActionsDisabled||!imageCaption.trim()}
              onClick={()=>void copyImageCaption()}>{shareStatus==='copied'?'Copied':'Copy caption'}</button>
            <button className="primary-action" type="button" disabled={imageActionsDisabled}
              onClick={()=>void downloadImageCard()}>Download PNG</button>
          </div>
        </>
      ) : (
        <div className="share-actions">
          <button className="secondary-action" type="button" onClick={() => void copy()}>
            {shareStatus === "copied" ? "Copied" : "Copy text"}
          </button>
          <button
            className="primary-action"
            type="button"
            disabled={!nativeShareAvailable || (format === "short" && shortPostOverLimit)}
            onClick={() => void share()}
          >
            Share…
          </button>
        </div>
      )}
      {format !== "image" && !nativeShareAvailable && (
        <p className="share-preview-helper">This browser has no native Share sheet. Copy remains available.</p>
      )}
      <p className="share-preview-status" role="status" aria-live="polite">{statusText}</p>
      {compact&&shareOptions}

    </section>
  );
}

function relationshipLabel(relationship: ReturnType<typeof deriveRthObservationStates>[number]["relationship"]): string {
  const labels = {
    IB_UNAVAILABLE: "IB relationship pending",
    ABOVE_IBH_BREAK: "At least 1 tick above IBH",
    ABOVE_IBH_NO_BREAK: "Above IBH, under 1 tick",
    AT_IBH: "At IBH",
    INSIDE_IB: "Inside IB",
    AT_IBL: "At IBL",
    BELOW_IBL_NO_BREAK: "Below IBL, under 1 tick",
    BELOW_IBL_BREAK: "At least 1 tick below IBL"
  } as const;
  return labels[relationship];
}

function transitionLabel(transition: ReturnType<typeof deriveRthObservationStates>[number]["transitions"][number]): string {
  const labels = {
    IBH_BREAK_RECORDED: "IBH break established between observations",
    RETURN_INSIDE_FROM_IBH_RECORDED: "IBH edge retested after break",
    IBL_BREAK_RECORDED: "IBL break established between observations",
    RETURN_INSIDE_FROM_IBL_RECORDED: "IBL edge retested after break"
  } as const;
  return labels[transition];
}

function RthObservationCorrectionForm({
  kind = 'RTH',
  observation,
  localTime,
  onCorrect,
  onRemove,
  onCancel
}: {
  kind?: 'RTH' | 'CP';
  observation: Pick<RthObservation, 'price'> & { note?: string | null };
  localTime: string;
  onCorrect: (update: RthObservationUpdate, localTime: string) => void | Promise<string|null>;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = useState(formatPriceNumber(observation.price));
  const [correctedLocalTime, setCorrectedLocalTime] = useState(localTime);
  const [note, setNote] = useState(observation.note ?? "");

  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),submitting=useRef(false);
  return (
    <form
      className="observation-correction"
      aria-label={`Correct ${kind} observation ${formatPriceNumber(observation.price)}`}
      onSubmit={async(event) => {
        event.preventDefault();if(submitting.current)return;
        const parsedPrice = parsePrice(price);
        if (parsedPrice === null) return;
        submitting.current=true;setBusy(true);setError(null);
        try{setError(await onCorrect({ price: parsedPrice, note }, correctedLocalTime)??null);}catch(error){setError(error instanceof Error?error.message:'Unable to save.');}finally{submitting.current=false;setBusy(false);}
      }}
    >
      <div className="rth-entry-row">
        <label className="rth-price-field">
          <span>Corrected price</span>
          <input
            inputMode="decimal"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className="rth-price-field context-picker-field">
          <span>Observation time</span>
          <span className="context-picker-readout">
            <strong>{formatClockTime(correctedLocalTime)}</strong>
            <em>Change</em>
          </span>
          <input
            className="native-picker-overlay"
            aria-label="Correct observation time"
            type="time"
            required
            value={correctedLocalTime}
            onChange={(event) => setCorrectedLocalTime(event.target.value)}
          />
        </label>
      </div>
      {kind === 'RTH' && <details className="optional-note correction-note">
        <summary>Add/edit note</summary>
        <label>
          <span>Observation note</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </details>}
      {error&&<p role="alert">{error}</p>}
      <div className="correction-actions">
        <div className="correction-primary-actions">
          <button className="primary-action" type="submit" disabled={busy}>Save correction</button>
          <button className="secondary-action" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
        </div>
        <button
          className="remove-action"
          type="button"
          aria-label={`Remove mistaken ${kind} entry ${formatPriceNumber(observation.price)}`}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </form>
  );
}

function SessionNoteCorrectionForm({
  note,
  localTime,
  linkOptions,
  onCorrect,
  onRemove,
  onCancel,
}: {
  note: SessionNote;
  localTime: string;
  linkOptions: SessionNoteLinkOption[];
  onCorrect: (
    text: string,
    localTime: string,
    link: SessionNoteLink | null,
  ) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(note.text);
  const [correctedLocalTime, setCorrectedLocalTime] = useState(localTime);
  const [selectedLinkValue, setSelectedLinkValue] = useState(
    note.link ? `${note.link.kind}:${note.link.targetId}` : "",
  );

  return (
    <form
      className="observation-correction"
      aria-label={`Correct ${note.phase} note at ${formatClockTime(localTime)}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        const link = linkOptions.find((option) => option.value === selectedLinkValue)?.link
          ?? (note.link && selectedLinkValue === `${note.link.kind}:${note.link.targetId}`
            ? note.link
            : null);
        onCorrect(text, correctedLocalTime, link);
      }}
    >
      <label>
        <span>Note</span>
        <textarea required value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <label>
        <span>Attach to <small>optional</small></span>
        <select
          aria-label={`Correct ${note.phase} note attachment`}
          value={selectedLinkValue}
          onChange={(event) => setSelectedLinkValue(event.target.value)}
        >
          <option value="">{note.phase} phase only</option>
          {note.link && !linkOptions.some(
            (option) => option.value === `${note.link?.kind}:${note.link?.targetId}`,
          ) && (
            <option value={`${note.link.kind}:${note.link.targetId}`}>{note.link.label}</option>
          )}
          {linkOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.link.label}</option>
          ))}
        </select>
      </label>
      <label className="rth-price-field context-picker-field">
        <span>Observation time</span>
        <span className="context-picker-readout">
          <strong>{formatClockTime(correctedLocalTime)}</strong>
          <em>Change</em>
        </span>
        <input
          className="native-picker-overlay"
          aria-label={`Correct ${note.phase} note time`}
          type="time"
          required
          value={correctedLocalTime}
          onChange={(event) => setCorrectedLocalTime(event.target.value)}
        />
      </label>
      <div className="correction-actions">
        <div className="correction-primary-actions">
          <button className="primary-action" type="submit">Save correction</button>
          <button className="secondary-action" type="button" onClick={onCancel}>Cancel</button>
        </div>
        <button className="remove-action" type="button" onClick={onRemove}>Remove</button>
      </div>
    </form>
  );
}

function BSnapshotForm({
  snapshot,
  inheritedRange,
  onSave
}: {
  snapshot: DevelopingBSnapshot | null;
  inheritedRange: RangeCheckpoint;
  onSave: (update: FifteenMinuteUpdate) => void | Promise<string|null>;
}) {
  const startingRange = carryRangeEdgesForward(
    {
      high: snapshot?.high ?? null,
      low: snapshot?.low ?? null,
      cp: snapshot?.cp ?? null,
    },
    inheritedRange,
  );
  const [high, setHigh] = useState(formatPrice(startingRange.high).replace("Pending", ""));
  const [low, setLow] = useState(formatPrice(startingRange.low).replace("Pending", ""));
  const [note, setNote] = useState(snapshot?.note ?? "");

  const [error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false),submitting=useRef(false);
  return (
    <form
      onSubmit={async(event) => {
        event.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError(null);
        try{setError(await onSave({
          high: parsePrice(high),
          low: parsePrice(low),
          cp: null,
          note
        })??null);}catch(error){setError(error instanceof Error?error.message:'Unable to save.');}finally{submitting.current=false;setBusy(false);}
      }}
    >
      <p className="stage-helper">
        Optional view of B so far. Skipping it does not leave the session incomplete.
      </p>
      <div className="period-form-heading"><h3>Range so far</h3>
        <button className="primary-action" type="submit" disabled={busy}>{busy ? 'Saving…' : snapshot ? 'Save correction' : 'Save snapshot'}</button></div>
      <div className="price-fields">
        <label>
          <span>B high so far <small>optional</small></span>
          <input inputMode="decimal" value={high} onChange={(event) => setHigh(event.target.value)} />
        </label>
        <label>
          <span>B low so far <small>optional</small></span>
          <input inputMode="decimal" value={low} onChange={(event) => setLow(event.target.value)} />
        </label>
      </div>
      <details className="optional-note">
        <summary>Add a note</summary>
        <label>
          <span>B snapshot commentary</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </details>
      {error&&<p role="alert">{error}</p>}
    </form>
  );
}

function RangeForm({
  checkpoint,
  highLabel,
  lowLabel,
  noteLabel,
  checkpointName,
  onSave
}: {
  checkpoint: RangeCheckpoint;
  highLabel: string;
  lowLabel: string;
  noteLabel: string;
  checkpointName: string;
  onSave: (update: FifteenMinuteUpdate) => void;
}) {
  const [high, setHigh] = useState(formatPrice(checkpoint.high).replace("Pending", ""));
  const [low, setLow] = useState(formatPrice(checkpoint.low).replace("Pending", ""));
  const [note, setNote] = useState(checkpoint.note ?? "");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          high: parsePrice(high),
          low: parsePrice(low),
          cp: null,
          note
        });
      }}
    >
      <p className="stage-helper">
        Enter both range edges in either order; the larger price becomes the high.
      </p>
      <div className="price-fields">
        <label>
          <span>{highLabel}</span>
          <input inputMode="decimal" value={high} onChange={(event) => setHigh(event.target.value)} />
        </label>
        <label>
          <span>{lowLabel}</span>
          <input inputMode="decimal" value={low} onChange={(event) => setLow(event.target.value)} />
        </label>
      </div>
      <details className="optional-note">
        <summary>Add a note</summary>
        <label>
          <span>{noteLabel}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </details>
      <button className="primary-action" type="submit">
        {checkpoint.status === "confirmed"
          ? "Save correction"
          : parsePrice(high) !== null && parsePrice(low) !== null
            ? `Confirm ${checkpointName}`
            : "Save pending"}
      </button>
    </form>
  );
}

function FifteenMinuteRelations({ session }: { session: JournalSession }) {
  const range = session.fifteenMinute;
  const geometry = deriveRange(range);
  if (!geometry) return null;
  const signed = (value: number | null) =>
    value === null ? "Pending" : `${value >= 0 ? "+" : ""}${formatPriceNumber(value)}`;
  const highVsOnh =
    session.overnight.high === null ? null : range.high! - session.overnight.high;
  const lowVsOnl =
    session.overnight.low === null ? null : range.low! - session.overnight.low;
  const openPosition =
    session.overnight.rthOpen === null || geometry.width === 0
      ? null
      : ((session.overnight.rthOpen - range.low!) / geometry.width) * 100;

  return (
    <dl className="geometry-grid compact-geometry">
      <div><dt>15R-H vs ONH</dt><dd>{signed(highVsOnh)}</dd></div>
      <div><dt>15R-L vs ONL</dt><dd>{signed(lowVsOnl)}</dd></div>
      <div>
        <dt>Open position</dt>
        <dd>{openPosition === null ? "Pending" : `${openPosition.toFixed(1)}%`}</dd>
      </div>
    </dl>
  );
}

function APeriodRelations({
  session,
  aPeriod,
}: {
  session: JournalSession;
  aPeriod: RangeCheckpoint;
}) {
  const geometry = deriveRange(aPeriod);
  const extensions = deriveRangeExtensions(
    session.fifteenMinute,
    aPeriod,
  );
  if (!geometry) return null;
  const highVsOnh =
    session.overnight.high === null || aPeriod.high === null
      ? null
      : aPeriod.high - session.overnight.high;
  const lowVsOnl =
    session.overnight.low === null || aPeriod.low === null
      ? null
      : aPeriod.low - session.overnight.low;
  const signed = (value: number | null) =>
    value === null ? "Pending" : `${value >= 0 ? "+" : ""}${formatPriceNumber(value)}`;

  return (
    <dl className="geometry-grid a-geometry">
      <div><dt>A width</dt><dd>{formatPriceNumber(geometry.width)}</dd></div>
      <div><dt>Midpoint</dt><dd>{formatPriceNumber(geometry.midpoint, 3)}</dd></div>
      <div>
        <dt>CP position</dt>
        <dd>{geometry.cpPositionPct === null ? "Pending" : `${geometry.cpPositionPct.toFixed(1)}%`}</dd>
      </div>
      <div><dt>High from 15R</dt><dd>{signed(extensions?.highExtension ?? null)}</dd></div>
      <div><dt>Low from 15R</dt><dd>{signed(extensions?.lowExtension ?? null)}</dd></div>
      <div><dt>A-H vs ONH</dt><dd>{signed(highVsOnh)}</dd></div>
      <div><dt>A-L vs ONL</dt><dd>{signed(lowVsOnl)}</dd></div>
    </dl>
  );
}

function BPeriodRelations({
  session,
  aPeriod,
  bPeriod,
  finalIb,
  finalIbGeometry
}: {
  session: JournalSession;
  aPeriod: RangeCheckpoint;
  bPeriod: RangeCheckpoint;
  finalIb: ReturnType<typeof deriveFinalIb>;
  finalIbGeometry: ReturnType<typeof deriveRange>;
}) {
  const bGeometry = deriveRange(bPeriod);
  const extensions = deriveBExtensions(aPeriod, bPeriod);
  const signed = (value: number | null) =>
    value === null ? "Pending" : `${value >= 0 ? "+" : ""}${formatPriceNumber(value)}`;

  return (
    <>
      {bGeometry && (
        <dl className="geometry-grid compact-geometry">
          <div><dt>B width</dt><dd>{formatPriceNumber(bGeometry.width)}</dd></div>
          <div><dt>Above A high</dt><dd>{signed(extensions?.highExtension ?? null)}</dd></div>
          <div><dt>Below A low</dt><dd>{signed(extensions?.lowExtension ?? null)}</dd></div>
        </dl>
      )}
      {finalIb && finalIbGeometry ? (
        <section className="final-ib-summary" aria-label="Final locked Initial Balance">
          <p className="eyebrow">Final IB locked from A + B</p>
          <dl className="geometry-grid a-geometry">
            <div><dt>IBH</dt><dd>{formatPrice(finalIb.high)}</dd></div>
            <div><dt>IBL</dt><dd>{formatPrice(finalIb.low)}</dd></div>
            <div><dt>Width</dt><dd>{formatPriceNumber(finalIbGeometry.width)}</dd></div>
            <div><dt>Midpoint</dt><dd>{formatPriceNumber(finalIbGeometry.midpoint, 3)}</dd></div>
            <div>
              <dt>CP position</dt>
              <dd>
                {finalIbGeometry.cpPositionPct === null
                  ? "Pending"
                  : `${finalIbGeometry.cpPositionPct.toFixed(1)}%`}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <p className="stage-helper">Final IB remains pending until completed A and B are confirmed.</p>
      )}
    </>
  );
}

function ContractSettings({ session, useForNewDays, onSave }: {
  session: JournalSession; useForNewDays: boolean; onSave: (contract: string) => Promise<string | null>;
}) {
  const [contract, setContract] = useState(session.contract ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form className="contract-settings" onSubmit={async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try { setError(await onSave(contract)); } finally { setBusy(false); }
  }}>
    <label><span>Contract <small>(optional)</small></span><input aria-label="Contract" maxLength={40} value={contract} onChange={(event) => setContract(event.target.value)} autoCapitalize="characters" placeholder="For example: ESZ26" /></label>
    <p className="stage-helper">{useForNewDays ? "Used for this day and new sessions. Other saved days keep their contract." : "Earlier day: only this day’s contract changes."} Leave blank if unknown.</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save contract"}</button>
  </form>;
}

function PreOpenForm({
  session,
  onSave
}: {
  session: JournalSession;
  onSave: (update: PreOpenUpdate, localTime: string) => void;
}) {
  const latest = latestPreOpenSnapshot(session);
  const [high, setHigh] = useState(
    formatPrice(latest?.formingOvernightHigh ?? null).replace("Pending", ""),
  );
  const [low, setLow] = useState(
    formatPrice(latest?.formingOvernightLow ?? null).replace("Pending", ""),
  );
  const [localTime, setLocalTime] = useState(
    currentTimeInZone(session.displayTimeZone),
  );
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          {
            contractStatus: session.contractStatus,
            contract: session.contract,
            formingOvernightHigh: parsePrice(high),
            formingOvernightLow: parsePrice(low),
            cp: null,
            note
          },
          localTime,
        );
      }}
    >
      <div className="price-fields preopen-fields">
        <label>
          <span>Forming ON high</span>
          <input inputMode="decimal" value={high} onChange={(event) => setHigh(event.target.value)} />
        </label>
        <label>
          <span>Forming ON low</span>
          <input inputMode="decimal" value={low} onChange={(event) => setLow(event.target.value)} />
        </label>
        <label className="context-picker-field">
          <span>Observation time · {sessionTimeZoneLabel(session)}</span>
          <span className="context-picker-readout">
            <strong>{formatClockTime(localTime)}</strong>
            <em>Change</em>
          </span>
          <input
            className="native-picker-overlay"
            aria-label="Observation time"
            type="time"
            value={localTime}
            onChange={(event) => setLocalTime(event.target.value)}
          />
        </label>
      </div>

      <details className="optional-note">
        <summary>Add a note</summary>
        <label>
          <span>Pre-open commentary</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
      </details>

      <button className="primary-action" type="submit">Save update</button>
    </form>
  );
}

function MarketContextForm({ session, item, initialHoliday = false, onSave, onCancel }: {
  session: JournalSession; item: MarketContextItem | null;
  initialHoliday?: boolean;
  onSave: (update: MarketContextUpdate, localTime: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const displayed = item ? Temporal.Instant.from(item.eventAt).toZonedDateTimeISO(session.displayTimeZone) : null;
  const [name, setName] = useState(item?.name ?? "");
  const [holiday, setHoliday] = useState(Boolean(item?.holiday) || !item && initialHoliday);
  const [holidaySession, setHolidaySession] = useState<HolidayContext['session']>(item?.holiday?.session ?? 'regular');
  const [lowVolume, setLowVolume] = useState(item?.holiday?.lowVolume ?? false);
  const [closeTime, setCloseTime] = useState(item?.holiday?.closeAt ? formatObservationTime(item.holiday.closeAt, session.displayTimeZone) : '');
  const [eventDate, setEventDate] = useState(item?.holiday ? item.eventDate : displayed?.toPlainDate().toString() ?? session.rthDate);
  const [localTime, setLocalTime] = useState(displayed?.toPlainTime().toString({ smallestUnit: "minute" }) ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [noteOpen, setNoteOpen] = useState(Boolean(item?.note));
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);

  return <form className="market-context-form context-capture-form" aria-label={item ? "Edit news or event" : "Add news or event"} onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try { setError(await onSave({ name, eventDate, note, ...(holiday ? { holiday: {
      timeZone: item?.holiday?.timeZone ?? session.market.canonicalTimeZone, session: holidaySession, lowVolume,
      closeAt: holidaySession === 'early_close' && closeTime ? calendarInstant(eventDate, closeTime, session.displayTimeZone).toString() : null,
    } } : {}) }, localTime)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }}>
    <header className="capture-form-heading"><h2>{holiday ? item ? 'Edit holiday' : 'Holiday' : item ? "Edit news or event" : "News or event"}</h2>
      <button type="button" disabled={busy} onClick={onCancel}>Cancel</button></header>
    <div className="context-kind-choice" role="group" aria-label="Context type">
      <button type="button" aria-pressed={!holiday} onClick={() => setHoliday(false)}>News / event</button>
      <button type="button" aria-pressed={holiday} onClick={() => setHoliday(true)}>Holiday</button>
    </div>
    <label><span>{holiday ? 'Holiday name' : 'Event'}</span><input required value={name} placeholder={holiday ? 'Columbus Day, Thanksgiving…' : "CPI, FOMC, earnings…"} onChange={event => setName(event.target.value)} /></label>
    <div className="capture-field-row">
      <label className="context-picker-field"><span>Date</span>
        <span className="context-picker-readout" aria-hidden="true">{eventDate ? formatCalendarDate(eventDate) : "Choose date"}</span>
        <input className="native-picker-overlay" aria-label="Date" type="date" required value={eventDate} onChange={event => setEventDate(event.target.value)} />
      </label>
      {holiday ? <div className="holiday-all-day"><span>Duration</span><strong>All day</strong></div> : <label className="context-picker-field"><span>Time · {sessionTimeZoneLabel(session)}</span>
        <span className="context-picker-readout" aria-hidden="true">{localTime ? formatClockTime(localTime) : "Choose time"}</span>
        <input className="native-picker-overlay" aria-label="Time" type="time" required value={localTime} onChange={event => setLocalTime(event.target.value)} />
      </label>}
    </div>
    {holiday && <div className="holiday-session-details">
      <label><span>Trading hours</span><select value={holidaySession} onChange={event => setHolidaySession(event.target.value as HolidayContext['session'])}>
        <option value="regular">Regular hours</option><option value="early_close">Early close</option><option value="closed">Market closed</option>
      </select></label>
      {holidaySession === 'early_close' && <label><span>Close time · {sessionTimeZoneLabel(session)} <small>optional</small></span>
        <input aria-label="Holiday close time" type="time" value={closeTime} onChange={event => setCloseTime(event.target.value)} /></label>}
      <label className="holiday-low-volume"><input type="checkbox" checked={lowVolume} onChange={event => setLowVolume(event.target.checked)} /><span>Low volume</span></label>
      <p className="context-hint">Day context for your journal. Trading hours here do not change the instrument's session clock.</p>
    </div>}
    <details className="capture-optional" open={noteOpen} onToggle={event => setNoteOpen(event.currentTarget.open)}><summary>Add a note <small>optional</small></summary>
      <label><span>Event note</span><textarea rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
    </details>
    {error && <p role="alert" className="form-error">{error}</p>}
    <button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : item ? "Save correction" : holiday ? 'Save holiday' : "Save event"}</button>
  </form>;
}

function MarketContextList({
  session,
  undoAvailable,
  onEdit,
  onRemove,
  onUndo,
  onLinkMove,
  onResult,
}: {
  session: JournalSession;
  undoAvailable: boolean;
  onEdit: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onUndo: () => void;
  onLinkMove:(itemId:string)=>void;
  onResult:(itemId:string,result:NewsResult|null)=>Promise<string|null>;
}) {
  if (session.marketContextItems.length === 0 && !undoAvailable) return null;

  return (
    <>
      {undoAvailable && (
        <button className="undo-action" type="button" onClick={onUndo}>
          Undo change
        </button>
      )}
      <ol className="market-context-list" aria-label="Saved market context">
        {session.marketContextItems.map((item) => {
          const displayed = Temporal.Instant.from(item.eventAt).toZonedDateTimeISO(
            session.displayTimeZone,
          );
          return (
            <li key={item.id}>
              <div>
                <time dateTime={item.eventAt}>
                  {item.holiday ? `${item.eventDate} · ${holidaySummary(item.holiday, session.displayTimeZone)}` : `${displayed.toPlainDate().toString()} · ${formatClockTime(
                    displayed.toPlainTime().toString({ smallestUnit: "minute" }),
                  )}`}
                </time>
                <small>{item.contextPack ? `Context Pack · ${item.contextPack.instrument}` : item.source === 'official' ? `Official · ${item.schedule?.provider === 'fed' ? 'Federal Reserve' : item.schedule?.provider === 'fred' ? 'St. Louis Fed' : item.schedule?.provider.toUpperCase() ?? 'Calendar'}` : 'Manual'}</small>
              </div>
              <strong>{item.name}</strong>
              {item.note && <p>{item.note}</p>}
              {!item.holiday&&<NewsResultEditor key={`${item.id}:${item.newsResult?.checkedAt??''}`} item={item} timeZone={session.displayTimeZone} onSave={result=>onResult(item.id,result)}/>}
              {!item.holiday&&<button className="event-move-open" type="button" onClick={()=>onLinkMove(item.id)}
                disabled={Date.parse(item.eventAt)>Date.now()}>{item.priceMove?'View linked move':'Link price move'}</button>}
              <div className="compact-entry-actions">
                <button type="button" onClick={() => onEdit(item.id)}>Edit</button>
                <button
                  className="remove-action"
                  type="button"
                  aria-label={`Remove event ${item.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function significantLevelPrice(level: SignificantLevel): string {
  return level.shape === "single_price"
    ? formatPrice(level.price)
    : `${formatPrice(level.zoneLow)}–${formatPrice(level.zoneHigh)}`;
}

function significantLevelName(level: SignificantLevel | undefined): string {
  if (!level) return "Unknown level";
  const type = level.levelType.charAt(0).toUpperCase() + level.levelType.slice(1);
  return `${displayLevelLabel(level) ?? type} · ${significantLevelPrice(level)}`;
}

function significantLevelInteractionLabel(
  interaction: ReturnType<typeof deriveSignificantLevelInteractions>[number],
): string {
  if (interaction.kind === "touch") return "Recorded touch";
  if (interaction.kind === "zone_entered") {
    return interaction.direction === "below_to_inside"
      ? "Recorded entry into zone from below"
      : "Recorded entry into zone from above";
  }
  if (interaction.kind === "zone_traversed") {
    return interaction.direction === "below_to_above"
      ? "Recorded zone traversal from below to above"
      : "Recorded zone traversal from above to below";
  }
  return interaction.direction === "below_to_above"
    ? "Recorded crossover from below to above"
    : "Recorded crossover from above to below";
}

function SignificantLevelProximityControl({
  proximityPoints,
  onSave,
}: {
  proximityPoints: number;
  onSave: (points: number) => void;
}) {
  const [value, setValue] = useState(proximityPoints.toString());
  useEffect(() => setValue(proximityPoints.toString()), [proximityPoints]);
  return (
    <form
      className="level-proximity-control"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(Number(value));
      }}
    >
      <label>
        <span>Distance from your price (points)</span>
        <input
          aria-label="Significant Level proximity points"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <button className="secondary-action" type="submit">Save distance</button>
    </form>
  );
}

function SignificantLevelNoteForm({
  session,
  level,
  onSave,
}: {
  session: JournalSession;
  level: SignificantLevel;
  onSave: (text: string, localTime: string) => void;
}) {
  const [text, setText] = useState("");
  const [localTime, setLocalTime] = useState(currentTimeInZone(session.displayTimeZone));
  return (
    <form
      className="level-note-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text.trim()) return;
        onSave(text, localTime);
      }}
    >
      <label>
        <span>Level note</span>
        <textarea required value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <label className="context-picker-field">
        <span>Observation time · {sessionTimeZoneLabel(session)}</span>
        <span className="context-picker-readout">
          <strong>{formatClockTime(localTime)}</strong>
          <em>Change</em>
        </span>
        <input
          className="native-picker-overlay"
          aria-label={`Change note time for ${significantLevelName(level)}`}
          type="time"
          required
          value={localTime}
          onChange={(event) => setLocalTime(event.target.value)}
        />
      </label>
      <button className="secondary-action" type="submit">Add level note</button>
    </form>
  );
}

function significantLevelTimeframeLabel(level: SignificantLevel): string {
  return level.sourceTimeframe === 'unknown' ? 'Timeframe unlisted' : `${levelTimeframeLabels[level.sourceTimeframe]} level`;
}

function SignificantLevelEpisodeHistory({
  session,
  level,
  onRemove,
}: {
  session: JournalSession;
  level: SignificantLevel;
  onRemove: (episodeId: string) => void;
}) {
  const episodes = level.episodes.filter(
    (episode) => episode.removedAt === null && episode.rthDate <= session.rthDate,
  );
  if (episodes.length === 0) return null;
  return (
    <details className="level-episode-history">
      <summary>Confirmed LBAF/LAAF · {episodes.length}</summary>
      <ol aria-label={`Confirmed episodes for ${significantLevelName(level)}`}>
        {episodes.map((episode) => (
          <li key={episode.id}>
            <div>
              <strong>{failurePatternLabel(episode.classification)}</strong>
              <span>{significantLevelEpisodePhaseLabel(episode.phase)}</span>
              <time dateTime={episode.observedAt}>
                {episode.rthDate} · {formatClockTime(formatObservationTime(
                  episode.observedAt,
                  session.displayTimeZone,
                ))}
              </time>
            </div>
            <small>
              Recorded evidence {formatPrice(episode.priorCp)} → {formatPrice(episode.laterCp)}
              {episode.crossingTimeKnown ? "" : " · exact crossing time unknown"}
            </small>
            {episode.linkedEvents.length > 0 && (
              <small>Events · {episode.linkedEvents.map((event) => event.name).join(", ")}</small>
            )}
            {episode.note && <p>{episode.note}</p>}
            <button
              className="remove-action"
              type="button"
              onClick={() => onRemove(episode.id)}
            >Remove</button>
          </li>
        ))}
      </ol>
    </details>
  );
}

function SignificantLevelEpisodeConfirmation({
  session,
  level,
  interaction,
  classification,
  onConfirm,
}: {
  session: JournalSession;
  level: SignificantLevel;
  interaction: SignificantLevelInteraction;
  classification: SignificantLevelEpisodeClassification;
  onConfirm: (localTime: string, eventIds: string[], note: string) => void;
}) {
  const { sessionObservationInstant } = useJournalClock();
  const defaultTime = formatObservationTime(
    interaction.laterObservedAt,
    session.displayTimeZone,
  );
  const [localTime, setLocalTime] = useState(defaultTime);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const observedAt = sessionObservationInstant(
    session.rthDate,
    localTime,
    session.displayTimeZone,
  ).toString();
  const availableEvents = session.marketContextItems.filter(
    (item) => item.eventAt <= observedAt,
  );
  const phase = significantLevelEpisodePhase(session, observedAt);

  return (
    <details className="level-episode-confirmation">
      <summary>Review and confirm {failurePatternLabel(classification)}</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(localTime, eventIds, note);
        }}
      >
        <p className="stage-helper">
          The journal recorded a {interaction.direction?.replaceAll("_", " ")} crossover.
          Confirm {failurePatternLabel(classification)} only when you recognize the complete structure.
        </p>
        <div className="level-episode-facts">
          <span>{formatPrice(interaction.priorCp)}</span>
          <b>→</b>
          <span>{formatPrice(interaction.laterCp)}</span>
        </div>
        <label className="context-picker-field">
          <span>Confirmation time</span>
          <span className="context-picker-readout">
            <strong>{formatClockTime(localTime)}</strong>
            <em>Change</em>
          </span>
          <input
            className="native-picker-overlay"
            aria-label={`Change ${failurePatternLabel(classification)} confirmation time for ${significantLevelName(level)}`}
            type="time"
            required
            value={localTime}
            onChange={(event) => {
              setLocalTime(event.target.value);
              setEventIds([]);
            }}
          />
        </label>
        <p className="level-episode-phase">
          Market phase · <strong>{significantLevelEpisodePhaseLabel(phase)}</strong>
        </p>
        <fieldset className="level-episode-events">
          <legend>Related earlier news/events <small>optional</small></legend>
          {availableEvents.length === 0 ? (
            <p>No earlier event is recorded for this session.</p>
          ) : availableEvents.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={eventIds.includes(item.id)}
                onChange={(event) => setEventIds((current) => event.target.checked
                  ? [...current, item.id]
                  : current.filter((id) => id !== item.id))}
              />
              <span>{item.name} · {item.holiday ? 'All day' : formatClockTime(formatObservationTime(
                item.eventAt,
                session.displayTimeZone,
              ))}</span>
            </label>
          ))}
        </fieldset>
        <label>
          <span>Episode note <small>optional</small></span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <button className="primary-action" type="submit">
          Confirm {failurePatternLabel(classification)}
        </button>
      </form>
    </details>
  );
}

function SignificantLevelLibrary({
  session, repository, lowBatches, priceBatches, contextBatches, initialPackId, initialLevelId, initialMonthlyFilter, onPacks,
  focused = false, navigation,active=true,
  levels,
  interactions,
  latestCp,
  proximityPoints,
  onSaveProximity,
  onToggleMap,
  onAddNote,
  onRemoveNote,
  onAddMarketEvent,
  onRemoveMarketEvent,
  onConfirmEpisode,
  onRemoveEpisode,
  onLifecycleAction,
  onEdit,
  onAdd,
  onRemove,
  undoAvailable,
  onUndo,
}: {
  session: JournalSession;
  repository: JournalRepository; lowBatches: FbdBatch[]; priceBatches: PriceHistoryBatch[]; contextBatches: ContextBatch[];
  initialPackId?: string; initialLevelId?: string; onPacks: () => void;
  initialMonthlyFilter?: MonthlyLevelFilter;
  focused?: boolean;active?:boolean;
  navigation?: {selectedId:string|null;onSelect:(id:string|null)=>void;backLabel?:string};
  levels: SignificantLevel[];
  interactions: ReturnType<typeof deriveSignificantLevelInteractions>;
  latestCp: number | null;
  proximityPoints: number;
  onSaveProximity: (points: number) => void;
  onToggleMap: (level: SignificantLevel, enabled: boolean) => void;
  onAddNote: (level: SignificantLevel, text: string, localTime: string) => void;
  onRemoveNote: (level: SignificantLevel, noteId: string) => void;
  onAddMarketEvent: (
    level: SignificantLevel,
    kind: SignificantLevelMarketEventKind,
    localTime: string,
    observedPrice: number | null,
    eventIds: string[],
    note: string,
  ) => Promise<boolean>;
  onRemoveMarketEvent: (level: SignificantLevel, marketEventId: string) => void;
  onConfirmEpisode: (
    level: SignificantLevel,
    interaction: SignificantLevelInteraction,
    classification: SignificantLevelEpisodeClassification,
    localTime: string,
    eventIds: string[],
    note: string,
  ) => void;
  onRemoveEpisode: (level: SignificantLevel, episodeId: string) => void;
  onLifecycleAction: (
    level: SignificantLevel,
    action: SignificantLevelStatusAction,
    details?: SignificantLevelArchiveDetails,
  ) => void;
  onEdit: (levelId: string) => void;
  onAdd: () => void;
  onRemove: (level: SignificantLevel) => void;
  undoAvailable: boolean;
  onUndo: () => void;
}) {
  return <LevelsWorkspace session={session} levels={levels} batches={lowBatches} repository={repository}
    focused={focused} navigation={navigation} active={active}
    initialMonthlyFilter={initialMonthlyFilter}
    priceBatches={priceBatches} contextBatches={contextBatches} initialPackId={initialPackId} initialLevelId={initialLevelId} onAdd={onAdd} onPacks={onPacks}
    mapSettings={<SignificantLevelProximityControl proximityPoints={proximityPoints} onSave={onSaveProximity} />}
    undo={undoAvailable && <button className="undo-action" type="button" onClick={onUndo}>Undo change</button>}
    renderLevel={(level,quality) => <SignificantLevelList
        session={session}
        levels={[level]}
        candidateLevels={levels}
        quality={quality}
        interactions={interactions}
        latestCp={latestCp}
        proximityPoints={proximityPoints}
        showArchived
        onToggleMap={onToggleMap}
        onAddNote={onAddNote}
        onRemoveNote={onRemoveNote}
        onAddMarketEvent={onAddMarketEvent}
        onRemoveMarketEvent={onRemoveMarketEvent}
        onConfirmEpisode={onConfirmEpisode}
        onRemoveEpisode={onRemoveEpisode}
        onLifecycleAction={onLifecycleAction}
        onEdit={onEdit}
        onRemove={onRemove}
        undoAvailable={false}
        onUndo={onUndo}
      />}
  />;
}

function SignificantLevelList({
  session,
  levels,
  candidateLevels,
  quality,
  interactions,
  latestCp,
  proximityPoints,
  showArchived,
  onToggleMap,
  onAddNote,
  onRemoveNote,
  onAddMarketEvent,
  onRemoveMarketEvent,
  onConfirmEpisode,
  onRemoveEpisode,
  onLifecycleAction,
  onEdit,
  onRemove,
  undoAvailable,
  onUndo,
}: {
  session: JournalSession;
  levels: SignificantLevel[];
  candidateLevels?:SignificantLevel[];
  quality?: LevelQuality;
  interactions: ReturnType<typeof deriveSignificantLevelInteractions>;
  latestCp: number | null;
  proximityPoints: number;
  showArchived: boolean;
  onToggleMap: (level: SignificantLevel, enabled: boolean) => void;
  onAddNote: (level: SignificantLevel, text: string, localTime: string) => void;
  onRemoveNote: (level: SignificantLevel, noteId: string) => void;
  onAddMarketEvent: (
    level: SignificantLevel,
    kind: SignificantLevelMarketEventKind,
    localTime: string,
    observedPrice: number | null,
    eventIds: string[],
    note: string,
  ) => Promise<boolean>;
  onRemoveMarketEvent: (level: SignificantLevel, marketEventId: string) => void;
  onConfirmEpisode: (
    level: SignificantLevel,
    interaction: SignificantLevelInteraction,
    classification: SignificantLevelEpisodeClassification,
    localTime: string,
    eventIds: string[],
    note: string,
  ) => void;
  onRemoveEpisode: (level: SignificantLevel, episodeId: string) => void;
  onLifecycleAction: (
    level: SignificantLevel,
    action: SignificantLevelStatusAction,
    details?: SignificantLevelArchiveDetails,
  ) => void;
  onEdit: (levelId: string) => void;
  onRemove: (level: SignificantLevel) => void;
  undoAvailable: boolean;
  onUndo: () => void;
}) {
  const active = levels.filter((level) => level.currentStatus === "active");
  const archived = levels.filter(
    (level) => level.currentStatus !== "active" && level.currentStatus !== "removed",
  );
  const levelIds = new Set(levels.map((level) => level.id));
  const relevantInteractions = interactions.filter((interaction) =>
    levelIds.has(interaction.levelId));
  const [noteLevelId, setNoteLevelId] = useState<string | null>(null);
  const notesRef = useRef<HTMLDetailsElement>(null);

  return (
    <section className="significant-level-list" aria-label="Significant Levels">
      {undoAvailable && (
        <button className="undo-action" type="button" onClick={onUndo}>
          Undo change
        </button>
      )}
      {active.length === 0 ? null : (
        <ul aria-label="Active Significant Levels">
          {active.map((level) => (
            <li key={level.id}>
              <header className="level-detail-heading">
                <strong>{significantLevelPrice(level)}</strong>
                <LevelQualityBadge quality={quality}/>
                <span>{level.sessionEdge ? `${level.sessionEdge.code} · ${level.sessionEdge.status === 'forming' ? 'Forming' : 'Locked'}`
                  : `${levelTypeLabels[level.levelType]}${level.sourceTimeframe !== 'unknown' ? ` · ${levelTimeframeLabels[level.sourceTimeframe]}` : ''}`}</span>
                {level.sessionEdge ? <p>{new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${level.createdInRthDate}T12:00:00Z`))}</p>
                  : displayLevelLabel(level) && <p>{displayLevelLabel(level)}</p>}
              </header>
              <div className="level-quick-actions">
                <button
                  type="button"
                  className="level-map-toggle"
                  aria-pressed={level.showOnMap}
                  onClick={() => onToggleMap(level, !level.showOnMap)}
                >
                  {level.showOnMap ? "Hide from map" : "Show on map"}
                </button>
                <button type="button" onClick={() => {
                  setNoteLevelId(level.id);
                  requestAnimationFrame(() => notesRef.current?.querySelector('textarea')?.focus());
                }}>Add note</button>
              </div>
              {level.showOnMap && level.sessionEdge?.sessionId !== session.id && latestCp !== null && significantLevelDistanceFromPrice(level, latestCp) > proximityPoints &&
                <small className="level-map-hint">Enabled · outside today's map distance</small>}
              <LevelDayRead level={level} session={session} price={latestCp}
                interactions={relevantInteractions.filter(interaction => interaction.levelId === level.id)} />
              <LevelEventMoveSummary levelId={level.id} zone={session.displayTimeZone}/>
              <LevelPriceTracking level={level} session={session} />
              <LevelVisits key={level.id} level={level} session={session} levels={candidateLevels??levels}/>
              <details className="level-notes-detail" ref={notesRef} open={noteLevelId === level.id}
                onToggle={event => setNoteLevelId(event.currentTarget.open ? level.id : null)}>
                <summary>
                  Notes · {level.notes.filter((note) => note.removedAt === null).length +
                    (level.note ? 1 : 0)}
                </summary>
                {level.note && <p><strong>Original</strong> · {level.note}</p>}
                {level.notes.filter((note) => note.removedAt === null).map((note) => (
                  <div className="level-note-row" key={note.id}>
                    <time dateTime={note.observedAt}>{formatClockTime(
                      formatObservationTime(note.observedAt, session.displayTimeZone),
                    )}</time>
                    <p>{note.text}</p>
                    <button
                      className="remove-action"
                      type="button"
                      onClick={() => onRemoveNote(level, note.id)}
                    >Remove</button>
                  </div>
                ))}
                <SignificantLevelNoteForm
                  key={`${level.id}:${level.updatedAt}:note`}
                  session={session}
                  level={level}
                  onSave={(text, localTime) => onAddNote(level, text, localTime)}
                />
              </details>
              <LevelActivity
                session={session}
                level={level}
                allowEntry
                onSave={(kind, localTime, observedPrice, eventIds, note) =>
                  onAddMarketEvent(level, kind, localTime, observedPrice, eventIds, note)}
                onRemove={(marketEventId) => onRemoveMarketEvent(level, marketEventId)}
              />
              <SignificantLevelEpisodeHistory
                session={session}
                level={level}
                onRemove={(episodeId) => onRemoveEpisode(level, episodeId)}
              />

            </li>
          ))}
        </ul>
      )}

      {relevantInteractions.length > 0 && (
        <details className="level-attention">
          <summary>{relevantInteractions.length} recorded level interaction{relevantInteractions.length === 1 ? "" : "s"}</summary>
          <ol aria-label="Significant Level attention">
            {relevantInteractions.map((interaction) => {
              const level = levels.find((candidate) => candidate.id === interaction.levelId);
              const existingEpisode = level?.episodes.find(
                (episode) =>
                  episode.evidenceInteractionId === interaction.id &&
                  episode.removedAt === null,
              );
              const classification: SignificantLevelEpisodeClassification | null =
                interaction.direction === "below_to_above"
                  ? "FBD"
                  : interaction.direction === "above_to_below"
                    ? "FBO"
                    : null;
              const canConfirm =
                level !== undefined &&
                classification !== null &&
                ["crossover", "zone_traversed"].includes(interaction.kind);
              return (
                <li key={interaction.id}>
                  <strong>{significantLevelName(level)}</strong>
                  <span>{significantLevelInteractionLabel(interaction)}</span>
                  {interaction.priorObservedAt && (
                    <small>
                      {interaction.priorCp == null ? "" : formatPriceNumber(interaction.priorCp)} at {formatClockTime(formatObservationTime(
                        interaction.priorObservedAt,
                        session.displayTimeZone,
                      ))} → {formatPriceNumber(interaction.laterCp)} at {formatClockTime(formatObservationTime(
                        interaction.laterObservedAt,
                        session.displayTimeZone,
                      ))}
                    </small>
                  )}
                  {interaction.kind !== "touch" && <em>Exact crossing time unknown</em>}
                  {existingEpisode ? (
                    <strong className="level-episode-confirmed">
                      User-confirmed {failurePatternLabel(existingEpisode.classification)} · {significantLevelEpisodePhaseLabel(
                        existingEpisode.phase,
                      )}
                    </strong>
                  ) : canConfirm && (
                    <SignificantLevelEpisodeConfirmation
                      session={session}
                      level={level}
                      interaction={interaction}
                      classification={classification}
                      onConfirm={(localTime, eventIds, note) => onConfirmEpisode(
                        level,
                        interaction,
                        classification,
                        localTime,
                        eventIds,
                        note,
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {active.map(level => <details key={level.id} className="level-manage-detail">
        <summary>Manage level</summary>
        <small className="level-structure-summary">
          {significantLevelTimeframeLabel(level)}
          {level.producedTwentyPlus ? ` · 20+ ${level.qualifyingMoveDirection}${level.qualifyingMovePoints === null
            ? '' : ` · ${formatPriceNumber(level.qualifyingMovePoints)} points`}` : ' · reference level'}
        </small>
        <div className="level-actions">
          <button type="button" onClick={() => onEdit(level.id)}>{level.sessionEdge ? 'Edit source range' : 'Edit'}</button>
          <LevelArchiveControl level={level} onSave={onLifecycleAction} />
          <button className="remove-action" type="button"
            aria-label={`Remove Significant Level ${significantLevelName(level)}`}
            onClick={() => onRemove(level)}>Remove</button>
        </div>
        <p className="levels-help">
          A lost level may remain active for resistance/support backtests.
          It stays tracked until you archive it with a reason.
        </p>
      </details>)}

      {showArchived && archived.length > 0 && (
        <details className="archived-levels" open>
          <summary>Archived level</summary>
          <ul aria-label="Archived Significant Levels">
            {archived.map((level) => (
              <li key={level.id}>
                <div className="level-summary-row">
                  <span>{level.currentStatus}</span>
                  <strong>{significantLevelName(level)}</strong>
                </div>
                <SignificantLevelEpisodeHistory
                  session={session}
                  level={level}
                  onRemove={(episodeId) => onRemoveEpisode(level, episodeId)}
                />
                <LevelActivity
                  session={session}
                  level={level}
                  allowEntry={false}
                  onSave={async() => false}
                  onRemove={(marketEventId) => onRemoveMarketEvent(level, marketEventId)}
                />
                {level.lifecycleEvents.at(-1)?.archiveDetails && <p>
                  {archiveReasonLabels[level.lifecycleEvents.at(-1)!.archiveDetails!.reason]}
                  {level.lifecycleEvents.at(-1)!.archiveDetails!.note && ` · ${level.lifecycleEvents.at(-1)!.archiveDetails!.note}`}
                </p>}
                <button
                  type="button"
                  onClick={() => onLifecycleAction(
                    level,
                    level.currentStatus === "retired"
                      ? "restored"
                      : "invalidation_corrected",
                  )}
                >
                  {level.currentStatus === "retired"
                    ? "Restore level"
                    : "Undo invalidation"}
                </button>
                <button type="button" onClick={() => onEdit(level.id)}>Edit</button>
                <button
                  className="remove-action"
                  type="button"
                  aria-label={`Remove Significant Level ${significantLevelName(level)}`}
                  onClick={() => onRemove(level)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function OvernightForm({
  session,
  onSave
}: {
  session: JournalSession;
  onSave: (update: OvernightUpdate) => void;
}) {
  const latestForming = latestPreOpenSnapshot(session);
  const [high, setHigh] = useState(
    formatPrice(session.overnight.high ?? latestForming?.formingOvernightHigh ?? null).replace("Pending", ""),
  );
  const [low, setLow] = useState(
    formatPrice(session.overnight.low ?? latestForming?.formingOvernightLow ?? null).replace("Pending", ""),
  );
  const [rthOpen, setRthOpen] = useState(
    formatPrice(session.overnight.rthOpen).replace("Pending", ""),
  );
  const canConfirm = parsePrice(high) !== null && parsePrice(low) !== null;
  const actionLabel =
    session.overnight.status === "confirmed"
      ? "Save correction"
      : canConfirm
        ? "Confirm ON"
        : "Save pending";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          high: parsePrice(high),
          low: parsePrice(low),
          rthOpen: parsePrice(rthOpen),
          confirm: canConfirm
        });
      }}
    >
      {latestForming && (
        <div className="forming-reference">
          <span>
            Latest forming · H {formatPrice(latestForming.formingOvernightHigh)} · L{" "}
            {formatPrice(latestForming.formingOvernightLow)}
          </span>
          <button
            type="button"
            onClick={() => {
              if (latestForming.formingOvernightHigh !== null) {
                setHigh(formatPriceNumber(latestForming.formingOvernightHigh));
              }
              if (latestForming.formingOvernightLow !== null) {
                setLow(formatPriceNumber(latestForming.formingOvernightLow));
              }
            }}
          >
            Use forming values
          </button>
        </div>
      )}
      <p className="stage-helper">
        Review the overnight high and low, adjust if needed, then confirm. Your latest overnight values are filled in for you.
      </p>
      <div className="price-fields">
        <label>
          <span>Completed ON high</span>
          <input inputMode="decimal" value={high} onChange={(event) => setHigh(event.target.value)} />
        </label>
        <label>
          <span>Completed ON low</span>
          <input inputMode="decimal" value={low} onChange={(event) => setLow(event.target.value)} />
        </label>
        <label>
          <span>RTH open <small>optional</small></span>
          <input inputMode="decimal" value={rthOpen} onChange={(event) => setRthOpen(event.target.value)} />
        </label>
      </div>
      <button className="primary-action" type="submit">{actionLabel}</button>
    </form>
  );
}
