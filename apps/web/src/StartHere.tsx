// SPDX-License-Identifier: MPL-2.0
import { BETA_REHEARSAL, PUBLIC_BLANK } from './supportReportModel';

export function StartHere() {
  return <details className="start-here">
    <summary>Start here</summary>
    <p>Observe. Record. Learn. Start with one price; fill in the rest as you go.</p>
    <ol>
      <li><strong>Check the day.</strong> Home is your daily dashboard and opens the current trading session. Use the arrows or calendar to browse other dates. Display time starts in Pacific; change it in Settings.</li>
      <li><strong>Record a price.</strong> On Home, press the pink Record price button, enter a price and choose Save CP. The time is captured when you open the sheet. Historical entries need an observation time; finalized days offer Edit price. More observations give the map more detail; gaps remain unknown.</li>
      <li><strong>Follow the session.</strong> Choose ON, 15R, A, B or RTH. ON is overnight; 15R is the first 15 minutes; A and B form the Initial Balance. RTH follows IB lock. Tap a period for its range editor. The green dot marks the active period; select it to resume automatic following. Missing entries never stop you recording another price.</li>
      <li><strong>Review and share.</strong> Levels holds your references; Review holds days and statistics. In Home’s ⋯ menu, Context holds news and notes, and Share opens your preview before you download a PNG or copy its caption. Only share details you choose.</li>
      <li><strong>Find your way back.</strong> The bottom tabs open Home, Levels and Review. Home returns directly to the dashboard. Deeper pages have Back to a named screen. Close or Cancel dismisses a popup or form.</li>
      <li><strong>Keep a backup.</strong> In Settings → Backups &amp; storage, Export SQLite saves a restorable backup of all instrument journals. Export JSON is a readable copy. Save a SQLite backup before moving to a different app address or device; journals do not sync automatically.</li>
    </ol>
    <p>Your journal stays in this browser on this device. Keep the app and its website data; clearing them can remove your journal. After the app finishes preparing offline, ordinary journaling works without a connection.</p>
    <p>On iPhone, open the app link in Safari and choose Share → Add to Home Screen. On Android, open it in Chrome and use its Install app or Add to Home screen option. Physical Android testing is still pending.</p>
    <p>Enter news results yourself for now; automatic retrieval is not yet verified on phones. Forecasts need compatible learning history and enough current observations. Experimental · Not financial advice.</p>
    {BETA_REHEARSAL && <p className="notice-panel">This is a local beta rehearsal. No bundled learning history or example journals are included. Forecast comparisons require separately supplied, permitted Study Packs.</p>}
    {PUBLIC_BLANK && <p className="notice-panel">This edition starts empty. No market history, Study Packs or example journals are included. Record your own observations using data you have permission to use. Historical forecast probabilities need compatible learning history and may be unavailable.</p>}
    <p>Something confusing or broken? Report a problem in Settings lets you review a report, then open an email draft to IB Notes or copy it into a DM.</p>
  </details>;
}
