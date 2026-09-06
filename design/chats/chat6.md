# Calendar view options

_Started 2026-08-20 17:53 UTC_

---

## User

Add a calendar view like in outlook calendar with view options "List" (lists events sorted by date in cards with preview infos) or a real calendar with three days, week, workweek and month

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: write_file]_

Now the CSS additions and app.jsx / HTML wiring.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update `EventsScreen` and App state in app.jsx.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: ready_for_verification]_

Added a List/Calendar toggle to the Events tab: List sorts event cards by date with time shown; Calendar has 3 Day/Week/Workweek/Month sub-views with a real time-grid (hour rows, all-day chips, now-line) and a month grid with an agenda list below for the selected day.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Fixed the column-width calculation so 3-Day/Workweek fit flush without overflow.

## User

Get rid of the list and calender action bar. Move "List" option to the bar below, after "Month"

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

Now I'll move the list rendering into CalendarView and simplify EventsScreen.

_[tool: str_replace_edit]_

_[tool: read_file]_

Good, clean. Now remove App's `calMode` state wiring and update `calendar-view.jsx` to add List as a subView.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Removed the top List/Calendar bar; List is now the 5th option in the sub-tabs row (3 Day, Week, Workweek, Month, List).

## User

Lose this button. The fab at the bottom does the same

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Removed the redundant add-event button from the Events topbar (FAB handles it). These lint warnings are pre-existing spacing style in the file, unrelated to this change.

