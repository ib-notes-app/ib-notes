import {shareTimeZoneLabel} from './shareTimeZone';
// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber } from "@ib-field-notes/domain";

import { Temporal } from "@js-temporal/polyfill";
import {
  deriveClosingOutcome,
  deriveRange,
  deriveRecordedBreakDayType,
  deriveRthObservationStates,
  deriveSessionFinalIb,
  deriveSessionMissingFields,
  latestCpObservation,
  latestPreOpenSnapshot,
  type CloseDisposition,
  type IbRelationship,
  type IbTransition,
  type JournalSession,
  type RangeObservation,
  type RthObservation,
  type SessionMissingField,
} from "@ib-field-notes/domain";

const TIME_ZONE_LABELS: Record<string, string> = {
  "America/Los_Angeles": "Pacific Time",
  "America/Denver": "Mountain Time",
  "America/Chicago": "Central Time",
  "America/New_York": "Eastern Time",
  UTC: "UTC",
};

const MISSING_FIELD_LABELS: Record<SessionMissingField, string> = {
  CONTRACT: "Exact contract not supplied",
  OVERNIGHT_RANGE: "Completed overnight range pending",
  RTH_OPEN: "RTH opening price not supplied",
  FIFTEEN_MINUTE_RANGE: "Completed 15R range pending",
  A_PERIOD: "Completed A period pending",
  B_PERIOD: "Completed B period pending",
  FINAL_IB: "Final IB unavailable",
  RTH_PATH_COVERAGE: "Full RTH break and return coverage not confirmed",
};

const SHORT_MISSING_FIELD_LABELS: Record<SessionMissingField, string> = {
  CONTRACT: "contract",
  OVERNIGHT_RANGE: "ON",
  RTH_OPEN: "open",
  FIFTEEN_MINUTE_RANGE: "15R",
  A_PERIOD: "A",
  B_PERIOD: "B",
  FINAL_IB: "final IB",
  RTH_PATH_COVERAGE: "complete RTH path",
};

const RELATIONSHIP_LABELS: Record<IbRelationship, string> = {
  IB_UNAVAILABLE: "IB relationship pending",
  ABOVE_IBH_BREAK: "at least 1 tick above IBH",
  ABOVE_IBH_NO_BREAK: "above IBH, under 1 tick",
  AT_IBH: "at IBH",
  INSIDE_IB: "inside IB",
  AT_IBL: "at IBL",
  BELOW_IBL_NO_BREAK: "below IBL, under 1 tick",
  BELOW_IBL_BREAK: "at least 1 tick below IBL",
};

const TRANSITION_LABELS: Record<IbTransition, string> = {
  IBH_BREAK_RECORDED: "IBH break recorded",
  RETURN_INSIDE_FROM_IBH_RECORDED: "IBH edge retested after break",
  IBL_BREAK_RECORDED: "IBL break recorded",
  RETURN_INSIDE_FROM_IBL_RECORDED: "IBL edge retested after break",
};

function formatPrice(value: number | null): string {
  return value === null ? "Pending" : formatPriceNumber(value);
}

