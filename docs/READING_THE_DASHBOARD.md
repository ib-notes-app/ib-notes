# Read the four dashboard buttons

[Back to IB Notes](../README.md) · [Getting started](QUICK_START.md) · [CSV imports](CSV_IMPORT.md) · [Creating levels](LEVELS.md)

The center records your observations. The four surrounding buttons help you
understand the selected session and inspect its evidence.

| Button | Open it for |
| --- | --- |
| **Forecast** | Estimates of what may happen next, with their time and supporting history. |
| **Structure** | Current recorded conditions and the map of the session's ranges and prices. |
| **Levels** | References around CP, their position, and their interaction history. |
| **Review** | Saved days, entries, recaps and the observations behind your statistics. |

Check the instrument, date and timestamps before interpreting a screen. CP is
the **last recorded current price**, not a live quote. The period buttons
**ON / 15R / A / B / RTH** give access to period recording and editing; they do
not manufacture an earlier forecast or an unseen historical price path.

Use the bottom **Home / Levels / Review** tabs for the main destinations. Home
returns directly to the dashboard, keeping the selected instrument, date and
viewed phase. A named **Back** button on a deeper page returns to its parent;
**Close** or **Cancel** dismisses a popup or form. Levels and Review use the
same underlying content as their corner buttons.

## Forecast — read the estimate and its target

Start with the main result, then check **what event it estimates**, **when the
estimate was made**, and **how much of the session remains**. Estimates change
as the session progresses and new observations become available.

### What appears as the day develops

| Session stage | What to look for when the required inputs and history are available |
| --- | --- |
| **Overnight** | **Opening band estimate**: the estimated band containing the RTH open, relative to the displayed fixed overnight reference range. Open **Opening odds & evidence** for the reference boundaries and other bands. |
| **15R / A / B formation** | **Leading outcome by RTH close**, the four edge outcomes, and **Estimated IB width**. First-break odds are in Details. The width band is an estimate, not guaranteed limits. |
| **After IB lock, before a recorded break** | The leading outcome and all four chances, including **Neither**. No return forecast is needed yet. |
| **After one recorded IB edge break** | **Chance IB low also breaks** or **Chance IB high also breaks** asks whether the other edge breaks before close, which would make IBB. |
| **After a break, while outside the IB** | **Chance of return inside IB** asks about reaching at least one tick inside after the estimate and before close. Touching an edge alone does not count. |
| **After both recorded breaks** | **Both IB edges broke · IBB** reports recorded evidence. A future return may still be estimated while price is outside. |
| **After the session ends** | Saved estimates and, when the day has been finished with the relevant records, **Post-IB recap** and **Forecast vs result**. |

The return count includes each recorded outside-to-inside excursion after the
first IB edge break. Inside again, **Returns inside IB** shows the recorded count.
Another outside observation can ask **Chance of another return inside IB**.
Repeated inside observations and edge touches do not add returns. Sparse entries
can miss a return; the count describes recorded evidence, not complete coverage.
Before any recorded break there is no return placeholder. A new estimate may
legitimately have the same percentage as an earlier one.

The forecast screen follows the selected session's stage and available
evidence. For an earlier forecast, read its saved timestamp in the details;
do not assume an earlier period selection replays what the model knew then.

### Read percentages without mixing the questions

**Leading outcome by RTH close** compares four edge outcomes:

| Code in an outcome estimate | Meaning |
| --- | --- |
| **IBH** | Only the IB high breaks after lock. |
| **IBL** | Only the IB low breaks after lock. |
| **IBB** | Both edges break after lock. |
| **IBN** | Neither edge breaks after lock. |

In the map, IBH and IBL also name the actual high and low reference prices.
The heading tells you whether a label is a price edge or an outcome category.

A fictional **IBL 37%** can lead a four-outcome estimate even though it is
below 50%; the remaining probability is spread across the other outcomes.
That is different from **First edge to break: IBL**, which asks which edge
goes first. A low-first day can later break the high and finish as IBB.

A fictional **3% Return inside IB** favors no future return under that
estimate; it still leaves a return possible. It is not a forecast of 3% price
movement, a confidence score for the whole app, or a guarantee of the result.
A low-probability event can happen. One day's result does not establish the
model's accuracy; compare many saved estimates with their appropriate outcomes.

