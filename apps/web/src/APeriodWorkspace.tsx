// SPDX-License-Identifier: MPL-2.0
import { useEffect, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { carryRangeEdgesForward, type FifteenMinuteUpdate, type JournalSession } from "@ib-field-notes/domain";
import { createSessionClock } from "@ib-field-notes/session-templates";

type SaveResult = Promise<string | null>;
export type ARangeEntry = { update: FifteenMinuteUpdate; observedAt: string; target: "15R" | "A"; confirm: boolean };

function rangeInstant(session: JournalSession, localTime: string) {
  return createSessionClock(session.market).sessionObservationInstant(session.rthDate, localTime, session.displayTimeZone);
}

// The entered time stays with the draft, even if the clock crosses a lock.
export function aRangeEntry(session: JournalSession, update: FifteenMinuteUpdate, localTime: string, now: string): ARangeEntry {
  const ES_TEMPLATE = session.market;
  const { checkpointInstant } = createSessionClock(ES_TEMPLATE);
  const observed = rangeInstant(session, localTime);
  const open = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.overnightLock);
  const fifteen = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.fifteenMinuteLock);
  const end = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.aLock);
  if (Temporal.Instant.compare(observed, open) < 0 || Temporal.Instant.compare(observed, end) > 0) {
    throw new Error("Enter a time within A period. Use Record for other price observations.");
  }
  if (Temporal.Instant.compare(observed, Temporal.Instant.from(now)) > 0) {
    throw new Error("The range time cannot be in the future.");
  }
  const target = Temporal.Instant.compare(observed, fifteen) < 0 ? "15R" : "A";
  if (target === "15R" && session.fifteenMinute.status === "confirmed") {
    throw new Error("15R is already confirmed. Open its review to correct the completed range.");
  }
  if (target === "A" && Temporal.Instant.compare(observed, end) < 0 && session.aPeriod.status === "confirmed") {
    throw new Error("A is already confirmed. Use its closing time to correct the completed range.");
  }
  return { update, observedAt: observed.toString(), target,
    confirm: target === "A" && Temporal.Instant.compare(observed, end) === 0 };
}

const priceText = (value: number | null) => value === null ? "" : String(value);
function parseRange(high: string, low: string, cp: string, note: string): FifteenMinuteUpdate {
  const numbers = [high, low, cp].map((text) => text.trim() === "" ? null : Number(text));
  if (numbers.some((value) => value !== null && !Number.isFinite(value))) {
    throw new Error("Enter prices as numbers without commas.");
  }
  return { high: numbers[0], low: numbers[1], cp: numbers[2], note };
}

