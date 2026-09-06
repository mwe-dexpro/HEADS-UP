# Progress bar and priority styling

_Started 2026-08-29 06:29 UTC_

---

## User

Continuing from "Task planning wizard design".

## Assistant

We were building a task planning wizard—a dedicated screen to help you quickly bulk-create and organize tasks for today through the next 2–3 days without context-switching.

The wizard follows a 3-step flow: capture (paste or type tasks one at a time), organize (assign day, priority, and drag to set execution order), then review and create all at once. Tasks created land as standalone items in the "Next 3 days" view, so they appear on Home, Zen, and Calendar screens alongside existing tasks and events.

We wired it into the app by adding a "Plan" button on the Home top bar and in the empty state, which triggers screen state to show PlanWizard. The wizard receives a bulk-create handler from app.jsx that processes all tasks at once and refreshes the task list.

Current state: plan-wizard.jsx is complete with all three steps, styling, and drag-reorder logic. We added the entry buttons to app.jsx, integrated CSS classes, and connected the data flow. The wizard fully integrates with your existing data model—tasks it creates are immediately visible everywhere else in the app.

Open next steps:
- Test the full flow end-to-end (create tasks via wizard, verify they appear on Home, Zen, Calendar)
- Refine UX polish: drag handles, focus management, mobile responsiveness
- Optional: add keyboard shortcuts for faster capture, or preset templates for common task sets

Files involved: plan-wizard.jsx, app.jsx, app.css, Heads Up.html.

## User

Make the progress bar on the card underneath the card as an extra bottom border. If a card is high priority make the card more prominent but do not match the overdue styling

## Assistant

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now remove the now-unused ring function and add CSS.

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now the CSS.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: ready_for_verification]_

Moved the per-task event progress from the ring into a thin ink-fill bar along the card's bottom edge (clipped to its rounded corners), with the done/total count now inline next to the event name. High-priority, non-done tasks get an ink border + deeper shadow instead of any orange/peach tint, so they stay visually distinct from overdue.

## User

Hm. Maybe Mark the high priority with a border on the left hand side (like a reddish)

## Assistant

_[tool: grep]_

Use `--brand-red` (#EB001B) — a genuine reddish, distinct from the orange overdue/priority-flag color.

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Pre-existing spacing warnings, unrelated to this change. Left border applied — high-priority cards now get a 4px brand-red left border, distinct from overdue's peach fill.

## User

Looks nice. But better do the styling of overdue but with a light red color. Remove the left hand border as this will be at some point a color code to understand from which list these tasks are coming from

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

High-priority now uses a light-red fill (`#FBE9E9`), left border removed. Warnings shown are pre-existing spacing, unrelated to this change.

## User

Nice. Remove the flag though

## Assistant

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Flag icon removed from high-priority task rows.

