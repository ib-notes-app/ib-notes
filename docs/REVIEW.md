# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Dated prior-contract references stay visible during large moves. Home shows
the closest two saved references on each side, with month/year and a Prior
badge where applicable. Original prices and contract-specific tracking remain
separate. The owner accepted the change on the private phone before public release.

This repository supplies app code, assets and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded records.
No price-filled documentation screenshots or example CSV rows are supplied.

## Checks run

- TypeScript, the public build and a rebuild from the cleaned source passed.
- 752 unit tests passed; one existing test is skipped.
- Eight Chromium journeys passed on the packaged public app, covering empty
  startup, prior-contract references, large moves, filters, detail navigation,
  CP persistence, offline use and backup restore with disposable test journals.
- Two exact-build update/offline checks passed.
- Source, website and nested downloads are audited before publication.
  The public source has no inactive private-dataset imports.

All browser test observations are isolated development inputs and excluded
from this repository and its downloads. The private phone build is unchanged.
The source rebuild reused existing local dependencies; a fresh dependency
installation was not part of that check.

## Still pending

The live verification result is recorded in [release-info.json](../release-info.json).
Actual-device installation and keyboard checks at the public address remain
pending. Firefox and WebKit were not rerun because their automation browsers
are unavailable. The wider legacy forecast suite was not rerun and is not
claimed as passing. No forecast accuracy improvement is claimed.
