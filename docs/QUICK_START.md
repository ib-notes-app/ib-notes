# Your first session

## Get oriented

Choose the instrument, session date and display timezone you want to study.
ES is the starting template; session times come from the selected configuration.

The dashboard has one main action: **Record price**. Forecast, Structure,
Levels and Review open the supporting detail around it.

## Record a price

1. Select the period you are recording: **ON, 15R, A, B or RTH**.
2. Press the pink **Record price** button.
3. Enter the price. **CP** is selected by default.
4. Check the observation time and press **Save CP**.

The sheet stays open for another observation. You can enter High, save, then
Low, save, then CP. Press **Cancel/Close** when finished; previously saved
observations remain saved.

For a current entry, the time is captured automatically and can be edited.
Historical entries need a valid time for the selected date and period. High
and Low use a **known by** time and remain separate from the last recorded CP.
Prices must match the instrument's tick size.

## Add period ranges

Tap a period button to open its range editor. Add the high and low you know.
15R belongs within A; A and B form the IB. The application preserves those
relationships as observations are added.

Missing fields remain missing. You can keep recording without pretending an
unobserved price path is complete.

## Read the session

See [Read the four dashboard buttons](READING_THE_DASHBOARD.md) for forecast
targets, map labels, level history, review tools and missing-data wording.

- **Structure:** current recorded conditions and the structure map.
- **Levels:** nearby references, Above/Below/All filters, tiers and level history.
- **Review:** saved entries, timeline, summaries and local statistics.
- **Forecast:** available estimates and their supporting details. This empty
  edition has no historical probability library, so historical odds are unavailable.

Levels above and below the central button are positioned relative to the last
applicable recorded CP. A High/Low entry does not automatically replace it.
Breaks and returns describe saved evidence; gaps between entries remain unknown.

## Finish and keep a backup

Use Review to inspect the day and its existing closing/finalization workflow.
Correct finalized entries through the explicit editing controls.

Use the dashboard menu's **Share** action to review a recap or image before
copying or downloading it. Nothing is automatically posted.

Export SQLite regularly from **Settings → Backups & storage**. Your journal
lives in that browser on that device.
Follow [Backups and recovery](BACKUPS_AND_RECOVERY.md) for checking a file and
restoring safely. [Privacy and your data](PRIVACY.md) explains hosting and sharing.

## Bring your own history

The [CSV import guide](CSV_IMPORT.md) covers the supported daily format,
required columns, import preview, comparison and learning settings, and data
rights. Ordinary minute-bar or broker exports need preparation first.

## Track your own levels

The [levels guide](LEVELS.md) explains adding prices or zones, finding them
above/below CP, and reading visits, role changes and LBAF history.

Questions? Check the [FAQ](FAQ.md) or ask in [GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions).
Report bugs in [GitHub Issues](https://github.com/ib-notes-app/ib-notes/issues).
GitHub posts are public and require an account; use **ibnotes.support@icloud.com**
for private matters or if you do not have an account.
