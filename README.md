# Heads Up — v1.2.0

Lead-time reminders for calendar events. One event produces a _ladder_ of nudges
at several lead times, so a birthday next week tells you to buy a present ten
days out and write the card the night before.

The reminder is the primary object, not the event. The main screen sorts by when
a reminder is due, not by when the event happens.

The surface follows the **Ladder** direction: clinical paper — warm off-white,
ink type, and one amber reserved exclusively for live. Live is a filled dark
card, not a tint, so it is categorically different at arm's length. Labels are
mono small-caps in fixed positions; every card scans in the same order.

**Tagged:** 2026-08-07 · `src/HeadsUp.jsx` · 6109 lines · sha256 `fb2d93262e4987ea…`

v1.0.0 and v1.1.0 remain tagged and intact: `git checkout v1.1.0`.

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

`.github/workflows/pages.yml` builds and deploys on every push to `main`. One
setting is needed first, once:

> Settings → Pages → Build and deployment → Source: **GitHub Actions**

Then push. The app lands at `https://<user>.github.io/<repo>/` — the subpath is
why every path in `index.html`, the manifest and the service worker is relative.

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

### The honest limit on notifications

A reminder due at 08:00 is announced **when you next open the app**, not at 08:00.
Firing on a schedule while the app is closed needs either the Notification
Triggers API, which no browser ships, or Web Push with a server to push from —
and a static host has no server. The in-app queue is always correct; the push is
only as timely as your next visit. See `docs/LIMITATIONS.md`.

## Before you change anything

Read `docs/ARCHITECTURE.md` § Invariants. There are thirteen identity and state
rules that, if broken, silently orphan a user's completed and muted items
rather than throwing an error. That failure mode looks like "all my finished
reminders came back," and it is not recoverable without a migration.

## Files

```
src/HeadsUp.jsx              the whole app — engine and surface, one file
web/index.html               the shell: manifest, icons, worker registration
web/main.jsx                 browser entry point
web/storage.js               window.storage over IndexedDB
web/sw.js                    service worker: offline shell, notifications
web/manifest.webmanifest     PWA manifest
web/icons/                   the mark, as SVG and as rasterised PNGs
build.mjs                    esbuild, ~90 lines, build and dev server
tools/make-icons.mjs         re-rasterise the icons when the mark changes
.github/workflows/pages.yml  build and deploy to GitHub Pages
docs/ARCHITECTURE.md         data model, nudge engine, invariants, host contract
docs/DECISIONS.md            why things are the way they are (ADR log)
docs/ROADMAP.md              planned features, each with a risk rating
docs/LIMITATIONS.md          known wrong behaviour, ranked
CHANGELOG.md                 version history
```