Prices, distance from the range and time remaining can change an estimate.
Three quick entries and a gap while you take a break are observations, not
proof of continuous movement or price holding still. Check the **Estimate**
and CP times instead of treating a stale recorded price as current market data.

### Details, missing inputs and saved forecasts

Open **Forecast details** for supporting explanations, saved estimates,
outcome chances and historical matches where available. Keep the **current
estimate** separate from an **original/saved forecast**; they may have different
times and answer different questions. Historical replay estimates are also
different from predictions actually saved during a live session.

**Partial forecast** names missing inputs, such as an ON low or 15R edge, or
indicates that the IB is based on partial recorded prices. Check and correct
your session measurements rather than guessing the missing value.

**Unavailable** means the app cannot produce that estimate from its current
inputs and compatible history. It does not mean a 0% chance. **Updating…**
means a calculation is in progress, not a probability.

The blank edition ships with **no historical probability library**. Recording
prices still builds the journal and structure map. Suitable permitted learning
history is needed for historical odds; some targets also require compatible
earlier minute-price history, which a daily CSV does not supply. See the
[CSV import guide](CSV_IMPORT.md) before adding your own data. Importing a file
does not guarantee every forecast becomes available.

Match counts and support labels describe the comparison behind an estimate.
Closer matches can receive more weight; a large file is not necessarily a
large set of close matches for the current situation. They are not a measured
win rate or a promise that the next outcome will follow the estimate.

### Today in context

Recorded widths and the IB's location within ON help explain what is unusual
about the session. These facts come from your entries, not a live feed.

Where earlier records are available, the app can say how many completed ranges
were narrower and how often an outcome occurred among IBs at least as wide as
today's locked IB. It names the source and sample size. **Your journal** and
**learning history** are separate comparisons; unfinished coverage remains
unknown rather than being counted as Neither.

A **historical frequency** counts past records. A **model estimate** weights
several available conditions, so its percentage can differ. Neither is a
guarantee. Forming IBs are not compared with final widths as though today's
range were already complete. Full explanations stay in **Forecast details**.

## Structure — read the conditions and the map together

Start with **Current conditions** or **Closing conditions**, then look at the
structure map below. Conditions summarize recorded price position, IB activity
and available range behavior. Open **Conditions explained** for the basis of
those descriptions and the recorded IB code.

The map develops as you record the session:

- **ONH / ONL** mark the overnight range when supplied.
- **15R** is the first 15 minutes of RTH and sits within A.
- **A and B** together establish the IB. Forming, inherited and recorded ranges
  keep their own labels; a range carried forward is not proof of complete coverage.
- **IBH / IBL** identify the IB edges, with a midpoint reference between them.
- Recorded CP observations show where your saved prices sit relative to the
  ranges. Enabled nearby levels can add other reference markers.

Read the **Forming / Recorded / Locked / Confirmed** wording alongside the
values. A forming range can still expand. Recorded edges can support a
provisional read when final confirmation is missing. Clock time advancing does
not supply observations you did not enter.

A CP between the IB edges is inside the range. If CP falls below IBL, that
low reference sits above CP. Position percentages describe where price sits
in a range; they are not forecast probabilities.

Recorded break labels report what your entries establish after lock. A range
extension during formation is not a post-lock IB break. A break followed by a
return inside remains part of the recorded history; returning inside does not
erase the earlier break. The current IB code remains provisional until the
day's closing review is finished.

Balance, imbalance and related conditions describe the available recorded
ranges and prices. They do not establish continuous holding, volume-profile
value areas or unseen order flow. A drawn connection between observations is
not proof of the exact path between them.

## Levels — orient around CP and inspect the reference

Levels is the full browser for your own prices/zones and available session or
imported references. The dashboard's surrounding cards are only a nearby
selection from that library.

1. Check **Reference price** and its recorded CP time. **Use CP** restores the
   selected day's latest CP after a manual filter-price change.
2. Use **Above / Below / All**, then **T1 / T2 / T3 / All** if useful. Those
   controls combine, so check both when something seems missing.
3. Open a level or expand a grouped area to inspect the exact references.
4. Read its current role, **Level activity**, **Recorded visits**, notes and
   tier explanation. Keep today's activity separate from dated LBAF/LAAF history.

Distances use the reference price; editing that filter does not save a new CP.
For a zone, distance is measured to the nearest boundary. A containing zone
says **Inside zone**. The Above/Below filters can include touches and zones
containing the reference.

