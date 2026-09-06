# Event overdue task system

_Started 2026-08-20 06:59 UTC_

---

## User

Resolve the comments and think of a system to show the user, which event is currently in danger due to one or multiple tasks being overdue.

## Assistant

_[tool: get_comments]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now resolving the addressed comments and verifying.

_[tool: resolve_comments]_

_[tool: ready_for_verification]_

Addressed all four comments and added an event-risk system: progress on the event detail screen is now a task-count segmented bar (not a cramped ring), the timeline sits above it, the today marker is Signal Orange, and "Add task" is a sticky + FAB. For risk: any event with overdue tasks now shows an orange "N overdue — at risk" badge in the Events list, its progress ring/segments turn orange, and its detail screen gets an orange risk banner.

## User

Resolve comments

## Assistant

_[tool: get_comments]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

Now update the CSS and load the calendar-picker script before app.jsx.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

_[tool: resolve_comments]_

Addressed all six: Save Task routes to task detail when no reminder is set (so the user can add one), due-date fields are now inline calendar pickers, long-press enters a multi-select mode with bulk mark-done/snooze, task rows support swipe-left (mark done) and swipe-right (quick-action menu, bulk-aware), the linked event on task detail is now a tappable chip routing to event detail, and the Events-screen FAB/+ now creates an event instead of a task.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Fixed the crash: `Icon` now renders a stable wrapper span so lucide's DOM swap never conflicts with React's own mount/unmount, and dynamic-name icons (edit toggle, chevron, swipe hint) are keyed to remount cleanly.

