# Changelog

## 1.1.0 — 2026-08-01

`src/HeadsUp.jsx`, 3186 lines, sha256 `02ba1dc5d3914e34…`

### Added
- **To-do lists.** Named lists, to-dos with or without a date, steps with their
  own dates and reminders. Built as a second, independent nudge source
  (`buildTodoNudges`) merged with the event stream by `allNudges`; the event
  engine is unchanged.
- To-do reminders are lead times counting back from a "needed by" date, so
  delivery buffers are expressed the same way as event lead times. Absolute
  one-off reminders cover to-dos with no date.
- Optional automatic day-of nudge for dated to-dos with no reminder of their
  own, so a deadline cannot sit in a list unseen.
- To-do reminders appear in Upcoming alongside event reminders, carrying their
  list's accent colour and a labelled List row.
- **Undo** on all six destructive actions, replacing confirmation copy.
- **Rule test box.** Type a title and see exactly which reminders it produces,
  with dates. Runs the real engine rather than a description of it.
- Rules now show how many of your actual events each one matches, and flag
  rules and tasks that can never fire.

### Changed
- Navigation cut from six tabs to four: Upcoming, Lists, Calendar, Rules. The
  New queue became a segment inside Calendar; settings moved behind a header
  control. The bar no longer changes shape when watching is toggled.
- Rules collapse to summaries with one editor open at a time.
- `--dim` raised to `#78899b`: 3.36:1 to 4.53:1 on panel, 3.80:1 to 5.12:1 on
  the background, clearing WCAG AA for small text. Smallest labels 9px to 10px.
- The key column widened to 54px; "Added by" shortened to "By" so it fits.

### Notes
- `lists` is an added field, so `loadData`'s merge over defaults handles it. No
  migration; the storage key stays `headsup:v1`.
- Two new completion paths and three new invariants — see ARCHITECTURE 7-10.

## 1.0.0 — 2026-07-31

Frozen baseline. `src/HeadsUp.jsx`, 1926 lines, sha256 `33244feba02635b8…`

### Added
- Reminder ladders: one event produces nudges at several lead times, driven by
  keyword rules. Marking a task done clears all of its lead times at once.
- Upcoming view sorted by reminder due time, bucketed into Due now / Today /
  Tomorrow / This week / Later, with a Handled section and undo.
- "On approach" lead-time tracks — a per-event runway from the first heads-up to
  the event, with fired reminders marked.
- Rule editor: keywords, tasks, and any number of lead times per task. Six
  starter rules (birthday, trip, wedding, presentation, appointment, booking).
- Catch-all fallback nudge for events no rule matches, toggleable.
- `.ics` import by file or paste, with recurrence expansion over 400 days,
  organiser parsing, and Teams-boilerplate stripping from descriptions.
- Opt-in New-events review queue for shared calendars: lists events added by
  others, with one-tap reminder presets, "mark all as read", and per-event mute.
- Per-event ad-hoc reminders, independent of the rules.
- Manual event entry with location and notes.
- Snooze (3 hours / tomorrow) per individual reminder.
- Browser notifications while the app is open, deduped.
- Persistence in a single `window.storage` key, debounced, with reset.

### Design
- Every card body is the same key/value table: Event / When / Where.
- Location always visible; the top-right badge cluster flags only what is
  hidden — recurrence and the presence of notes.
- Instrument-panel palette: slate ground, amber for live signals, mint for new
  and cleared. Barlow Condensed / IBM Plex Sans / IBM Plex Mono.

### Known limitations
See `docs/LIMITATIONS.md`. Headlines: `TZID` times are read as local, there is no
service worker so notifications only fire while open, and there is no live
calendar sync.