export function APeriodWorkspace({ session, onSave, onConfirm15R, targetPhase }: {
  session: JournalSession;
  targetPhase?: "A";
  onSave: (entry: ARangeEntry) => SaveResult;
  onConfirm15R: (update: FifteenMinuteUpdate) => SaveResult;
}) {
  const ES_TEMPLATE = session.market;
  const { checkpointInstant } = createSessionClock(ES_TEMPLATE);
  const open = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.overnightLock);
  const fifteen = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.fifteenMinuteLock);
  const end = checkpointInstant(session.rthDate, ES_TEMPLATE.checkpoints.aLock);
  const [now, setNow] = useState(() => Temporal.Now.instant());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Temporal.Now.instant()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const clockLabel = (instant: Temporal.Instant) => instant.toZonedDateTimeISO(session.displayTimeZone)
    .toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  const defaultTime = (instant: Temporal.Instant) => {
    const minimum = targetPhase ? fifteen : open;
    const initial = Temporal.Instant.compare(instant, minimum) < 0 ? minimum : Temporal.Instant.compare(instant, end) > 0 ? end : instant;
    return initial.toZonedDateTimeISO(session.displayTimeZone).toPlainTime().toString({ smallestUnit: "second" });
  };
  const [localTime, setLocalTime] = useState(() => defaultTime(now));
  const [timeIsAutomatic, setTimeIsAutomatic] = useState(!targetPhase);
  const selected = localTime ? rangeInstant(session, localTime) : null;
  const early = selected !== null && Temporal.Instant.compare(selected, fifteen) < 0;
  const completed = selected !== null && Temporal.Instant.compare(selected, end) === 0;
  const initialRange = early ? session.fifteenMinute : carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
  const [high, setHigh] = useState(priceText(initialRange.high));
  const [low, setLow] = useState(priceText(initialRange.low));
  const [note, setNote] = useState(completed || targetPhase ? session.aPeriod.note ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked15R = Temporal.Instant.compare(now, fifteen) >= 0;
  const [reviewOpen, setReviewOpen] = useState(locked15R && session.fifteenMinute.status !== "confirmed");
  const label15R = session.fifteenMinute.status === "confirmed" ? "Confirmed" : "Pending confirmation";
  useEffect(() => {
    if (!timeIsAutomatic) return;
    const time = defaultTime(now);
    const nextEarly = Temporal.Instant.compare(rangeInstant(session, time), fifteen) < 0;
    if (nextEarly !== early) {
      const range = nextEarly ? session.fifteenMinute : carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
      setHigh(priceText(range.high)); setLow(priceText(range.low)); setNote("");
    }
    setLocalTime(time);
  }, [now, timeIsAutomatic]);
  function keepDraftTime() {
    if (timeIsAutomatic) setLocalTime(defaultTime(Temporal.Now.instant()));
    setTimeIsAutomatic(false);
  }

  return <section className="stage-card focused-stage-card a-workspace" aria-label="A period">
    <header className="focused-stage-heading"><span><h2>A period</h2><small>{clockLabel(open)}–{clockLabel(end)}</small></span>
      <strong>{session.aPeriod.status === "confirmed" ? "Confirmed" : Temporal.Instant.compare(now, end) >= 0 ? "Pending" : "Forming"}</strong></header>
    <div className="stage-content">
      {!targetPhase&&<details className="a-fifteen-review" open={reviewOpen} onToggle={(event) => setReviewOpen(event.currentTarget.open)}>
        <summary>15R · {locked15R ? label15R : "Forming"}</summary>
        <p className="stage-helper">First 15 minutes · ends {clockLabel(fifteen)}. Confirm the completed range to supply IB Forecast.</p>
        <FifteenReview session={session} locked={locked15R} blocked={busy} onSave={async (update) => {
          setBusy(true);
          try { return await onConfirm15R(update); }
          finally { setBusy(false); }
        }} />
      </details>}
      {!targetPhase&&!reviewOpen && locked15R && session.fifteenMinute.status !== "confirmed" && <p className="stage-helper">Open 15R above to review and confirm its completed edges.</p>}
      <form onSubmit={async (event) => {
        event.preventDefault(); if (busy) return;
        setError(null); setBusy(true);
        try {
          const savedAt = Temporal.Now.instant();
          const entry=aRangeEntry(session, parseRange(high, low, "", note), timeIsAutomatic ? defaultTime(savedAt) : localTime, savedAt.toString());
          if(targetPhase&&entry.target!==targetPhase)throw new Error("This time belongs to 15R. Open 15R, or keep the time within the selected A phase.");
          setError(await onSave(entry));
        }
        catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
        finally { setBusy(false); }
      }}>
        <div className="period-form-heading"><h3>{early ? "Opening range" : completed ? "Completed A" : "A so far"}</h3>
        <button className="primary-action" type="submit" disabled={busy}>{busy ? "Saving…" : completed
          ? session.aPeriod.status === "confirmed" ? "Save A correction" : "Confirm A period"
          : "Save forming range"}</button></div>
        <p className="range-purpose">{early ? "Builds 15R and A" : completed ? "Review A, including 15R" : "Updates A only"}</p>
        <div className="price-fields">
          <label>A high<input inputMode="decimal" value={high} onChange={(event) => { keepDraftTime(); setHigh(event.target.value); }} /></label>
          <label>A low<input inputMode="decimal" value={low} onChange={(event) => { keepDraftTime(); setLow(event.target.value); }} /></label>

        </div>
        <label className="range-time-control">Range time<input type="time" step="1" required value={localTime} onChange={(event) => {
          setTimeIsAutomatic(false);
          const nextTime = event.target.value;
          if (nextTime) {
            const nextEarly = Temporal.Instant.compare(rangeInstant(session, nextTime), fifteen) < 0;
            if (nextEarly !== early) {
              const nextRange = nextEarly ? session.fifteenMinute : carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
              setHigh(priceText(nextRange.high)); setLow(priceText(nextRange.low)); setNote("");
            }
          }
          setLocalTime(nextTime);
        }} /></label>
        <details className="range-time-help"><summary>About this time</summary><p>This time stays with your entry. Change it when recording an earlier observation. Before {clockLabel(fifteen)}, prices build 15R and A; later updates build A only.</p></details>
        <details className="optional-note"><summary>Add a note</summary><label>A-period commentary<textarea value={note} onChange={(event) => { keepDraftTime(); setNote(event.target.value); }} /></label></details>
        {error && <p role="alert" className="form-error">{error}</p>}
      </form>

    </div>
  </section>;
}

export function FifteenReview({ session, locked, blocked, onSave }: {
  session: JournalSession; locked: boolean; blocked: boolean; onSave: (update: FifteenMinuteUpdate) => SaveResult;
}) {
  const range = session.fifteenMinute;
  const [high, setHigh] = useState(priceText(range.high));
  const [low, setLow] = useState(priceText(range.low));
  // A forming CP is an earlier observation, not the price at the 15R lock.
  const [note, setNote] = useState(range.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <form onSubmit={async (event) => {
    event.preventDefault(); if (busy || blocked) return;
    setError(null); setBusy(true);
    try {
      const update = parseRange(high, low, "", note);
      if (!locked) throw new Error("Wait until the first 15 minutes end to confirm 15R.");
      if (update.high === null || update.low === null) throw new Error("Enter both completed 15R edges.");
      setError(await onSave(update));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }}>
    <div className="period-form-heading"><h3>First 15 minutes</h3>
      <button className="primary-action" type="submit" disabled={busy || blocked || !locked}>{busy ? "Saving…" : range.status === "confirmed" ? "Save 15R correction" : "Confirm 15R"}</button></div>
    <div className="price-fields">
      <label>15R high<input inputMode="decimal" value={high} onChange={(event) => setHigh(event.target.value)} /></label>
      <label>15R low<input inputMode="decimal" value={low} onChange={(event) => setLow(event.target.value)} /></label>
    </div>
    <details className="optional-note"><summary>Add a note</summary><label>15R commentary<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label></details>
    {error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
