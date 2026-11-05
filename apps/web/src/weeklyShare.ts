import {formatTickRoundedPrice} from './mapFormatting';
// SPDX-License-Identifier: MPL-2.0

import type {
  MonthlySessionSummary,
  PostBreakReturnDepth,
  SessionPeriodStatistics,
  WeeklyDaySummary,
  WeeklySessionSummary,
  YearlySessionSummary,
} from "@ib-field-notes/domain";
import { buildPeriodImageCard, shareOutcomeLabel } from "./periodImageCard";
import { periodShareSummary, type PeriodShareOptions } from './periodShareSummary';
import {buildWeeklyMarketCard} from './weeklyMarketCard';
import type {WeeklyMarketOptions} from './weeklyMarketFacts';

export type WeeklyImageCardResult = {
  width?:number; height?:number;
  svg: string;
  overflow: boolean;
  omittedLineCount: number;
  altText: string;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function displayDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function displayMonth(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function width(value: number | null,tickSize=.01): string {
  return value === null ? "Unavailable" : `${formatTickRoundedPrice(value,tickSize)} pts`;
}

function returnDepth(
  summary: SessionPeriodStatistics & { days: WeeklyDaySummary[] },
  depth: PostBreakReturnDepth,
): { yes: number; known: number } {
  const statuses = summary.days.map((day) => day.returnDepthStatus[depth]);
  return {
    yes: statuses.filter((status) => status === "YES").length,
    known: statuses.filter((status) => status === "YES" || status === "NO").length,
  };
}

function dayTypeLine(summary: SessionPeriodStatistics): string {
  const counts = summary.dayTypeCounts;
  return `IB breaks: High only ${counts.IBH} · Low only ${counts.IBL} · Both ${counts.IBB} · Neither ${counts.IBN}` +
    (summary.unclassifiedDayTypeCount ? ` · Not recorded ${summary.unclassifiedDayTypeCount}` : '');
}

function upcomingLines(days: WeeklyDaySummary[]): string[] {
  return days.length ? ['', 'UPCOMING — excluded from results', ...days.map(day => displayDate(day.rthDate))] : [];
}

function selectedLines(lines: string[]): string[] {
  return lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function buildWeeklyShortShareText(
  summary: WeeklySessionSummary,
  instrument: string,
  commentary: string[] = [],
  options: PeriodShareOptions = {},
): string {
  summary = periodShareSummary(summary, options);
  const lines = [
    `${instrument} · ${displayDate(summary.weekStart)}–${displayDate(summary.weekEnd)} · Weekly IB Notes`,
    `${summary.journaledDays} ${summary.journaledDays === 1 ? 'session' : 'sessions'} · ${summary.completedDays} complete · Median IB ${width(summary.medianIbWidth,options.tickSize)}`,
    dayTypeLine(summary),
    `First break: High ${summary.firstBreakCounts.high} · Low ${summary.firstBreakCounts.low} · Back inside ${summary.returnedInsideAfterBreakDays}/${summary.recordedBreakDays}`,
    ...selectedLines(commentary),
    "Recorded structure · no trade recommendation.",
  ];
  return lines.join("\n");
}

export function buildWeeklyFullShareText(
  summary: WeeklySessionSummary,
  instrument: string,
  commentary: string[] = [],
  options: PeriodShareOptions = {},
): string {
  const view = periodShareSummary(summary, options);
  summary = view;
  const quarter = returnDepth(summary, "QUARTER");
  const midpoint = returnDepth(summary, "MIDPOINT");
  const threeQuarter = returnDepth(summary, "THREE_QUARTER");
  const opposite = returnDepth(summary, "OPPOSITE_EDGE");
  const lines = [
    `IB Notes — Week of ${displayDate(summary.weekStart)}`,
    `${instrument} · ${displayDate(summary.weekStart)}–${displayDate(summary.weekEnd)}`,
    "",
    "Initial Balance (IB): the session’s opening price range.",
    "",
    "COVERAGE",
    `Recorded sessions: ${summary.journaledDays}`,
    `Complete: ${summary.completedDays}`,
    ...(summary.incompleteDays ? [`Unfinished sessions: ${summary.incompleteDays}`] : []),
    `Recorded IB ranges: ${summary.finalIbAvailableDays}`,
    `Median IB width: ${width(summary.medianIbWidth,options.tickSize)}`,
    ...(summary.missingDataCount ? [`Missing journal fields: ${summary.missingDataCount}`] : []),
    "",
    "WHICH IB EDGES BROKE?",
    dayTypeLine(summary).replace("IB breaks: ", ""),
    "",
    "RECORDED BREAK AND RETURN",
    `High edge first: ${summary.firstBreakCounts.high}`,
    `Low edge first: ${summary.firstBreakCounts.low}`,
    ...(summary.firstBreakCounts.notRecorded ? [`First break not recorded: ${summary.firstBreakCounts.notRecorded}`] : []),
    `Returned inside the IB: ${summary.returnedInsideAfterBreakDays}/${summary.recordedBreakDays} days with a recorded break`,
    `Reached 25%: ${quarter.yes}/${quarter.known}`,
    `Reached midpoint: ${midpoint.yes}/${midpoint.known}`,
    `Reached 75%: ${threeQuarter.yes}/${threeQuarter.known}`,
    `Reached opposite edge: ${opposite.yes}/${opposite.known}`,
    "",
    "RECORDED CLOSES",
    `Above the IB high: ${summary.closeDispositionCounts.ABOVE_IBH}`,
    `Inside or on IB: ${summary.closeDispositionCounts.INSIDE_OR_ON_IB}`,
    `Below the IB low: ${summary.closeDispositionCounts.BELOW_IBL}`,
    ...(summary.unavailableCloseCount ? [`Closing price not recorded: ${summary.unavailableCloseCount}`] : []),
    "",
    "CONTRIBUTING DAYS",
    ...summary.days.map((day) =>
      `${day.rthDate} · ${shareOutcomeLabel(day.dayType)} · ${width(day.finalIbWidth,options.tickSize)} · ` +
      `${day.completed ? "Complete" : "Unfinished"}`),
    ...upcomingLines(view.upcomingDays),
  ];
  const selected = selectedLines(commentary);
  if (selected.length > 0) lines.push("", "SELECTED COMMENTARY", ...selected);
  lines.push("", "Recorded market structure only. No trade recommendation.");
  return lines.join("\n");
}

function wrapText(value: string, maximumCharacters: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const rawWord of words) {
    const chunks: string[] = [];
    for (let index = 0; index < rawWord.length; index += maximumCharacters) {
      chunks.push(rawWord.slice(index, index + maximumCharacters));
    }
    for (const word of chunks) {
      if (!line) line = word;
      else if (`${line} ${word}`.length <= maximumCharacters) line = `${line} ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function buildWeeklyImageCardSvg(
  summary: WeeklySessionSummary, instrument: string, commentary: string[] = [],
  options: WeeklyMarketOptions = {},
): WeeklyImageCardResult {
  return buildWeeklyMarketCard(summary,instrument,selectedLines(commentary),options);
}

export function buildMonthlyShortShareText(
  summary: MonthlySessionSummary,
  instrument: string,
  commentary: string[] = [],
  options: PeriodShareOptions = {},
): string {
  summary = periodShareSummary(summary, options);
  return [
    `${instrument} · ${displayMonth(summary.month)} · Monthly IB Notes`,
    `${summary.journaledDays} ${summary.journaledDays === 1 ? 'session' : 'sessions'} · ${summary.completedDays} complete · Median IB ${width(summary.medianIbWidth,options.tickSize)}`,
    dayTypeLine(summary),
    `First break: High ${summary.firstBreakCounts.high} · Low ${summary.firstBreakCounts.low} · Back inside ${summary.returnedInsideAfterBreakDays}/${summary.recordedBreakDays}`,
    ...selectedLines(commentary),
    "Recorded structure · no trade recommendation.",
  ].join("\n");
}

export function buildMonthlyFullShareText(
  summary: MonthlySessionSummary,
  instrument: string,
  commentary: string[] = [],
  options: PeriodShareOptions = {},
): string {
  const view = periodShareSummary(summary, options);
  summary = view;
  const quarter = returnDepth(summary, "QUARTER");
  const midpoint = returnDepth(summary, "MIDPOINT");
  const threeQuarter = returnDepth(summary, "THREE_QUARTER");
  const opposite = returnDepth(summary, "OPPOSITE_EDGE");
  const lines = [
    `IB Notes — ${displayMonth(summary.month)}`,
    `${instrument} · ${displayDate(summary.monthStart)}–${displayDate(summary.monthEnd)}`,
    "",
    "Initial Balance (IB): the session’s opening price range.",
    "",
    "COVERAGE",
    `Recorded sessions: ${summary.journaledDays}`,
    `Complete: ${summary.completedDays}`,
    ...(summary.incompleteDays ? [`Unfinished sessions: ${summary.incompleteDays}`] : []),
    `Recorded IB ranges: ${summary.finalIbAvailableDays}`,
    `Median IB width: ${width(summary.medianIbWidth,options.tickSize)}`,
    ...(summary.missingDataCount ? [`Missing journal fields: ${summary.missingDataCount}`] : []),
    "",
    "WHICH IB EDGES BROKE?",
    dayTypeLine(summary).replace("IB breaks: ", ""),
    "",
    "RECORDED BREAK AND RETURN",
    `High edge first: ${summary.firstBreakCounts.high}`,
    `Low edge first: ${summary.firstBreakCounts.low}`,
    ...(summary.firstBreakCounts.notRecorded ? [`First break not recorded: ${summary.firstBreakCounts.notRecorded}`] : []),
    `Returned inside the IB: ${summary.returnedInsideAfterBreakDays}/${summary.recordedBreakDays} days with a recorded break`,
    `Reached 25%: ${quarter.yes}/${quarter.known}`,
    `Reached midpoint: ${midpoint.yes}/${midpoint.known}`,
    `Reached 75%: ${threeQuarter.yes}/${threeQuarter.known}`,
    `Reached opposite edge: ${opposite.yes}/${opposite.known}`,
    "",
    "RECORDED CLOSES",
    `Above the IB high: ${summary.closeDispositionCounts.ABOVE_IBH}`,
    `Inside or on IB: ${summary.closeDispositionCounts.INSIDE_OR_ON_IB}`,
    `Below the IB low: ${summary.closeDispositionCounts.BELOW_IBL}`,
    ...(summary.unavailableCloseCount ? [`Closing price not recorded: ${summary.unavailableCloseCount}`] : []),
    "",
    "CONTRIBUTING WEEKS",
    ...summary.weeks.filter(week => week.journaledDays > 0).map((week) =>
      `${week.weekStart}–${week.weekEnd} · ${week.journaledDays} day${week.journaledDays === 1 ? "" : "s"} · ` +
      `${week.completedDays} complete · Median IB ${width(week.medianIbWidth,options.tickSize)}`),
    "",
    "CONTRIBUTING DAYS",
    ...summary.days.map((day) =>
      `${day.rthDate} · ${shareOutcomeLabel(day.dayType)} · ${width(day.finalIbWidth,options.tickSize)} · ` +
      `${day.completed ? "Complete" : "Unfinished"}`),
    ...upcomingLines(view.upcomingDays),
  ];
  const selected = selectedLines(commentary);
  if (selected.length > 0) lines.push("", "SELECTED COMMENTARY", ...selected);
  lines.push("", "Recorded market structure only. No trade recommendation.");
  return lines.join("\n");
}

export function buildMonthlyImageCardSvg(
  summary: MonthlySessionSummary, instrument: string, commentary: string[] = [],
  options: PeriodShareOptions = {},
): WeeklyImageCardResult {
  return buildPeriodImageCard(summary,instrument,selectedLines(commentary),options);
}

export function buildYearlyShortShareText(
  summary: YearlySessionSummary,
  instrument: string,
  commentary: string[] = [],
  options: PeriodShareOptions = {},
): string {
  summary = periodShareSummary(summary, options);
  return [
    `${instrument} · ${summary.year} · Yearly IB Notes`,
    `${summary.journaledDays} ${summary.journaledDays === 1 ? 'session' : 'sessions'} · ${summary.completedDays} complete · Median IB ${width(summary.medianIbWidth,options.tickSize)}`,
    dayTypeLine(summary),
    `First break: High ${summary.firstBreakCounts.high} · Low ${summary.firstBreakCounts.low} · Back inside ${summary.returnedInsideAfterBreakDays}/${summary.recordedBreakDays}`,
    ...selectedLines(commentary),
    "Recorded structure · no trade recommendation.",
  ].join("\n");
}

export function buildYearlyFullShareText(
  summary: YearlySessionSummary,
  instrument: string,
  commentary: string[] = [],
  options: PeriodShareOptions = {},
): string {
  const view = periodShareSummary(summary, options);
  summary = view;
  const quarter = returnDepth(summary, "QUARTER");
  const midpoint = returnDepth(summary, "MIDPOINT");
  const threeQuarter = returnDepth(summary, "THREE_QUARTER");
  const opposite = returnDepth(summary, "OPPOSITE_EDGE");
  const lines = [
    `IB Notes — ${summary.year}`,
    `${instrument} · ${displayDate(summary.yearStart)}–${displayDate(summary.yearEnd)}`,
    "",
    "Initial Balance (IB): the session’s opening price range.",
    "",
    "COVERAGE",
    `Recorded sessions: ${summary.journaledDays}`,
    `Complete: ${summary.completedDays}`,
    ...(summary.incompleteDays ? [`Unfinished sessions: ${summary.incompleteDays}`] : []),
    `Recorded IB ranges: ${summary.finalIbAvailableDays}`,
    `Median IB width: ${width(summary.medianIbWidth,options.tickSize)}`,
    ...(summary.missingDataCount ? [`Missing journal fields: ${summary.missingDataCount}`] : []),
    "",
    "WHICH IB EDGES BROKE?",
    dayTypeLine(summary).replace("IB breaks: ", ""),
    "",
    "RECORDED BREAK AND RETURN",
    `High edge first: ${summary.firstBreakCounts.high}`,
    `Low edge first: ${summary.firstBreakCounts.low}`,
    ...(summary.firstBreakCounts.notRecorded ? [`First break not recorded: ${summary.firstBreakCounts.notRecorded}`] : []),
    `Returned inside the IB: ${summary.returnedInsideAfterBreakDays}/${summary.recordedBreakDays} days with a recorded break`,
    `Reached 25%: ${quarter.yes}/${quarter.known}`,
    `Reached midpoint: ${midpoint.yes}/${midpoint.known}`,
    `Reached 75%: ${threeQuarter.yes}/${threeQuarter.known}`,
    `Reached opposite edge: ${opposite.yes}/${opposite.known}`,
    "",
    "RECORDED CLOSES",
    `Above the IB high: ${summary.closeDispositionCounts.ABOVE_IBH}`,
    `Inside or on IB: ${summary.closeDispositionCounts.INSIDE_OR_ON_IB}`,
    `Below the IB low: ${summary.closeDispositionCounts.BELOW_IBL}`,
    ...(summary.unavailableCloseCount ? [`Closing price not recorded: ${summary.unavailableCloseCount}`] : []),
    "",
    "CONTRIBUTING MONTHS",
    ...summary.months.filter(month => month.journaledDays > 0).map((month) =>
      `${displayMonth(month.month)} · ${month.journaledDays} day${month.journaledDays === 1 ? "" : "s"} · ` +
      `${month.completedDays} complete · Median IB ${width(month.medianIbWidth,options.tickSize)}`),
    ...upcomingLines(view.upcomingDays),
  ];
  const selected = selectedLines(commentary);
  if (selected.length > 0) lines.push("", "SELECTED COMMENTARY", ...selected);
  lines.push("", "Recorded market structure only. No trade recommendation.");
  return lines.join("\n");
}

export function buildYearlyImageCardSvg(
  summary: YearlySessionSummary, instrument: string, commentary: string[] = [],
  options: PeriodShareOptions = {},
): WeeklyImageCardResult {
  return buildPeriodImageCard(summary,instrument,selectedLines(commentary),options);
}
