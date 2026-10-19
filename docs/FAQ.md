# Frequently asked questions

[Back to IB Notes](../README.md) · [Getting started](QUICK_START.md) · [Open the app](https://ib-notes-app.github.io/ib-notes/)

Short answers for the public version. Start with one price and build your
journal as you go.

Step-by-step help: [Backups and recovery](BACKUPS_AND_RECOVERY.md) ·
[Troubleshooting](TROUBLESHOOTING.md) · [Privacy and your data](PRIVACY.md).

[Getting started](#getting-started) · [Data and backups](#data-and-backups) ·
[Recording prices](#recording-prices) · [Forecasts and structure](#forecasts-and-structure) ·
[Levels](#levels) · [CSV imports](#csv-imports) · [Sharing and help](#sharing-and-help)

## Getting started

### What is IB Notes?

A journal for studying the Initial Balance: the first hour of the regular
trading session. Record prices, follow the structure, track levels and review
what happened. It does not give trade recommendations.

### Is it free? Do I need an account or a subscription?

It is free, with no app account or subscription required. [Ko-fi support](https://ko-fi.com/ibnotes)
is optional and does not unlock extra features.

### How do I open or install it? Does it work on Android?

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) in a supported browser.
It is a web app, with Home Screen installation options for iPhone and Android;
there is no APK or App Store download. See [installation instructions and device-test status](INSTALLATION.md).

### Do I need to download the GitHub repository or know how to code?

No. Use the app link above. The repository is where the instructions and source
code live; its ZIP files are not phone installers.

### Is it only for ES?

ES is the starting workflow, but instruments have their own journal configuration.
Use the correct tick size, study hours and calendar for the instrument. Changing
a name alone does not make another market's data equivalent.

### Why is everything empty when I first open it?

The public app includes no market history, example journals or data packs.
Enter your own observations or [import compatible history](CSV_IMPORT.md)
that you have permission to use.

### Does it provide live prices, automatic news or broker connections?

No. You record observations and context yourself. The displayed CP is a saved
price, not a live quote, and the app does not place orders.

### Can I use it offline?

Ordinary journaling works after the app has finished preparing for offline
use. The first visit and updates need a connection; external guides and links
also need internet access. Physical-phone offline checks are still pending.

## Data and backups

### Where is my data? Does GitHub receive my prices and notes?

Your journal is stored in your browser on your device. GitHub serves the app's
files; calculations run locally. Recording prices and notes does not upload
your journal to GitHub or the developer.
See [Privacy and your data](PRIVACY.md) for hosting requests and voluntary sharing.

### Will my phone and computer stay in sync?

No. Devices, browser profiles and app addresses have separate storage. There
is no automatic cloud sync or live merge between journals.

### How do I back up my journal?

Open **⋯ → Settings → Backups & storage → Export SQLite**. Save the file somewhere
you control and repeat regularly. Browser storage is not a substitute for a backup.
Follow [Backups and recovery](BACKUPS_AND_RECOVERY.md) to save and check a restorable copy.

### How do I move to another phone, browser or app address?

Export SQLite from the original journal, open the app at the destination and
use **Restore SQLite**. Restore replaces all instrument journals there; back
up the destination first. It does not merge two devices' entries.
Use the [moving and restore steps](BACKUPS_AND_RECOVERY.md#move-to-another-phone-browser-or-app-address).

### Should I export SQLite or JSON?

Use **SQLite** for the app's restorable backup. **JSON** is a readable copy of
your records. Keep SQLite when preparing to restore or move your journal.

### My journal looks empty now. What should I check?

Check the instrument, date, exact app address, browser and device. Another
browser or address can have a separate empty journal. Do not clear storage or
reinstall as a first fix; preserve the original data and seek help.
See [Troubleshooting](TROUBLESHOOTING.md#the-app-is-empty-or-records-seem-missing).

## Recording prices

### What do High, CP and Low mean?

**CP** is an observed current price. **High** and **Low** record period extremes
known by the supplied time. High/Low entries do not replace your latest CP.

### Which period will my entry go into?

Check the instrument, date and phase shown on the entry sheet. That is its
target. The open sheet keeps its target when the clock moves into another
period; it does not silently switch to RTH.

### Why does the entry sheet stay open after Save?

So you can record High, Low and CP without reopening it each time. A successful
save is already stored. **Cancel/Close** dismisses the sheet; it does not undo
earlier saves.

### Can I adjust the time or enter a historical price?

Yes. Use **Edit time** and check the date and phase. Historical entries need
a valid historical time. For High/Low, the **known by** time does not claim the
exact moment the extreme occurred.

### How do I enter or correct a period's range?

Tap its **ON / 15R / A / B / RTH** button to open the range editor. 15R belongs
within A; A and B form the IB. Later prices do not silently rewrite locked
earlier ranges. See the [first-session guide](QUICK_START.md).

### Do I have to record every price or complete every field?

No. Sparse entries are supported and missing fields stay missing. Gaps do not
mean price held still; the app cannot reconstruct movement you did not observe.

### How do I fix a typo or rejected price?

Check the selected instrument's tick size and price precision. For an already
saved mistake, open **Review → Day timeline** and inspect or correct the entry;
use Undo when offered. **Review price** flags something unusual, not a proven typo.

### Is a closed session the same as a finalized journal?

No. The clock can close the session while your journal remains unfinished.
Use the closing review to check measurements and coverage. Finalized entries
use the explicit editing safeguards; opening a day does not unfinalize it.

## Forecasts and structure

### What is the difference between the four dashboard buttons?

**Forecast** shows available estimates. **Structure** shows recorded conditions
and the map. **Levels** holds references and their history. **Review** holds
entries, recaps and statistics. See [Read the dashboard](READING_THE_DASHBOARD.md).

### Why does a forecast say Unavailable or Partial?

**Unavailable** means the required inputs or compatible learning history are
missing; it is not 0%. **Partial** identifies incomplete inputs. The public
app starts without a historical probability library.

### Will recording prices or importing any CSV unlock every forecast?

No. Recording builds your journal; historical odds need suitable learning
history. CSV learning is an explicit import option, and some forecasts need
minute-price paths that daily summaries do not contain.

### How can 37% be the most likely result? Is a forecast a guarantee?

One outcome can lead when the remaining probability is spread across others.
A low-probability event can still happen. Check the target and timestamp;
forecast percentages are study estimates, not trade instructions or guarantees.

### What do IBH, IBL, IBB and IBN mean?

On the map, **IBH/IBL** name the IB high/low prices. As outcome categories,
they mean high-only/low-only breaks; **IBB** means both and **IBN** neither.
These are post-lock outcomes, and missing observations do not prove neither broke.

## Levels

### Can I create my own levels without a data pack?

Yes. Open **Levels → + Add Level** and save a price or zone. Your CP entries
then provide recorded interaction evidence. See [Create and track levels](LEVELS.md).

### Why is a low above my current price, or a level missing from Today?

Above/below is calculated from recorded CP, not the level's name. Today shows
only a nearby selection. In Levels, check **Use CP**, Above/Below, tier and
distance filters; a containing zone says **Inside zone**.

### Do tiers and LBAF tags tell me what to trade?

No. T1/T2/T3 summarize available evidence. LBAF means **Look Below and Fail**;
LAAF means **Look Above and Fail**. Qualification and dated history are explained
in the [levels guide](LEVELS.md#read-lbaf-and-laaf-tags); a tag is not a guarantee.

## CSV imports

### Can I import any chart, tick or broker CSV?

No. The current CSV format accepts **one daily IB summary per session date**,
with specific headers and measurements. Ordinary OHLC bars, tick files and
trade logs need preparation; renaming a file is not enough. See [CSV format](CSV_IMPORT.md).

### Will imported days become editable entries on Today?

No. They form a separate history library, available through pack browsing and
Review. Daily summaries do not reconstruct individual observations or an intraday path.

### Can I use or share data from any provider?

Only where the provider's terms and applicable data licenses permit your use.
The app's software license grants no market-data rights. Check permission
for importing, processing, learning and sharing; see the [data-rights reminder](CSV_IMPORT.md#check-your-data-rights-first).

## Sharing and help

### Does Share automatically publish my journal?

No. **⋯ → Share** opens a preview. You choose what to copy, download or share;
nothing is automatically posted. Check both the content and your data-sharing
rights before sending it.

### How do I report a bug?

Use **Settings → Report a problem** to review and copy a report, or email
**ibnotes.support@icloud.com**. Include your device, browser, app build, steps
and any error message. Remove private information from screenshots first.

### Where can I follow updates or support the project?

Follow [@IBFieldNotes on X](https://x.com/IBFieldNotes). Optional donations go
through [Ko-fi](https://ko-fi.com/ibnotes). The app remains free to use.

Structure journal only. No trade recommendations.
