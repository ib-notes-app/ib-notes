# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

This update makes overnight entries choose their matching date automatically.
In **Record price → ON**, changing the clock selects the date within that
session's overnight window. It covers CP, High, Low and note clocks, including
older sessions. Invalid ON times name the window to use. Existing entries,
study hours and the return-to-now behavior after CP save are preserved.

The owner approved the private update and this public release. The isolated
public source build and the phone-sized ON entry/save/reload check passed.
Fifty-four focused checks and two update/offline journeys passed during private
verification. Physical public-device validation remains pending. Earlier
popup-dependent navigation limitations remain disclosed in
[release-info.json](../release-info.json); they were not rerun for this date fix.

This app includes no market history, CSVs, packs, journals, backups, examples
or data-bearing screenshots. Your own permitted data stays on your device.

Save current input, keep a backup, and choose **Update safely** at your usual
app address when offered. Do not clear browser data to force an update.
[Update help](TROUBLESHOOTING.md).
