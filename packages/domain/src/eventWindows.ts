// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { JournalSession, MarketContextItem } from './index.ts';

export type ScheduleProvider = 'bls' | 'fred' | 'fed' | 'bea';
export type ScheduledEvent = {
  sourceId: string;
  provider: ScheduleProvider;
  name: string;
  eventAt: string;
  sourceUrl: string;
  fetchedAt: string;
};

export const EVENT_WINDOW = { beforeMinutes: 5, afterMinutes: 15 } as const;

export function validateEventObservationWindow(window:NonNullable<MarketContextItem['observationWindow']>,recordedAt:string){
 const start=Temporal.Instant.from(window.startAt),end=window.endAt===null?null:Temporal.Instant.from(window.endAt);
 if(end&&Temporal.Instant.compare(end,start)<=0)throw Error('The tracking window must end after it starts.');
 return {startAt:start.toString(),endAt:end?.toString()??null,recordedAt:Temporal.Instant.from(recordedAt).toString()};
}
export function eventObservationWindow(item:MarketContextItem){
 if(item.holiday)return null;
 if(item.observationWindow){
  const {startAt,endAt}=item.observationWindow;
  if(!Number.isFinite(Date.parse(startAt))||endAt!==null&&(!Number.isFinite(Date.parse(endAt))||Date.parse(endAt)<=Date.parse(startAt)))return null;
  return {startAt,endAt,explicit:true};
 }
 if(!Number.isFinite(Date.parse(item.eventAt)))return null;
 const release=Temporal.Instant.from(item.eventAt);
 return {startAt:release.subtract({minutes:EVENT_WINDOW.beforeMinutes}).toString(),endAt:release.add({minutes:EVENT_WINDOW.afterMinutes}).toString(),explicit:false};
}

/** Association with a recorded instant, never an inferred crossing between prices. */
export function eventWindowsAt(items: MarketContextItem[], observedAt: string): MarketContextItem[] {
  const at = Date.parse(observedAt);
  return items.filter(item => {
    if (item.holiday) return false; // An all-day holiday is not a release window.
    const window=eventObservationWindow(item);
    return !!window&&at>=Date.parse(window.startAt)&&(window.endAt===null||at<=Date.parse(window.endAt));
  });
}

export function eventFamily(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/^(cpi|consumer price index)\b/.test(normalized)) return 'cpi';
  if (/^(ppi|producer price index)/.test(normalized)) return 'ppi';
  if (/^(nfp|jobs report|employment situation|nonfarm payrolls)\b/.test(normalized)) return 'jobs';
  if (/^(pce|personal income and outlays)\b/.test(normalized)) return 'pce';
  if (/^(gdp|gross domestic product)\b/.test(normalized)) return 'gdp';
  if (/^fomc (decision|meeting)$/.test(normalized)) return 'fomc decision';
  return normalized;
}

export function scheduledEventState(session: JournalSession, event: ScheduledEvent): 'new' | 'saved' | 'changed' | 'removed' {
  const matches = (item: MarketContextItem) => {
    if (!item.schedule) return false;
    if (item.schedule.sourceId === event.sourceId && item.schedule.provider === event.provider) return true;
    // FRED republishes these BLS releases. Switching sources must not resurrect or duplicate them.
    return item.schedule.provider !== event.provider &&
      ['bls', 'fred'].includes(item.schedule.provider) && ['bls', 'fred'].includes(event.provider) &&
      ['cpi', 'ppi', 'jobs'].includes(eventFamily(event.name)) && eventFamily(item.name) === eventFamily(event.name) &&
      Temporal.Instant.from(item.eventAt).toZonedDateTimeISO('America/New_York').toPlainDate().toString() ===
      Temporal.Instant.from(event.eventAt).toZonedDateTimeISO('America/New_York').toPlainDate().toString();
  };
  let saved = session.marketContextItems.find(matches);
  if (saved) return Date.parse(saved.eventAt) === Date.parse(event.eventAt) ? 'saved' : 'changed';
  // Removed and manually corrected copies stay under the user's control.
  const prior = session.marketContextHistory.find(history => history.prior && matches(history.prior))?.prior;
  if (prior) {
    saved = session.marketContextItems.find(item => item.id === prior.id);
    return saved ? (Date.parse(saved.eventAt) === Date.parse(event.eventAt) ? 'saved' : 'changed') : 'removed';
  }
  if (session.marketContextItems.some(item => Date.parse(item.eventAt) === Date.parse(event.eventAt) &&
    eventFamily(item.name) === eventFamily(event.name))) return 'saved';
  return 'new';
}

/** Imports are reviewed snapshots. Refresh never overwrites a user's saved event. */
export function withScheduledEvents(session: JournalSession, events: ScheduledEvent[], recordedAt: string): JournalSession {
  const items = [...session.marketContextItems];
  for (const event of events) {
    const instant = Temporal.Instant.from(event.eventAt);
    // This first adapter serves ES/MES calendar days; display timezone is independent.
    if (instant.toZonedDateTimeISO('America/New_York').toPlainDate().toString() !== session.rthDate) continue;
    if (scheduledEventState({ ...session, marketContextItems: items }, event) !== 'new') continue;
    items.push({
      id: `schedule:${event.provider}:${event.sourceId}`,
      name: event.name,
      eventDate: instant.toZonedDateTimeISO(session.displayTimeZone).toPlainDate().toString(),
      eventAt: instant.toString(),
      note: null,
      source: 'official',
      recordedAt,
      schedule: { sourceId: event.sourceId, provider: event.provider, url: event.sourceUrl,
        fetchedAt: event.fetchedAt, sourceTimeZone: event.provider === 'fred' ? 'America/Chicago' : 'America/New_York' },
    });
  }
  if (items.length === session.marketContextItems.length) return session;
  return { ...session, marketContextItems: items.sort((a, b) => Date.parse(a.eventAt) - Date.parse(b.eventAt)),
    forecastCoverage: { ...session.forecastCoverage, news: 'reviewed' }, updatedAt: recordedAt };
}
