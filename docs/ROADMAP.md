# Roadmap

Each item rates **value** and **risk to v1.0**. Risk means "how much working
behaviour this could break", not difficulty.

**Shipped since:** rule test box (1.1.0); the Ladder surface, five calendar
views, event editing, swipe and bulk actions, quiet hours (1.2.0).

## Suggested order

The sequence matters. Building sync before the PWA shell means doing the OAuth
redirect twice, and touching the nudge engine before there are tests means
finding out by hand.

1. Tests on the pure functions — value 7, risk 1
2. PWA shell: manifest, service worker, real notifications — value 10, risk 3
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

## 2. PWA shell
**Value 10 · Risk 3.** `manifest.webmanifest`, a service worker registered with a
relative path, install-to-home-screen, and notification scheduling.

Notes:
- SW scope is its own directory; on GitHub Pages that means `/repo/`
- iOS only permits web push for home-screen-installed PWAs
- there is no reliable background timer in a PWA; schedule on open and on
  visibilitychange, and accept that a closed phone may deliver late
- keep `state.notified` as the dedupe guard so a rescheduled SW doesn't re-fire

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
