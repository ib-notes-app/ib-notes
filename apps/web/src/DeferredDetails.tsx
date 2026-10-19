// SPDX-License-Identifier: MPL-2.0
import { useState, type ReactNode } from 'react';

/** Keep native disclosure behavior while leaving closed content unmounted. */
export function DeferredDetails({summary,children,className}: {
  summary: ReactNode; children: ReactNode; className?: string;
}) {
  const [open,setOpen]=useState(false);
  return <details className={className} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{summary}</summary>
    {open&&children}
  </details>;
}
