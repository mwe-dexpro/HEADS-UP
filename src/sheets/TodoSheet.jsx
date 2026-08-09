/* One to-do, opened: its date, its reminders, its steps. Invariant 7 lives
   here — a to-do's completion is intrinsic data on the item, never in
   state.done — which is why a step ticked in this sheet clears the nudge the
   home ledger is showing for it. */

import { useState } from "react";
import {
  addDays,
  capDate,
  dateInputValue,
  isoFromInput,
  leadChip,
  sameDay,
  startOfDay,
} from "../lib/time.js";
import { TODO_LEADS, stepCount } from "../lib/todos.js";
import { useSheetDrag } from "../ui/gestures.js";

/* ---------- the to-do sheet ---------- */
export function TodoSheet({ data, list, item, now, ops, onClose }) {
  const [stepDraft, setStepDraft] = useState("");
  const sc = stepCount(item);
  const overdue = item.due && new Date(item.due) < startOfDay(now);
  const hour = data.settings.todoAutoHour ?? 9;
  const leadDays = (item.reminders || [])
    .filter((r) => r.kind === "lead")
    .map((r) => r.days);
  const patch = (p) => ops.patchItem(list.id, item.id, p);
  const drag = useSheetDrag(onClose);

  const dateChips = [
    ["TODAY", 0],
    ["TOMORROW", 1],
    ["+1 WEEK", 7],
  ];

  return (
    <div
      className="lx-sheet"
      role="dialog"
      aria-label={item.title || "To-do"}
      style={drag.style}
    >
      <div className="lx-grab" aria-hidden="true" {...drag.bind}>
        <i />
      </div>
      <div className="lx-sheet-head" {...drag.bind}>
        <button className="lx-close" onClick={onClose}>
          ‹ {list.name}
        </button>
        <span className="lx-savenote">SAVES AS YOU TYPE</span>
      </div>

      <div className="lx-sheet-body">
        <div className="lx-form">
          <div>
            <textarea
              className="lx-td-title"
              rows={2}
              value={item.title}
              placeholder="Untitled"
              onChange={(e) => patch({ title: e.target.value })}
              aria-label="Title"
            />
            <div className="lx-tags" style={{ marginTop: 6 }}>
              <span
                className="lx-tag solid"
                style={{
                  color: overdue
                    ? "#8c2f10"
                    : item.due
                      ? "var(--ink-2)"
                      : "var(--mute-3)",
                  background: overdue
                    ? "#fbe8e0"
                    : item.due
                      ? "#f0ede5"
                      : "transparent",
                }}
              >
                {item.due
                  ? overdue
                    ? `OVERDUE · ${capDate(item.due)}`
                    : capDate(item.due)
                  : "NO DATE"}
              </span>
              {sc.total > 0 && (
                <span className="lx-tag">{`${sc.done}/${sc.total} STEPS`}</span>
              )}
            </div>
          </div>

          <div className="lx-td-card">
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              DUE DATE
            </div>
            <input
              type="date"
              className="lx-td-date"
              value={dateInputValue(item.due)}
              onChange={(e) => {
                const iso = isoFromInput(e.target.value, hour);
                patch(iso ? { due: iso } : { due: null, reminders: [] });
              }}
              aria-label="Due date"
            />
            <div className="lx-chips" style={{ marginTop: 10 }}>
              {dateChips.map(([label, n]) => {
                const d = addDays(now, n);
                d.setHours(hour, 0, 0, 0);
                const on = item.due && sameDay(new Date(item.due), d);
                return (
                  <button
                    key={label}
                    className={`lx-chip sm ink${on ? " on" : ""}`}
                    onClick={() => patch({ due: d.toISOString() })}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                className="lx-chip sm danger"
                onClick={() => patch({ due: null, reminders: [] })}
              >
                CLEAR
              </button>
            </div>

            <div className="lx-hr" />
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              REMINDERS
            </div>
            <div className="lx-chips" style={{ marginTop: 0 }}>
              {TODO_LEADS.map((d) => {
                const on = leadDays.includes(d);
                return (
                  <button
                    key={d}
                    className={`lx-chip sm${!item.due ? " off" : on ? " on" : ""}`}
                    disabled={!item.due}
                    onClick={() =>
                      patch({
                        reminders: on
                          ? item.reminders.filter(
                              (r) => !(r.kind === "lead" && r.days === d),
                            )
                          : [
                              ...(item.reminders || []),
                              { kind: "lead", days: d, hour },
                            ].sort((a, b) => (b.days || 0) - (a.days || 0)),
                      })
                    }
                  >
                    {leadChip(d)}
                  </button>
                );
              })}
            </div>
            {!item.due && (
              <div className="lx-locked">
                Give it a date first — reminders count back from the due date.
              </div>
            )}
          </div>

          <div>
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              STEPS
            </div>
            <div className="lx-steps">
              {(item.subtasks || []).map((s) => (
                <div className="lx-step" key={s.id}>
                  <button
                    className={`lx-step-box${s.done ? " on" : ""}`}
                    onClick={() =>
                      ops.patchSub(list.id, item.id, s.id, { done: !s.done })
                    }
                    aria-label={`Mark ${s.title} ${s.done ? "not done" : "done"}`}
                  >
                    <i>{s.done ? "✓" : ""}</i>
                  </button>
                  <input
                    value={s.title}
                    onChange={(e) =>
                      ops.patchSub(list.id, item.id, s.id, {
                        title: e.target.value,
                      })
                    }
                    aria-label="Step"
                  />
                  {s.due && <span className="when">{capDate(s.due)}</span>}
                  <button
                    className="lx-step-x"
                    onClick={() => ops.removeSub(list.id, item.id, s.id)}
                    aria-label={`Remove ${s.title}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="lx-step" style={{ gridTemplateColumns: "1fr" }}>
                <input
                  className="draft"
                  value={stepDraft}
                  placeholder="Add a step, press enter"
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && stepDraft.trim()) {
                      ops.addSub(list.id, item.id, stepDraft.trim());
                      setStepDraft("");
                    }
                  }}
                  aria-label="Add a step"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              NOTES
            </div>
            <textarea
              className="lx-ta"
              rows={3}
              value={item.notes || ""}
              placeholder="Anything worth remembering"
              onChange={(e) => patch({ notes: e.target.value })}
              aria-label="Notes"
            />
          </div>

          <div>
            <div className="lx-lab" style={{ marginBottom: 7 }}>
              LIST
            </div>
            <select
              className="lx-select-full"
              value={list.id}
              onChange={(e) => ops.moveItem(list.id, item, e.target.value)}
              aria-label="List"
            >
              {data.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="lx-sheet-foot">
        <button
          className="lx-save"
          onClick={() => ops.setDone(list.id, item, true)}
        >
          ✓ MARK DONE
        </button>
        <button
          className="lx-kill"
          onClick={() => ops.deleteItem(list.id, item)}
        >
          DELETE
        </button>
      </div>
    </div>
  );
}