Support/resistance roles and tiers summarize available evidence. They are not
instructions to take a trade. A historical reclaim marker does not guarantee
another reclaim or automatically upgrade a reference's tier.

Use [Create and track your own levels](LEVELS.md) for the complete entry,
tracking, LBAF qualification, map visibility and maintenance workflow.

## Review — inspect the record behind the summary

The persistent top sections are **Days**, **IB stats** and **Level stats**.
**Day timeline** and **Review day** sit together beneath the Review heading.
Review day highlights **Needs review** after the session closes; confirmed days
keep a dark, usable button labeled **Confirmed**.

| Review area | What to read |
| --- | --- |
| **Days** | Find a saved date and see what exists: your journal, an imported IB summary, an available minute map or context. Imported facts remain identified separately from editable journal observations. |
| **Weeks / Months / Years**, within Days | Broader recaps from your journal entries. These views do not automatically turn every imported CSV row into a journal day. Clear a search or pack filter if the period controls are hidden. |
| **Day timeline** | The selected session's saved prices, ranges, news and notes, grouped into overnight, IB and post-IB sections. Search by price, time or text and tap an entry to inspect or correct it. |
| **IB stats** | Outcomes, first breaks, returns, closing position and IB widths for the chosen data source. Open a count to inspect the contributing days. |
| **Level stats** | Recorded level interactions, visits and recoveries, with drilldowns to their underlying observations. Price-derived events and your explicit confirmations stay distinguishable. |

Check the source and denominator before interpreting a percentage. Your local
journal, reference history and separate comparison history are different
groups. A result from a handful of known outcomes does not describe every day
you imported. Missing coverage and unknown outcomes remain unknown.

In **Day timeline**, a **Review price** tag flags an unusual value worth
checking. It does not prove a typo and does not automatically exclude the
price from calculations. Keep it if correct; use the existing correction or
removal controls if it was entered incorrectly.

When reviewing forecasts, compare each estimate with events **after its own
timestamp and before its deadline**. A return before a later estimate does
not satisfy that later estimate. **No return recorded** describes your saved
evidence; sparse entries may have missed a return. **Comparison unavailable**
or **Result not confirmed** is a limit on verification, not a 0% estimate.

A session being **closed by the clock** is different from confirming its journal.
Ordinary observations save immediately, and recorded ON/IB levels carry forward
after their configured boundaries without per-period completion steps.
**Review day** collects period and daily high/low measurements, an optional
explicit RTH close and expanded **Day Notes** behind one **Confirm day** action.
The last CP is not substituted for an unknown close; unrecorded path coverage
remains unknown. Finalized days retain explicit editing safeguards. Corrections
can update derived maps and statistics.

Daily sharing opens from a period button: **ON / 15R / A / B / RTH →
Share this period**. Image Card opens first. Choose a period or the full session,
then combine recap, forecast, map, conditions and other details on one card.
Your usual options are remembered. Notes and nearby levels need individual
selection for the selected day. Options dim when another item would overfill
the card; selected items stay removable. See [Make a share card](SHARING.md).

Structure's **Event windows** show the recorded ranges around events you added.
In Review, **Event days** helps find CPI, PPI, FOMC or your own event names and
inspect their IB outcomes. Counts describe eligible recorded days, with each
matching day counted once. See [Events](EVENTS.md).

Amber calendar dots and period markers lead to missing ranges or unusual prices.
Open the affected period to check its highlighted field. Saving the range
updates the day and weekly summary without a second RTH confirmation. A day can
have complete high/low ranges without a stream of CP observations. Missing
closing prices and unobserved movement still remain unknown.

## A short daily loop

**Record price → Structure → Forecast → back to recording.** Open Levels when
you want reference detail. Use Review to check the timeline and measurements,
correct mistakes, and compare saved forecasts with recorded outcomes.

You can use the journal, map and manual levels while historical odds are
unavailable. Export SQLite regularly through **⋯ → Backups & storage**.

For questions or ideas, use [GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions).
For bugs, use [GitHub Issues](https://github.com/ib-notes-app/ib-notes/issues).
See [reporting steps and the email fallback](TROUBLESHOOTING.md#send-a-useful-report);
GitHub posts are public.

Structure journal only. No trade recommendations. Do not use these estimates
for trading decisions.
