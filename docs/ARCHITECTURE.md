# Architecture

## The one idea

```
Event  ×  Task  ×  Lead time  =  one nudge
```

An event matches rules by keyword. Each matching rule contributes tasks. Each
task has one or more lead times. Every combination becomes a nudge with its own
due timestamp. Nudges are **derived on every render and never stored**.

Marking a task done is recorded once per (event, task) and therefore clears all
of that task's lead times at once. This is the mechanism that stops the app
becoming a nag, and it is why the done key deliberately excludes the lead time.

## Data model

Persisted shape, stored as JSON under a single key:

```js
{
  events: [{
    id, title, start,          // ISO string
    end,                       // ISO | null — display only, never scheduling
    allDay, location, description,
    cat,                       // "work"|"personal"|"family"|"trip" — colour only
    recurring, repeats,        // "yearly", "every 2 weeks", ""
    organizer: { name, email } | null,
    tasks: [{ id, label, leads: [{ days, hour }] }],   // ad-hoc, per event
    alerts: [Number],          // minutes before start — plain calendar alerts
    source: "ics" | "manual" | "sample",
  }],
  rules: [{
    id, name, enabled,
    keywords: [String],        // matched case-insensitively against event.title
    tasks: [{ id, label, leads: [{ days, hour }] }],
  }],
  state: {
    done:     { [doneKey]:   ISO },   // per event+task
    snoozed:  { [nudgeId]:   ISO },   // per event+task+lead
    seen:     { [eventId]:   ISO },   // absence means "new"
    muted:    { [eventId]:   true },  // produces zero nudges
    notified: [nudgeId],              // capped at 400, prevents re-firing
  },
  lists: [{                          // to-dos; a second, independent nudge source
    id, name, accent,                // accent drives the origin marker on cards
    items: [{
      id, title, notes,
      due,                           // ISO | null — null means "never nudges"
      reminders: [ { kind:"lead", days, hour } | { kind:"at", at: ISO } ],
      done, doneAt,
      subtasks: [{ id, title, due, reminders, done, doneAt }],
    }],
  }],
  settings: {
    fallback, fallbackHour,          // catch-all nudge for unmatched events
    defaultLead,                     // the catch-all's lead time, in days
    watchNew, watchOnlyOthers, myEmail,
    todoAutoRemind, todoAutoHour,    // implicit day-of nudge for dated to-dos
    quiet, quietFrom, quietTo,       // "HH:MM" — shifts day-based rungs only
    defaultSnooze,                   // "15m" | "1h" | "3h"
    calDefault, weekStart, weekNums, // calendar view, "mon"|"sun", ISO KW column
    undatedAt,                       // "top" | "bottom" inside a list
    confirmDelete,                   // off: undo is cheaper than a dialog
    sound, badge, haptics,           // only Silent, setAppBadge and vibrate bite
    swipeSeen,                       // added in 1.5.0 — retires the gesture hint
  },
}
```

### Two nudge sources

`buildNudges` (events) and `buildTodoNudges` (to-dos) are independent pure
functions. `allNudges` merges and sorts them by due time. They share the card
layout and the snooze store but nothing else — in particular, a to-do's
completion is **not** in `state.done`.

Within `buildNudges` there are three task sources, collected in this order:
matched rules, the event's own ad-hoc `tasks`, then its `alerts`. The catch-all
is appended only if all three came back empty.

### Two kinds of lead

A **rung** counts back in whole days from the start of the event's day and lands
at a chosen hour — this is the ladder, and it is what rules produce. An **alert**
counts back in minutes from the event's exact start. Rungs are subject to quiet
hours; alerts are not, because shifting one out of the small hours would land it
after the event it is announcing.

## Key schemes

| Key | Format | Scope |
| --- | --- | --- |
| Event id (ICS) | `${UID}@${YYYY-MM-DD}` | one occurrence of a series |
| Event id (manual) | `manual-${rand}` | one event |
| `doneKey` | `${eventId}::${ruleId}::${taskId}` | a task, all its lead times |
| Nudge id / snooze key | `${doneKey}::${days}:${hour}` | one single reminder |
| Custom task ruleId | the literal `custom` | ad-hoc, per-event tasks |
| Fallback ruleId | the literal `fallback` | unmatched events |
| To-do nudge id | `todo::${listId}::${itemId}::${subId\|-}::${index}` | one to-do reminder |
| To-do doneKey | the same, without `::${index}` | unused; completion lives on the item |
| Alert ruleId | the literal `alert` | plain calendar alerts |
| Alert taskId | `alert-${minutes}` | one alert, all its firings |
| Alert snooze key | `${doneKey}::m${minutes}` | one alert |

