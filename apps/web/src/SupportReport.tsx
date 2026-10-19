// SPDX-License-Identifier: MPL-2.0
import { useId, useState } from 'react';
import { APP_BUILD_ID, SUPPORT_EMAIL, formatSupportReport, supportContext, supportEmailDraft, type SupportScreen } from './supportReportModel';

export function AppBuildLabel() {
  return <p className="app-build">Build {APP_BUILD_ID}</p>;
}

/** Independent of journal providers/storage so recovery can always offer it. */
export function SupportReport({ screen, timeZone }: { screen: SupportScreen; timeZone?: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState({ happened: '', expected: '', steps: '' });
  const [includeContext, setIncludeContext] = useState(true);
  const [status, setStatus] = useState('');
  const [context] = useState(() => supportContext({ userAgent: navigator.userAgent, screen, timeZone,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true }));
  const report = formatSupportReport(details, includeContext ? context : null);
  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(report);
      setStatus('Copied. Paste it into your DM or email to IB Notes.');
    } catch {
      setStatus('Copy is unavailable. Select the report text below and copy it yourself.');
    }
  }
  return <div className="support-report">
    <button type="button" aria-expanded={open} aria-controls={`${id}-report`} onClick={() => setOpen(value => !value)}>Report a problem</button>
    {open && <section id={`${id}-report`} aria-label="Problem report">
      <p>A few words are enough. Include what you know.</p>
      {(['happened', 'expected', 'steps'] as const).map(key => <div className="support-field" key={key}>
        <label htmlFor={`${id}-${key}`}>{key === 'happened' ? 'What happened?' : key === 'expected' ? 'What did you expect?' : 'Steps to repeat (if known)'}</label>
        <textarea id={`${id}-${key}`} rows={2} maxLength={4000} value={details[key]} onChange={event => { setDetails({ ...details, [key]: event.currentTarget.value }); setStatus(''); }} />
      </div>)}
      <label className="support-context-choice"><input type="checkbox" checked={includeContext} onChange={event => { setIncludeContext(event.currentTarget.checked); setStatus(''); }} />Include app details</label>
      <p className="stage-helper">App details include the build, browser, device, timezone and screen. Journal entries, backups and error details are not attached.</p>
      <div className="support-field"><label htmlFor={`${id}-preview`}>Review report</label><textarea id={`${id}-preview`} className="support-report-preview" rows={9} readOnly value={report} onFocus={event => event.currentTarget.select()} /></div>
      <div className="support-report-actions">
        <a className="support-email-action" href={supportEmailDraft(report)}>Open email draft</a>
        <button type="button" onClick={() => void copy()}>Copy report</button>
      </div>
      <p className="stage-helper">To: {SUPPORT_EMAIL}. Review and send in your email app, or copy into a DM. Attach a screenshot there if useful.</p>
      <p role="status">{status || 'Nothing has been sent. Opening a draft or copying this report does not send it.'}</p>
    </section>}
  </div>;
}
