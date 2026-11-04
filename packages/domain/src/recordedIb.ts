// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {carryRangeEdgesForward,deriveSessionFinalIb,type JournalSession,type RangeObservation} from './index';

/** The IB bounds actually recorded before the post-IB path. Reading them never
 * confirms a checkpoint or infers complete coverage of the market. */
export function deriveSessionRecordedIb(session:JournalSession,asOf=session.updatedAt):RangeObservation|null {
  if(session.calendarStatus==='CLOSED')return null;
  const confirmed=deriveSessionFinalIb(session);
  if(confirmed)return confirmed;
  const {checkpoints:c,canonicalTimeZone:timeZone}=session.market;
  let day=Temporal.PlainDate.from(session.rthDate);
  if(Temporal.PlainTime.compare(c.ibLock,c.overnightLock)<0)day=day.add({days:1});
  const lock=day.toZonedDateTime({timeZone,plainTime:c.ibLock}).toInstant();
  if(Temporal.Instant.compare(Temporal.Instant.from(asOf),lock)<0)return null;
  const b=session.bPeriod,snapshots=session.bSnapshots;
  // A/15R alone cannot stand in for an unobserved B period.
  if(b.high===null&&b.low===null&&!snapshots.length)return null;
  const a=carryRangeEdgesForward(session.aPeriod,session.fifteenMinute);
  const range=carryRangeEdgesForward(b,session.fifteenMinute,a,...snapshots);
  if(range.high===null||range.low===null||!Number.isFinite(range.high)||!Number.isFinite(range.low)||range.high<=range.low)return null;
  return {high:range.high,low:range.low,cp:b.cp};
}
