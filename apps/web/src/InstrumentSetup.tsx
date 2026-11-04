// SPDX-License-Identifier: MPL-2.0
import { useEffect, useRef, useState } from "react";
import { type JournalProfile } from "@ib-field-notes/domain";
import { makeStudyTemplate } from "@ib-field-notes/session-templates";
export function InstrumentSetup({ profiles, onSave, onCancel }: {
  profiles: JournalProfile[]; onSave: (profile: JournalProfile) => Promise<string | null>; onCancel: () => void;
}) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [tick, setTick] = useState("");
  const [zone, setZone] = useState("America/Los_Angeles");
  const [customZone, setCustomZone] = useState(false);
  const [open, setOpen] = useState("");
  const [close, setClose] = useState("");
  const [everyDay, setEveryDay] = useState(false);
  const [contract, setContract] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting=useRef(false),errorRef=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  return <section className="entry-card instrument-setup" aria-label="Add instrument">
    <h2>What would you like to study?</h2>
    <p>Set this up once. Each journal keeps its own days, price levels, and history.</p>
    <form onSubmit={async (event) => {
      event.preventDefault(); if (submitting.current) return;
      submitting.current=true;
      setError(null); setBusy(true);
      try {
        const id = `journal-${crypto.randomUUID()}`;
        const template = makeStudyTemplate({ id: `${id}-v1`, instrument: symbol, tickSize: Number(tick), timeZone: zone, open, close,
          weekdays: everyDay ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5], requiresContract: contract });
        const existing = profiles.filter((profile) => profile.template.instrument === template.instrument).length;
        const journalName = name.trim() || `${template.instrument}${existing ? ` (${existing + 1})` : ""}`;
        setError(await onSave({ id, name: journalName, template, createdAt: new Date().toISOString() }));
      } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      finally { submitting.current=false;setBusy(false); }
    }}>
      <div className="period-form-heading"><h3>New journal</h3>
        <button className="primary-action" disabled={busy} type="submit">{busy ? "Creating journal…" : "Create journal"}</button>
        <button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className="form-error">{error}</p>}
      <fieldset className="instrument-basics"><legend>Instrument</legend>
      <label>Instrument symbol<input required maxLength={24} value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="For example: NQ, CL, AAPL" autoCapitalize="characters" /></label>
      <label>Smallest price step<input required inputMode="decimal" value={tick} onChange={(event) => setTick(event.target.value)} placeholder="For example: 0.25 or 0.01" /></label>
      <p className="stage-helper">Also called tick size. Used to tell a touch from a break.</p>
      </fieldset>
      <fieldset className="instrument-study-hours"><legend>Study hours</legend>
      <label>Time zone for these hours<select aria-label="Time zone for these hours" value={customZone ? "custom" : zone} onChange={(event) => {
        setCustomZone(event.target.value === "custom");
        if (event.target.value !== "custom") setZone(event.target.value);
      }}>
        {[["America/Los_Angeles", "Pacific"], ["America/Denver", "Mountain"], ["America/Chicago", "Central"], ["America/New_York", "Eastern"], ["Europe/London", "London"], ["Europe/Berlin", "Berlin"], ["Asia/Tokyo", "Tokyo"], ["Asia/Hong_Kong", "Hong Kong"], ["Australia/Sydney", "Sydney"], ["UTC", "UTC"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        <option value="custom">Another time zone…</option>
      </select></label>
      {customZone && <label>Time zone name<input required value={zone} onChange={(event) => setZone(event.target.value)} placeholder="For example: Asia/Singapore" /></label>}
      <div className="instrument-hours">
        <label>Session opens<input type="time" required value={open} onChange={(event) => setOpen(event.target.value)} /></label>
        <label>Session ends<input type="time" required value={close} onChange={(event) => setClose(event.target.value)} /></label>
      </div>
      <p className="stage-helper">Choose the hours you study. A and B cover the first hour; 15R is the first 15 minutes. An end before the open means the next day.</p>
      <label className="check-row"><input type="checkbox" checked={everyDay} onChange={(event) => setEveryDay(event.target.checked)} />Study weekends too</label>
      </fieldset>
      <details><summary>More options</summary>
        <label>Journal name <small>optional</small><input value={name} maxLength={60} onChange={(event) => setName(event.target.value)} placeholder="For example: NQ Practice" /></label>
        <label className="check-row"><input type="checkbox" checked={contract} onChange={(event) => setContract(event.target.checked)} />Track a futures contract</label>
        <p className="stage-helper">Overnight notes begin 15 minutes after the previous study close. Holidays are not automatically checked.</p>
      </details>
    </form>
  </section>;
}
