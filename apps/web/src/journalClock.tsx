// SPDX-License-Identifier: MPL-2.0
import { createContext, useContext, useEffect, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { DEFAULT_JOURNAL, type JournalProfile, type StudyTemplate } from "@ib-field-notes/domain";
import { createSessionClock } from "@ib-field-notes/session-templates";
export const JournalContext = createContext<JournalProfile>(DEFAULT_JOURNAL);
export function journalClock(template: StudyTemplate) {
  const clock = createSessionClock(template);
  return { ...clock, template,
    checkpointLockReached: (date: string, time: string) => Temporal.Instant.compare(Temporal.Now.instant(), clock.checkpointInstant(date, time)) >= 0,
    formatCheckpointTime: (date: string, time: string, zone: string) => clock.checkpointInstant(date, time).toZonedDateTimeISO(zone).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}
export function useJournalClock() { return journalClock(useContext(JournalContext).template); }

/** The active trading date follows Today, including overnight/weekend rules. */
export function useCurrentRthDate() {
  const {template,resolveLaunchRthDate}=useJournalClock();
  const [date,setDate]=useState(()=>resolveLaunchRthDate(Temporal.Now.instant()));
  useEffect(()=>{
    const refresh=()=>setDate(resolveLaunchRthDate(Temporal.Now.instant()));
    refresh();
    const timer=window.setInterval(refresh,60_000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[template]);
  return date;
}
