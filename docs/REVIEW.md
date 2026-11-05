# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Session and review Image Cards now share one visual style. Session cards keep
recorded structure, recap, current conditions and estimates distinct. The map
labels its midpoints. Saved forecasts and recorded results keep their own times
and counts. Selected references, events and notes use the same compact style.

Weekly, monthly and annual cards focus on broader statistics: outcome frequencies,
range sizes, recorded returns, closing locations and changes across days, weeks
or months. Unknown outcomes stay separate and future plans are excluded. Saved
forecast comparisons are reviewed counts, with ties identified; they are not new
forecasts for the next time span. Short Post and Full Recap remain available.

This repository supplies app code, graphics and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded examples. Test
records and price-filled screenshots are not distributed.

## Checks run

- TypeScript and the public build from cleaned source passed.
- Ninety-three focused unit tests passed for sharing, comparisons, reviewed
  statistics, snapshot boundaries, reference roles and recording notices.
- Twenty-two distinct Chromium journeys passed on the packaged public app.
  They cover empty startup, manual recording, reload persistence, session and
  aggregate sharing, selected notes, all twelve months, overflow protection,
  text formats, small screens and focused writing.
- Two exact-public-build update/offline checks passed with disposable records.
- Source, website, nested downloads and reachable history passed the content
  audit, with no restricted-source references or private dataset filenames.
- The numeric-literal review found no new price/history literals.

Three older tests used links to the website root rather than the app's project
path. Their links now respect that path, and all three follow-up journeys pass.
No application change was needed for those test failures.

All browser observations are isolated test inputs and excluded from this
repository and its downloads. Preparation leaves the private phone app unchanged.
Existing local dependencies were used; a fresh dependency installation was not
part of these checks.

## Live public checks

Deployment verification is pending. The published build and final live results
are recorded in [release-info.json](../release-info.json).

## Still pending

Physical-device installation and keyboard checks at the public address remain
pending. Firefox and WebKit automation binaries are unavailable. No forecast
accuracy improvement or general release-readiness claim is made.
