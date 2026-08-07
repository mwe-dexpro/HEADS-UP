# Changelog

## 1.2.0 — 2026-08-07

`src/HeadsUp.jsx`, 6109 lines, sha256 `fb2d93262e4987ea…`

The "Ladder" visual direction, implemented for real. The nudge engine, the key
schemes and the storage contract are unchanged; the presentation layer is new.

### Changed — the whole surface

- **Clinical paper.** Warm off-white ground (`#f7f5f0`), ink type, Public Sans
  and IBM Plex Mono. The instrument-panel slate palette is gone.
- **One amber, reserved.** `#e8813f` means live and nothing else. Origin moved
  onto the rail down a card's left edge: ink for a calendar event, the list's
  accent for a to-do, amber when the thing is due now.
- **Live is a filled dark card, not a tint** — categorically different at arm's
  length rather than the same object in another shade.
- Home opens on a three-cell counter strip (NOW / TODAY / WEEK), then the live
  card, then the queue bucketed by distance, then the runway, then Handled.
- Every card body is still one key/value grid, in one order, mono small-caps
  labels in fixed positions.
- Tab labels: Upcoming became **Home**. Still four destinations.

### Added

- **Calendar with five views** — agenda, month, week, work week and three-day.
  The timed views are a 06:00–23:00 grid with lane packing for overlaps, an
  all-day row per column and a now-line. Month carries ISO week numbers and a
  selected-day list. Tapping an empty slot starts an event there.
- **Event sheet**, read-only until you tap EDIT: title, date, all-day, start and
  end, calendar, alerts, place, notes.
- **Event end times.** `DTEND` is now parsed and carried through recurrence
  expansion as a duration, so the calendar can draw a block of the right length.
- **Plain calendar alerts** (`alerts: [minutes]`) — at start, 15 min, 1 h, 2 h,
  1 day — as a third task source inside `buildNudges`, pushed before the fallback
  check so an event with only alerts does not also collect a catch-all.
- **Event categories** (`cat`) — work, personal, family, travel. Colour only;
  they carry no scheduling meaning.
- **Swipe and long press on to-dos.** Right clears, left deletes, a long press
  starts a selection. The gesture claims the pointer only once it is
  unambiguously horizontal, so vertical scrolling is never stolen.
- **Bulk actions** on a selection: done, re-date, move between lists, delete.
- **Quiet hours.** A pure transform of a computed due time, applied at the end of
  the calculation, so it can never orphan a completion. Day-based rungs move;
  minute alerts do not, because a shifted alert would land after its own event.
- **Settings**, rebuilt as a full sheet: quiet hours, catch-all lead time,
  default snooze, calendar defaults, week start, week numbers, undated position,
  ask-before-deleting, notification permission, sound, app badge, haptics, the
  new-events queue, calendar sources and `.ics` import.
- App-icon badge via `setAppBadge`, and haptics via `vibrate`, where the platform
  has them.
- Rule editing gained a name field, keyword add and remove, task add and remove,
  and a per-rule on switch. The lead-time chip grid shows the presets plus any
  lead the rule already has.
- Undo toast carries a mono meta line and a 9-second bar that runs down.

### Added — it is a real web app now

- **A build.** `build.mjs`, esbuild, one dependency: `npm run dev` for a watching
  dev server on :8000, `npm run build` for `dist/`.
- **A browser host.** `web/main.jsx` mounts the app and `web/storage.js` provides
  `window.storage` over IndexedDB, with an in-memory fallback where IndexedDB is
  blocked. `src/HeadsUp.jsx` is unchanged in what it assumes: React 18 and that
  one storage API.
- **A complete PWA.** Manifest, maskable icons, `apple-touch-icon`, theme colour,
  and a service worker that precaches the shell. It cold-starts with no network
  at all and makes zero requests doing it.
- **Notifications through the service worker.** `new Notification()` is not
  constructible on Android, which meant notifications silently never appeared
  there. The page now hands the worker a title and body and the worker shows it;
  the constructor stays as the fallback for hosts with no worker.
- Notification taps focus an open window or open one.
- **Deploy to GitHub Pages** on push to `main`, via
  `.github/workflows/pages.yml`. Every emitted path is relative, so the same
  `dist/` serves from a domain root or from `/HEADS-UP/` with no rebuild.
- `tools/make-icons.mjs` re-rasterises the icons from SVG when the mark changes.
  The PNGs are committed, so a normal build needs neither it nor Playwright.

### Notes

- The webfonts are cached on first online load and fall back to the system stack
  before that.
- Reminders still fire when you next open the app, not on a schedule. A static
  host has no server to push from — see LIMITATIONS and ROADMAP 2.

### Fixed

- A long press that ends on the row it selected no longer deselects it: the
  release was still reading as a tap. The same suppression now covers the
  checkbox circle, which sits inside the swipe target.
- The live band deduplicates by `doneKey`. Two overdue rungs of one ladder are
  one thing to do — marking either clears both — so it shows the earliest.
- The runway lists one row per task rather than one per rung, for the same
  reason.
- Notifications appeared on desktop and silently never on Android, because the
  page constructed them itself.

### Notes

- Every added field (`end`, `cat`, `alerts`, and eleven settings) arrives through
  `loadData`'s merge over `defaultData()`. The storage key stays `headsup:v1` and
  there is no migration.
- Three new invariants — see ARCHITECTURE 11-13.
- Seed data is richer, so a fresh install demonstrates the design: fifteen
  events across three weeks and eight lists.

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