## Invariants

Breaking any of these produces silent data loss, not an error.

1. **Event ids are derived from UID + occurrence date.** Change the scheme and
   every `done`, `seen` and `muted` entry orphans. Completed reminders reappear.
2. **`doneKey` must not contain the lead time.** If it does, marking done stops
   cancelling the rest of the ladder and the app starts nagging.
3. **Nudges are pure and derived.** `buildNudges(data)` has no side effects and
   is never persisted. Any caching must be keyed on the whole `data` object.
4. **Absence in `seen` means new.** Every code path that adds events must decide
   seen-ness explicitly. Forget it and the user's next import dumps hundreds of
   events into the New tab.
5. **Muted events produce zero nudges.** The check sits at the top of the
   `events.forEach` in `buildNudges`; new task sources must sit below it.
6. **The fallback rule fires only when nothing else matched** — no rule *and* no
   ad-hoc task. Custom tasks are pushed before the length check for this reason.
7. **A to-do's completion lives on the item, not in `state.done`.** It is
   intrinsic data, not reminder state. Marking a to-do nudge done in Upcoming
   must write through to the item or the reminder returns on next render.
8. **A `lead` reminder with no anchor date emits nothing, silently.**
   `resolveReminder` returns `null` when there is no `due` to count back from.
   This is deliberate — but it means a UI that offers lead presets without a date
   set will appear to do nothing. The presets are disabled for that reason.
9. **To-do nudge ids embed the reminder's array index.** Deleting or reordering
   an item's reminders re-keys its snooze and notified entries. Acceptable today;
   if reminders ever become individually addressable, give them real ids first.
10. **`buildNudges` must stay free of to-do logic.** The rule preview calls it
    with a hand-built single-event dataset. If it starts reading `lists` or other
    state, the preview stops telling the truth.
11. **Quiet hours may only move a due time, never a key.** `applyQuiet` runs at
    the very end of the due calculation; `doneKey` and the snooze key are built
    from `(event, task)` and `(days, hour)` and never see the shifted value. Feed
    the shifted time into a key and every completion orphans the first time the
    user edits their quiet window.
12. **Alerts count as a task source for the fallback check.** They are pushed
    into `tasks` before the `!tasks.length` test, so an event carrying only alerts
    does not also collect a catch-all. A fourth source must sit in the same place
    for the same reason.
13. **`event.end` is presentation only.** Nothing schedules from it. It may be
    `null` on any event — every reader must cope, and the calendar assumes an hour
    when it is missing.

## The host contract

`src/HeadsUp.jsx` is deliberately portable. It assumes two things and nothing
else:

1. **React 18 with hooks**, imported as `react`.
2. **`window.storage`** — an async key/value store:
   `get(key) -> {value} | null`, `set(key, value)`, `delete(key)`, `list()`.
3. **Optionally** an `onSchedule` prop. Everything else degrades to "notifies
   while open" without it, which is exactly what the artifact runtime gets.

Everything platform-specific lives outside the app file, in `web/`:

```
web/main.jsx      mounts the app, installs the shim, picks a scheduler
web/storage.js    window.storage over IndexedDB, with an in-memory fallback
web/schedule.js   publishes the queue to the worker; registers periodic sync
web/native.js     publishes the queue to Android's AlarmManager (Capacitor)
web/sw.js         offline shell, notification display, background catch-up
web/index.html    manifest, icons, theme colour, worker registration
```

Keep it that way. A path to an icon or a service-worker call inside
`HeadsUp.jsx` is the beginning of the end of running it anywhere else — which is
why the app posts a notification *request* to the worker rather than naming its
own icon files.

### The schedule seam

```js
onSchedule([{ id, at, title, body, silent }, …])
```

Called whenever the queue changes, with everything unfinished due in the next
`SCHEDULE_DAYS` (30), capped at `SCHEDULE_MAX` (60) — Android's alarm scheduler
and iOS both get unhappy past a few dozen pending notifications, and a reminder
six weeks out will be republished many times before it matters.

Three things about it are load-bearing:

- **It is keyed on the nudge set, not on `now`.** Otherwise it republishes every
  thirty seconds and, on Android, rewrites every alarm with it.
