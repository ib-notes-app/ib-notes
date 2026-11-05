# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Record price keeps **Last price entered and saved** with the saved CP beneath
the four smaller buttons. Closing/reopening or reloading retains it. Drafts,
canceled or invalid entries, and note-only saves do not replace it. Backdated
entries use save order for this receipt; the dashboard's latest position still
uses observation time. Different days keep their own saved values.

The existing journal records supply this line. No schema or forecast calculation
changed. This repository includes no market history, CSVs, packs, journals,
backups, seeded examples, test records or price-filled screenshots.

## Checks

- The cleaned-source TypeScript and public production build passed.
- Twenty-nine focused unit tests passed for journal entry and saved-price behavior.
- Seventeen Chromium journeys passed on the packaged public app, covering
  reopen/reload persistence, drafts, invalid saves, notes, backdated entries,
  day changes, clocks, period targets, empty startup and manual recording.
- Two exact-public-build safe-update/offline checks passed with disposable records.
- Source, website, nested downloads and reachable history passed the content audit.
  No restricted data, provider references or private dataset names were found.
- The numeric scan introduced no new price/history literals.

Browser observations are isolated test records, excluded from public files.
Live publication verification is pending. Final results are recorded in
[release-info.json](../release-info.json).
Physical public-phone installation and keyboard acceptance remain pending.
Browser viewport checks do not establish a physical Safari pass. Firefox and
WebKit automation binaries are unavailable in this environment.

## Getting the update

Save current input and export a backup. Open your usual app address online
and choose **Update safely** when offered. Do not clear browser data to force
an update. [Update help](TROUBLESHOOTING.md).
