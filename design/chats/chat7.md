# Task completion button design

_Started 2026-08-20 18:08 UTC_

---

## User

Remove this and add a fab button with a checkbox to mark the task done

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

Unused now; I'll drop those CSS rules and add the fab-check styles.

_[tool: str_replace_edit]_

_[tool: read_file]_

The line had extra content (min-height/flex) I hadn't captured. Fixing with the exact text.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: ready_for_verification]_

Removed the snooze/mark-done footer and added a checkbox-style FAB on the task detail screen — outlined when open, fills in with a check when marked done.

## User

Do not make it a real checkbox but use an icon to signal the user that tapping this button marks it as done. Also, if the task is marked as done I want to be redirected to the last view (back navigation)

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

FAB now always shows a check icon (signal, not a literal checkbox) and marking done navigates back to the previous screen immediately.

_[tool: ready_for_verification]_

Done.

