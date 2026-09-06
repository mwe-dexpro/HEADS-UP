# Design review skill

_Started 2026-08-29 16:55 UTC_

---

## User

I paste a skill and want you to use it and review the design:
---
name: design-review
description: Review or audit a design/UI across 6 weighted dimensions with Nielsen's 10 heuristics and a prioritized findings table. Use when the user wants a design critique, quality score, heuristic evaluation, or audit of an existing screen, page, or product before/after build.
invocation: model
---

# Skill: Design Review

Run a structured, scored review.

## Steps
1. Read `workflows/design-review.md` (rubric, scoring guide, Nielsen heuristics, process).
2. Gather context: the screen(s)/flow, target users, platform, constraints.
3. Score the 6 dimensions (Visual Hierarchy 20%, Consistency 20%, Accessibility 20%, Usability 20%, Responsiveness 10%, Performance 10%); compute the weighted overall.
4. Run the accessibility lens with `accessibility/wcag-checklist.md`; use `scripts/contrast.py` for any color-pair doubts.
5. Check against the anti-slop tells in `taste/design-taste.md` (Banned Defaults checklist).
6. Apply Nielsen's 10 heuristics; flag violations by number.

## Output
- The 6-dimension scored table + overall score.
- A prioritized findings table: # · Severity (Critical → Major → Minor → Enhancement) · Finding · Recommendation.
- Concrete, token-referenced fixes.

## Assistant

_[tool: grep]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: multi_screenshot]_

_[tool: show_html]_

Reset to Events/Week. Good, page state persists across calls — I'll be more careful sequencing.

_[tool: multi_screenshot]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: multi_screenshot]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: screenshot]_

_[tool: eval_js]_

_[tool: screenshot]_

_[tool: eval_js]_

## Design Review — Heads Up (mobile task/event prototype)

Reviewed live: Home, Events (Week/List/Month), Event Detail, Task Detail, Zen mode, Add Task/Event sheets, Plan Wizard, Settings. Verified contrast and hit-targets via computed styles, not just visual inspection.

### Scored dimensions

| Dimension | Weight | Score | Why |
|---|---|---|---|
| Visual Hierarchy | 20% | 8.5/10 | Clear topbar → section (dot+count) → row structure; risk shown via color + progress ring/segments consistently. Timeline dots get visually tight when tasks cluster. |
| Consistency | 20% | 7.5/10 | Strong DS token/component use (pill rows, stadium buttons, circular checks, shadow-1). But Signal Orange appears on the "Focus" pill and "Paste a list instead" link — the DS spec reserves that color strictly for consent/legal, never CTAs. |
| Accessibility | 20% | 5.5/10 | One clear WCAG fail, one borderline fail, touch targets under 44px (see findings). |
| Usability | 20% | 7.5/10 | Excellent patterns: undo on every mutation, recurrence one/all dialog, bulk-select wheel, Plan Wizard capture→organize→review. But primary "mark done" action on list rows has zero visible affordance. |
| Responsiveness | 10% | 7/10 | Fixed 390×844 frame is appropriate for a native-mobile prototype; not tested beyond that viewport. |
| Performance | 10% | 7.5/10 | Fine at this scale; icon re-render called on every render with no dependency gate. |

**Weighted overall: 7.25/10**

### Nielsen heuristic flags
- **#4 Consistency & standards** — Signal Orange doubles as both "danger/overdue" and "brand accent for utility actions," diluting its meaning and breaking the DS's own color rule.
- **#6 Recognition rather than recall** — Swipe-to-complete on task rows has no persistent icon/hint; first-time users must discover or be told about the gesture.
- **#9 Error recovery** — AddEventSheet silently disables Save when the date is missing, without saying why.
- Heuristics #1, #2, #3, #5, #7, #8 — no violations found; #5 (error prevention) is a standout strength via the recurrence-scope dialog.

### Prioritized findings

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| 1 | Major | "Low priority" wizard flag label: `--dust-taupe` (#D1CDC7) on white = **1.58:1** contrast, far below WCAG AA 4.5:1 | Use `--slate` (#696969, 5.5:1) or `--granite` for the low-priority label/icon |
| 2 | Major | No persistent tap target to mark a task done on Home/Event Detail rows — only a swipe gesture with no idle-state hint (Zen mode does have a visible checkbox; Home doesn't) | Add a lightweight always-visible check affordance to `task-row`, or a subtle swipe-hint chevron shown on first load/empty state |
| 3 | Major | Signal Orange (#CF4500) used on the "Focus" pill and "Paste a list instead" link — DS spec: reserved strictly for consent/legal, never marketing/utility CTAs | Restyle both to ink-on-soft-bone (matches `pill-tag`) or `--link-blue` for the text link |
| 4 | Minor | "X overdue — at risk" text/icon (`risk-badge`, list view) = **4.08:1** on its own background, just under AA; the equivalent `risk-banner` on Event Detail uses `--clay-brown` and passes at 6.15:1 — same signal, inconsistent contrast outcome | Swap `risk-badge` text color to `--clay-brown` to match `risk-banner` |
| 5 | Minor | `.icon-btn` (40×40) and `.check` (24×24) are under the 44×44 minimum mobile touch target | Bump `icon-btn` to 44×44; pad `.check`'s tap area with invisible hit-slop even if the visual dot stays 24px |
| 6 | Minor | Events tab opens on Week view at a fixed 8AM–8PM grid with no auto-scroll to "now" or nearest event — can look empty on first glance | Auto-scroll the time grid to current hour (same pattern Zen mode already uses) |
| 7 | Minor | `useIcons()` calls `lucide.createIcons()` on every render with no dependency array | Gate on relevant deps or run once via a MutationObserver-free effect |
| 8 | Enhancement | AddEventSheet disables Save without saying the date is required | Inline hint under the date field when empty |
| 9 | Enhancement | Sofia Sans fails to load from Google Fonts in this environment and falls back to Arial silently (confirmed via `document.fonts` status: `error`) | Self-host the woff2 or add a closer local fallback stack |

Note: I initially flagged apparent text-overlap on overdue rows from a screenshot capture, but DOM measurement confirmed the live app renders it correctly at one line with no overlap — that was a screenshot-renderer artifact, not a real bug, so I excluded it.

## User

Fix the findings

## Assistant

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the auto-scroll-to-now fix in the Events time grid:

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

Fixed all 8 actionable findings: low-priority contrast, persistent tap-to-complete checkbox on task rows, Focus pill/paste-list link off Signal Orange, risk-badge contrast, 44px icon buttons + enlarged check hit-area, auto-scroll-to-now on the Events time grid, throttled icon re-render, and a required-date hint on Add Event. Left the Sofia Sans CDN fallback as-is — that failure is a sandbox network restriction, not a real defect.

