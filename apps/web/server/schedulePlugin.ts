// SPDX-License-Identifier: MPL-2.0
import type { Plugin, Connect } from 'vite';
import type { ScheduleProvider } from '@ib-field-notes/domain';
import type { ScheduleResponse, ScheduleSourceResult } from '../src/scheduleTypes.ts';
import { retainSchedule } from '../src/scheduleTypes.ts';
import { FRED_RELEASES, fredReleaseUrl, parseCalendar, parseFedCalendar, parseFredCalendar, scheduleUrl,
  type FredRelease } from './scheduleParsers.ts';

const MAX_BYTES = 2_000_000;
const CACHE_MS = 6 * 60 * 60_000;
const RETRY_MS = 60_000;

export async function fetchBody(sourceUrl: string, accept: string, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(sourceUrl, {
    signal: AbortSignal.timeout(12_000), redirect: 'error', headers: { Accept: accept },
  });
  if (!response.ok) throw new Error(`Source unavailable (HTTP ${response.status}).`);
  if (!response.body) throw new Error('Source returned an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '', bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('Source response was too large.');
      body += decoder.decode(part.value, { stream: true });
    }
    return body + decoder.decode();
  } finally { await reader.cancel(); }
}

export async function readScheduleSource(provider: ScheduleProvider, month: string,
  fetcher: typeof fetch = fetch, now = new Date().toISOString()): Promise<ScheduleSourceResult> {
  const sourceUrl = scheduleUrl(provider, month);
  const base = { provider, sourceUrl, checkedAt: now };
  try {
    const events = provider === 'fred' ? (await Promise.all(
      (Object.keys(FRED_RELEASES) as FredRelease[]).map(async release =>
        parseFredCalendar(await fetchBody(fredReleaseUrl(month, release), 'text/html', fetcher), month, release, now)),
    )).flat() : provider === 'fed'
      ? parseFedCalendar(await fetchBody(sourceUrl, 'text/html', fetcher), month, now)
      : parseCalendar(await fetchBody(sourceUrl, 'text/calendar', fetcher), provider, month, now);
    return { ...base, status: 'ok', events, message: null };
  } catch (error) {
    return { ...base, status: 'unavailable', events: [], message:
      error instanceof Error && !['TypeError', 'TimeoutError'].includes(error.name)
        ? error.message : 'Could not reach this calendar. Try again later or add an event manually.' };
  }
}

export async function readBlsSchedule(month: string, fetcher: typeof fetch = fetch,
  now = new Date().toISOString()): Promise<ScheduleSourceResult> {
  const primary = await readScheduleSource('bls', month, fetcher, now);
  if (primary.status === 'ok') return primary;
  const backup = await readScheduleSource('fred', month, fetcher, now);
  return { ...backup, message: backup.status === 'ok'
    ? `BLS calendar unavailable. Using the St. Louis Fed backup. ${primary.message ?? ''}`.trim()
    : `BLS: ${primary.message ?? 'Unavailable.'} Backup: ${backup.message ?? 'Unavailable.'}` };
}

/** Coalesce checks; a failed source gets a one-minute retry window instead of six hours. */
export function createScheduleLookup(fetcher: typeof fetch = fetch, clock: () => number = Date.now) {
  const cache = new Map<string, { expiresAt: number; result: Promise<ScheduleResponse> }>();
  return (month: string): Promise<ScheduleResponse> => {
    const previous = cache.get(month);
    if (previous && previous.expiresAt > clock()) return previous.result;
    const now = new Date(clock()).toISOString();
    const entry: { expiresAt: number; result: Promise<ScheduleResponse> } = { expiresAt: Infinity, result: Promise.all([
      readBlsSchedule(month, fetcher, now), readScheduleSource('fed', month, fetcher, now),
      readScheduleSource('bea', month, fetcher, now),
    ]).then(async sources => {
      const incoming = { month, sources };
      entry.expiresAt = clock() + (sources.some(source => source.status === 'unavailable') ? RETRY_MS : CACHE_MS);
      return retainSchedule(incoming, previous ? await previous.result : null);
    }) };
    cache.set(month, entry);
    return entry.result;
  };
}

/** A fixed-source relay for the existing local server. No arbitrary URLs or journal payloads. */
export function schedulePlugin(): Plugin {
  const lookup = createScheduleLookup();
  const handler: Connect.NextHandleFunction = (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/scheduled-events') return next();
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const month = url.searchParams.get('month') ?? '';
    if (request.method !== 'GET' || [...url.searchParams.keys()].some(key => key !== 'month') ||
        !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: 'Choose a valid calendar month.' }));
      return;
    }
    // Avoid using this small local adapter as an unbounded historical crawler.
    const year = Number(month.slice(0, 4));
    const currentYear = new Date().getUTCFullYear();
    if (year < currentYear - 2 || year > currentYear + 1) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: 'Official schedule lookup covers the last two years through next year. Add older events manually.' }));
      return;
    }
    void lookup(month).then(result => response.end(JSON.stringify(result))).catch(() => {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: 'Schedule lookup is unavailable.' }));
    });
  };
  return { name: 'ib-official-schedules',
    configureServer(server) { server.middlewares.use(handler); },
    configurePreviewServer(server) { server.middlewares.use(handler); },
  };
}
