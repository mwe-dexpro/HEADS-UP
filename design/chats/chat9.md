# Task planning wizard design

_Started 2026-08-28 21:10 UTC_

---

## User

Create a new screen. I don't know how to wire this to the existing screens like a button that opens the new screen. I want a wizard to plan for today and the next days. I want to quickly create tasks and order them after due date or importance or execution order. Think of a nice wizard that helps me to quickly and bulk create and edit and plan tasks and sort and order them. My goal is to think of what I have to do tomorrow or today or the next 2-3 days and create a plan for that. The resulting tasks or events are accessible and viewable like the other events and tasks on the home screen, Zen screen or calendar screen.

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: write_file]_

Now wiring: script tag, app.css additions, and app.jsx integration.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now app.jsx wiring: HomeScreen entry button, EmptyHome secondary entry, priority flag on TaskRow, screen state, and bulk create handler.

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Added a "Plan" button on the Home top bar (and in the empty state) that opens a 3-step wizard: quick-capture tasks one at a time or pasted as a list, organize them with day chips + priority flag + drag-to-reorder for execution order, then review and create in bulk. Created tasks land as standalone "Next 3 days" tasks, so they show up on Home, Zen, and Calendar like any other task.

