// SPDX-License-Identifier: MPL-2.0
import { eventWindowsAt, holidayAppliesAt, type MarketContextItem } from '@ib-field-notes/domain';

export function EventWindowTags({ items, at }: { items: MarketContextItem[]; at: string }) {
  const names = [...new Set(eventWindowsAt(items, at).map(item => item.name))];
  const holidays = [...new Set(items.filter(item => item.holiday && holidayAppliesAt(item.eventDate, item.holiday, at)).map(item => item.name))];
  if (!names.length && !holidays.length) return null;
  return <span className="event-window-tags" aria-label="Events near this observation">
    {names.map(name => <span key={name} title="This entry was recorded within 5 minutes before or 15 minutes after the event. Timing does not establish cause.">{name} window</span>)}
    {holidays.map(name => <span key={`holiday:${name}`} title="All-day holiday context; this does not establish why price moved.">{name} · all day</span>)}
  </span>;
}
