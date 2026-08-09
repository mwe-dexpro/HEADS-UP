/* One event, read and edited in the same sheet. Editing is its own layer: back
   and Cancel both leave the edit and keep the event open. Alerts count back in
   minutes from the exact start and are not subject to quiet hours — shifting
   one out of the small hours would land it after the event it announces. */

import { CATS, catOf } from "../lib/data.js";
import {
  alertChip,
  alertLabel,
  clockOfMins,
  fmtDate,
  fmtTime,
  leadLabel,
  minsOfClock,
} from "../lib/time.js";
import { Toggle } from "../ui/atoms.jsx";
import { useSheetDrag } from "../ui/gestures.js";

const ALERT_OPTS = [0, 15, 60, 120, 1440];

/* ---------- the event sheet ---------- */
export function EventSheet({
  data,
  event,
  draft,
  editing,
  setDraft,
  onClose,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}) {
  const cat = catOf(event ? event.cat : draft && draft.cat);
  const set = (patch) => setDraft({ ...draft, ...patch });
  const draftDay = draft ? new Date(`${draft.date}T00:00:00`) : null;
  const drag = useSheetDrag(onClose);

  return (
    <div
      className="lx-sheet"
      role="dialog"
      aria-label={editing ? "Edit event" : "Event"}
      style={drag.style}
    >
      <div className="lx-grab" aria-hidden="true" {...drag.bind}>
        <i />
      </div>
      <div className="lx-sheet-head" {...drag.bind}>
        <button className="lx-close" onClick={onClose}>
          ‹ Close
        </button>
        {editing ? (
          <button className="lx-cancel" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <button className="lx-edit" onClick={onEdit}>
            EDIT
          </button>
        )}
      </div>

      <div className="lx-sheet-body">
        {!editing && event && (
          <div style={{ padding: "20px 16px 26px" }}>
            <span
              className="lx-cat"
              style={{ color: cat.fg, background: cat.bg }}
            >
              {cat.name.toUpperCase()}
            </span>
            <h3 className="lx-sheet-h">{event.title}</h3>
            <div className="lx-table">
              <div className="lx-table-row">
                <span className="lx-table-k">WHEN</span>
                <span className="lx-table-v">
                  {event.allDay
                    ? `${fmtDate(event.start)} · all day`
                    : `${fmtDate(event.start)} · ${fmtTime(event.start)}${
                        event.end ? `–${fmtTime(event.end)}` : ""
                      }`}
                  {event.recurring ? ` · ${event.repeats || "repeats"}` : ""}
                </span>
              </div>
              <div className="lx-table-row">
                <span className="lx-table-k">WHERE</span>
                <span className="lx-table-v">{event.location || "—"}</span>
              </div>
              <div className="lx-table-row">
                <span className="lx-table-k">ALERTS</span>
                <span className="lx-table-v">
                  {(event.alerts || []).length
                    ? event.alerts
                        .slice()
                        .sort((a, b) => b - a)
                        .map(alertLabel)
                        .join(", ")
                    : "None"}
                </span>
              </div>
              {(event.tasks || []).length > 0 && (
                <div className="lx-table-row">
                  <span className="lx-table-k">ADDED</span>
                  <span className="lx-table-v">
                    {event.tasks
                      .map(
                        (t) =>
                          `${t.label} (${(t.leads || [])
                            .map((l) => leadLabel(l.days))
                            .join(", ")})`,
                      )
                      .join(" · ")}
                  </span>
                </div>
              )}
              <div className="lx-table-row">
                <span className="lx-table-k">NOTES</span>
                <span className="lx-table-v">{event.description || "—"}</span>
              </div>
            </div>
            <div className="lx-note">
              Read-only. Tap Edit — at the top, or under your thumb below — to
              change anything.
            </div>
          </div>
        )}

        {editing && draft && (
          <div className="lx-form">
            <div className="lx-form-h">
              {draft.id ? "Edit event" : "New event"}
            </div>
            <div>
              <div className="lx-lab">TITLE</div>
              <input
                className="lx-in"
                value={draft.title}
                placeholder="What is it?"
                onChange={(e) => set({ title: e.target.value })}
                aria-label="Title"
              />
            </div>
            <div>
              <div className="lx-lab">DATE</div>
              <input
                type="date"
                className="lx-in mono"
                value={draft.date}
                onChange={(e) =>
                  e.target.value && set({ date: e.target.value })
                }
                aria-label="Date"
              />
              <div className="lx-daynote">
                {draftDay && !isNaN(draftDay) ? fmtDate(draftDay) : ""}
              </div>
            </div>
            <div className="lx-rowcard">
              <span className="t">All day</span>
              <Toggle
                on={draft.allDay}
                label="All day"
                onClick={() => set({ allDay: !draft.allDay })}
              />
            </div>
            {!draft.allDay && (
              <div className="lx-two">
                <div>
                  <div className="lx-lab">STARTS</div>
                  <input
                    type="time"
                    className="lx-in mono"
                    value={draft.start}
                    onChange={(e) => {
                      const v = e.target.value;
                      set({
                        start: v,
                        end:
                          minsOfClock(v) >= minsOfClock(draft.end)
                            ? clockOfMins(Math.min(minsOfClock(v) + 60, 1439))
                            : draft.end,
                      });
                    }}
                    aria-label="Starts"
                  />
                </div>
                <div>
                  <div className="lx-lab">ENDS</div>
                  <input
                    type="time"
                    className="lx-in mono"
                    value={draft.end}
                    onChange={(e) => set({ end: e.target.value })}
                    aria-label="Ends"
                  />
                </div>
              </div>
            )}
            <div>
              <div className="lx-lab">CALENDAR</div>
              <div className="lx-chips" style={{ marginTop: 0 }}>
                {Object.keys(CATS).map((k) => {
                  const on = draft.cat === k;
                  return (
                    <button
                      key={k}
                      className="lx-chip"
                      style={
                        on
                          ? {
                              background: CATS[k].fg,
                              borderColor: CATS[k].fg,
                              color: "#fff",
                            }
                          : undefined
                      }
                      onClick={() => set({ cat: k })}
                      aria-pressed={on}
                    >
                      {CATS[k].name.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="lx-lab">ALERTS</div>
              <div className="lx-chips" style={{ marginTop: 0 }}>
                {ALERT_OPTS.map((m) => {
                  const on = draft.alerts.includes(m);
                  return (
                    <button
                      key={m}
                      className={`lx-chip${on ? " on" : ""}`}
                      onClick={() =>
                        set({
                          alerts: on
                            ? draft.alerts.filter((x) => x !== m)
                            : [...draft.alerts, m],
                        })
                      }
                      aria-pressed={on}
                    >
                      {alertChip(m)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="lx-lab">WHERE</div>
              <input
                className="lx-in plain"
                value={draft.location}
                placeholder="Add a place"
                onChange={(e) => set({ location: e.target.value })}
                aria-label="Where"
              />
            </div>
            <div>
              <div className="lx-lab">NOTES</div>
              <textarea
                className="lx-ta"
                rows={3}
                value={draft.description}
                placeholder="Anything worth remembering"
                onChange={(e) => set({ description: e.target.value })}
                aria-label="Notes"
              />
            </div>
          </div>
        )}
      </div>

      {/* The commit row is a fixed foot rather than the last thing in a long
          scroll: on a phone, Save is never a scroll away from wherever the
          keyboard left you. */}
      {editing && draft && (
        <div className="lx-sheet-foot">
          <button className="lx-save" onClick={onSave}>
            SAVE
          </button>
          {draft.id && (
            <button className="lx-kill" onClick={onDelete}>
              DELETE
            </button>
          )}
        </div>
      )}
      {!editing && event && (
        <div className="lx-sheet-foot">
          <button className="lx-save" onClick={onEdit}>
            EDIT EVENT
          </button>
        </div>
      )}
    </div>
  );
}
