# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Levels has one list of enabled map references, with quick Hide controls and
separate shown/enabled counts. Structure opens the same list, with Back to
Structure. Hidden current-day IB/ON references stay hidden after navigation
and reload. Hiding preserves saved prices, notes and history.

This repository supplies app code, assets and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded records.
No price-filled documentation screenshots or example CSV rows are supplied.

## Checks run

- TypeScript and the public build from cleaned source passed.
- 39 focused level, performance, entry-model and session-reference unit tests passed.
- Eleven Chromium journeys passed on the packaged public app, covering empty
  startup, prior-contract references, large moves, filters, detail navigation,
  CP persistence, offline use and backup restore with disposable test journals.
  The new manager checks cover filters, off-screen enabled references, clearing
  and re-enabling references, failed saves, duplicate prevention and contextual Back.
- Two exact-build update/offline checks passed.
- Source, website and nested downloads are audited before publication.
  The public source has no inactive private-dataset imports.

All browser test observations are isolated development inputs and excluded
from this repository and its downloads. The private phone build is unchanged.
The build used existing local dependencies; a fresh dependency installation
was not part of that check.

## Still pending

Live verification for this build follows deployment; results are recorded in
[release-info.json](../release-info.json). Source and nested downloads contain
no bundled records, restricted-source mentions or private-dataset filenames.
Actual-device installation and keyboard checks at the public address remain
pending. Firefox and WebKit were not rerun because their automation browsers
are unavailable. The wider legacy forecast suite was not rerun and is not
claimed as passing. No forecast accuracy improvement is claimed.
