# Import and use your own CSV history

[Back to IB Notes](../README.md) · [First-session guide](QUICK_START.md)

IB Notes starts empty. You can record your own observations or import
compatible history that you have permission to use. CSV imports add a separate
history library; they do not fill the dashboard with editable journal entries
or reconstruct a price-by-price timeline.

## Check your data rights first

**You are responsible for confirming that your data license permits your
intended use in IB Notes. The app's software license grants no rights to
third-party market data.**

Check the provider's terms and any applicable exchange or dataset license
before exporting, copying, processing, or importing proprietary data. Confirm
permission for use outside the original platform, including local analysis and
forecast learning. Permission to view data is not permission to use it in
another application or redistribute it.

Before sharing CSVs, derived packs, backups, screenshots, or recaps containing
that data, check the relevant sharing and redistribution terms too. Free
access, a paid subscription, manual transcription, or changing a file's format
does not by itself establish those permissions. Ask the provider if uncertain.

For exchange-supplied data, consult the exchange's policies as well as your
provider's agreement; for example, the [CME market data policy center](https://www.cmegroup.com/market-data/license-data/market-data-policy-education-center.html).
This reminder is not legal advice or confirmation that a particular source is
licensed for your use. You do not need to send your proprietary files to us.

## Import a prepared file

1. Export a SQLite backup from **Settings → Backups & storage** first.
2. Save your compatible `.csv` file somewhere the device's file picker can access.
3. Choose the correct instrument in IB Notes. Open **⋯ → Settings → Study packs**.
4. Press **Add a pack or CSV** and select the file.
5. Check **Preview before import**: row counts, years, missing data, duplicate
   dates, and ON / 15R inputs. Resolve every blocking error before continuing.
6. Leave **CSV options → Use these days for forecast learning** off to browse
   and compare the history. Turn it on only for permitted, verified learning
   data with matching instrument and session definitions. This choice is made
   before importing, not by renaming the file afterward.
7. Press **Add IB Pack**. A CSV uses this button too. For a custom instrument,
   the app may also require confirmation that the file matches the instrument
   and study hours; confirm only if it actually does.
8. Under **Your packs**, expand the imported IB Pack and press **View pack days**.
   Imported history is also available through **Review → Days** and **IB stats**.

The file is read and saved locally in that browser's journal. It is not
automatically uploaded or synchronized to another phone or computer. Export
another backup after a successful import.

## What kind of CSV works?

The current CSV importer accepts **daily IB summaries: one row per RTH session
date**. A generic `time,open,high,low,close,volume` export, tick file, trade log,
or list of prices is not the supported daily format. Prepare the daily
measurements from data you are allowed to process; renaming columns alone
does not calculate them. No automatic raw-bar converter is included here.

The existing daily format uses Pacific study-clock names: ordinary RTH opens
at **6:30 AM America/Los_Angeles**, IB locks at **7:30 AM**, and the ordinary
study close is **1:00 PM**. These are timezone-aware times, not a permanent UTC
offset. `CP_07_30` means CP at that IB lock even if your display timezone is
Eastern or UTC. Changing display settings does not convert source measurements
made with different study hours. Respect the applicable session calendar and
do not present an incomplete or shortened day's coverage as a normal full day.

Keep instruments, actual contracts, session boundaries and adjustment methods
consistent. Preserve the real contract identifier; do not relabel another
instrument's data or assume an adjusted continuous series is equivalent to
individual contracts. The journal is configurable, but this daily CSV format
is not an arbitrary instrument/time-column mapper.

Use UTF-8, comma-separated fields and a `.csv` filename. Keep files at or below
10 MB. Use the exact, case-sensitive headers below; column order can vary.
Use decimal points without currency symbols or thousands separators. Quote
text containing commas, and save dates as `YYYY-MM-DD`, not spreadsheet serials
or locale-specific dates. Leave unknown optional values blank; never use zero,
`false`, or `IBN` as a substitute for missing evidence.

## Required columns

Every header in this table must be present, including headers whose row values
may be blank.

