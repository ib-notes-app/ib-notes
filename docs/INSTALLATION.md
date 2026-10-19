# Installation and desktop preview

## Phone installation

Open **https://ib-notes-app.github.io/ib-notes/**. This is the live blank edition;
your journal starts empty. Downloading this repository or its website ZIP does
not install it on a phone.

On iPhone or iPad:

1. Open the address in **Safari**.
2. Open **Share**, then **Add to Home Screen**. If offered, enable **Open as Web App**.
3. Press **Add**, then open IB Notes from its icon.

See [Apple's installation guide](https://support.apple.com/guide/iphone/iphea86e5236/ios).

On Android:

1. Open the address in **Chrome**.
2. Open the browser menu and choose **Add to home screen → Install**, or
   **Install app**, according to the options offered on your device.
3. Follow the prompt, then open IB Notes from its icon.

See [Chrome's web-app guide](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en).

These steps still need hands-on verification on actual devices at this public
address. There is no APK, App Store installer, live feed or bundled market
history. Do not import proprietary data unless your rights permit that use.

The first online load downloads the app. Offline use was checked in Chromium
after the service worker was ready and the page was reloaded; the first visit
still needs connectivity. Export SQLite backups regularly. Installed-app
keyboard behavior and updates on physical phones remain pending.

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
Follow [Backups and recovery](BACKUPS_AND_RECOVERY.md) for checking a backup,
restoring and moving devices. See [Troubleshooting](TROUBLESHOOTING.md) if loading,
installation or an update fails.

The downloaded ZIP's README records its original preparation status. The live
address and current test status are maintained here and in [test status](REVIEW.md).
