# Public version — test status

Current status: **early public version**, published with the owner's approval
on October 19, 2026. App: **https://ib-notes-app.github.io/ib-notes/**.
Physical-device checks remain pending; this is not a claim of release readiness.

## What is included

- An empty manual journal with the current dashboard and entry workflow.
- Application source, licenses and a prepared static website package.
- No bundled market history, replay journals or seeded test records.
- No live market feed or automatic news lookup.
- Historical forecast probabilities unavailable without compatible learning history.

The exact prepared build is identified in [release-info.json](../release-info.json).
The download checksum is in [downloads/SHA256SUMS.txt](../downloads/SHA256SUMS.txt).

## October 21 interface and day-review update

The period-ending follow-up removes the optional-closing-price dependency from
Daily Low tracking. Previously confirmed ranges supply missing Daily Low
references automatically. Level Stats retains the known range review while
leaving its closing price unknown. No extra confirmation, invented price,
rebound or 20-point qualification is added. See the
[period carry-forward table](LEVELS.md#what-carries-forward-automatically).

Recorded ON/IB levels now carry forward after their configured period ends
without per-period completion steps. Review day collects all period and daily
highs/lows, an optional explicit close and expanded Day Notes behind one Confirm
day action. Missing coverage remains unknown; the last CP is not assumed to be
the close. Finalized edits keep their explicit safeguards.

Price entry has compact View entries and Entry details buttons, with a named
return preserving the draft. Home, Levels and Review stay in the bottom tabs;
redundant header shortcuts are removed, while deeper pages retain contextual
Back. Day timeline and Review day share an aligned row under the Review heading.

## Earlier October 21 correction

IB width forecasts now display on the selected instrument's tick size (quarter
points for ES). During post-IB RTH, Structure shows the full recorded regular
session range, including the IB hour. The locked IB and recorded breaks remain
separate references. Stored prices and forecast calculations are unchanged.

## Verification

The current source passed TypeScript and 693 unit tests, with one existing
skip. The data-free source copy also passes TypeScript. Seven public-package
Chromium journeys cover empty startup, manual prices and level placement,
day confirmation, Review navigation, sharing, persistence and SQLite restore.
Two exact-build safe-update/offline checks passed with disposable journals.
Phone-width, enlarged-text and desktop screenshots were inspected.
The public package passed the history, file, nested-archive and static-literal
data audit. Live deployment results are recorded in
[release-info.json](../release-info.json) as they are completed.

Tests use disposable browser storage. Fictional observations used by the browser
tests are excluded from the distributed package. No journal data is supplied.
Firefox and WebKit automation were not rerun: their Playwright browser bundles
are unavailable. Physical Safari was not tested for this correction.

## Live public address

The updated app is deployed. All 38 live website files match the tested package
by SHA-256, eight excluded private-data URLs return 404, and seven Chromium
journeys pass against the public address. These include day review, navigation,
manual recording, level placement, a confirmed Daily Low with an unknown closing
price after reload, offline use, PNG export and SQLite restore.
Tests use disposable browser storage. See
[release-info.json](../release-info.json) for the exact build and deployment.
Physical-device acceptance remains pending.

## Still pending

- Physical iPhone/Safari and Android install, keyboard entry and offline use.
- Installed-app update and recovery checks, including backups on those devices.
- A small tester group before wider sharing.

No accuracy claim is made for historical forecasts. A future learning-data
source and its processing/distribution permissions need separate review.
