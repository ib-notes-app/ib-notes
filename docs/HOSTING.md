# Website publishing and updates

The live app address is **https://ib-notes-app.github.io/ib-notes/**.
See [installation instructions](INSTALLATION.md) for current availability and
phone-testing status.

GitHub Pages serves the already prepared `site/` directory. It does not run
the application source, build private data, provide quotes, or receive journal
entries. Each journal stays in its browser on that device.

## Publish a reviewed package

1. Review the changes to `site/`, the matching ZIP in `downloads/`, and the
   checksum/build details in `release-info.json`.
2. Push the approved files to `main`.
3. Open **Actions → Publish reviewed blank app → Run workflow**, using `main`.
4. Wait for a successful deployment. Check the public URL and
   `/ib-notes/build-info.json`, then exercise saving, reloading, offline use and
   backups in a separate test browser profile.
5. Test installation and updates on actual supported phones before describing
   those device checks as passed. Keep a SQLite backup before updating.

Publishing is manual. A documentation commit does not automatically redeploy
the website. The workflow verifies the download checksum and every `site/`
file against that archive, requires `public-blank` distribution, and uploads
only `site/`. It does not run npm, rebuild the app, or upload the repository root.

## Recover from a bad website update

Preserve the previous reviewed ZIP and its source/metadata before replacing a
package. Restore the reviewed website, matching download and checksum from the
chosen known-good version in a new reviewed commit, then run the publishing
workflow. Check the build identity, update prompt and offline behavior again.
Do not clear browser storage or reset a user's journal to recover a deployment.

PWA updates use the existing update prompt. Reloading a website and installing
an update are not proof that every physical device has received the new build.
Moving to a different origin does not transfer journal storage automatically.

No server-side database, data feed, account synchronization or paid hosting
service is added by this setup.