- **It is not deduped by `doneKey`.** The live band collapses rungs of one ladder
  for *display*; this is *delivery*, and a ladder that only speaks once is not a
  ladder.
- **`body` is rendered as of `at`, not as of now.** `notifyBody(n, new Date(n.dueAt))`
  — hand Android a notification today that says "in 2 days" and it will still say
  "in 2 days" when it fires next week.

Consumers are free to be worse than the seam. The service worker can only show
what fell due when the browser happens to run it; Capacitor gets it exact.

## Storage

Single key `headsup:v1`, whole state as one JSON blob, debounced 400 ms. One key
rather than several because the storage API is rate limited and the state is
always written together.

Never use `localStorage` or `sessionStorage` — unavailable in the artifact
runtime, and the blob outgrows its 5 MB quota once a real calendar is imported.
The IndexedDB shim in `web/storage.js` falls back to memory where IndexedDB is
blocked (Safari private browsing, some webviews) and says so in the console; the
app's own "changes stay for this session only" warning covers the user-facing
half.

## Build and deploy

`build.mjs` is esbuild and about ninety lines. It transforms JSX, bundles, copies
the shell, and stamps `web/sw.js` with a hash of the bundle so each deploy gets
its own cache name.

**Every emitted path is relative.** That is the single constraint that lets the
same `dist/` serve from a domain root and from `/HEADS-UP/` on GitHub Pages. An
absolute `/main.js` anywhere — in the HTML, the manifest, or the worker's shell
list — breaks the subpath deploy and nothing else, so it fails only in
production. The worker's scope comes from its own relative registration path,
which is what makes its caching subpath-correct for free.

### The service worker's four jobs

1. Precache the shell so the app opens with no network.
2. Show notifications. `new Notification()` is not constructible on Android, so
   the page posts `{type:"NOTIFY"}` to the worker and the worker calls
   `showNotification` — and owns the icon paths, because they are its assets.
3. Store the published schedule (`{type:"SCHEDULE"}`) and, on `periodicsync`,
   announce anything overdue.
4. Step aside for a new build: network-first for same-origin requests, so a
   deploy is live on the next load; cache-first only for the webfonts.

Network-first costs a round trip on a warm start. It buys never having to debug
why a user is looking at last week's bundle, which is the better trade for an app
with one developer.

Three caches, and the difference matters: `headsup-<build>` is evicted on every
deploy, `headsup-fonts` and `headsup-state` are not. The schedule and the record
of what has already been announced belong to the user, not to the build.

### Why the worker keeps its own `shown` set

It does not write into `state.notified`. That blob is saved by the page on a
400 ms debounce, and a worker writing the same key from outside that cycle can
clobber a completion. So both sides keep their own record and both set
`tag: nudgeId` on every notification — same tag replaces rather than stacks, so a
reminder announced by the worker and then again by the page is one line on the
lock screen, not two.

### Scheduling, and its ceiling

| Host | Timeliness |
| --- | --- |
| Page open | Correct, checked every 30 s |
| Installed PWA, Chromium, closed | Periodic Background Sync: late, ~12 h floor, browser's choice of moment |
| Safari, Firefox, uninstalled | On next open |
| Capacitor / Android | Exact, via `AlarmManager`, app closed, no network, no server |

The web cannot do better. Notification Triggers never shipped past an origin
trial; a worker is killed after ~30 s idle so it cannot hold a timer. Do not add
a `setTimeout` ladder in the page to paper over this — it only works while a tab
is alive, which is the case that already works.

`web/native.js` rewrites the whole alarm set on each publish rather than diffing
it. Sixty entries is cheap, and a diff that is subtly wrong leaves a ghost alarm
for a reminder the user already dealt with — which is worse than any amount of
churn.

### Migration seam

`loadData()` merges the parsed blob over `defaultData()`, so *added* fields
default safely with no migration. `lists` arrived in 1.1.0 this way — the key
stayed `headsup:v1` and no migration was needed. Removing or reshaping a field does need one:

```js
// bump the constant, migrate forward, leave v1 untouched as a rollback
const STORE_KEY = "headsup:v2";
function migrate(v1) { /* … */ }
```

Read the old key, write the new one, and do not delete the old key in the same
release.

## Rendering

- Styling is a single CSS string in the `CSS` constant, injected via `<style>`.
  There is no Tailwind compiler in the target runtime, so arbitrary-value classes
  silently do nothing. Custom colours live in CSS variables on `.lx`. An inline
  style is for values computed at render time only — a track position, a category
  colour, a swipe transform.
