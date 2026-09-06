# Product & UX Spec — Heads Up
### Event-driven task & reminder app

> Quick note: I don't have live search access, so any real-app references below are from memory and could be outdated — treat them as illustrative, not confirmed.

---

## 1. One-Liner
Helps you keep track of events and the tasks they imply, with reminders that fire in time (or repeatedly) so nothing tied to an event gets forgotten.

**Core problem solved:** existing calendar/reminder apps notify you about the *event* — this notifies you about everything that needs to happen *because of* the event.

## 2. Primary User
- Age 20–50, generally tech-comfortable
- Cares specifically about how *comfortable and pleasant* the app feels to use, not just that it works
- Context: personal use — private events, personal goals, and todos (not team/work management)

## 3. Core Jobs, Ranked
1. **See the next important/upcoming task** across all events — this is the load-bearing screen; if it's confusing or slow, the app fails its purpose
2. Create a task tied to an event (before or after it)
3. Attach multiple reminders to one task (more chances to catch it before the deadline)
4. Check overall progress of a task list for a given event

## 4. Information Architecture (proposed)
- **Home / "What's Next"** — feed of upcoming/overdue tasks, sorted by urgency. Includes both event-linked tasks AND standalone tasks (not tied to any event) — treated as equals, not a hidden secondary list
- **Event Detail** — task list for that event + progress indicator. Event may be device-calendar-synced (read-only event data) or app-native
- **Task Detail** — the task itself + its list of reminders, editable
- **Add Event / Add Task / Add Reminder** — creation flows, with a clear choice at task-creation time: "link to an event" or "standalone task"
- **Settings** — default reminder timing, notification behavior, calendar sync management

Fixed: nav skeleton (Home / Events / Settings or similar).
Dynamic: everything inside — event names, tasks, reminders, progress states.

## 5. Platform & Context of Use
- Android + Web (PWA)
- Two real usage modes to design for:
  - **On the go, one-handed** → quick checks, quick "mark done," fast add
  - **Evening, couch, two-handed** → deliberate planning, adding multiple tasks/reminders at once
- Implication: the fast/frequent actions (check next task, mark done) should be thumb-reachable in one motion; deeper planning/editing can ask for more deliberate interaction

## 6. Visual Direction (proposal — confirm/adjust, since brand is a blank slate)
**Mood:** earthy, forest-focused, ordered, clean, trustworthy, calm, informative

- **Palette:** deep forest green (primary), moss/sage (secondary), warm cream/parchment background, charcoal text, one warm accent (amber or clay) reserved for reminders/alerts so they stand out against the calm base
- **Type:** rounded/humanist sans-serif, legible at small sizes, generous line height
- **Layout instinct:** generous whitespace, one clear primary action per screen, native-feeling components
- **Explicitly avoid:** dense multi-column layouts, small/cramped tap targets, anything that reads as "website squeezed into an app" (you flagged this — noted as a hard constraint, not a nice-to-have)

## 7. Content Reality — Edge Cases to Design For
Since real content was TBD, plan for:
- Long event/task names that wrap to 2 lines without breaking layout
- New-user zero state — no events yet, needs a warm/inviting empty state, not a blank void
- An event with 20+ tasks — list needs to stay scannable
- A task with 5+ reminders — reminder list needs to stay compact
- Overdue tasks — need a visual state distinct from "upcoming"

## 8. Data Model Sketch
```
Event
 ├── source: device-calendar (read-only) | app-native
 ├── recurrence rule: none / repeating
 └── Task (many, optional — a Task may instead have no Event)

Task
 ├── event: linked Event, or none (standalone)
 ├── recurrence rule: none / repeating
 ├── status: not started / in progress / done / overdue
 └── Reminder (many)
      ├── rule: e.g. "1 day before," "morning of" — not a fixed timestamp
      └── generates a push notification per occurrence

Event progress = tasks done ÷ tasks total (for that event's tasks only)
```
Note: reminders and recurring tasks are stored as **rules**, not pre-generated instances — see trap #1 below.

