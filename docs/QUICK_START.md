# Your first session

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [All guides](../README.md) · [What changed](WHATS_NEW.md)

Your journal starts empty. You record the prices, notes and events you want to
study. There is no live quote feed or included market history.

## Get oriented

The instrument appears on the big pink **Record price** button. To change it,
open **⋯ → Instrument**. Use **⋯ → Time zone** for your preferred clock display.
Each instrument keeps its own journal, prices and history.

Use the arrows beside the date to browse sessions, or tap the date to open the
calendar. **Current session** takes you back using your configured study hours.
ON, 15R, A, B and RTH are the period controls. Tapping one opens its range editor.
Closing it leaves that period selected for recording.

## Record a price

1. Press **Record price**. Check the instrument and selected period.
2. Type a price on the left. **CP** is selected for an ordinary price update.
3. Press the pink **SAVE** button between the price and time.

That's it. The sheet stays open so you can record another price without extra
taps. **Cancel/Close** leaves the sheet; earlier successful saves stay saved.
Choose **High** or **Low** to record the period extremes instead of CP.

The time on the right updates while you record the current period. Tap it to
adjust when an observation happened. After saving a backdated CP in the current
period, the clock returns to the current time for your next entry. Historical
entries need a valid time for their selected date and period. An open sheet
keeps its target if the clock moves into a new period; check the period before
starting the next one. High/Low times mean **known by**, not necessarily the
exact moment the extreme occurred. They do not replace the latest CP.

## Add a note or event

Below the price are **Entries · Add Note · + Event · Details**.

- **Add Note** opens a lined writing page with simple formatting. A typed price
  can be saved with its note and time. With no price, it saves a timestamped
  note only. Back returns to your recording draft.
- **+ Event** records something such as CPI, PPI or FOMC and its tracking window.
  Saved prices within that window can build its observed range. The event is
  entered manually; no news feed supplies it. See [Events](EVENTS.md).
- **Details** explains the entry types and gives access to the target phase:
  **ON, 15R, A, B or RTH**, matching the dashboard buttons.

## Correct a saved price quickly

Choose **Entries** from Record price. Newest observations appear first, with
**Latest CP** marked. Search by price, time or note, or filter **Unusual prices**.
A flag means check the value; it does not prove a mistake.

Tap the entry, correct its price or time, then press **Save correction** at the
top. You return to recording with your draft preserved. A price-only correction
keeps the original timestamp seconds. **Back to entries** leaves an unsaved
correction. Notes are available in the focused entry editor too.

## Check the ranges and nearby levels

Tap a period button to add its high and low. 15R sits within A; A and B form the
IB. Missing values stay missing. You can keep recording without pretending
you observed the entire price path.

The level cards around Record price use the selected day's latest recorded CP.
A low can appear above CP if price has moved below it. A zone containing CP says
**Inside zone**. Open **Levels** for the full library and Above/Below/All filters.
See [Create and track levels](LEVELS.md).

## Fix a missing measurement

An amber calendar dot means a saved day has something to check. Open that day,
then the marked period. The affected field is highlighted. Save the corrected
range there; you do not need to revisit RTH just to confirm the same repair.
A day with all required high/low ranges does not need extra CP entries to count
as complete. Unrecorded paths and unknown closing prices still remain unknown.

The calendar also has **Review** shortcuts for each week. Instruments configured
with **Study weekends too** keep their weekend dates available.

## Read, review and share

- **Structure:** recorded conditions and the session map.
- **Forecast:** available estimates for the stage of the day. No learning
  history is included, so historical odds may be unavailable.
- **Review:** entries, days, weeks and statistics. **Event days** helps find
  sessions with CPI, PPI, FOMC or another event you entered.

After close, **Review day** brings the period and daily highs/lows together with
**Day Notes**. Check them and use **Confirm day**. The closing price is optional;
the last CP is never assumed to be the close. Finalized edits keep their safeguards.

To share, tap a period button, then **Share this period**. Image Card opens first.
Choose ON, 15R, A, B, RTH or the full session, then the details you want included.
Your usual layout choices are remembered. Check the preview before downloading
or sharing. Nothing is posted automatically. See [sharing steps](SHARING.md).

## Keep your journal safe

Use **⋯ → Backups & storage → Export SQLite** regularly. Save a copy outside
the app. There is no automatic cloud backup or phone/computer sync.
[Backups and recovery](BACKUPS_AND_RECOVERY.md) explains checking and restoring it.

For your own permitted history, follow [CSV imports](CSV_IMPORT.md). For help,
try the [FAQ](FAQ.md) or [GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions).
Public posts should not contain private backups or proprietary data.

Structure journal only · No trade recommendations.
