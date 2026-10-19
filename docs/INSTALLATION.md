# Installation and desktop preview

## Phone installation

The public app address is pending review. Downloading this repository or its
website ZIP does not install it on a phone. The package needs static HTTPS
hosting so browser storage, workers and offline installation can work.

Once the app address is available:

1. Open it in Safari on iPhone or Chrome on Android.
2. Use the browser's Add to Home Screen / Install app option.
3. Open IB Notes from its icon and record your own observations.

These phone paths still need hands-on verification at the eventual public
address. There is no native installer in this package.

## Inspect the prepared build on a desktop

Requires Node.js 22 or newer and npm. Download or clone this repository, open
a terminal in its folder, then run:

```bash
npm ci
npm run preview --workspace @ib-field-notes/web -- --mode public-blank --host 127.0.0.1 --port 4202 --strictPort --outDir ../../site
```

Open **http://127.0.0.1:4202/** on that computer. Stop the preview with **Ctrl+C**.
The command serves the prepared build; it does not rebuild or deploy anything.
Use a separate browser profile for test observations. This loopback address is
for the computer running the preview.

Do not open `site/index.html` directly from Files or File Explorer. Browser
workers and storage need a supported served origin.

## Build this edition from source

Requires Node.js 22 or newer, npm and Python 3:

```bash
npm ci
npm run build:public
```

Use `build:public` for this source distribution. Other build/development modes
expect optional internal files that are intentionally absent. The command
typechecks and prints a new timestamped package under `local-study-packs/`.
It does not replace the reviewed `site/` or publish a website.

The internal phone-fixture module is a nonfunctional stub. Private JSON imports
have type-only declarations and are eliminated by the public build. No example
journal is seeded into the application.

## Backups and moving addresses

Use **Settings → Backups & storage → Export SQLite**. Keep the file somewhere
you control. Restore it explicitly through **Restore SQLite** when moving to a
new device or app address. Different addresses and browser profiles have
separate journals.

Do not clear browser data as a troubleshooting step before exporting a backup.
