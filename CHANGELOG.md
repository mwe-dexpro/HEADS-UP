# Changelog

## 1.5.0 — 2026-08-08

`src/HeadsUp.jsx`, 7097 lines

Phone first, everywhere. Every verb the app has is now reachable by a gesture or
a thumb-sized control, and a list can finally be named.

### Added

- **Lists are named by the person making them.** `+ New list` opens a sheet with
  the name field focused, a colour, and a Create button; the same sheet renames
  the list afterwards. It is reached by tapping the list's own name on its screen,
  by the ⋯ beside it, or by holding a row in the overview. `List 4` as a name only
  survives if you save the field empty.
  - Deleting a list lives in that sheet too, behind the standard undo, and says
    how many open items go with it.
  - Renaming is a plain patch. Nothing keys off a list's name — the to-do nudges
    carry `listName`, but they are derived on every render, so the origin line on
    the home ledger follows a rename immediately.
- **Swipe a reminder on Home: right marks it done, left snoozes it** by the
  default snooze duration, with the same rubber-band, hint labels and haptics the
  to-do rows have had since 1.1.0. A hint line under the first row explains both,
  and retires itself the first time either is used (`settings.swipeSeen`).
- **Long press a reminder for the quick-action menu.** Mark done, all three snooze
  times, and Open the event or the to-do — pinned to the bottom of the screen
  rather than floating in the middle of it. The two swipes are shortcuts into its
  first two entries and are labelled as such.
- **Sheets are dismissed by dragging them down.** The to-do, event, settings and
  list sheets all grew a grabber; the drag is claimed only when it is clearly
  downward, so a sideways or upward start still belongs to what is underneath.
  Every Close button stays.
- **The calendar steps a period per sideways swipe**, in every view except the
  review queue. A swipe that crosses the hour slots does not also open the slot it
  passed over — the click is swallowed in the capture phase.
- **A list is left by swiping in from its left edge**, because `‹ All lists` sits
  in the one corner of a phone a thumb cannot reach. The gesture refuses to start
  on a row, which swipes for itself.

### Changed

- **Everything that takes a tap is at least 44 px tall** — chips, lead-time
  buttons, keyword add and its input, the calendar's ‹ › and TODAY, the agenda's
  ＋, close and cancel and edit, put-back, the bulk bar's minis and date presets,
  segmented controls, selects and time fields. The switches went from 46×28 to
  52×32 with a 44 px hit area that overhangs them.
- **Every field the user types into is 16 px**, via `--field-type`. Below that,
  iOS Safari zooms the page on focus and leaves it zoomed — the app was doing
  this in the rule editor, the step rows, the to-do date and both selects.
- **Save is a fixed foot, not the end of a scroll.** The event form's SAVE and
  DELETE moved into the sheet's footer, and the read view grew an EDIT EVENT
  button beside its top-right EDIT. Adding to a list is a sticky field at the top
  of the scroll; `+ New list` is a sticky bar at the bottom of the overview.
- **The calendar opens on 3 DAY** on a fresh install, rather than a seven-column
  week that fits about eight characters of a title per day. Every view is still
  one tap away, and a stored preference is never overridden.
- Event blocks in the grid wrap to two lines before the ellipsis, and drop the
  time line when the block is too short for both.
- Press feedback is a real state now (`button:active`), hover effects are behind
  `@media (hover:hover)`, and `prefers-reduced-motion` turns the animations off.
- The phone frame pays for the landscape notch (`safe-area-inset-left/right`),
  and a phone on its side gets the status bar's height back.

### Verified

- Walked the whole app at 393×851 in Chromium: swipe right on a queued row marks
  it done and offers undo; swipe left snoozes it to the default; a long press
  opens the quick menu, whose Cancel and scrim both close it; the to-do sheet is
  dragged away by its grabber; the calendar steps 8–10 Aug → 11–13 Aug on a
  sideways drag; the left-edge swipe leaves a list while a swipe that starts on a
  row still marks the row done.
- Created a list called "Garden jobs" from the sheet, renamed it to "Garden and
  shed", added an item, then deleted the list and read the undo line back.
- No page errors in any of it.

## 1.4.0 — 2026-08-08

`src/HeadsUp.jsx`, 6310 lines

The card treatment the design's own study defaulted to, a week that means the
calendar week, and a header that stops imitating a phone.

### Changed

- **Reminders are ledger rows, not cards.** Treatment C from the handoff bundle's
  live-card study, chosen from a screenshot of the prototype. Every reminder is a
  full-bleed block — no radius, no shadow, no inset edge — separated by hairlines,
  with a 7 px left rail and a body of mono label / value rows.
  - Live keeps the amber, but spends it differently: a 7 px amber rail and an
    amber origin band across the full width, rather than a filled dark card.
    Nine reminders due at once no longer means one poster followed by a list.
  - Queued rows get an ink rail and a tinted origin chip — `--tint-live`,
    `--tint-todo`, `--tint-event` — so the source of a reminder is legible before
    you read it.
  - Done is a full-width ink bar, snooze a bordered box beside it; nothing is a
    pill and nothing has a caret. Tapping the row still opens it, and open adds
    only what the closed row does not already say.
  - The mark chips are gone from the queue: recurrence now rides in the WHEN
    value, and an ad-hoc origin says so in the origin chip.
- **"This week" is the calendar week, ending on the day before your week start.**
  It was a rolling eight-day window, so on a Saturday two reminders from the
  _following_ week were filed under THIS WEEK — reported, and reproduced.
  `bucketOf` and `dueLabelOf` now both end at `endOfWeek(now, settings.weekStart)`,
  the same setting the calendar grid uses.
  - Both take `weekStart` for the same reason: the second half of this bug was a
    reminder filed under LATER whose own label read a bare `DUE FRI`.
  - Intended consequence: late in the week THIS WEEK empties out. On a Saturday
    the section disappears — Sunday is "tomorrow", the rest is LATER. The runway
    below is what carries the next fortnight.
