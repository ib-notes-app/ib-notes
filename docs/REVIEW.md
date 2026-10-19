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

## Checks completed for this candidate

TypeScript/build checks, 673 unit tests with one existing skip, 21 Chromium
journeys and three final-package rechecks passed during preparation. Those
checks covered empty startup, date/phase navigation, entry validation, saving,
level placement, recorded breaks, return navigation, reload persistence,
offline use, PNG export and SQLite export/restore.

The stripped source also rebuilt without private data files. Automated mobile
viewports do not establish physical keyboard or Safari behavior.

## Checks on the live public address

All 38 website files match the reviewed package by SHA-256, including the app,
workers, manifest and icons. Three Chromium journeys passed on October 19:

- Empty startup, no seeded data and truthful unavailable forecasts.
- Manual period/CP recording, correct level positions after CP crosses the IB,
  recorded break display and reload persistence.
- Correct subpath/manifest/icon loading, saving, PNG export, offline reload,
  and SQLite export/restore.

The checks used disposable browser storage and fictional test observations.
They did not add records to the distributed package or an existing journal.
Firefox and WebKit automation were not rerun on this address because their
Playwright browser bundles were unavailable. Physical Safari was not tested.

## Still pending

- Physical iPhone/Safari and Android install, keyboard entry and offline use.
- Installed-app update and recovery checks, including backups on those devices.
- A small tester group before wider sharing.

No accuracy claim is made for historical forecasts. A future learning-data
source and its processing/distribution permissions need separate review.
