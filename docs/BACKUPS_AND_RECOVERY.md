# Backups and recovery

[Back to IB Notes](../README.md) · [FAQ](FAQ.md) · [Troubleshooting](TROUBLESHOOTING.md) · [Privacy and your data](PRIVACY.md)

Your journal lives in your browser on your device. There is no automatic cloud
backup or synchronization in IB Notes. Export SQLite regularly and before
moving devices, changing app addresses, restoring a file or applying an update.

## Choose the right export

| Export | Use it for |
| --- | --- |
| **Export SQLite** | A restorable snapshot of every instrument journal in this browser. |
| **Export JSON** | A readable copy of your records. The restore control accepts SQLite, not JSON. |

SQLite includes the saved sessions, observations, notes, levels, imported
history, saved forecasts and Trash in the database. It is not a copy of an
unsaved form, the installed app or every browser-only preference.

The export filename includes the selected session date. **That date does not
limit the backup to one day or tell you when the file was exported.** Keep
copies labeled with your actual export date and time, preserving `.sqlite3`.

## Export and keep a backup

1. Save any observations you want included. Close the entry form when finished.
2. Open **Today → ⋯ → Settings → Backups & storage**.
3. Press **Export SQLite** and complete any browser download/save prompt.
4. Find the `.sqlite3` file in Downloads or the location you chose. Check that
   the download finished and the file is not empty.
5. Keep a copy somewhere separate from the device, using storage you control.
   Keep an earlier known-good backup as well as the newest copy.
6. Optionally choose **Export JSON** for a readable companion copy.

A download appearing in the file list does not prove it can be restored. Use
the check below when establishing your backup routine. Exports contain your
records and are not password-encrypted by the app; protect the saved files.

## Check a backup without risking the original

1. Keep the original app and its journal intact.
2. Open the [same app address](https://ib-notes-app.github.io/ib-notes/) in a
   **separate normal browser profile or spare device with an empty journal**.
   Do not use a second tab in the original browser as a separate test journal.
3. Follow **Restore a backup** below in that isolated destination only.
4. Select an instrument and a date you know were saved. Check representative
   prices and times, notes, levels and any imported history you expect.
5. Reload, return to that date and confirm the records remain. Check other
   instrument journals too if the backup contains them.

You now have evidence that this file restores in that tested environment.
This does not establish every phone/browser combination; see [test status](REVIEW.md).

## Restore a backup

**Restore replaces every instrument journal at the destination with the saved
copy. It does not merge records or preserve entries made there after the backup.**

**Selecting the file starts restoration immediately. There is no separate
confirmation screen after the file picker.**

1. Open IB Notes in the browser or installed app whose journal you intend to replace.
2. If it already contains anything you might want, **export its SQLite backup
   first** and keep it separate from the incoming file.
3. Open **⋯ → Settings → Backups & storage → Restore SQLite**.
4. Select your IB Notes `.sqlite3` backup. Do not select a CSV, JSON, website ZIP
   or an unrelated SQLite database.
5. Wait for **SQLite backup restored.** The app may reload when the restored
   instrument configuration differs.
6. Select the restored instrument and a known saved date. The dashboard may
   initially open the current session rather than the date in the filename.
7. Check the records, then reload and check them again before relying on the copy.

If restoration reports an error, keep its exact wording and both backup files.
Do not assume the destination was unchanged or repeatedly try different files
in your only working journal. Use the [recovery steps](TROUBLESHOOTING.md#restore-failed)
or contact **ibnotes.support@icloud.com**.

## Move to another phone, browser or app address

1. Export and check a fresh SQLite backup from the original journal.
2. Transfer the file through a method you control. This is a manual transfer,
   not a live sync service.
3. Open or install IB Notes at the destination; preserve any journal already
   there before using Restore SQLite.
4. Restore and check known dates, prices and levels, including a reload.
5. Keep the old device and backup intact until you are satisfied with the new copy.

Choose which copy you will continue using. New entries on one device will not
appear on the other, and restoring one later can replace the other device's work.

## If something goes wrong

- **The journal will not open:** keep its app and website data. Close other IB
  Notes windows, reopen the original app and use **Retry opening** if offered.
  See [Journal will not open](TROUBLESHOOTING.md#journal-will-not-open).
- **A session was moved to Trash:** check **Settings → Manage journal → Trash**.
  Restore a trashed session only through its existing safeguards; this is
  separate from replacing the entire database with a backup.
- **Website data was cleared or the device was lost:** restore a backup you
  previously saved. The developer does not hold a remote journal copy to recover.
- **Only an older backup remains:** it contains the records saved at that
  snapshot. Later entries cannot be recreated from the app download.

Do not clear site data or reinstall as an experiment to repair the only copy
of a journal. Browser storage can also be affected by private browsing or
storage pressure; [MDN explains browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Backups may contain proprietary data you imported. Keep your source-data rights
in mind before sending them to another person; see [Privacy and your data](PRIVACY.md).
