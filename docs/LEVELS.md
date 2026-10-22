# Create and track your own levels

[Back to IB Notes](../README.md) · [Read the dashboard](READING_THE_DASHBOARD.md) · [CSV imports](CSV_IMPORT.md)

A level is a price or zone you want to remember and observe. You can add a
prior high, a low, a gap or another reference without importing a data pack.
Your saved price observations then build its activity and history.

## What carries forward automatically?

| Period | What the app retains or carries |
| --- | --- |
| **ON** | ONH / ONL references after the configured overnight end. |
| **15R** | Its own saved range, inherited by A. It is not a separate cross-day library reference. |
| **A** | Its own saved range, inherited by B/IB. It is not a separate cross-day library reference. |
| **B / IB** | IBH / IBL references after IB lock, with recorded B evidence. |
| **RTH** | A Daily Low after Confirm day. The daily high remains in the reviewed daily range. |

The Daily Low does not need a closing price or a rebound. An ordinary daily
reference is separate from a 20-point-move or reclaim qualification. Previously
confirmed daily lows appear without reconfirming, while existing notes and
removed-level choices are preserved. In Levels, select **Type → Daily levels**
to find them; map visibility and position/tier filters remain separate choices.

## Add a level

1. Select the correct instrument and session date.
2. Open **Levels** from the dashboard corner or bottom navigation.
3. Press **+ Add Level**.
4. Choose **Type**: **Low**, **High**, **Gap**, or **Other**. Choose its source
   **Timeframe**, or leave it **Unlisted** if you do not know.
5. Choose **Shape → Price** and enter **Level price**, or choose **Zone** and
   enter **Zone low** and **Zone high**. Use an ordered low/high pair.
6. Optionally add when it formed, a **Short label** and a **Level note**.
   Leave the origin time blank when unknown; do not invent the exact time.
7. Press **Save** in the form header. This adds the reference; it does not
   create a CP observation. Use the central **Record price** action for CP.

For example, a fictional level could be **Low · 1H · 7774.50**, labeled
“Prior session low.” A zone could span **7774.50–7776.00**. These are formatting
examples, not historical records or suggested trading levels.

### Produced 20+ points

Use **Produced 20+ points** only when you have evidence that this level already
produced such a move. Supply **Move direction** and, if known, **Move points**.
Twenty means price points, not ticks. This is recorded evidence about a prior
move, not a target or prediction. It is optional; an ordinary level still works
without it. Do not select it merely to seek a higher tier.

The form can remember your Type, Shape and Timeframe choices for the next new
level. Prices, origin times, notes and 20+ evidence are not copied into a fresh
record. **Reset form** clears the draft; **Cancel** leaves it unsaved.

## Find levels around your recorded CP

On a fresh visit to Levels, **Reference price** uses the latest applicable CP
for the selected instrument and session date. **Use CP** restores that value
after a manual reference-price change. Typing a reference here filters the
list; it does not change the journal's CP.

| Control | Use |
| --- | --- |
| **All / Above / Below** | Browse both sides of the reference or just one side. Touches and zones containing the reference can appear in either side filter. |
| **All / T1 / T2 / T3** | Narrow the list by the app's current evidence-based tier. |
| **Find a level** | Search by price, date, name or other saved level information. |
| **Type** | Select lows, highs, gaps, session references or other categories. |
| **More filters** | Limit distance in points, source or archived-level inclusion. |
| **Clear filters** | Remove list restrictions if a reference seems to be missing. |

Without a saved CP, enter a reference price to use the position filters. The
app does not borrow CP from another day. Open a result to see the exact level
and its detail history; **Back** returns through the view you opened it from.

The dashboard shows a compact nearby selection, not the whole library. A low
can sit **above** CP after price falls below it. Distance to an outside zone
is measured to its nearest boundary; a containing zone says **Inside zone**.
“Above” and “below” describe position, not guaranteed resistance or support.

Nearby low references may be grouped into an area. Expand it to inspect each
exact reference. Grouping preserves the member records; several references in
one zone are not automatically several independent defenses of that zone.

## Build the history by recording prices

Return to Home and use **Record price → CP → Save CP** as you observe price.
Check the observation time, especially for a backdated entry. High and Low
entries are period-extreme observations and do not replace a newer CP.

Automatic tracking reads compatible saved observations, their times and the
level's availability. It can identify recorded contacts, crossings, tests,
departures, returns and changing roles. No live feed is included. More frequent
entries can reveal more events, but entering three prices does not establish
what happened every second between them.

Open a level for these views:

