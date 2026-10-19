// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { summarizeDaySummaries, type WeeklyDaySummary, type WeeklySessionSummary,
  type MonthlySessionSummary, type YearlySessionSummary } from '@ib-field-notes/domain';

type PeriodSummary = WeeklySessionSummary | MonthlySessionSummary | YearlySessionSummary;
export type PeriodShareOptions = { asOfDate?: string };

/** The market's calendar date, independent of the user's display timezone. */
export function periodShareDateAt(instant: string, timeZone: string): string {
  return Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

/** Upcoming pages remain visible as plans, but supply no result or missing-data counts. */
export function periodShareSummary<T extends PeriodSummary>(
  original: T, options: PeriodShareOptions = {},
): T & { upcomingDays: WeeklyDaySummary[] } {
  const cutoff = options.asOfDate;
  const upcomingDays = cutoff ? original.days.filter(day => day.rthDate > cutoff) : [];
  const upcomingIds = new Set(upcomingDays.map(day => day.sessionId));
  const days = original.days.filter(day => !upcomingIds.has(day.sessionId));
  const summary = { ...original, ...summarizeDaySummaries(days), days, upcomingDays };
  if ('weeks' in summary) summary.weeks = summary.weeks.map(week => periodShareSummary(week, options));
  if ('months' in summary) summary.months = summary.months.map(month => periodShareSummary(month, options));
  return summary;
}
