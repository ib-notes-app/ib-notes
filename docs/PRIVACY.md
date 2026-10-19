# Privacy and your data

[Back to IB Notes](../README.md) · [Backups and recovery](BACKUPS_AND_RECOVERY.md) · [FAQ](FAQ.md)

This page describes the current public app at
**https://ib-notes-app.github.io/ib-notes/**. Last checked: **October 19, 2026**.
It explains the app's behavior, not the privacy practices of every browser,
device, email provider or website you may use alongside it.

## What stays on your device

IB Notes stores your journal locally in your browser using SQLite-backed
storage. This includes saved observations, times, notes, levels, imported
history and saved forecasts. Some interface preferences use separate browser
storage. App files are cached for offline use.

Calculations run on your device. Ordinary recording does not upload your
journal to GitHub or the developer. The public app has no app account,
automatic cloud sync, advertising or app analytics/tracking service. It does
not ask for broker credentials or automatically send records to an AI service.

Devices and browser profiles have separate journals. A Home Screen app and
browser context may also have separate storage. The developer cannot read or
restore a local journal remotely just because you opened the app.

## What GitHub receives

GitHub Pages delivers the website, app code, icons and updates. Those downloads
are ordinary web requests; local journaling does not make visiting the site
anonymous. GitHub states that visitors' IP addresses are logged and stored
for security purposes, including visitors without a GitHub account. See
[GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection)
and [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

That hosting traffic is separate from your locally stored prices and notes.
Reading guides or posting an issue or discussion on `github.com` uses GitHub's
services and their privacy rules. Our issues, discussions and their attachments
are public. Posting requires a GitHub account; using the app does not.

## When you choose to export, share or ask for help

| Action | What happens |
| --- | --- |
| **Export SQLite / Export JSON** | The app creates a local download containing your records. It does not send the file to the developer. |
| **Share preview** | You review the selected recap text or image locally. Copy/download saves it or places it on the clipboard; a native share action hands it to a service you choose. |
| **Report a problem** | You review a report, open an email draft or copy its text. You decide whether and where to send it. |
| **Post in GitHub Issues or Discussions** | GitHub receives the text and attachments you submit, associated with your GitHub account. The post is public; journal data is not attached automatically. |
| **Open an external link** | The destination, such as GitHub, Ko-fi or X, handles your visit under its own policies. |

Exports can contain much more than a share card: SQLite includes all instrument
journals, notes, imported history and Trash in the database. Exports are not
password-encrypted by the app. Store and transfer them through methods you trust.
Your device or chosen backup provider may apply its own security or sync rules.

A problem report can include the text you enter plus optional app details:
build, browser version, broad device/OS information, Browser/Home Screen mode,
timezone and screen. The **Include app details** checkbox controls that extra
context. Journal entries, backups and error details are not automatically
attached. Review anything you type, paste or attach before sending it.

If you email support, the email service and the recipient receive the message
and any files you deliberately send. It is no longer only a local journal
record. You do not need to provide an entire database or proprietary source
data to report an ordinary problem.

## Imported data and permissions

CSV and supported pack imports are processed locally in the selected browser's
journal. This public edition includes no market history or automatic news
lookup. Importing a file does not automatically upload or redistribute it.

The software license does not grant rights to third-party data. Confirm that
your intended processing, learning, storage and sharing are permitted by the
applicable licenses. See the [CSV guide's data-rights reminder](CSV_IMPORT.md#check-your-data-rights-first).

## Keeping or removing your data

You control your devices and exported copies. [Keep SQLite backups](BACKUPS_AND_RECOVERY.md)
if you want to preserve a journal. Browser storage can be affected by private
browsing, storage limits or clearing website data; a Home Screen icon is not
a backup. See [MDN's browser-storage explanation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Moving a session to **Trash** preserves a restorable local copy. It does not
permanently erase that session. Previously exported files can still contain
older records even after you change or remove them in the app.

If you deliberately want to remove the journal from a browser, use that
browser's controls for deleting this site's stored data, after preserving any
backup you want. Check the scope: deleting data for `ib-notes-app.github.io`
can affect other apps on that same site. Removing an icon alone is not a
reliable way to verify deletion, and clearing browser data does not delete
downloads, backups, shared images or emails you already sent.

## Questions

General questions about this app's data behavior can go in
[GitHub Discussions](https://github.com/ib-notes-app/ib-notes/discussions).
For private matters, a message you sent to support, or without a GitHub account,
contact **ibnotes.support@icloud.com**. Do not post private records in a public
thread. The developer cannot erase a journal on your device remotely.

For information held by a hosting, email, donation or social provider, use that
provider's own privacy information and contact process.
