# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Forecast and image cards share the same stage summary and estimate time.
Neither remains visible before an edge breaks. Recorded range size and location
have historical comparisons when suitable records exist; counts and model
estimates are labeled separately. Return forecasts wait for a recorded break,
and re-entries have recorded counts. Ongoing events need no numerical result.
The image preview shows its full height and share prices use the instrument step.
Period endings offer a deferred range confirmation with explicit correction.
Closing an earlier period on the current day returns to its active phase.

This repository supplies app code, assets and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded records.
No price-filled documentation screenshots or example CSV rows are supplied.

## Checks run

- TypeScript and the public build from cleaned source passed.
- 140 focused unit tests across 15 files passed during preparation.
- Eighteen Chromium journeys passed on the packaged public app, including
  empty startup, manual recording, level placement, forecast/card consistency,
  tall previews, repeated returns, reload persistence and all five period endings.
- Two exact-public-build update/offline checks passed with disposable records.
- Source, website, nested downloads and reachable history passed the data audit.
  The public source has no inactive private-dataset imports.
- The numeric-literal review found no new price or history literals.

One older test expected the previous range-save wording. Its selector now uses
**Confirm range** too. It also distinguishes descriptive range percentages from
unavailable forecast odds. The corrected eighteen-journey run passes; this did
not require an app change.

All browser test observations are isolated development inputs and excluded
from this repository and its downloads. Public preparation does not alter the
separately updated private phone app. Existing local dependencies were used;
a fresh dependency installation was not part of the check.

## Live public checks

Deployment verification is pending. The current result will be recorded in
[release-info.json](../release-info.json) after publication.

## Still pending

Actual-device installation and keyboard checks at the public address remain
pending. Firefox and WebKit could not launch because their automation binaries
are unavailable. The wider legacy forecast suite was not rerun and is not
claimed as passing. No forecast accuracy improvement is claimed.