| View | What it explains |
| --- | --- |
| **Level activity** | Events from saved prices alongside observations you explicitly recorded. Source labels distinguish them. |
| **Recorded visits** | Tests from above/below, saved departures/returns, and recorded moves away from the reference. Consecutive contacts count once; a new visit needs a saved departure and return. |
| **Tracking details**, where available | A low's flush, reclaim, recovery floor and dated transitions. |
| **Notes** | Your original note and later notes about the reference. |
| Tier explanation beneath the level | Why the current reference has its displayed T1, T2 or T3 classification. |

Support/resistance labels describe the app's recorded relationship and role
logic. A crossing between two saved prices does not establish the exact
crossing time, a continuous hold, or an unseen market path. Missing activity
means “not recorded,” not “did not happen.”

## Record something you observed directly

In the level's **Level activity**, press **Record what happened**. Choose
**What happened**, check **When**, and press **Save observation**. Depending on
the reference, choices include support/resistance tests, holds, a flush below
or a reclaim above. **Optional note & context** adds your explanation or links
to an earlier event you already recorded.

If saved prices already show the same event, the form offers **Confirm existing
event** rather than counting a second automatic event. An already-recorded
duplicate is blocked. These observations remain separate from CP entry; they
do not create an invented price just to justify a tag.

## Read LBAF and LAAF tags

**LBAF** means **Look Below and Fail**. **LAAF** means **Look Above and Fail**.
An ordinary crossing of a low is not automatically a qualifying LBAF.

The current automatic low-reclaim rule requires:

1. Evidence of a **20+ point upward move before the flush**. This can come
   from compatible saved prices or the documented prior-move fields.
2. A saved flush below that eligible low, followed by a reclaim above it.
3. For **LBAF reclaimed**, a first saved price at least **5 points above** the
   low, then another at or above that threshold **more than 3 minutes later**,
   without an intervening recorded dip below the threshold. For a zone, use
   its upper edge plus 5 points.

The timer starts at the first saved +5 price, not an assumed unseen reclaim.
Exactly three minutes is not enough. A later entry can complete the check;
elapsed clock time by itself cannot. Two entries 30 minutes apart still do
not prove price held above the threshold continuously. The pending check does
not bridge separate journal sessions.

Ordinary crossings and role tracking remain available for unqualified lows.
Explicit **Review and confirm LBAF / LAAF** controls, when offered, record your
own assessment of the full structure. They remain distinct from the automatic
quantitative low rule. There is no matching automatic high-side LAAF rule in
this version.

**LBAF history · [date]** preserves useful past context when the level is
revisited. It does not automatically raise its tier or make the old reclaim a
new event today. Correcting or removing the underlying evidence can change
derived history; it is not an immutable claim about the market.

## Tiers, map visibility and maintenance

T1/T2/T3 summarize the app's available structural and interaction evidence.
They are calculated, not a manual star rating, win probability or trade
recommendation. Open the level's tier explanation rather than assuming its
color means it will hold. IB pink and ON gray also identify session-reference
types; they are not extra forecast confidence scores.

Use **Show on map** or **Hide from map** in level details. If an enabled
reference is not visible, check **Levels → Today & map distance**. Its distance
setting can keep a far-away reference off today's map; the library record is
still saved.

Use **Add note** as the story develops. Under **Manage level → Edit**, correct
the price, shape, timeframe or other entered details. A native IB/ON reference
instead offers **Edit source range** so the underlying session measurements
remain consistent. Corrections to levels and price observations can recalculate
their tracking and statistics.

To stop following a reference, choose **Manage level → Archive…**, select a
reason and confirm. A lost level is not automatically deleted; it may remain
useful for later role changes. Archived records can be included through the
library filter. Use the available Undo control when correcting an unintended
change, and export SQLite backups regularly.

Under **Review → Level stats**, explore the saved activity and open the
underlying observations. Automatic price-derived activity and your explicit
observations/confirmations are identified separately. No entries means no
recorded evidence, not a fabricated successful test.

Only enter or share reference information you have permission to use; the
[CSV guide's data-rights reminder](CSV_IMPORT.md#check-your-data-rights-first)
applies to proprietary source data too. Notes stay local unless you explicitly
include them in a supported export/share workflow.

Questions or ideas: [GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions).
Found a bug? Use [GitHub Issues](https://github.com/ib-notes-app/ib-notes/issues).
See [how to report a problem](TROUBLESHOOTING.md#send-a-useful-report) before
posting; reports are public, so keep private or proprietary information out.

Structure journal only. No trade recommendations.
