// SPDX-License-Identifier: MPL-2.0
import { carryRangeEdgesForward, deriveSessionFinalIb, formatPriceNumber, significantLevelDistanceFromPrice,
  type JournalSession, type SignificantLevel, type SignificantLevelInteraction } from '@ib-field-notes/domain';
import { useContext } from 'react';
import { LevelTrackingContext } from './LevelPriceTracking';
import { levelMapRole } from './mapLevelReferences';

/** Small presentation of recorded facts; it adds no forecast weight or inferred visits. */
export function LevelDayRead({level, session, price, interactions}: {
  level: SignificantLevel; session: JournalSession; price: number | null; interactions: SignificantLevelInteraction[];
}) {
  const sessions = useContext(LevelTrackingContext);
  const role = levelMapRole(level, sessions, session);
  const low = level.price ?? level.zoneLow!, high = level.price ?? level.zoneHigh!;
  const locked = deriveSessionFinalIb(session);
  const a = carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
  const b = carryRangeEdgesForward(session.bPeriod, a, ...session.bSnapshots);
  const highs = [a.high, b.high].filter((value): value is number => value !== null);
  const lows = [a.low, b.low].filter((value): value is number => value !== null);
  const ib = locked ?? (highs.length && lows.length ? {high: Math.max(...highs), low: Math.min(...lows)} : null);
  const points = (value: number) => `${formatPriceNumber(value)} pt`;
  let position = 'Not recorded yet';
  if (ib && ib.high !== null && ib.low !== null) {
    if (low > ib.high) position = `${points(low - ib.high)} above IBH`;
    else if (high < ib.low) position = `${points(ib.low - high)} below IBL`;
    else if (low === high && low === ib.high) position = 'At IBH';
    else if (low === high && low === ib.low) position = 'At IBL';
    else if (low < ib.low && high > ib.high) position = 'Spans the IB';
    else if (low <= ib.low && high >= ib.low) position = 'Overlaps IBL';
    else if (low <= ib.high && high >= ib.high) position = 'Overlaps IBH';
    else {
      const toHigh = ib.high - high, toLow = low - ib.low;
      position = `Inside · ${points(Math.min(toHigh, toLow))} from ${toHigh <= toLow ? 'IBH' : 'IBL'}`;
    }
  }
  const latest = interactions.at(-1);
  const latestText = latest && (latest.kind === 'touch' ? 'Touch' : latest.kind === 'zone_entered' ? 'Zone entry'
    : latest.kind === 'zone_traversed' ? 'Zone crossed' : latest.direction === 'below_to_above' ? 'Crossed above' : 'Crossed below');
  return <section className="level-day-read" aria-label="Level and today's map">
    {(level.levelType !== 'low' || role === 'resistance') && <p className="level-current-role" data-role={role}>
      {{support:'Support', resistance:'Resistance', reference:'Reference level'}[role]}</p>}
    <dl className="level-day-facts">
      <div><dt>From your price</dt><dd>{price === null ? 'Not recorded yet'
        : price >= low && price <= high ? level.shape === 'price_zone' ? 'Inside this zone' : 'At this level'
        : `${points(significantLevelDistanceFromPrice(level, price))} ${price > high ? 'below' : 'above'} price`}</dd></div>
      <div><dt>{locked ? 'Locked IB' : 'Forming IB'}</dt><dd>{position}</dd></div>
    </dl>
    <div className="level-today-interactions"><strong>Today</strong>
      <span>{interactions.length ? `${interactions.length} recorded price interaction${interactions.length === 1 ? '' : 's'}` : 'No price interaction recorded'}</span>
      {latest && <small>{latestText} · {new Intl.DateTimeFormat('en-US', {timeZone:session.displayTimeZone, hour:'numeric', minute:'2-digit'}).format(new Date(latest.laterObservedAt))}</small>}
    </div>
  </section>;
}
