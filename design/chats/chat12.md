# To-do lists feature design

_Started 2026-08-29 18:09 UTC_

---

## User

Add a new tab at the bottom which transfers to a new view. The to-do lists view. It contains of lists which contain their respective todos which can be ordered, grouped and sorted by importance, date and execution order. Make lists easily accessible and editable. Get rid of the standalone banner. Every to-do task with reminder or due date appears on the home screen like the tasks and reminders of events. Every to do list has a color. Every task card on the home screen will have a left hand border in the same color as the list to signal the user, to which list it is linked. Also state the list with the banner like the standalone badge

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

Now the app.css additions and app.jsx edits.

_[tool: str_replace_edit]_

Now the big app.jsx rewrite via batched edits.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

## Assistant

## Assistant

## Assistant

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now HomeScreen edits (add listsById prop + pass to TaskRow calls):

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now AddTaskSheet:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now ZenScreen edits:

_[tool: str_replace_edit]_

Now the App() component: state, handlers, and render wiring.

_[tool: str_replace_edit]_

Now add list CRUD functions, update createTask, and rewire body/tabbar/sheets.

_[tool: str_replace_edit]_

Now the render/body switch and bottom JSX:

_[tool: str_replace_edit]_

Now verify it renders cleanly.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: show_html]_

Renders correctly — "Renew passport" shows the green Errands left border and colored pill badge. Let me check the Lists tab and a list detail screen.

_[tool: multi_screenshot]_

Everything works: Lists tab, list detail with drag-order rows, date grouping, priority grouping, colored borders throughout. Sending for verification.

_[tool: ready_for_verification]_

Added a Lists tab with color-coded to-do lists (create/rename/recolor/delete), each list sortable by manual order (drag), date, or importance. List-linked tasks now show a colored left border and colored list-name badge on Home, Zen, and task detail — replacing the old "Standalone" banner. New tasks can link to an event, a list, or neither.

## User

Found issues — fixing…

## Assistant

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

These are pre-existing spacing patterns throughout the file (not introduced by this change), consistent with the rest of the codebase. Fix applied for the real issue (list colors now use design tokens).