| Column | What to enter |
| --- | --- |
| `rth_date` | RTH session date, such as `2026-10-12`. One row per date in a file. |
| `status` | `OK` for complete source coverage, or `MISSING_DATA` when coverage is incomplete. Do not use `OK` just to bypass a gap. |
| `missing_data_details` | Describe any missing coverage; blank when none. |
| `locked_IBH` | Final IB high. A valid number is required even on a `MISSING_DATA` row. |
| `locked_IBL` | Final IB low. A valid number is required even on a `MISSING_DATA` row. |
| `locked_IB_width_points` | `locked_IBH - locked_IBL`. Must reconcile with both edges. |
| `CP_07_30` | Observed CP at the IB lock; blank if unknown. |
| `CP_07_30_position_pct` | `100 × (CP_07_30 - locked_IBL) / locked_IB_width_points`; blank if CP is unknown or width is zero. |
| `first_break` | First post-lock edge broken: `IBH` or `IBL`. Blank if unknown; `none` is also accepted but does not establish a completed no-break day. |
| `returned_to_IB` | `true` if price returned inside/on the IB after the first break; `false` only when adequate coverage establishes no return; blank if unknown. |
| `day_type` | `IBH` = high edge only; `IBL` = low edge only; `IBB` = both; `IBN` = neither. These describe post-lock breaks, not formation extensions. Blank if unknown. |
| `RTH_close` | Price at the applicable study close; blank if unknown. |
| `final_disposition` | Exactly `close above IBH`, `close inside IB`, or `close below IBL`; blank if unknown. Inside includes a close on an edge. |
| `contract` | Actual source contract, for example `ESZ26`; blank if genuinely unknown. Do not invent one. |
| `source_year` | Four-digit year matching `rth_date`. |

The daily format cannot import a row without both final IB edges and a valid
width. If those are missing, omit that day from the import rather than inventing
prices. Keep its incomplete observations in your manual journal if useful.

### Optional columns

| Column | Meaning |
| --- | --- |
| `ONH`, `ONL` | Completed overnight high and low for the matching study window. |
| `IB15_H`, `IB15_L` | High and low of the first 15 minutes of RTH. |
| `deepest_return_points` | Known deepest return measured inward from the first broken edge; a nonnegative number. A recorded edge retest can be `0`; leave unknown depth blank. |
| `break_code` | Optional detailed final classification. Omit it unless you already use the app's exact notation; when possible, the importer derives it from the supplied day type, IB edges and close. |

Supply all four ON / 15R values to make those opening inputs available. They
are used together; partial input does not create a complete opening example.
The 15R high/low must lie within the final IB, and each high must be at least
its paired low. Optional fields are not guesses or extrapolations.

## Copyable format example

**Fictional formatting example only. These are not historical prices. Do not
add this row to a real research library or enable forecast learning for it.**
Copy the header into a spreadsheet or text file, then replace the example row
with your own permitted, checked measurements. The last four columns are
optional; this example includes them to show their placement.

```csv
rth_date,status,missing_data_details,locked_IBH,locked_IBL,locked_IB_width_points,CP_07_30,CP_07_30_position_pct,first_break,returned_to_IB,day_type,RTH_close,final_disposition,contract,source_year,ONH,ONL,IB15_H,IB15_L
2026-10-12,OK,,110,100,10,105,50,IBH,true,IBH,108,close inside IB,ESZ26,2026,115,95,107,101
```

Here the locked IB is 100–110, its width is 10, and lock CP 105 is at 50% of
the range. Only the high edge later broke; price returned inside and closed
at 108. The row supplies outcomes, not the sequence or timestamps of each move.

## Use the imported data

- **Comparison, the default:** the app calls this **Separate comparison**.
  Browse imported days and statistics without using them as forecast-learning
  examples. Completed earlier IB/close facts can still provide prior-day context.
- **Learning, explicitly enabled:** the app calls this **Reference history**.
  Eligible earlier days can support the IB Forecast when the data and session
  definitions match. Importing a CSV does not guarantee an available forecast,
  adequate matches, or accurate probabilities.
- **Detailed paths:** daily summaries do not supply minute-by-minute movement.
  Features requiring price paths need separate compatible Price Action Packs;
  this CSV does not create those paths automatically.

Keep evaluation data separate from learning data. Do not enable both uses for
the same days to claim an independent forecast test. An import is not a set of
live predictions made before those outcomes were known.

## Correct a file, remove it, or recover

The app blocks duplicate dates within a file, invalid values and incompatible
range geometry. It also prevents overlapping imports in the same data group
from silently replacing existing history. If a preview is wrong, use **Clear
selection**, correct the source CSV and select it again; clearing the selection
does not remove an installed batch.

For an installed daily CSV, **Settings → Study packs → Your packs** lets you
expand the IB Pack, choose **Remove**, and confirm **Remove IB Pack**. Back up
first and check the batch carefully. Removal affects that imported history,
not manual journal entries or saved forecasts. Then import the corrected file.
An identical file may instead offer an existing-library update or report that
it is already installed; do not duplicate it under a new name.

If import fails, keep the error message and check the header spelling, date
format, year, numeric values, accepted outcome labels and duplicate dates.
`locked_IBH - locked_IBL` must match the supplied width. The importer cannot
verify the truth of every source measurement or grant permission to use it.

Questions: [GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions).
Reproducible import bugs: [GitHub Issues](https://github.com/ib-notes-app/ib-notes/issues).
Share the error and header names first; posts are public, so omit proprietary
rows and private records. Posting requires a GitHub account. For private matters
or without an account, use **ibnotes.support@icloud.com**; email does not grant
permission to share proprietary files either.

Structure journal only. Do not use this guide or the app for trading decisions.