function formatClock(instant: string, timeZone: string): string {
  const time = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone);
  const hour = time.hour;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(time.minute).padStart(2, "0")} ${suffix}`;
}

function formatRangeLine(
  label: string,
  range: RangeObservation,
  status: "confirmed" | "pending",
): string {
  const geometry = deriveRange(range);
  if (!geometry) {
    return `${label}: ${formatPrice(range.low)}–${formatPrice(range.high)} · ${status === "confirmed" ? "Confirmed" : "Pending"}`;
  }
  return `${label}: ${formatPrice(range.low)}–${formatPrice(range.high)} · Width ${formatPriceNumber(geometry.width)} · Mid ${formatPriceNumber(geometry.midpoint, 3)} · ${status === "confirmed" ? "Confirmed" : "Pending"}`;
}

function closeDispositionLabel(
  disposition: CloseDisposition,
): string {
  if (disposition === "ABOVE_IBH") return "Above IBH";
  if (disposition === "BELOW_IBL") return "Below IBL";
  return "Inside or on IB";
}

function pathThroughClose(session: JournalSession): RthObservation[] {
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
      id: "share-session-close",
      price: session.close.price,
      observedAt: session.close.observedAt,
      recordedAt: session.close.recordedAt,
      note: null,
      cpObservationId: null,
    },
  ];
}

export type ShortPostShareOptions = {
  showTimes?:boolean;
  includeOvernight: boolean;
  includeFinalIb: boolean;
  includePath: boolean;
  includeCurrentOrClose: boolean;
  includeEvents: boolean;
  includeMissing: boolean;
  selectedOptionalLines: string[];
};

export const DEFAULT_SHORT_POST_SHARE_OPTIONS: ShortPostShareOptions = {
  includeOvernight: true,
  includeFinalIb: true,
  includePath: true,
  includeCurrentOrClose: true,
  includeEvents: false,
  includeMissing: false,
  selectedOptionalLines: [],
};

function compactRecordedPath(
  states: ReturnType<typeof deriveRthObservationStates>,
): string | null {
  const tokens: string[] = [];
  const add = (token: string) => {
    if (tokens.at(-1) !== token) tokens.push(token);
  };

  states.forEach((state, index) => {
    if (index === 0) {
      if (state.relationship === "ABOVE_IBH_BREAK") add("IBH break");
      if (state.relationship === "BELOW_IBL_BREAK") add("IBL break");
    }
    for (const transition of state.transitions) {
      if (transition === "IBH_BREAK_RECORDED") add("IBH break");
      if (transition === "RETURN_INSIDE_FROM_IBH_RECORDED") add("IBH retest");
      if (transition === "IBL_BREAK_RECORDED") add("IBL break");
      if (transition === "RETURN_INSIDE_FROM_IBL_RECORDED") add("IBL retest");
    }
  });

  return tokens.length > 0 ? tokens.join(" → ") : null;
}

export type CompactShareFacts = {
  overnightRange: {
    high: number | null;
    low: number | null;
    status: "Locked" | "Forming";
  } | null;
  finalIb: RangeObservation | null;
  classification: string;
  status: "Final" | "Provisional";
  path: string | null;
  currentOrClose: string | null;
  events: string[];
};

function shareOvernightRange(session: JournalSession): CompactShareFacts["overnightRange"] {
  const latestPreOpen = latestPreOpenSnapshot(session);
  const high = session.overnight.high ?? latestPreOpen?.formingOvernightHigh ?? null;
  const low = session.overnight.low ?? latestPreOpen?.formingOvernightLow ?? null;
  if (high === null && low === null) return null;
  return {
    high,
    low,
    status: session.overnight.status === "confirmed" ? "Locked" : "Forming",
  };
}

export function deriveCompactShareFacts(
  session: JournalSession,
  tickSize = session.market.tickSize,
  showTimes = true,
): CompactShareFacts {
  const finalIb = deriveSessionFinalIb(session);
  const path = pathThroughClose(session);
  const states = deriveRthObservationStates(path, finalIb, tickSize);
  const closingOutcome = deriveClosingOutcome(session, finalIb, tickSize);
  const recordedDayType = deriveRecordedBreakDayType(path, finalIb, tickSize);
  const classification = closingOutcome?.breakCode ?? recordedDayType ?? "In progress";
  const status = closingOutcome?.status === "final" ? "Final" : "Provisional";
  let currentOrClose: string | null = null;

  if (session.close.price !== null) {
    const location = closingOutcome
      ? closeDispositionLabel(closingOutcome.closeDisposition).replace(/^./,letter=>letter.toLowerCase())
      : "location pending";
    currentOrClose = `Close ${formatPriceNumber(session.close.price)} · ${location}`;
  } else {
    const latestCp = latestCpObservation(session);
    if (latestCp) {
      currentOrClose =
        `CP ${formatPriceNumber(latestCp.price)}${showTimes?` · ${formatClock(latestCp.observedAt, session.displayTimeZone)}`:''}`;
    }
  }

  const events = [...session.marketContextItems]
    .sort((left, right) => left.eventAt.localeCompare(right.eventAt))
    .map((item) => `${item.holiday ? 'All day ' : showTimes?`${formatClock(item.eventAt, session.displayTimeZone)} `:''}${item.name}`);

  return {
    overnightRange: shareOvernightRange(session),
    finalIb,
    classification,
    status,
    path: compactRecordedPath(states),
    currentOrClose,
    events,
  };
}

/** Builds a compact draft without truncating selected content. */
export function buildShortPostShareText(
  session: JournalSession,
  options: ShortPostShareOptions = DEFAULT_SHORT_POST_SHARE_OPTIONS,
  tickSize = session.market.tickSize,
): string {
  const facts = deriveCompactShareFacts(session, tickSize, options.showTimes!==false);
  const lines = [
    `${session.instrument} ${session.rthDate} · ${facts.classification} · ${facts.status}${options.showTimes===false?'':` · ${shareTimeZoneLabel(session)}`}`,
  ];

  if (options.includeOvernight && facts.overnightRange) {
    const overnightGeometry = deriveRange({
      high: facts.overnightRange.high,
      low: facts.overnightRange.low,
      cp: null,
    });
    const label = facts.overnightRange.status === "Locked" ? "ON" : "Forming ON";
    lines.push(
      `${label} ${formatPrice(facts.overnightRange.low)}–${formatPrice(facts.overnightRange.high)}` +
      `${overnightGeometry ? ` · ${formatPriceNumber(overnightGeometry.width)} pts` : ""}`,
    );
  }

  if (
    options.includeFinalIb &&
    facts.finalIb?.high !== null &&
    facts.finalIb?.high !== undefined &&
    facts.finalIb.low !== null
  ) {
    const geometry = deriveRange(facts.finalIb);
    lines.push(
      `IB ${formatPriceNumber(facts.finalIb.low)}–${formatPriceNumber(facts.finalIb.high)}${geometry ? ` · ${formatPriceNumber(geometry.width)} pts` : ""}`,
    );
  }

  if (options.includePath && facts.path) lines.push(`Path: ${facts.path}`);

  if (options.includeCurrentOrClose && facts.currentOrClose) {
    lines.push(facts.currentOrClose);
  }

  if (options.includeEvents && facts.events.length > 0) {
    lines.push(`Events: ${facts.events.join(", ")}`);
  }

  if (options.includeMissing) {
    const missing = deriveSessionMissingFields(session, facts.finalIb);
    if (missing.length > 0) {
      lines.push(`Missing: ${missing.map((item) => SHORT_MISSING_FIELD_LABELS[item]).join(", ")}`);
    }
  }

  for (const line of options.selectedOptionalLines) {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  }

  lines.push("Journaled structure · no trade recommendation.");
  return lines.join("\n");
}

/**
 * Builds the exact local text shown to the user before copying. This function
 * deliberately has no Significant Level, Trash, audit, storage, or research
 * input. Freeform notes present inside the session are never read.
 */
export function buildDailyShareText(
  session: JournalSession,
  tickSize = session.market.tickSize,
  showTimes = true,
): string {
  const finalIb = deriveSessionFinalIb(session);
  const overnightRange = shareOvernightRange(session);
  const path = pathThroughClose(session);
  const states = deriveRthObservationStates(path, finalIb, tickSize);
  const closingOutcome = deriveClosingOutcome(session, finalIb, tickSize);
  const recordedDayType = deriveRecordedBreakDayType(path, finalIb, tickSize);
  const status = closingOutcome?.status === "final" ? "FINAL" : "PROVISIONAL";
  const contract = session.contractStatus === "known" && session.contract
    ? session.contract
    : "Contract unknown";
  const timeZone = TIME_ZONE_LABELS[session.displayTimeZone] ?? session.displayTimeZone;
  const lines = [
    `IB Notes — ${session.rthDate}`,
    `${session.instrument} · ${contract}${showTimes?` · ${timeZone}`:''}`,
    `Status: ${status}`,
    "",
    "FORMATION",
    formatRangeLine(
      overnightRange?.status === "Locked" ? "ON" : "Forming ON",
      {
        high: overnightRange?.high ?? null,
        low: overnightRange?.low ?? null,
        cp: null,
      },
      overnightRange?.status === "Locked" ? "confirmed" : "pending",
    ),
    formatRangeLine("15R", session.fifteenMinute, session.fifteenMinute.status),
    formatRangeLine("A", session.aPeriod, session.aPeriod.status),
    formatRangeLine("B", session.bPeriod, session.bPeriod.status),
    formatRangeLine(
      "Final IB",
      finalIb ?? { high: null, low: null, cp: null },
      finalIb ? "confirmed" : "pending",
    ),
  ];

  if (session.marketContextItems.length > 0) {
    lines.push("", "MARKET CONTEXT");
    for (const item of [...session.marketContextItems].sort((left, right) =>
      left.eventAt.localeCompare(right.eventAt))) {
      const date = item.eventDate === session.rthDate ? "" : `${item.eventDate} · `;
      lines.push(`${date}${item.holiday ? 'All day — ' : showTimes?`${formatClock(item.eventAt, session.displayTimeZone)} — `:''}${item.name}`);
    }
  }

  lines.push("", "RECORDED PATH");
  if (states.length === 0) {
    lines.push("No post-lock observations supplied.");
  } else {
    for (const state of states) {
      const closeLabel = state.observation.id === "share-session-close" ? " · Close" : "";
      const transitions = state.transitions.map((transition) =>
        TRANSITION_LABELS[transition]).join(" · ");
      lines.push(
        `${showTimes?`${formatClock(state.observation.observedAt, session.displayTimeZone)} — `:''}${formatPriceNumber(state.observation.price)}${closeLabel} · ${RELATIONSHIP_LABELS[state.relationship]}${transitions ? ` · ${transitions}` : ""}`,
      );
    }
  }

  lines.push("", "OUTCOME");
  lines.push(`Day type: ${closingOutcome?.dayType ?? recordedDayType ?? "Not established"}`);
  lines.push(`Close: ${formatPrice(session.close.price)}`);
  lines.push(
    `Close location: ${closingOutcome ? closeDispositionLabel(closingOutcome.closeDisposition) : "Pending"}`,
  );
  lines.push(`Break code: ${closingOutcome?.breakCode ?? "Pending"}`);

  const missing = deriveSessionMissingFields(session, finalIb);
  if (missing.length > 0) {
    lines.push("", "MISSING / UNKNOWN");
    for (const item of missing) lines.push(`• ${MISSING_FIELD_LABELS[item]}`);
  }

  lines.push("", "Recorded market structure only. No trade recommendation.");
  return lines.join("\n");
}

export function appendSelectedShareContent(
  text: string,
  selectedOptionalLines: string[],
): string {
  const selected = selectedOptionalLines.map((line) => line.trim()).filter(Boolean);
  if (selected.length === 0) return text;
  return `${text}\n\nSELECTED CONTENT\n${selected.join("\n")}`;
}
