# Roadmap

Each item rates **value** and **risk to v1.0**. Risk means "how much working
behaviour this could break", not difficulty.

**Shipped since:** rule test box (1.1.0); the Ladder surface, five calendar
views, event editing, swipe and bulk actions, quiet hours, the PWA shell and
static-host deploy (1.2.0).

## Suggested order

The sequence matters. Building sync before the PWA shell means doing the OAuth
redirect twice, and touching the nudge engine before there are tests means
finding out by hand.

1. Tests on the pure functions — value 7, risk 1
2. ~~PWA shell: manifest, service worker~~ — **done in 1.2.0.** What remains of
   this item is *scheduled* notifications, which is not a shell problem: it needs
   Web Push and a server to push from — value 10, risk 3
3. Microsoft Graph sync — value 10, risk 6
4. Timezone correctness — value 8, risk 5
5. Recurrence completeness (`BYDAY` etc.) — value 6, risk 5
6. Everything else

---

## 1. Tests on the pure functions
**Value 9 · Risk 1.** Raised from 7 after a bad edit during 1.1.0 truncated half
the file. It was recoverable only because v1.0.0 was tagged. Tests would have
caught it in seconds instead of by inspection. `parseICS`, `expandRecurrence`, `buildNudges`, `buildTodoNudges`,
`resolveReminder`, `allNudges`, `unreviewedEvents`, `matchRules` are side-effect
free. Fixtures: a real Outlook
export, a yearly birthday, an all-day event, a `TZID` event, one with `EXDATE`.
For to-dos: an item with no date, a lead reminder with no anchor, a step
inheriting its parent's date.

Do this first. Everything below edits code these tests would protect.

## 2. PWA shell — shipped in 1.2.0, except the scheduling
**Value 10 · Risk 3.** Done: `manifest.webmanifest`, maskable icons, a service
worker registered with a relative path, precached shell, offline cold start,
install to home screen, and notifications displayed via the worker. Deploy to
GitHub Pages is a workflow.

The predictions in this section held up:
- SW scope is its own directory; on GitHub Pages that means `/repo/` ✓
- `state.notified` is still the dedupe guard, unchanged ✓

**What is left is the hard half: firing on time when the app is closed.**

- there is no reliable background timer in a PWA. Notification Triggers never
  shipped; Periodic Background Sync is Chromium-only, needs an install and a
  12-hour minimum interval, and is not a scheduler
- so this needs Web Push: a VAPID key pair, a push subscription per device, and
  a small always-on service holding the schedule and sending at the due minute
- iOS only permits web push for home-screen-installed PWAs, and only since 16.4
- **this is the item that ends "your data never leaves your browser."** The
  server needs enough of the schedule to send the right words at the right
  minute. Decide deliberately whether that is titles or opaque ids, and write it
  down as an ADR before writing the endpoint
- today the app notifies on open, deduped. That is honest and it is documented in
  LIMITATIONS; do not paper over it with a `setTimeout` that only works while a
  tab happens to be alive

## 3. Microsoft Graph sync
**Value 10 · Risk 6.** Replaces manual import. Touches event identity, which is
invariant 1 — the highest-risk change in the list.

- MSAL browser, auth code + PKCE, authority `/common`
- scopes `Calendars.Read offline_access`
- poll `/me/calendarView/delta` on open; no webhooks, since there is no server
- **map Graph `iCalUId` + occurrence date onto the existing id scheme** so that
  imported and synced events resolve to the same identity, or every completed
  reminder in the user's history orphans
- verify the consumer-account shared-calendar question first (DECISIONS 007)

## 4. Timezone correctness
**Value 8 · Risk 5.** Parse `VTIMEZONE` or pull in a tz library. Changes event
start times, which moves due timestamps, which changes nudge ids only if the
*date* shifts — so most state survives, but not all. Ship with a migration that
recomputes ids and carries `done`/`seen`/`muted` across.

## 5. Recurrence completeness
**Value 6 · Risk 5.** `BYDAY`, `BYMONTHDAY`, `BYSETPOS`. Same identity hazard:
newly correct occurrence dates mean new ids for events the user has already
handled.

---

## Smaller, safe additions

| Feature | Value | Risk | Note |
| --- | --- | --- | --- |
| Import rules from another rule set / export JSON | 6 | 1 | Backup before experimenting |
| Snooze presets on non-due reminders | 4 | 1 | |
| Weekly digest view ("next 7 days, one screen") | 6 | 2 | |
| Per-rule quiet hours | 5 | 2 | Suppress a 07:00 nudge on weekends |
| Location deep-link to maps | 5 | 1 | `geo:` or a maps URL from the location string |
| Attach a checklist to a task | 7 | 3 | Packing lists. Nests inside `task`, needs a migration |
| Light theme | 3 | 2 | CSS variables are already the seam |
| Multiple calendars with per-calendar rules | 6 | 5 | Adds a `calendarId` to events |
| Real ids on to-do reminders | 5 | 2 | Removes the index-keying hazard, ARCHITECTURE 9 |
| Multi-step undo | 4 | 2 | A stack instead of one snapshot |
| Recurring to-dos | 7 | 3 | "Bins out every Tuesday"; needs an occurrence identity like events have |

## Deliberately not planned

- **AI-inferred tasks as a replacement for rules.** As a suggestion layer, fine.
  Predictability is why rules won (DECISIONS 003).
- **A server.** The moment there's a backend, the privacy story and the hosting
  story both change. Delta polling on open is enough.
- **Writing reminders back into the calendar as alarms.** Rated and rejected
  early: clutters the calendar, painful to edit.
