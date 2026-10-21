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

## October 21 correction

IB width forecasts now display on the selected instrument's tick size (quarter
points for ES). During post-IB RTH, Structure shows the full recorded regular
session range, including the IB hour. The locked IB and recorded breaks remain
separate references. Stored prices and forecast calculations are unchanged.

## Verification

The October 21 source passed TypeScript and 677 unit tests, with one existing
skip. Ten private-build Chromium journeys passed, covering formation and RTH
forecasts, all-phase Structure, recorded breaks, reload persistence, period
editing, statistics and sharing. Three public-package journeys and two safe-update/offline checks also pass.
The public package passed the history, file and nested-archive data audit.
Live deployment results are recorded in [release-info.json](../release-info.json) as completed.

Tests use disposable browser storage. Fictional observations used by the browser
tests are excluded from the distributed package. No journal data is supplied.
Firefox and WebKit automation were not rerun: their Playwright browser bundles
are unavailable. Physical Safari was not tested for this correction.

## Still pending

- Physical iPhone/Safari and Android install, keyboard entry and offline use.
- Installed-app update and recovery checks, including backups on those devices.
- A small tester group before wider sharing.

No accuracy claim is made for historical forecasts. A future learning-data
source and its processing/distribution permissions need separate review.
