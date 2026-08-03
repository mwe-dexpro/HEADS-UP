# Heads Up — v1.1.0

Lead-time reminders for calendar events. One event produces a *ladder* of nudges
at several lead times, so a birthday next week tells you to buy a present ten
days out and write the card the night before.

The reminder is the primary object, not the event. The main screen sorts by when
a reminder is due, not by when the event happens.

**Tagged:** 2026-08-01 · `src/HeadsUp.jsx` · 3186 lines · sha256 `02ba1dc5d3914e34…`

v1.0.0 remains tagged and intact: `git checkout v1.0.0`.

## What works

| Area | State |
| --- | --- |
| Reminder ladders from keyword rules | Working |
| To-do lists, steps, dates optional | Working |
| To-do reminders in the same Upcoming stream | Working |
| Rule test box | Working |
| Undo on destructive actions | Working, single-step |
| Upcoming view, sorted by reminder due time | Working |
| "On approach" lead-time tracks | Working |
| Rule editor (keywords, tasks, lead times) | Working |
| Per-event ad-hoc reminders | Working |
| `.ics` import with recurrence expansion | Working, see limits |
| New-event review for shared calendars (opt-in) | Working, manual import only |
| Persistence | `window.storage`, single key |
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

## Before you change anything

Read `docs/ARCHITECTURE.md` § Invariants. There are ten identity and state
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
