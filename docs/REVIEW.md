# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

The selected day's native boundaries stay visible in Structure. Map levels
controls extra references, including edges from other days. Older hidden
choices cannot suppress the day's own ON/IB boundaries. Each phase has its own
midpoint in Current conditions and on the map; recorded RTH bounds are called
out separately from IB. Midpoints are never carried as levels.
Saved observations, range calculations and prior-day preferences are preserved.

This repository supplies app code, assets and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded records.
No price-filled documentation screenshots or example CSV rows are supplied.

## Checks run

- TypeScript and the public build from cleaned source passed.
- 60 focused conditions, entry-model, session-reference and calendar unit tests passed.
- Eighteen private-build Chromium journeys passed across ON, 15R, A, B and
  RTH, covering protected ranges, midpoints, empty states, clearing optional
  levels, reloads, contextual navigation and configured phase handoffs.
- An update test with disposable records verifies old hidden ON preferences
  no longer suppress native boundaries and prior-day references can still hide.
- Fourteen Chromium journeys passed on the packaged public app, including
  empty startup, persistence, all five phases and the old-preference update case.
- Two exact-public-build update/offline checks passed.
- Source, website and nested downloads are audited before publication.
  The public source has no inactive private-dataset imports.

All browser test observations are isolated development inputs and excluded
from this repository and its downloads. Public preparation does not alter the
separately updated private phone app.
The build used existing local dependencies; a fresh dependency installation
was not part of that check.

## Live public checks

Live checks for this build are pending. Results will be recorded in
[release-info.json](../release-info.json).

## Still pending

Actual-device installation and keyboard checks at the public address remain
pending. Firefox and WebKit were not rerun because their automation browsers
are unavailable. The wider legacy forecast suite was not rerun and is not
claimed as passing. No forecast accuracy improvement is claimed.
