# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Share cards have one clear recording notice and always say **Not financial
advice or trade signals**. Record price Details uses ON, 15R, A, B and RTH.
Level success confirmations expire and clear when leaving the page or day;
failed saves stay visible. Saving and calculations are unchanged.

This repository supplies app code, assets and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded records.
No price-filled documentation screenshots or example CSV rows are supplied.

## Checks run

- TypeScript and the public build from cleaned source passed.
- 69 focused sharing unit tests passed.
- Twelve Chromium journeys passed on the packaged public app, covering empty
  startup, prior-contract references, large moves, filters, detail navigation,
  CP persistence, offline use and backup restore with disposable test journals.
  They also check every sharing period, recorded-only disclaimers, phase names,
  expiring level messages and a failed save that an earlier timer cannot hide.
- Two exact-build update/offline checks passed.
- Source, website and nested downloads are audited before publication.
  The public source has no inactive private-dataset imports.

All browser test observations are isolated development inputs and excluded
from this repository and its downloads. The private phone build is unchanged.
The build used existing local dependencies; a fresh dependency installation
was not part of that check.

## Still pending

Twelve live Chromium journeys passed. All 38 served files match the reviewed
package, and eight excluded-data URLs return 404. Results are recorded in
[release-info.json](../release-info.json). Source and nested downloads contain
no bundled records, restricted-source mentions or private-dataset filenames.
Actual-device installation and keyboard checks at the public address remain
pending. Firefox and WebKit were not rerun because their automation browsers
are unavailable. The wider legacy forecast suite was not rerun and is not
claimed as passing. No forecast accuracy improvement is claimed.
