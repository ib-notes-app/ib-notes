// SPDX-License-Identifier: MPL-2.0
import type { FbdBatch, HistoricalIbCohort } from '@ib-field-notes/domain';

export const packTypes = {
  daily: { name: 'IB Pack', description: 'Past IB ranges, breaks, and daily outcomes.' },
  price: { name: 'Price Action Pack', description: 'Follow price movement and watch the IB take shape.' },
  fbd: { name: 'Low Pack', description: 'Significant lows, flushes, and failed breakdowns.' },
  context: { name: 'Context Pack', description: 'News and events surrounding the trading day.' },
} as const;

export const packTitle = (kind: keyof typeof packTypes, instrument?: string) =>
  [instrument, packTypes[kind].name].filter(Boolean).join(' · ');

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
}).format(new Date(`${date}T12:00:00Z`));

export const packDates = (first: string, last: string) =>
  first === last ? dateLabel(first) : `${dateLabel(first)} – ${dateLabel(last)}`;

export function lowPackDates(windows: FbdBatch['windows']): string {
  const first = windows.map(w => w.firstOriginAt.slice(0, 10)).sort()[0];
  const last = windows.map(w => w.cutoffAt.slice(0, 10)).sort().at(-1);
  return first && last ? packDates(first, last) : 'Dates not supplied';
}

// These describe data use, never another pack type. Keep cohorts separate.
export const studyGroupLabel = (cohort: HistoricalIbCohort) =>
  cohort === 'REFERENCE' ? 'Reference history' : 'Separate comparison';

export const ibForecastUse = (cohort: HistoricalIbCohort) => cohort === 'REFERENCE'
  ? 'Eligible days in this IB Pack can support the IB Forecast.'
  : 'These days do not train the IB Forecast. Their completed IB and close can supply prior-day inputs for a later forecast.';

export const packContextUse = (cohort: HistoricalIbCohort) => cohort === 'REFERENCE'
  ? 'This history can add context to future IB Forecasts when earlier-date checks show improvement.'
  : 'Kept for comparison; excluded from forecast learning.';

export function StudyPackGuide() {
  return <details className="study-pack-guide">
    <summary>What can I add?</summary>
    <p>Choose your instrument and month. One Study Pack adds the available material together.</p>
    <dl>
      <div><dt>IB history</dt><dd>Past ranges, breaks and daily outcomes.</dd></div>
      <div><dt>Price maps</dt><dd>Minute prices showing how the IB formed.</dd></div>
      <div><dt>Levels &amp; recoveries</dt><dd>Significant lows and their recorded history.</dd></div>
      <div><dt>Events &amp; holidays</dt><dd>News dates and all-day context, including upcoming events.</dd></div>
    </dl>
    <p>Check the preview for what is included. Add more months to grow your library; choose a newer version to update a month.</p>
    <details><summary>Earlier files &amp; CSVs</summary><p>Individual IB, Price Action, Low and Context Packs still work. The app reads their type automatically.</p></details>
  </details>;
}
