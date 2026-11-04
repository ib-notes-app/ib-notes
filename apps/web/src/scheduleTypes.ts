// SPDX-License-Identifier: MPL-2.0
import type { ScheduledEvent, ScheduleProvider } from '@ib-field-notes/domain';

export const SCHEDULE_PROVIDERS: Record<ScheduleProvider, string> = {
  bls: 'BLS · CPI, PPI & jobs', fed: 'Federal Reserve · FOMC', bea: 'BEA · GDP & PCE',
  fred: 'St. Louis Fed · CPI, PPI & jobs backup',
};
export type ScheduleSourceResult = {
  provider: ScheduleProvider;
  sourceUrl: string;
  status: 'ok' | 'unavailable';
  checkedAt: string;
  events: ScheduledEvent[];
  message: string | null;
};
export type ScheduleResponse = { month: string; sources: ScheduleSourceResult[] };

/** BLS and its official FRED backup cover the same releases, with distinct provenance. */
export const scheduleCoverage = (provider: ScheduleProvider) => provider === 'fred' ? 'bls' : provider;

export function retainSchedule(incoming: ScheduleResponse, previous: ScheduleResponse | null): ScheduleResponse {
  return { ...incoming, sources: incoming.sources.map(source => {
    const prior = previous?.sources.find(item => scheduleCoverage(item.provider) === scheduleCoverage(source.provider));
    return source.status === 'unavailable' && !source.events.length && prior?.events.length
      ? { ...prior, status: source.status, checkedAt: source.checkedAt,
        message: `${source.message ?? 'Unavailable.'} Previously downloaded events are shown.` }
      : source;
  }) };
}
