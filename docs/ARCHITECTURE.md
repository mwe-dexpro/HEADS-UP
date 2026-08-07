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

Everything platform-specific lives outside the app file, in `web/`:

```
web/main.jsx      mounts the app, installs the storage shim
web/storage.js    window.storage over IndexedDB, with an in-memory fallback
web/sw.js         offline shell, notification display, notification clicks
web/index.html    manifest, icons, theme colour, worker registration
```

Keep it that way. A path to an icon or a service-worker call inside
`HeadsUp.jsx` is the beginning of the end of running it anywhere else — which is
why the app posts a notification *request* to the worker rather than naming its
own icon files.

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

### The service worker's three jobs

1. Precache the shell so the app opens with no network.
2. Show notifications. `new Notification()` is not constructible on Android, so
   the page posts `{type:"NOTIFY"}` to the worker and the worker calls
   `showNotification` — and owns the icon paths, because they are its assets.
3. Step aside for a new build: network-first for same-origin requests, so a
   deploy is live on the next load; cache-first only for the webfonts.

Network-first costs a round trip on a warm start. It buys never having to debug
why a user is looking at last week's bundle, which is the better trade for an app
with one developer.

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
- **One amber.** `--amber` (`#e8813f`) and `--amber-ink` (`#b4470f`) mean live and
  nothing else. Anything that wants a second accent takes it from the muted inks:
  `--blue`, `--green`, or a list's own `accent`.
- **Live is filled, never tinted.** The one card in front of you is the dark card.
  Other items already due keep the amber rail and say so in amber ink — treatment
  B in the design's live-card study — so the fill stays worth something.
- Every card body uses the same `.lx-kv` label/value grid. New card types should
  reuse `<Row k="…">` rather than inventing a layout.
- The mark cluster under a card body flags only information *not* visible on it:
  recurrence, the presence of notes, an ad-hoc origin. If you surface a field on
  the card, remove its mark.
- Mono small-caps labels are instrument readings, so dates in them go through
  `capDate` to drop the locale's comma. Prose keeps it.
- Overlays (`.lx-sheet`, `.lx-bulk`, `.lx-undo`) are absolutely positioned
  siblings of the tab bar inside `.lx-phone`, not children of the scroll area.

## Component map

Four destinations in the tab bar; settings sit behind the header control.

```
HeadsUp                 state owner, storage, notification loop, routing, undo
├─ Home                 counters · live · buckets · runway · handled
│  ├─ LiveCard          the one filled dark card; done and snooze
│  ├─ QueuedCard        everything else; `live` prop gives it the amber rail
│  └─ Runway            one event's whole ladder on a track (signature element)
├─ ListsOverview        eight lists, search across all of them
├─ ListDetail           with-a-date / no-date, swipe, long press
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
   ├─ EventSheet        read-only until EDIT
   ├─ BulkBar           done · date · move · delete
   ├─ Settings          everything adjustable, plus ImportPanel
   └─ undo / confirm
```

Shared leaves and helpers: `Row`, `Toggle`, `Seg`, `SectionHead`, `Empty`,
`TabIcon`, `StatusBar`, `useSwipe`, and the pure nudge-to-string mappings
(`rungOf`, `dueLabelOf`, `rowsOf`, `marksOf`, `railOf`).

### Where state lives

`listId`, `openTodo`, `sel`, `bulkPanel`, `evOpen`, `evEdit` and `draft` are held
by `HeadsUp`, not by the screens, because the sheets and the bulk bar render
above the tab bar rather than inside the scroll area. Screens own only what
nothing else can see: which card is expanded, a draft in a text field.

### Gestures

`useSwipe` is one hook for the whole app. It claims the pointer only after the
movement is unambiguously horizontal (7px, and more horizontal than vertical), so
vertical scrolling is never stolen, and it rubber-bands past 150px. Two things
matter for correctness:

- A gesture that has just ended must not also register as a tap — `tapBlocked()`
  covers a 320 ms window after any release.
- **Every clickable thing inside a swipe target must check `tapBlocked()` too.**
  The checkbox circle sits inside the row, so without it a long press that lands
  on the circle deselects the item it just selected.

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
