# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

## This update

Live RTH forecasts and image cards can show **Limited range history** when
few completed learning IBs were as wide or narrow as the current range. The
message describes history coverage; it does not change the odds or establish
their accuracy on rare days. Local journal rankings remain separate.

Period High/Low fields now come first, with the map below them and fixed
Save/Confirm and Close actions. The existing confirmation and draft behavior
is preserved.

This repository supplies app code, graphics and instructions. It includes no
CSVs, data packs, market history, journals, backups or seeded examples. Test
records and price-filled screenshots are not distributed.

## Checks

- The cleaned-source TypeScript and public production build passed.
- Thirty focused unit tests passed for range coverage, forecasts and image cards.
- Eleven Chromium journeys passed on the packaged public app: thin history,
  ordinary ranges, breaks, section choices, sharing, empty startup, manual
  recording and keyboard viewport behavior across all five periods.
- Two exact-public-build safe-update/offline checks passed with disposable data.
- Source, website, nested downloads and reachable history passed the content
  audit, with no restricted data, provider references or private dataset names.
- The numeric scan introduced no new price/history literals.

Browser observations use isolated test records, excluded from public files.
Build `public-blank-20261105T170044621Z` is live. All eleven journeys also passed at the public address.
All 39 served files match the reviewed package; eight excluded-data URLs
return 404. The live content audit has no findings. Publication: app commit
`4ec624b`, successful [Pages run 42071573462](https://github.com/ib-notes-app/ib-notes/actions/runs/42071573462).
Details are in [release-info.json](../release-info.json).
Physical public-phone installation and keyboard acceptance remain pending.
Browser viewport simulations do not establish a physical Safari pass. Firefox
and WebKit automation binaries are unavailable in this environment.

## Getting the update

Save current input and export a backup. Open your usual app address online
and choose **Update safely** when offered. Do not clear browser data to force
an update. [Update help](TROUBLESHOOTING.md).
