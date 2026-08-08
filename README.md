# Heads Up — v1.4.0

Lead-time reminders for calendar events. One event produces a _ladder_ of nudges
at several lead times, so a birthday next week tells you to buy a present ten
days out and write the card the night before.

The reminder is the primary object, not the event. The main screen sorts by when
a reminder is due, not by when the event happens.

The surface follows the **Ladder** direction: clinical paper — warm off-white,
ink type, and one amber reserved exclusively for live. Reminders are ledger rows
— full-bleed, hairline-separated, no radius and no shadow — and live is said with
an amber rail and an amber origin band rather than with a fill. Labels are mono
small-caps in fixed positions; every card scans in the same order.

**Released:** 2026-08-08 · `src/HeadsUp.jsx` · 6310 lines · `main`

Version history is in `CHANGELOG.md`; each release is a commit on `main`.

## What works

| Area                                            | State                                     |
| ----------------------------------------------- | ----------------------------------------- |
| Reminder ladders from keyword rules             | Working                                   |
| Home, sorted by reminder due time               | Working                                   |
| Runway — one event's whole ladder on a track    | Working                                   |
| To-do lists, steps, dates optional              | Working                                   |
| To-do reminders in the same stream              | Working                                   |
| Swipe to clear or delete, long press to select  | Working                                   |
| Bulk done, re-date, move, delete                | Working                                   |
| Calendar: agenda, month, week, work week, 3-day | Working                                   |
| Event editing, alerts, categories               | Working                                   |
| Rule test box                                   | Working                                   |
| Rule editor (keywords, tasks, lead times)       | Working                                   |
| Quiet hours                                     | Working, day-based rungs only             |
| Undo on destructive actions                     | Working, single-step                      |
| Per-event ad-hoc reminders                      | Working, read-only in the sheet           |
| `.ics` import with recurrence expansion         | Working, see limits                       |
| New-event review for shared calendars (opt-in)  | Working, manual import only               |
| Persistence                                     | `window.storage`, single key              |
| App-icon badge, haptics                         | Working where the platform has them       |
| Notification sound choice                       | Stored; only Silent has an effect         |
| Installable PWA, offline                        | Working                                   |
| Notifications                                   | Working while open; not on a schedule     |
| Live Outlook sync                               | Not built — see `docs/ROADMAP.md`         |
| Scheduled background reminders                  | Not possible on a static host — see below |

## Running it

```sh
npm install
npm run dev          # http://localhost:8000, watches and rebuilds
npm run build        # production bundle into dist/
npm run preview      # build, then serve dist/ on :8000
```

Node 20 or newer. esbuild is the only build dependency; there is no framework
config to learn and no plugin chain to keep working.

**Serve it over `http://localhost` or HTTPS, not `file://`.** IndexedDB, service
workers and notifications all require a secure context, and `localhost` counts as
one. Opening `dist/index.html` directly gives you a page that renders and then
forgets everything.

### What the app expects from its host

`src/HeadsUp.jsx` is written to be portable — it is plain React 18 with hooks and
no bundler-specific imports. It needs exactly two things, and `web/` provides
both:

| It needs                                             | Provided by                      |
| ---------------------------------------------------- | -------------------------------- |
| React 18 with hooks                                  | `web/main.jsx`                   |
| `window.storage` — async `get`/`set`/`delete`/`list` | `web/storage.js`, over IndexedDB |

Nothing else. Drop the same file into a different host that offers those two and
it runs unchanged.

## Hosting it

`dist/` is a folder of static files with **no absolute paths**, so it works at a
domain root or in a subdirectory without a rebuild or a base-URL flag.

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys on every push to `main`, and
enables Pages on its first run, so on a **public** repository there is nothing to
set up.

One catch worth knowing before you try it on a private repo: Pages publishing
from a private repository needs GitHub Pro, Team or Enterprise. On the Free plan
the enable step fails with a misleading _"Resource not accessible by
integration"_ — the fix is to make the repo public, or to use one of the hosts
below, which serve private repos free.

The app lands at `https://<user>.github.io/<repo>/`. That subpath is why every
path in `index.html`, the manifest and the service worker is relative.

### Anywhere else