## 9. Editing Safety (your explicit requirement: fast, but not accidentally destructive)
- **Fast path:** adding a task or reminder should take as few taps as possible — quick presets for reminders (e.g., "1 day before," "morning of," "1 hour before") plus one custom option
- **Guarded path:** deleting a task/event always uses an undo snackbar (~5–8 sec) — this is the single consistent pattern for the whole app, not a mix of confirms and snackbars. The snackbar message should state scope (e.g., "Event and 5 tasks deleted," not just "Deleted") so the person knows the full impact before the window closes
- View mode and edit mode should look visibly different, so nothing gets changed by an accidental tap
- Marking something "done" should be low-friction (this isn't destructive); deleting should not be equally easy to trigger by accident

## 10. Confirmed Decisions
- **Name:** Heads Up
- **Reminders:** real push notifications (not in-app-only)
- **Recurrence:** both events and tasks can repeat
- **Calendar:** reads from the existing device calendar, PLUS keeps its own separate app-native event list — for events not on the device calendar, and for tasks with no event at all (standalone)
- **Offline:** required
- **Users:** single-user for now (no sharing/collaboration in v1)

## 11. Best Practices & Easy-to-Miss Traps for This App

**Recurrence**
1. **"This one or all of them?"** — editing or deleting a recurring event/task must ask whether the change applies to just this occurrence or the whole series. Skipping this dialog is the single most common recurrence bug (people accidentally nuke a whole series, or wonder why their edit "didn't stick" on future occurrences).
2. **Reminders are rules, not one-time alarms.** For a repeating task, its reminders must regenerate for every future occurrence automatically. It's easy to build reminders as fixed timestamps that only fire once — silently breaking the app's core promise the second week a task repeats.
3. **Don't render every future instance.** A weekly task with 3 reminders over a year is 150+ instances — display the *rule* ("3 reminders, weekly") in the UI, not a scrolling list of every occurrence.

**Calendar sync & offline**
4. **Platform feasibility flag:** reading the device calendar is straightforward on native Android, but a pure web PWA has no standard browser API for that — it typically needs a native wrapper (e.g., Capacitor) or a companion Android app. Worth raising with the dev agent early, since it affects the "Android + PWA" platform choice itself, not just the UI.
5. **Orphaned tasks:** if a synced calendar event is later deleted or moved in the *native* calendar app, decide what happens to its Heads Up tasks — silently keeping them with a stale date is worse than surfacing "this event changed, review its tasks."
6. **Offline actions need a visible sync state.** If someone deletes a task offline, they should see it's pending sync, not assume it's permanently gone (or permanently pending forever).
7. **Undo + offline interaction:** define what happens if the app is closed or backgrounded during the undo window — does the delete commit anyway, or does reopening the app still show the undo option? Pick one rule and apply it consistently.

**Notifications**
8. **Ask for push permission in context**, not at first launch — e.g., right when the person sets their first reminder, not on the splash screen. Cold, out-of-context permission prompts get reflexively denied.

**General**
9. **Progress math with recurrence:** decide whether a recurring task's progress ring reflects "today's occurrence" or "all-time completion rate" — both are defensible, but pick one explicitly or the number will feel inconsistent.
10. **Standalone tasks are first-class**, not an edge case bolted onto events — make sure the Home feed, search, and any "by event" filtering all handle a task with no event gracefully.

## 12. Checklist for the AI Design/Dev Agent
- Treat the "What's Next" home feed as the star screen — test it with 0, 1, and 50+ tasks, mixing event-linked and standalone tasks
- Make event progress visually obvious (e.g., a ring or bar), not just a number
- Design the reminder-adding flow around quick presets + one custom option
- Design the recurring event/task edit flow with an explicit "this occurrence vs. all" choice
- Use Android-conventional navigation, but keep the earthy/calm palette rather than default Material colors
- Build one undo-snackbar pattern for all destructive actions and reuse it everywhere, including scope in the message
- Use realistic long-form content in mockups, not lorem ipsum
- Include a designed empty state for a brand-new user
- Confirm responsive behavior for the PWA/web version, not just the phone screen
- Design a visible "pending sync" state for offline actions
- Confirm calendar-read feasibility on the intended platform(s) before committing to final architecture