- **Phone first, and the tokens say so.** `--tap` (44px) is the height of
  anything that takes a tap, and `--field-type` (16px) the size of anything typed
  into — below 16px iOS Safari zooms on focus and stays zoomed. Both are set once
  on `.lx`; a control that hard-codes its own height or font size instead is the
  bug, not the exception. Hover lives behind `@media (hover:hover)` and is never
  the only way to find something; the press state is `button:active`.
- **One amber.** `--amber` (`#e8813f`) and `--amber-ink` (`#b4470f`) mean live and
  nothing else. Anything that wants a second accent takes it from the muted inks:
  `--blue`, `--green`, or a list's own `accent`.
- **Cards are ledger rows, not objects on a page.** Treatment C in the design's
  live-card study: no radius, no shadow, no inset card — a full-bleed block
  (`margin:0 -16px`) with a hairline top border, a 7 px left rail, and a body of
  label/value rows. The paper is the card. See `.lx-led` and `.lx-led.q` in `CSS`.
- **The rail and the band carry live, not a fill.** The one reminder in front of
  you gets an amber left rail and an amber origin band across the top; queued
  rows get an ink rail and a tinted origin chip (`--tint-live`, `--tint-todo`,
  `--tint-event`). Nothing is ever a dark filled card — the earlier treatment
  turned every "also due now" item into a second poster competing with the first.
- Every card body uses the same `.lx-kv` label/value grid. New card types should
  reuse `<Row k="…">` rather than inventing a layout.
- The mark cluster under a card body flags only information *not* visible on it:
  recurrence, the presence of notes, an ad-hoc origin. If you surface a field on
  the card, remove its mark.
- Mono small-caps labels are instrument readings, so dates in them go through
  `capDate` to drop the locale's comma. Prose keeps it.
- Overlays (`.lx-sheet`, `.lx-bulk`, `.lx-undo`) are absolutely positioned
  siblings of the tab bar inside `.lx-phone`, not children of the scroll area.
  `.lx-bulk` and `.lx-undo` are positioned from `--nav-h` so they float *above*
  the tab bar; `.lx-sheet` covers it, and carries a `z-index` to say so.

### "This week" is the calendar week

`bucketOf(nudge, now, weekStart)` and `dueLabelOf(nudge, now, weekStart)` both end
the week at `endOfWeek(now, weekStart)` — the last millisecond of the calendar week
`now` falls in, honouring the same `settings.weekStart` the calendar grid uses.
Both take `weekStart` as an argument for exactly one reason: a bucket and the
label inside it must never disagree. When these were a rolling eight-day window,
Sunday's reminders showed up under THIS WEEK on a Saturday, and a nudge could be
filed under LATER while its own label read a bare `DUE FRI`.

The consequence is intended and worth stating: **late in the week, THIS WEEK is
empty.** On a Saturday, Sunday is "tomorrow" and everything after it is LATER.
Any new time bucket must be derived from this function, not from `addDays`.

### The shell owns the viewport

This is one rule with a whole class of bug behind it:

```
.lx      height:100dvh   overflow:hidden   (NOT min-height)
.lx-phone   flex:1   min-height:0
.lx-scroll  flex:1   min-height:0   overflow-y:auto
.lx-nav     flex:none  height:var(--nav-h)
```

A flex column whose height comes from its content cannot make a child scroll —
the child simply grows. `min-height:100vh` looks equivalent to `height:100vh` and
is not: with it, Home's 13,000 px of cards made the *document* scroll and put the
tab bar 12,617 px below the fold. `min-height:0` on the children matters just as
much, because the default `min-height:auto` refuses to shrink below content size.

`html`, `body` and `#root` carry `height:100%` for the same reason, and
`overflow:hidden` so a stray pixel cannot start the document scrolling again.

`--nav-h` is `64px + max(8px, env(safe-area-inset-bottom))`: a constant 58 px of
icon row, with the inset added beneath rather than subtracted from it. Anything
that floats above the bar must be positioned from that variable, never from a
hard-coded `72px`.

## Component map

Four destinations in the tab bar; settings sit behind the header control.

