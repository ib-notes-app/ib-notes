// SPDX-License-Identifier: MPL-2.0
import { packTitle, packDates, packTypes, studyGroupLabel } from './StudyPackLabels';
import type { StudyPackManifest } from '@ib-field-notes/domain';

export function StudyPackDetails({ pack }: { pack: StudyPackManifest }) {
  const c = pack.coverage;
  return <div className="study-pack-details">
    <p className="study-pack-title"><strong>{packTitle('daily', pack.instrument)}</strong><span>{packTypes.daily.description}</span></p>
    <p>{packDates(c.firstDate, c.lastDate)}</p>
    <p>{c.completeRows} complete days · {c.missingRows} days with missing data</p>
    <details>
      <summary>What’s in this pack?</summary>
      <p>Daily IB ranges, first breaks and closing outcomes where recorded. {c.openingRangeRows} days also have overnight and 15R inputs for forecast study. Forecast eligibility requires additional checks.</p>
      <p>News, failed breakdowns and the intraday price path are not imported by this pack format.</p>
      <p>Pacific study hours: 6:30 AM open · 7:30 AM IB close · 1:00 PM day close. Overnight starts at 1:15 PM on the preceding day.</p>
      <p>Original title: {pack.title}</p><p>Version {pack.version} · Data group: {studyGroupLabel(pack.cohort)}</p>
      <p>Source: {pack.source}</p>
      <p>Prepared by {pack.preparedBy}</p>
      <p>Contracts: {c.contracts.join(', ') || 'Not supplied'}{c.unknownContractRows ? ` · ${c.unknownContractRows} days without a contract` : ''}</p>
      {pack.notes.length > 0 && <ul>{pack.notes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
      <p>Extra history can support study; it does not guarantee a more accurate forecast.</p>
    </details>
  </div>;
}
