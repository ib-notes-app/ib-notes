# Review before public availability

Current status: **private repository for inspection**. No public website or
installation address is enabled by this upload.

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

## Still pending

- Owner inspection of this repository, wording and package.
- A separately approved public HTTPS address.
- Physical iPhone/Safari and Android install, keyboard entry and offline use.
- Safe update, backup/restore and recovery checks on that address.
- A small tester group before wider sharing.

No accuracy claim is made for historical forecasts. A future learning-data
source and its processing/distribution permissions need separate review.
