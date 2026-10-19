// SPDX-License-Identifier: MPL-2.0
import { useState } from "react";
import type { SignificantLevel, SignificantLevelArchiveDetails, SignificantLevelArchiveReason, SignificantLevelStatusAction } from "@ib-field-notes/domain";
export const archiveReasonLabels: Record<SignificantLevelArchiveReason, string> = {
  breakdown: "Breakdown",
  fbd_low_broken: "LBAF recovery low lost",
  no_longer_tracking: "No longer tracking",
  duplicate: "Entered by mistake",
  other: "Other reason",
};
export function LevelArchiveControl({ level, onSave }: {
  level: SignificantLevel;
  onSave: (level: SignificantLevel, action: SignificantLevelStatusAction, details?: SignificantLevelArchiveDetails) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<SignificantLevelArchiveReason | "">("");
  const [note, setNote] = useState("");
  if (!open) return <button type="button" onClick={() => setOpen(true)}>Archive…</button>;
  return <form className="level-archive-form" onSubmit={event => {
    event.preventDefault();
    if (!reason) return;
    onSave(level, reason === "breakdown" || reason === "fbd_low_broken" ? "invalidated" : "retired", { reason, note });
  }}>
    <label>Archive reason<select required value={reason} onChange={event => setReason(event.target.value as SignificantLevelArchiveReason)}>
      <option value="">Choose a reason</option>
      {Object.entries(archiveReasonLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
    </select></label>
    <label>Archive note {reason !== "other" && <small>optional</small>}<textarea required={reason === "other"} value={note} onChange={event => setNote(event.target.value)} /></label>
    <p>Price interactions do not archive this level. This is your decision; you can undo it.</p>
    <button type="submit">Confirm archive</button>
    <button type="button" onClick={() => setOpen(false)}>Cancel</button>
  </form>;
}
