# Known limitations in v1.5.0

Ranked by how likely they are to bite. These are known-wrong, not undiscovered.

### High

**Time zones are approximated.** `DTSTART` with a `TZID` parameter is read as
*local* time, because there is no tz database in the file. A calendar exported in
another zone will be off by the offset, which shifts every reminder with it.
`Z`-suffixed UTC times and date-only values are correct.
*Fix:* parse `VTIMEZONE`, or depend on a tz library.

**In a browser, notifications are late — sometimes by half a day.** The Android
build schedules real OS alarms and is exact. The web build cannot: Notification
Triggers never shipped, and a service worker is killed after ~30 s idle, so
Periodic Background Sync is all there is. It is Chromium-only, needs the app
installed, and Chrome enforces a twelve-hour floor and picks the moment itself.
On Safari and Firefox there is no catch-up at all — reminders wait for the next
open.

The in-app "Due now" band is always correct. Only the announcement is late.
*Fix, for the web specifically:* Web Push plus a small always-on service to hold
the schedule. That is a backend, and it ends "your data never leaves your
browser" — see ROADMAP 2.

**On Android 12+, exact delivery needs a permission the user must find.**
Without "Alarms & reminders" granted in app settings, `canScheduleExactAlarms()`
is false and every reminder is set with `setAndAllowWhileIdle` instead: it still
wakes the device from Doze, but Android may batch it with other work and it can
drift by minutes. The app declares `SCHEDULE_EXACT_ALARM` so it *can* be granted,
and deliberately does not claim `USE_EXACT_ALARM`, which is auto-granted but
restricted by Play policy to alarm-clock and calendar apps.
*Fix:* prompt for it in-app on first run — the plugin exposes the settings
intent. Not wired up yet.

**Aggressive battery managers can still defer an alarm.** Some vendor Androids
(Xiaomi, Huawei, Samsung's stricter modes) freeze apps they consider idle
regardless of `allowWhileIdle`. Setting the app to Unrestricted battery usage
fixes it; nothing in the app can.

**Only the next 30 days and 60 reminders are scheduled.** Beyond that the queue
is republished long before it matters, so this is invisible in practice — unless
you have more than sixty reminders inside a month, in which case the furthest
ones are not armed until some nearer ones clear.

**Offline needs one online visit first for the webfonts.** The shell and your
data are cached on first load, but Public Sans and IBM Plex Mono come from Google
Fonts and are only cached once they have been fetched once. Before that, offline
falls back to the system sans and mono. Layout does not shift; the type just
looks ordinary. *Fix:* self-host two woff2 files.

**No live calendar sync.** Manual `.ics` import only, so the New-events queue
only updates when you import.

### Medium — the new surface

**Quiet hours do not move alerts.** A minute-based alert on an early flight fires
inside the quiet window by design — shifting it would land it after the event.
Deliberate, but it means the window is not an absolute guarantee of silence.
*Fix:* none wanted. If it ever becomes one, it needs a per-alert opt-in.

**Notification sound is a stored preference, not a tone.** Only **Silent** has an
effect (`silent: true`); Chime, Ping and Marimba all get the platform's default.
*Fix:* needs an audio asset and a service worker to play it when not focused.

**The week and work-week grids stay cramped on a phone.** Seven columns on a
360px screen is about forty pixels a day, which is a colour and two characters of
a title. 1.5.0 answered it by opening on **3 DAY** instead, and by wrapping block
titles to two lines — the week view itself is unchanged and is, in practice, a
tablet-and-up view. *Fix:* let the grid scroll horizontally with a minimum column
width and a sticky hour gutter; the sideways paging gesture would have to yield
to it inside the grid.

**The gesture hints are per install, not per person.** `settings.swipeSeen` lives
in the same store as everything else, so a new browser or a cleared store shows
the swipe hint again. Cheap and self-correcting — it disappears the first time
either swipe is used.

**The calendar grid runs 06:00–23:00.** An event at 04:00 exists, is reminded
about, and appears in agenda and month views, but has no block in the timed
views. *Fix:* make the window follow the day's earliest and latest events.

**Overlap packing is greedy, left to right.** Three events that mutually overlap
each get a third of the column; a chain that overlaps only pairwise still splits
the whole column. Correct, never wrong, occasionally narrower than it needs to be.

**`event.end` is only as good as the import.** An `.ics` without `DTEND` gives
`null`, and the grid draws an hour. Recurring series carry the first
occurrence's duration to every occurrence.

**Ask-before-deleting confirms, then still offers undo.** Both, not either. With
the setting off — the default — you get undo alone.

### Medium

**`RRULE` support is partial.** `FREQ` (daily/weekly/monthly/yearly), `INTERVAL`,
`COUNT` and `UNTIL` work. `BYDAY`, `BYMONTHDAY`, `BYSETPOS` and `WKST` are
ignored, so "every second Tuesday" expands as a plain fortnightly repeat from the
start date. Monthly repeats on the 31st skip nothing and may land oddly in short
months.

**`EXDATE` is day-granular.** Exclusions match on date only, so cancelling one of
two occurrences on the same day removes both.

**Recurring series share one identity per occurrence date.** If an organiser
moves a single occurrence, the moved instance reads as a new event and the old
one lingers until reimport.

**No conflict resolution on reimport.** Events are matched by id. An edited event
keeps its old title and time unless its date changed, in which case you get both.

### Medium — to-dos and undo

**Undo reverts everything since the snapshot.** It restores the whole state
object, so deleting a list, then ticking an unrelated to-do, then undoing will
also untick it. Single-step, and gone on reload.

**To-do reminder ids embed an array index.** Deleting or reordering an item's
reminders re-keys its snooze and notified entries, so a snooze can appear to
attach to a different reminder. See ARCHITECTURE invariant 9.

**A lead reminder with no date emits nothing, silently.** The presets are
disabled without a date to prevent this, but a to-do imported or edited by other
means could carry one.

**No per-reminder dismissal for to-dos.** Ticking any reminder of a to-do
finishes the whole to-do. Deliberate — see DECISIONS 011 — but it differs from
how event reminders behave.

### Low

**Descriptions are truncated at 700 characters** after the Teams block is
stripped at the first run of eight or more underscores. A description that uses
underscores decoratively will be cut early.

**`notified` grows to 400 entries then trims oldest.** A very long-lived install
could in theory re-notify something ancient. Harmless.

**Organiser matching is a plain string compare** against one address. Aliases,
proxy addresses and `SENT-BY` are not considered, so "hide events I created" can
show your own events.

**The chip close control sits at 4.07:1 contrast** on the lighter panel. That
passes the 3:1 requirement for UI controls but not the 4.5:1 text threshold, so
do not reuse that pairing for anything readable.

**All-day events anchor lead times to 00:00 local.** A "day of" reminder on an
all-day event fires at the hour set in the rule, measured from midnight, which is
what you want — but a "T-0d at 07:00" on a 09:00 timed event also fires at 07:00
rather than relative to the event's start. Lead times are date-anchored, not
event-time-anchored, by design.