```
HeadsUp                 state owner, storage, notification loop, routing, undo
├─ Home                 counters · live · buckets · runway · handled
│  ├─ LedgerSwipe       the gesture wrapper: right done, left snooze, hold menu
│  ├─ LiveCard          the amber-railed ledger block; done and snooze
│  ├─ QueuedCard        everything else; `live` prop gives it the amber rail
│  └─ Runway            one event's whole ladder on a track (signature element)
├─ ListsOverview        eight lists, search across all of them; hold to rename
├─ ListDetail           with-a-date / no-date, swipe, long press, edge-swipe back
│  └─ TodoRow           one row; owns nothing, all state is lifted
├─ CalendarTab          five views + the opt-in NEW segment
├─ Rules                test box, warnings, collapsed summaries
│  ├─ TestBox           live preview; calls the real engine
│  ├─ RuleCard          ladder diagram, keywords, summary
│  │  ├─ KeywordEditor
│  │  └─ TaskEditor     one task's lead-time chip grid
│  └─ (catch-all card)
└─ overlays, siblings of the tab bar
   ├─ TodoSheet         date, reminders, steps, notes, move
   ├─ EventSheet        read-only until EDIT; commits from a fixed foot
   ├─ ListSheet         name, colour, delete — creating and renaming, one sheet
   ├─ QuickActions      what a long press on a ledger row opens
   ├─ BulkBar           done · date · move · delete
   ├─ Settings          everything adjustable, plus ImportPanel
   └─ undo / confirm
```

Shared leaves and helpers: `Row`, `Toggle`, `Seg`, `SectionHead`, `Empty`,
`TabIcon`, `StatusBar`, `useSwipe`, `useSheetDrag`, `usePager`, and the pure
nudge-to-string mappings (`rungOf`, `dueLabelOf`, `rowsOf`, `marksOf`,
`railOf`).

### Where state lives

`listId`, `openTodo`, `sel`, `bulkPanel`, `evOpen`, `evEdit`, `draft`, `quickId`
and `listEdit` are held by `HeadsUp`, not by the screens, because the sheets and the bulk bar render
above the tab bar rather than inside the scroll area. Screens own only what
nothing else can see: which card is expanded, a draft in a text field.

### Gestures

Three hooks, all built the same way: claim the pointer only once the direction
is unambiguous, so scrolling is never stolen.

`useSwipe` is the row gesture, one instance for the whole app, passed down as the
`swipe` prop. It claims the pointer after 7px of movement that is more horizontal
than vertical, and rubber-bands past 150px.

- The two directions are `onRight`/`onLeft`; `onDone`/`onDelete` are the list's
  names for the same pair. **A direction with no handler springs back** rather
  than flying off, which is what lets a row offer one action and not the other.
- `pressOnly: true` takes a row out of the drag machinery entirely and leaves only
  the long press — the list rows in the overview use it to open the rename sheet.
- A gesture that has just ended must not also register as a tap — `tapBlocked()`
  covers a 320 ms window after any release.
- **Every clickable thing inside a swipe target must check `tapBlocked()` too.**
  The checkbox circle sits inside the row, so without it a long press that lands
  on the circle deselects the item it just selected. On Home the same applies to
  the row's own expand toggle and to its Done and Snooze buttons.

`useSheetDrag` dismisses a full-screen sheet by pulling it down past 96px. It is
bound to the grabber and the sheet's head only, never the body, and it bails out
if the press starts on a control there. The sheet's entry animation deliberately
has **no fill mode**: a filled animation outranks the inline transform the drag
writes, and the sheet would refuse to move.

`usePager` steps the calendar a period per sideways swipe, and — with
`{ edge, ignore }` — walks back out of a list from its left edge. Because most of
a calendar is buttons, it cannot ask the gesture to avoid them; instead it
swallows the following click in the capture phase (`onClickCapture`, same 320 ms
window). `ignore` is a selector for anything that swipes for itself: a page and
the rows inside it cannot both own a horizontal drag.

## Undo

Destructive actions call `undoable(next, label)`, which snapshots the whole
`data` object before writing. Undo restores that snapshot. This is cheap because
state is one immutable object, but note the consequence: **undo reverts
everything that happened since the snapshot**, not just the deletion. It is
single-step and in memory only.

## Pure functions worth testing first

`parseICS`, `expandRecurrence`, `recurrenceLabel`, `cleanDescription`,
`matchRules`, `buildNudges`, `buildTodoNudges`, `resolveReminder`, `allNudges`,
`unreviewedEvents`, `applyQuiet`, `bucketOf`, `buildRunway`, `ruleWarnings`. All
are side-effect free and take plain data. Any future test suite should start
here. `applyQuiet` deserves the first test: the midnight-wrapping window is the
part that is easy to get subtly wrong.
