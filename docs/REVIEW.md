# Public version — test status

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [What changed](WHATS_NEW.md)

Record price now chooses the period from the observation time. The public
package passed phone-sized checks for backfilling a 15R price from A, routing a
previous-evening ON price, preserving saved observation times, and switching
from a manual period to Automatic without losing the draft.

The private build passed focused entry and offline update checks. The RTH
Review day layout and navigation were checked at two phone widths. The
performance update reduced idle work in matched phone-sized browser tests.
Cellular battery use and the public install on a physical phone remain to
be tested. See [release-info.json](../release-info.json) for the release record.

This package contains the app with an empty journal. It includes no market
history, CSVs, packs, journals, backups, or example records. Your permitted
data stays in your browser.

Save current input, keep a backup, and choose **Update safely** at your usual
app address when offered. [Update help](TROUBLESHOOTING.md).
