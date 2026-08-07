# Heads Up — v1.2.0

Lead-time reminders for calendar events. One event produces a *ladder* of nudges
at several lead times, so a birthday next week tells you to buy a present ten
days out and write the card the night before.

The reminder is the primary object, not the event. The main screen sorts by when
a reminder is due, not by when the event happens.

The surface follows the **Ladder** direction: clinical paper — warm off-white,
ink type, and one amber reserved exclusively for live. Live is a filled dark
card, not a tint, so it is categorically different at arm's length. Labels are
mono small-caps in fixed positions; every card scans in the same order.

**Tagged:** 2026-08-07 · `src/HeadsUp.jsx` · 6084 lines · sha256 `4a599a145aab0761…`

v1.0.0 and v1.1.0 remain tagged and intact: `git checkout v1.1.0`.

## What works

| Area | State |
| --- | --- |
| Reminder ladders from keyword rules | Working |
| Home, sorted by reminder due time | Working |
| Runway — one event's whole ladder on a track | Working |
| To-do lists, steps, dates optional | Working |
| To-do reminders in the same stream | Working |
| Swipe to clear or delete, long press to select | Working |
| Bulk done, re-date, move, delete | Working |
| Calendar: agenda, month, week, work week, 3-day | Working |
| Event editing, alerts, categories | Working |
| Rule test box | Working |
| Rule editor (keywords, tasks, lead times) | Working |
| Quiet hours | Working, day-based rungs only |
| Undo on destructive actions | Working, single-step |
| Per-event ad-hoc reminders | Working, read-only in the sheet |
| `.ics` import with recurrence expansion | Working, see limits |
| New-event review for shared calendars (opt-in) | Working, manual import only |
| Persistence | `window.storage`, single key |
| App-icon badge, haptics | Working where the platform has them |
| Notification sound choice | Stored; only Silent has an effect |
| Live Outlook sync | Not built — see `docs/ROADMAP.md` |
| Lock-screen notifications | Not built — needs a service worker |

## Running it

The file is a single React component with no build step, written for the
Claude artifact runtime. It expects:

- React 18 with hooks
- `window.storage` — an async key/value API (`get`/`set`/`delete`/`list`)
- No bundler-specific imports, no CSS files, no Tailwind arbitrary values

To run it outside that runtime, provide a `window.storage` shim over
IndexedDB. See `docs/ARCHITECTURE.md` § Storage.

Two fonts are pulled from Google Fonts by an `@import` at the top of the `CSS`
constant. Offline, the stack falls back to the system sans and mono; the layout
does not depend on the webfont metrics.

## Before you change anything

Read `docs/ARCHITECTURE.md` § Invariants. There are thirteen identity and state
rules that, if broken, silently orphan a user's completed and muted items
rather than throwing an error. That failure mode looks like "all my finished
reminders came back," and it is not recoverable without a migration.

## Files

```
src/HeadsUp.jsx        the whole app
docs/ARCHITECTURE.md   data model, nudge engine, invariants, migration seam
docs/DECISIONS.md      why things are the way they are (ADR log)
docs/ROADMAP.md        planned features, each with a risk rating
docs/LIMITATIONS.md    known wrong behaviour, ranked
CHANGELOG.md           version history
```