- **The clock moved into the header, next to the date**, reading
  `AUG 8 2026 · 01:37 PM` on the sub-line, where it belongs to "today" rather
  than to a fake status bar.

### Removed

- **The battery percentage**, and the `useBattery` hook behind it. The status bar
  was imitating phone chrome two pixels below the real one; in a browser tab it
  was simply wrong. The status bar is now the wordmark alone.

### Verified

- The ledger renders every value the design specifies: 7 px amber rail, square
  corners, amber band, 25 px / 700 title on the live block, 19.5 px / 600 on the
  queue, `#f6d9c2` origin chip, full-bleed to the pane edge, no carets, no chips.
- Walked a pinned clock from Monday 3 August to Sunday 9 August 2026 and read the
  buckets and every due label on each day: no reminder from a later week appears
  under THIS WEEK, no bare weekday appears under LATER, and on the Saturday THIS
  WEEK is absent as designed.
- The scroll shell, gestures, undo, offline boot, the published schedule and the
  worker catch-up were all re-checked against this build; marking the live row
  done still shrinks the schedule (49 → 46 items).

## 1.3.1 — 2026-08-07

### Fixed

- **The app scrolled the document instead of its own pane.** `.lx` had
  `min-height:100vh` rather than a definite height, so the flex column took its
  height from its content: the scroll pane grew instead of scrolling, and the tab
  bar ended up wherever the content ended — 12,617 px below the fold on Home.
  Now `height:100dvh` with `overflow:hidden`, `min-height:0` on every flex child
  in the scroll chain, and `height:100%` down through `html`, `body` and `#root`.
  Verified at six viewport sizes: the document scrolls by 0, the pane scrolls,
  and the tab bar is pinned with nothing behind it.
- **The tab bar's height now includes the safe-area inset instead of being eaten
  by it.** `height:72px` with `box-sizing:border-box` meant a 34 px inset left
  38 px for the icons. The row is a constant 58 px and the inset is added below
  it, via a `--nav-h` custom property.
- **The bulk-action bar covered the tab bar.** It sat at `bottom:0`; it now sits
  at `bottom:var(--nav-h)`, as the design has it. The undo toast is positioned
  from the same variable.
- **"Erase everything" appeared to do nothing.** Two reasons, both real: it wrote
  `defaultData()`, which hands back the same fifteen sample events and eight
  sample lists it just removed, and it left the Settings sheet open over the undo
  toast that was the only evidence anything had happened. It is now
  **ERASE EVENTS AND LISTS**, it empties them for real along with every
  completion and snooze, it keeps your rules and settings, and it closes the
  sheet so you can see the result and undo it.
- Sheets carry an explicit `z-index`, so they sit above the undo toast and the
  bulk bar rather than depending on paint order.

## 1.3.0 — 2026-08-07

`src/HeadsUp.jsx`, 6163 lines

Reminders that actually arrive. The engine and the surface are unchanged; what is
new is a way for the app to tell a host _when_ to wake the device, and two hosts
that can.

### Added

- **The schedule seam.** An optional `onSchedule` prop: the app publishes
  `[{id, at, title, body, silent}]` for everything unfinished due in the next 30
  days, capped at 60, whenever the queue changes. It names no platform. The
  artifact runtime passes nothing and behaves exactly as before.
  - Keyed on the nudge set rather than on the clock, so it does not republish
    every thirty seconds.
  - Not deduped by `doneKey`: the live band collapses rungs of one ladder for
    display, but every rung is its own delivery.
  - `body` is rendered as of the moment it will fire, so a notification handed to
    the OS today does not still say "in 2 days" when it goes off next week.
- **Android app, via Capacitor** — `android/`, `npm run android`. Each reminder
  is handed to Android's `AlarmManager` with `allowWhileIdle`, so it fires at the
  minute with the app closed, offline, and with no server anywhere. Alarms are
  restored after a reboot and rewritten whenever anything changes; marking a
  reminder done cancels its alarm.
  - `SCHEDULE_EXACT_ALARM` is declared so exact delivery can be granted.
    Deliberately not `USE_EXACT_ALARM` — auto-granted, but Play policy restricts
    it to alarm-clock and calendar apps.
  - The launcher icon is the Ladder mark: an adaptive icon on the ink ground,
    plus legacy square and round. The Capacitor splash image is replaced by a
    flat sheet of paper, which cannot be the wrong density.
- **Background catch-up on the web.** The service worker stores the published
  schedule and, on `periodicsync`, announces anything overdue — three
  individually, the rest collapsed into one line. Chromium only, needs the app
  installed, and Chrome enforces a twelve-hour floor, so it is late by design.
  Better than waiting until Thursday.
- `npm run icons` regenerates every icon, web and Android, from three SVGs.

### Changed

- Three service-worker caches instead of one. `headsup-state` holds the schedule
  and the record of what has been announced, and survives a deploy — it belongs
  to the user, not the build.
- The worker keeps its own `shown` set rather than writing `state.notified`,
  which the page saves on a debounce and which a worker write could clobber. Both
  sides tag every notification with the nudge id, so the two can never stack.

### Notes

- Exact delivery on Android 12+ needs "Alarms & reminders" granted in app
  settings; without it Android downgrades to an inexact alarm that still wakes
  from Doze but can drift. See LIMITATIONS.
- The web still cannot fire on time with the app closed, and no amount of service
  worker will change that. ROADMAP 2 now scopes the only fix — Web Push with an
  empty payload, so a server learns when to poke a device and never what to say.

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
