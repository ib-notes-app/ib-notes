// SPDX-License-Identifier: MPL-2.0
import { Temporal } from "@js-temporal/polyfill";
import { ES_STUDY_TEMPLATE, type StudyTemplate } from "@ib-field-notes/domain";
export const ES_TEMPLATE = ES_STUDY_TEMPLATE;
export type SupportedDisplayTimeZone = string;

export function checkpointInstant(rthDate: string, localTime: string, timeZone = ES_TEMPLATE.canonicalTimeZone): Temporal.Instant {
  return Temporal.PlainDate.from(rthDate).toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from(localTime) }).toInstant();
}

export function createSessionClock(template: StudyTemplate) {
  const openTime = Temporal.PlainTime.from(template.checkpoints.overnightLock);
  function at(date: string, localTime: string, timeZone = template.canonicalTimeZone) {
    // A session date names its opening day; checkpoints after midnight belong to the following date.
    let day = Temporal.PlainDate.from(date);
    if (timeZone === template.canonicalTimeZone && Temporal.PlainTime.compare(localTime, openTime) < 0) day = day.add({ days: 1 });
    return checkpointInstant(day.toString(), localTime, timeZone);
  }
  function valid(date: string) { return template.weekdays.includes(Temporal.PlainDate.from(date).dayOfWeek); }
  function adjacent(date: string, direction: number) {
    let day = Temporal.PlainDate.from(date);
    do { day = day.add({ days: direction }); } while (!valid(day.toString()));
    return day.toString();
  }
  function overnightStart(date: string) {
    const open = at(date, template.checkpoints.overnightLock);
    let start = checkpointInstant(date, template.overnightStart, template.canonicalTimeZone);
    if (Temporal.Instant.compare(start, open) >= 0) start = checkpointInstant(Temporal.PlainDate.from(date).subtract({ days: 1 }).toString(), template.overnightStart, template.canonicalTimeZone);
    return start;
  }
  function observation(date: string, localTime: string, zone = template.canonicalTimeZone) {
    const start = overnightStart(date), end = at(date, template.checkpoints.studyClose);
    const displayedDate = at(date, template.checkpoints.overnightLock).toZonedDateTimeISO(zone).toPlainDate();
    const candidates = [-1, 0, 1, 2].map((offset) => checkpointInstant(displayedDate.add({ days: offset }).toString(), localTime, zone));
    const inside = candidates.find((value) => Temporal.Instant.compare(value, start) >= 0 && Temporal.Instant.compare(value, end) <= 0);
    if (inside) return inside;
    const distance = (value: Temporal.Instant) => Math.max(start.epochMilliseconds - value.epochMilliseconds, value.epochMilliseconds - end.epochMilliseconds, 0);
    return candidates.reduce((a, b) => distance(a) <= distance(b) ? a : b);
  }
  function launch(now: Temporal.Instant) {
    const today = now.toZonedDateTimeISO(template.canonicalTimeZone).toPlainDate();
    // Prefer a currently open session, including a session extending past midnight.
    for (const offset of [-1, 0]) {
      const date = today.add({ days: offset }).toString();
      if (valid(date) && Temporal.Instant.compare(now, at(date, template.checkpoints.overnightLock)) >= 0 && Temporal.Instant.compare(now, at(date, template.checkpoints.studyClose)) <= 0) return date;
    }
    const date = today.toString();
    const prior = valid(date) ? date : adjacent(date, -1);
    const next = adjacent(prior, 1);
    if (Temporal.Instant.compare(now, overnightStart(next)) >= 0) return next;
    return prior;
  }
  return { checkpointInstant: at, sessionObservationInstant: observation, overnightStart,
    isPotentialRthDate: valid, previousPotentialRthDate: (date: string) => adjacent(date, -1),
    nextPotentialRthDate: (date: string) => adjacent(date, 1), resolveLaunchRthDate: launch,
    displayCheckpoint: (date: string, time: string, zone: string) => at(date, time).toZonedDateTimeISO(zone).toPlainTime().toString({ smallestUnit: "minute" }),
  };
}
const esClock = createSessionClock(ES_TEMPLATE);
export const { displayCheckpoint, sessionObservationInstant, isPotentialRthDate, previousPotentialRthDate, nextPotentialRthDate, resolveLaunchRthDate } = esClock;

export function makeStudyTemplate(input: { id: string; instrument: string; tickSize: number; timeZone: string; open: string; close: string; weekdays: number[]; requiresContract?: boolean }): StudyTemplate {
  const instrument = input.instrument.trim().toUpperCase();
  if (!instrument || instrument.length > 24) throw new Error("Enter a symbol, up to 24 characters.");
  if (!Number.isFinite(input.tickSize) || input.tickSize < 1e-8) throw new Error("Enter the smallest price step, such as 0.25 or 0.01 (at least 0.00000001).");
  Temporal.Now.instant().toZonedDateTimeISO(input.timeZone);
  if (!input.weekdays.length || input.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) throw new Error("Choose at least one study day.");
  const open = Temporal.PlainTime.from(input.open), close = Temporal.PlainTime.from(input.close);
  const seconds = (time: Temporal.PlainTime) => time.hour * 3600 + time.minute * 60 + time.second;
  const duration = (seconds(close) - seconds(open) + 86400) % 86400;
  if (duration <= 3600) throw new Error("Study hours must leave time after the first hour of IB. Choose an end time more than one hour after the open.");
  if (duration > 85500) throw new Error("Leave at least 15 minutes between one study session and the next.");
  const after = (minutes: number) => open.add({ minutes }).toString({ smallestUnit: "second" });
  return { id: input.id, instrument, tickSize: input.tickSize, canonicalTimeZone: input.timeZone,
    weekdays: [...new Set(input.weekdays)].sort(), requiresContract: input.requiresContract ?? false,
    overnightStart: close.add({ minutes: 15 }).toString({ smallestUnit: "second" }),
    checkpoints: { overnightLock: after(0), fifteenMinuteLock: after(15), aLock: after(30), bSnapshot: after(45), ibLock: after(60), studyClose: close.toString({ smallestUnit: "second" }) } };
}
