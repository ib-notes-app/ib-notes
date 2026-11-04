# What's new

[Open IB Notes](https://ib-notes-app.github.io/ib-notes/) · [Getting started](QUICK_START.md) · [All guides](../README.md)

## Your day's structure stays on the map

The selected day's own ON, 15R, A, B/IB and RTH ranges always remain visible
in Structure. Clearing extra map references cannot remove those boundaries,
including when an older version saved them as hidden.

The current period also has a named midpoint on the map and between the low
and high in Current conditions. Both use the same recorded range. It is not
saved as a level or carried into another day. Empty sessions identify their
phase without inventing a range.

## Clear enabled map references in one place

**Levels → Map levels** lists your enabled references with a quick **Hide**
button on each row. See which ones are shown now and which are enabled outside
the map distance. Hiding keeps the record and its history saved.

**Structure → Manage map levels**, or a listed reference under Other map
levels, opens that same section. Back returns to Structure. Optional references
stay hidden after returning or reloading; the day's own boundaries stay visible.
[Read the map-level guide](LEVELS.md#clear-map-references-quickly).

## Clearer share-card footers and phase names

Every image card now says **Not financial advice or trade signals**, including
cards that show only recorded prices or structure. The recording notice appears
once and explains that human error or gaps between entries can leave price
movements unrecorded. Longer warnings stay readable, and replay, source and
level qualifications are kept when relevant.

**Record price → Details** now uses the same **ON, 15R, A, B and RTH** names as
the dashboard. Your entries still save to the selected phase.

After updating, download a new image to get the new footer. Images you already
saved or posted do not change.

## Level confirmations clear themselves

Messages such as **Level enabled on map** and **Level hidden from map** now
disappear after a few seconds and clear when you leave the page or day. Level
note, archive/restore, proximity and recorded-visit confirmations behave the
same way. The saved changes remain in your journal; only the message clears.
A save error stays visible so it is not mistaken for a successful change.

## Levels stay useful through large moves

Home now finds the closest two saved references on each side of recorded CP,
even when they are beyond your map-distance setting. Older contract references
show their month and year with an amber **Prior** badge. Details keep the exact
source contract. Original prices are preserved, and different contract months
stay separate. [Read the level guide](LEVELS.md#levels-from-an-older-contract).

No CSVs, data packs or market history are included. These labels describe your
own saved or permitted imported references; they do not supply a history library.

## Recording is quicker

The entry row now puts **price · SAVE · time** together. Tap the time to change
when the observation happened. The current-session clock keeps updating while
the sheet is open. After a backdated CP save, it returns to now for your next
entry. High, CP and Low have a blue selection outline, leaving pink for SAVE.
The sheet stays open for repeated entries.

**Entries · Add Note · + Event · Details** sit together beneath the field.
Notes open a proper writing page. Save a note with a price and time, or save a
timestamped note on its own. The entry correction screen is more compact too.

## Events have their own recorded windows

Add CPI, PPI, FOMC or another event from Record price. Set its release time,
tracking window and note. Timed CP observations build its recorded high, low,
midpoint and width. Structure shows event windows; Review can find event days
and show their recorded IB statistics. [How Events work](EVENTS.md).

## Sharing follows the session

Tap a period, then **Share this period**. Pick ON, 15R, A, B, RTH or the full
session and combine the details on one image. Your usual card options stay
selected. Options dim when there isn't room for another readable item.
[Make a share card](SHARING.md).

## Missing measurements are easier to find

Amber calendar and period markers lead to the ranges that need attention.
Save the repair in that period; no extra trip to RTH is needed just to confirm
it again. High/low-only days can be complete. Weekly Review shortcuts are in
the calendar, with weekend dates kept for instruments that study weekends.

## A simpler Home menu

The **⋯** menu now opens **Instrument, Time zone, Import & data, Trash,
Backups & storage, and Help** directly. The instrument is shown on Record price.
Events are in the recording sheet. Trash counts stay on Trash instead of
lingering on the dashboard after you leave.

## Getting the update

Save your work and export a SQLite backup from **⋯ → Backups & storage**.
Open your usual app address while online. When **Update safely** appears,
choose it after saving any open draft. Your journal stays in the same browser;
there is no need to import it again or reinstall the app.

If the update isn't offered yet, close and reopen the app while connected.
Check **⋯ → Help → Build** against [the published build](../release-info.json).
Do not clear website data to force an update.

The public journal still starts empty. No market history, personal journals or
news feed are bundled. Forecasts still need suitable permitted learning history.