Netlify, Cloudflare Pages, Vercel, S3, a Raspberry Pi behind Caddy — any static
host works. Build command `npm run build`, publish directory `dist`.

The only hard requirement is **HTTPS**, which every host above gives you free.
Without it there is no service worker, so no install and no notifications.

## As an installed app

The build is a complete PWA: manifest, maskable icons, and a service worker that
precaches the shell.

- **Install:** Chrome and Edge offer it in the address bar; on Android use
  "Add to Home screen"; on iOS use Share → Add to Home Screen in Safari.
- **Offline:** it opens and works with no network at all. Your data is in
  IndexedDB and the shell is in the cache. Only the webfonts need one online
  visit first, after which they are cached too.
- **Updates:** the worker fetches the network first and falls back to the cache,
  so a deploy is live on the next load. No stale-build purgatory.
- **Notifications** fire through the service worker, which is the only path that
  works on Android.

### Notifications in a browser

Three things happen, in decreasing order of timeliness:

1. **App open:** reminders fire as they fall due. On a desktop PWA left open,
   this is simply correct.
2. **App installed, closed, Chromium:** a **Periodic Background Sync** catch-up
   announces anything overdue. Chrome picks the moment and enforces a twelve-hour
   floor, so it is late — but you hear about Tuesday's reminder on Tuesday rather
   than on Thursday when you next look.
3. **Everything else** (Safari, Firefox, uninstalled): on next open.

There is no way to do better on the web. Notification Triggers — the one API
designed for this — never shipped past an origin trial, and a service worker is
killed after about thirty seconds idle, so it cannot hold a timer. Anything that
claims otherwise on a static host is either Web Push with a server behind it, or
a `setTimeout` that only works while a tab happens to be alive.

## On Android

For reminders that arrive **at the minute, with the app closed, with no network
and no server**, build the Android app. It is the same web code in a Capacitor
shell; the difference is that each reminder is handed to Android's own
`AlarmManager` instead of hoping the browser wakes up.

```sh
npm run android          # build, sync, open in Android Studio
npm run android:apk      # build, sync, ./gradlew assembleDebug
```

Needs Android Studio (or a JDK 21 and the Android SDK) — `android/` is a normal
Gradle project, and the second command drops an APK in
`android/app/build/outputs/apk/debug/`.

Two permissions matter once it is installed:

- **Notifications** — the app asks on first launch (Android 13+).
- **Alarms & reminders** — Settings → Apps → Heads Up → Alarms & reminders. On
  Android 12+, _without_ this Android downgrades every reminder to an inexact
  alarm: it still wakes the device from Doze, but it can drift by minutes. With
  it, delivery is exact.

Alarms are re-registered after a reboot, and the queue is rewritten whenever
anything changes — mark a reminder done and its alarm is cancelled with it.

Nothing about this adds a backend. The schedule is computed on the device from
data that never leaves it.

## Before you change anything

Read `docs/ARCHITECTURE.md` § Invariants. There are thirteen identity and state
rules that, if broken, silently orphan a user's completed and muted items
rather than throwing an error. That failure mode looks like "all my finished
reminders came back," and it is not recoverable without a migration.

## Files

```
src/HeadsUp.jsx              the whole app — engine and surface, one file
web/index.html               the shell: manifest, icons, worker registration
web/main.jsx                 browser entry point; picks the scheduler
web/storage.js               window.storage over IndexedDB
web/schedule.js              publishes the queue to the worker; periodic sync
web/native.js                publishes the queue to Android's AlarmManager
web/sw.js                    service worker: offline shell, notify, catch-up
web/manifest.webmanifest     PWA manifest
web/icons/                   the mark: three SVGs and their rasterisations
android/                     Capacitor project — on-time local notifications
capacitor.config.json        app id, name, and that the web root is dist/
build.mjs                    esbuild, ~100 lines, build and dev server
tools/make-icons.mjs         re-rasterise every icon when the mark changes
.github/workflows/pages.yml  build and deploy to GitHub Pages
docs/ARCHITECTURE.md         data model, nudge engine, invariants, host contract
docs/DECISIONS.md            why things are the way they are (ADR log)
docs/ROADMAP.md              planned features, each with a risk rating
docs/LIMITATIONS.md          known wrong behaviour, ranked
CHANGELOG.md                 version history
```
