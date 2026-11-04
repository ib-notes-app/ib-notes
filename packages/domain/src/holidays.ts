// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';

/** Day-wide journal context, independent of the exchange's verified hours. */
export type HolidayContext = {
  timeZone: string;
  session: 'regular' | 'early_close' | 'closed';
  closeAt: string | null;
  lowVolume: boolean;
};

export function holidayDayStart(date: string, timeZone: string): string {
  return Temporal.PlainDate.from(date).toZonedDateTime(timeZone).toInstant().toString();
}

export function validateHolidayContext(value: unknown, date: string): HolidayContext {
  if (!value || typeof value !== 'object') throw new Error('Invalid holiday details.');
  const h = value as HolidayContext;
  if (!['regular', 'early_close', 'closed'].includes(h.session) || typeof h.lowVolume !== 'boolean' ||
    typeof h.timeZone !== 'string' || !h.timeZone || h.closeAt !== null && typeof h.closeAt !== 'string') {
    throw new Error('Invalid holiday details.');
  }
  holidayDayStart(date, h.timeZone);
  if (h.closeAt !== null && (h.session !== 'early_close' ||
    Temporal.Instant.from(h.closeAt).toZonedDateTimeISO(h.timeZone).toPlainDate().toString() !== date)) {
    throw new Error('The holiday close time must fall on the selected date.');
  }
  return { timeZone: h.timeZone, session: h.session, closeAt: h.closeAt, lowVolume: h.lowVolume };
}

export function holidayAppliesAt(date: string, holiday: HolidayContext, at: string): boolean {
  return Temporal.Instant.from(at).toZonedDateTimeISO(holiday.timeZone).toPlainDate().toString() === date;
}

export function holidaySummary(holiday: HolidayContext, displayTimeZone: string): string {
  const close = holiday.closeAt ? new Intl.DateTimeFormat('en-US', {
    timeZone: displayTimeZone, hour: 'numeric', minute: '2-digit',
  }).format(new Date(holiday.closeAt)) : null;
  return ['All day', holiday.session === 'closed' ? 'Market closed' : holiday.session === 'early_close'
    ? `Early close${close ? ` ${close}` : ''}` : 'Regular hours', holiday.lowVolume ? 'Low volume' : null]
    .filter(Boolean).join(' · ');
}
