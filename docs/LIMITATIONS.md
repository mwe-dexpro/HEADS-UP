# Known limitations in v1.1.0

Ranked by how likely they are to bite. These are known-wrong, not undiscovered.

### High

**Time zones are approximated.** `DTSTART` with a `TZID` parameter is read as
*local* time, because there is no tz database in the file. A calendar exported in
another zone will be off by the offset, which shifts every reminder with it.
`Z`-suffixed UTC times and date-only values are correct.
*Fix:* parse `VTIMEZONE`, or depend on a tz library.

**Notifications only fire while the app is open.** There is no service worker, so
a reminder due at 08:00 is announced whenever you next open the app. The
in-app "Due now" list is always correct; the push is not.

**No live calendar sync.** Manual `.ics` import only, so the New-events queue
only updates when you import.

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
