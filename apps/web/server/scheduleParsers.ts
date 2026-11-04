// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { ScheduledEvent, ScheduleProvider } from '@ib-field-notes/domain';

export const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];
export function scheduleUrl(provider: ScheduleProvider, month: string): string {
  if (provider === 'bls') return 'https://www.bls.gov/schedule/news_release/bls.ics';
  if (provider === 'bea') return 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics';
  if (provider === 'fred') return `https://fred.stlouisfed.org/releases/calendar?y=${month.slice(0, 4)}&m=${Number(month.slice(5))}`;
  return `https://www.federalreserve.gov/newsevents/${month.slice(0, 4)}-${MONTH_NAMES[Number(month.slice(5)) - 1]}.htm`;
}

function eventName(title: string, provider: ScheduleProvider): string | null {
  if (provider === 'bls') {
    if (/^Consumer Price Index\b/i.test(title)) return 'CPI';
    if (/^Producer Price Index/i.test(title)) return 'PPI';
    if (/^Employment Situation\b/i.test(title)) return 'Jobs report (NFP)';
  }
  if (provider === 'bea') {
    if (/^Personal Income and Outlays\b/i.test(title)) return 'PCE / Personal income';
    if (/^(GDP\s*\(|Gross Domestic Product\s*,)/i.test(title)) return 'GDP';
  }
  return null;
}

/** The adapters accept timed single events only, not recurrence rules or all-day guesses. */
export function parseCalendar(body: string, provider: 'bls' | 'bea', month: string, fetchedAt: string): ScheduledEvent[] {
  const unfolded = body.replace(/\r?\n[ \t]/g, '');
  if (!unfolded.includes('BEGIN:VCALENDAR') || !unfolded.includes('END:VCALENDAR')) {
    throw new Error('Calendar format unavailable.');
  }
  const events: ScheduledEvent[] = [];
  const months: string[] = [];
  for (const match of unfolded.matchAll(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/g)) {
    const lines = match[1]!.split(/\r?\n/);
    const value = (key: string) => lines.find(line => line.startsWith(`${key}:`))?.slice(key.length + 1);
    const title = (value('SUMMARY') ?? '').replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
    const name = eventName(title, provider);
    if (value('STATUS') === 'CANCELLED') continue;
    const start = lines.find(line => /^DTSTART[;:]/.test(line));
    const raw = start?.slice(start.indexOf(':') + 1);
    const date = raw?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
    if (!date || !start) {
      if (name) throw new Error('Some release times are not published. Check the source calendar.');
      continue;
    }
    if (name && lines.some(line => /^(RRULE|RECURRENCE-ID)[;:]/.test(line))) {
      throw new Error('Calendar uses an unsupported repeating event.');
    }
    const local = `${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:${date[6]}`;
    let instant: Temporal.Instant;
    if (date[7]) instant = Temporal.Instant.from(`${local}Z`);
    else {
      const tz = start.match(/TZID=([^;:]+)/)?.[1]?.replaceAll('"', '') ?? 'America/New_York';
      // BLS publishes Eastern times; a provider format change must not silently shift them.
      if (!['America/New_York', 'US/Eastern', 'US-Eastern', 'Eastern Standard Time'].includes(tz)) {
        throw new Error('Calendar timezone was not recognized.');
      }
      instant = Temporal.PlainDateTime.from(local).toZonedDateTime('America/New_York', { disambiguation: 'reject' }).toInstant();
    }
    const eventMonth = instant.toZonedDateTimeISO('America/New_York').toPlainDate().toString().slice(0, 7);
    months.push(eventMonth);
    if (!name || eventMonth !== month) continue;
    const uid = value('UID');
    if (!uid) throw new Error('Calendar event identity is missing.');
    events.push({ sourceId: uid, provider, name, eventAt: instant.toString(),
      sourceUrl: scheduleUrl(provider, month), fetchedAt });
  }
  months.sort();
  if (!months.length || month < months[0]! || month > months.at(-1)!) {
    throw new Error('This month is not covered by the published calendar.');
  }
  return events;
}

const htmlText = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

export const FRED_RELEASES = {
  '10': { title: 'Consumer Price Index', name: 'CPI' },
  '46': { title: 'Producer Price Index', name: 'PPI' },
  '50': { title: 'Employment Situation', name: 'Jobs report (NFP)' },
} as const;
export type FredRelease = keyof typeof FRED_RELEASES;
export const fredReleaseUrl = (month: string, release: FredRelease) => `${scheduleUrl('fred', month)}&rid=${release}`;

/** Reads one filtered release calendar. The unfiltered page is paginated and is not coverage evidence. */
export function parseFredCalendar(body: string, month: string, release: FredRelease, fetchedAt: string): ScheduledEvent[] {
  const monthName = MONTH_NAMES[Number(month.slice(5)) - 1]!;
  const heading = htmlText(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const expected = FRED_RELEASES[release];
  const table = body.match(/<div id="release-dates-pager">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1];
  if (!heading.toLowerCase().includes(`${monthName.slice(0, 3)}, ${month.slice(0, 4)}`) ||
      !heading.includes(` - ${expected.title} | FRED |`) || table === undefined ||
      !body.includes('All times are US Central Time.')) throw new Error('Backup calendar format or timezone unavailable.');
  const events: ScheduledEvent[] = [];
  let date: string | null = null;
  for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = match[1]!;
    const day = htmlText(row).match(/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) ([A-Za-z]+) (\d{1,2}), (\d{4})\b/);
    if (day) {
      if (day[1]!.toLowerCase() !== monthName || day[3] !== month.slice(0, 4)) throw new Error('Backup calendar returned another month.');
      date = Temporal.PlainDate.from(`${month}-${day[2]!.padStart(2, '0')}`).toString();
      continue;
    }
    const link = row.match(/<a href="\/release\?rid=(\d+)">([^<]+)<\/a>/);
    if (!link || link[1] !== release || htmlText(link[2]!) !== expected.title) throw new Error('Backup calendar release rows could not be read.');
    const clock = htmlText(row.match(/<td\b[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? '').match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!date || !clock || Number(clock[1]) < 1 || Number(clock[1]) > 12 || Number(clock[2]) > 59) {
      throw new Error('A backup release time is not published. Check the source calendar.');
    }
    const hour = Number(clock[1]) % 12 + (clock[3]!.toLowerCase() === 'pm' ? 12 : 0);
    const eventAt = Temporal.PlainDateTime.from(`${date}T${String(hour).padStart(2, '0')}:${clock[2]}`)
      .toZonedDateTime('America/Chicago', { disambiguation: 'reject' }).toInstant().toString();
    events.push({ sourceId: `${release}:${date}`, provider: 'fred', name: expected.name, eventAt,
      sourceUrl: fredReleaseUrl(month, release), fetchedAt });
  }
  const count = htmlText(body).match(/Releases (\d+) - (\d+) of (\d+)\b/);
  if (!count || Number(count[3]) !== events.length || Number(count[2]) !== events.length ||
      (events.length && Number(count[1]) !== 1)) throw new Error('Backup calendar coverage could not be confirmed.');
  return events;
}

/** Reads the official monthly rows, including their published time; never a two-day date range. */
export function parseFedCalendar(body: string, month: string, fetchedAt: string): ScheduledEvent[] {
  const monthName = MONTH_NAMES[Number(month.slice(5)) - 1]!;
  const heading = `${monthName} ${month.slice(0, 4)}`;
  if (!htmlText(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').toLowerCase().includes(heading) ||
      !body.includes('cal-nojs__rowTitle')) throw new Error('Monthly calendar unavailable.');
  const events: ScheduledEvent[] = [];
  for (const row of body.split(/<div class="panel-body">/).slice(1)) {
    const cell = (column: number) => row.match(new RegExp(`<div class="col-xs-${column}">([\\s\\S]*?)</div>`))?.[1];
    const content = cell(7);
    if (!content) continue;
    const title = htmlText(content.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const name = title === 'FOMC Meeting' ? 'FOMC decision' :
      title === 'FOMC Minutes' ? 'FOMC minutes' : title === 'FOMC Press Conference' ? 'FOMC press conference' : null;
    if (!name) continue;
    const clock = htmlText(cell(2) ?? '').replaceAll('.', '').match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    const day = htmlText(cell(3) ?? '');
    if (!clock || !/^\d{1,2}$/.test(day) || Number(clock[1]) < 1 || Number(clock[1]) > 12) {
      throw new Error('An FOMC release time is not published. Check the source calendar.');
    }
    const hour = Number(clock[1]) % 12 + (clock[3]!.toLowerCase() === 'pm' ? 12 : 0);
    const date = `${month}-${day.padStart(2, '0')}`;
    const at = Temporal.PlainDateTime.from(`${date}T${String(hour).padStart(2, '0')}:${clock[2]}`)
      .toZonedDateTime('America/New_York', { disambiguation: 'reject' }).toInstant().toString();
    events.push({ sourceId: `${date}:${name}`, provider: 'fed', name, eventAt: at,
      sourceUrl: scheduleUrl('fed', month), fetchedAt });
  }
  // A changed layout is an unavailable source, never evidence of a quiet day.
  if (/FOMC (Meeting|Minutes|Press Conference)<\/p>|>FOMC Press Conference<\/a>/.test(body) && !events.length) {
    throw new Error('FOMC calendar rows could not be read.');
  }
  return events;
}
