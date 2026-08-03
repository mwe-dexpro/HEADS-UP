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
    allDay, location, description,
    recurring, repeats,        // "yearly", "every 2 weeks", ""
    organizer: { name, email } | null,
    tasks: [{ id, label, leads: [{ days, hour }] }],   // ad-hoc, per event
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
    watchNew, watchOnlyOthers, myEmail,
    todoAutoRemind, todoAutoHour,    // implicit day-of nudge for dated to-dos
  },
}
```

### Two nudge sources

`buildNudges` (events) and `buildTodoNudges` (to-dos) are independent pure
functions. `allNudges` merges and sorts them by due time. They share the card
layout and the snooze store but nothing else — in particular, a to-do's
completion is **not** in `state.done`.

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

## Storage

Single key `headsup:v1`, whole state as one JSON blob, debounced 400 ms. One key
rather than several because the storage API is rate limited and the state is
always written together.

Never use `localStorage` or `sessionStorage` — unavailable in the target runtime.

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
  silently do nothing. Custom colours live in CSS variables on `.hu`.
- Every card body uses the same `.hu-kv` label/value grid. New card types should
  reuse `<Row k="…">` rather than inventing a layout.
- The badge cluster in the top-right flags only information *not* visible on the
  card: recurrence and the presence of notes. If you surface a field on the card,
  remove its badge.

## Component map

Four destinations in the tab bar; settings sit behind the header control.

```
HeadsUp                 state owner, storage, notification loop, routing, undo
├─ Upcoming             due-now / today / tomorrow / this week / later + handled
│  ├─ Nudge             dispatcher: picks the card by nudge kind
│  │  ├─ NudgeCard      event reminder
│  │  │  └─ EventDetail recurrence, provenance, full notes
│  │  └─ TodoNudgeCard  to-do reminder; accent edge + List row
│  └─ Approach          the lead-time track (signature element)
├─ Lists                to-do lists
│  └─ ItemEditor        due date, reminders, notes, steps
│     └─ SubStep        one step, own date and reminders
├─ CalendarTab          segmented shell
│  ├─ NewInCalendar     opt-in review queue for events added by others
│  │  └─ QuickReminder  presets + custom lead time, shared with Events
│  ├─ Events            all events, ad-hoc reminders, mute, manual add
│  └─ ImportTab         .ics import only
├─ Rules                test box, collapsed summaries, editor
│  ├─ RuleProbe         live preview; calls the real engine
│  └─ RuleEditor        keywords, tasks, lead times
└─ Settings             watching, notifications, to-do defaults, reset
```

Shared leaf components: `Badges`, `Row`, `QuickReminder`, `EventDetail`.

## Undo

Destructive actions call `undoable(next, label)`, which snapshots the whole
`data` object before writing. Undo restores that snapshot. This is cheap because
state is one immutable object, but note the consequence: **undo reverts
everything that happened since the snapshot**, not just the deletion. It is
single-step and in memory only.

## Pure functions worth testing first

`parseICS`, `expandRecurrence`, `recurrenceLabel`, `cleanDescription`,
`matchRules`, `buildNudges`, `buildTodoNudges`, `resolveReminder`, `allNudges`,
`unreviewedEvents`. All are side-effect free and
take plain data. Any future test suite should start here.
