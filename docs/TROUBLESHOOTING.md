# Troubleshooting

[Back to IB Notes](../README.md) · [FAQ](FAQ.md) · [Backups and recovery](BACKUPS_AND_RECOVERY.md) · [Current test status](REVIEW.md)

Start with the matching symptom below. Keep the app installed and its website
data intact. If the journal opens, [export SQLite](BACKUPS_AND_RECOVERY.md#export-and-keep-a-backup)
before recovery steps that could replace or remove records.

## The link opens GitHub instead of the app

The repository holds instructions and source code. Open the actual app at
**https://ib-notes-app.github.io/ib-notes/**. You do not need to download the
repository or run commands. Follow [installation instructions](INSTALLATION.md)
to add it to your Home Screen.

## The app is empty or records seem missing

1. Check the selected instrument and session date.
2. Check that you opened the original app address, browser/profile and device.
   Another browser, Home Screen context or address may have separate storage.
3. Look in **Review → Days** and check any search or source filters.
4. If you moved a session to Trash, check **Settings → Manage journal → Trash**.

The public edition starts empty. Imported daily summaries live in their own
library; they do not create editable observations on Today. If you moved
devices, follow [Backups and recovery](BACKUPS_AND_RECOVERY.md). Do not import
a backup into an unexpected empty screen until you know which journal it replaces.

## Journal will not open

If you see **Your journal couldn’t open**, or **Already open in another tab**:

1. Finish any unsaved entry if another IB Notes window is still working.
2. Close other IB Notes tabs/windows, including a browser copy alongside the
   Home Screen app, then reopen the original one.
3. Use **Retry opening** if offered. Keep the installed app and its website data.
4. If it still fails, record **Build** and **Error details**, then use **Report a problem**.

Do not clear site data, reset storage or reinstall to force it open. If storage
is inaccessible, export may also be unavailable; stop and seek help rather
than destroy the original copy. Another browser can test app loading, but its
empty journal does not prove the original records were lost.

## A price will not save

Check the inline message, instrument, date and phase. Use a plain decimal price
matching the instrument's tick size and precision. Historical entries need a
valid time for that selected session and phase; check AM/PM and the display timezone.

Do not assume an error means a successful save. Keep the entered value, record
the message and inspect **Review → Day timeline** if the result is uncertain
before adding the same observation again.

## Save worked but the sheet stayed open

That is intentional. Save High, Low and CP in sequence, then press
**Cancel/Close** when finished. Closing the form does not undo saved entries.
Confirm the saved message or check the entry in Review.

## The latest CP did not change

High/Low entries update period-extreme evidence, not CP. A backdated CP does
not supersede a later observed CP just because it was saved last. Check the
observation times, selected date and instrument. The dashboard uses the last
applicable recorded CP, not a live quote.

## Levels are missing or on an unexpected side

Open **Levels**, check **Reference price**, and press **Use CP** if needed.
Check Above/Below, tier, distance and archived-level filters. The dashboard
shows a compact nearby selection rather than the full library.

Position follows price: a low can be above CP after price falls below it.
An outside zone uses distance to its nearest boundary; a containing one says
**Inside zone**. See the [levels guide](LEVELS.md).

## A forecast is Unavailable, Partial or still updating

The blank edition includes no historical probability library. Check the named
missing inputs and your permitted learning history. A daily CSV does not
provide minute-price paths or guarantee every forecast becomes available.
**Unavailable** is not 0%, and **Updating…** is not a forecast result.

If a calculation remains stuck, note the build, session stage and displayed
message before reopening the app. See [Read the dashboard](READING_THE_DASHBOARD.md)
and [CSV imports](CSV_IMPORT.md) for prerequisites; do not invent missing prices
to make a forecast appear.

## A recorded break or result looks wrong

Open **Structure** and **Review → Day timeline**. Check the locked IB edges,
the price and observation time. An extension during formation is different
from a post-lock break, and touching an edge is different from breaking it.

Correct an erroneous observation through its existing editor. Keep current
recorded conditions separate from earlier saved forecast percentages; a new
break does not rewrite what an earlier forecast predicted. Include a small,
permitted reproduction example in a report if it still looks incorrect.

## The phone keyboard covers a control

Scroll inside the entry sheet; use the keyboard's dismiss/Done control if
available to reach an obscured action. Do not repeatedly tap Save without
knowing whether it saved. Keep the target date/phase visible when checking.

Report the phone model, OS, browser, whether it is the Home Screen app, and a
screenshot with the keyboard open. Remove private information first. Public
physical-phone keyboard checks are [still pending](REVIEW.md); a desktop
mobile viewport does not establish actual keyboard behavior.

## Installation, offline use or an update is not working

- Open the HTTPS app link in the browser described in [Installation](INSTALLATION.md),
  rather than inside a messaging app's embedded viewer.
- For offline use, first load online and let setup finish. **Settings → Backups
  & storage → Storage details → Offline shell** shows its state. Installing the
  icon alone does not prove the app is ready offline.
- When **An offline update is ready** appears, save any draft and export SQLite,
  then choose **Update safely**. A recovery screen may instead offer **Update app**.
- If a version seems unchanged, compare the **Build** line in Settings after
  reopening online. Not every documentation change releases a new app build.

Do not clear website data to force an update. Physical installation, offline
and installed-app update checks remain listed in [test status](REVIEW.md).

## CSV import failed

Use the exact daily headers and check dates, tick-compatible values, range
geometry, duplicate dates, file size and the preview's blocking errors. Raw
bars and tick exports are not the daily summary format. Follow the
[CSV guide](CSV_IMPORT.md); share the error and header names before considering
whether any source rows may be shared.

## Restore failed

Use an actual IB Notes SQLite export, not JSON, CSV or a ZIP. Keep the original
file intact. A filename or SQLite extension alone does not establish that it
is the correct database or a compatible backup.

Stop after an error; keep its wording and the backup of the destination you
made before restoring. Do not assume a failed restore left the destination
untouched. Follow [Backups and recovery](BACKUPS_AND_RECOVERY.md#restore-a-backup)
and contact support before trying further restores in your only journal.

## Send a useful report

Use [GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions)
for questions, ideas and general help. Use [GitHub Issues](https://github.com/ib-notes-app/ib-notes/issues)
for bugs that need tracking. Search existing posts first; add your reproduction
details to a matching issue instead of opening a duplicate.

GitHub posts and attachments are public, and posting requires a GitHub account.
Keep journal backups, private notes and proprietary data out of public reports.
Use **ibnotes.support@icloud.com** for private matters or if you do not have an
account. Using IB Notes itself does not require an account.

Open **Settings → Report a problem**, or use it on a recovery screen. Include
what happened, what you expected and the shortest steps that repeat it.
**Include app details** adds build, browser, device/OS category, display mode,
timezone and screen; you can turn it off and review the exact report.

Choose **Copy report** and paste the reviewed text into the relevant GitHub
issue or discussion. If copying is unavailable, select the preview text manually.
Check any screenshot for private information before attaching it.

The app also offers **Open email draft** for the email fallback. Copying a
report or opening a draft does not send anything automatically; you still
post the report on GitHub or send the email yourself. Do not send a whole
database or proprietary rows as the first troubleshooting step.
