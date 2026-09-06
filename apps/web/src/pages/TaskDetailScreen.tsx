import type { EventRecord, List, Priority, TaskRecord } from "@heads-up/shared";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Icon } from "../components/Icon";
import { bucketTask, formatShortDate, formatTime, reminderDateLabel, reminderLabel, REMINDER_PRESETS } from "../lib/taskBuckets";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

function eventMetaLabel(event: EventRecord): string {
  const start = new Date(event.start);
  const parts = [formatShortDate(start)];
  if (!event.allDay) parts.push(formatTime(start));
  if (event.location) parts.push(event.location);
  return parts.join(" · ");
}

interface TaskDetailScreenProps {
  task: TaskRecord;
  event: EventRecord | undefined;
  list: List | undefined;
  now: Date;
  onBack: () => void;
  onToggleDone: (task: TaskRecord) => void;
  onDelete: (task: TaskRecord) => void;
  onSetPriority: (task: TaskRecord, priority: Priority) => void;
  onAddReminder: (task: TaskRecord, presetLabel: string) => void;
  onRemoveReminder: (task: TaskRecord, reminderId: string) => void;
}

/**
 * Task Detail — see design/project/app.jsx's TaskDetailScreen. Ports the
 * header (back/edit/delete), the linked event-or-list chip, priority, and
 * reminders. Deliberately narrower than the prototype for this first slice,
 * same "narrower on purpose" precedent as Home/Calendar:
 *  - the linked event/list chip doesn't navigate anywhere yet (Event Detail
 *    and the Lists tab don't exist), so it's shown but not tappable;
 *  - there's no custom-reminder-time picker (the "Custom…" chip in the
 *    design), since nothing in the app has one yet;
 *  - recurring tasks don't get the "this occurrence or the whole series?"
 *    dialog — the API has no concept of a recurrence occurrence at all
 *    (recurrenceRule is freeform, see docs/DECISIONS.md ADR-005), so delete
 *    always deletes the whole task either way.
 * Editing mode is purely a display affordance (the banner, and showing the
 * reminder remove buttons) — every field here already saves immediately on
 * change, matching the rest of the app's optimistic-update pattern rather
 * than the prototype's own batched local-state edits.
 */
export function TaskDetailScreen({ task, event, list, now, onBack, onToggleDone, onDelete, onSetPriority, onAddReminder, onRemoveReminder }: TaskDetailScreenProps) {
  const [editing, setEditing] = useState(false);
  const { bucket, dueLabel } = bucketTask(task, now);
  const overdue = bucket === "overdue" && !task.done;

  function handleFabClick() {
    const wasDone = task.done;
    onToggleDone(task);
    if (!wasDone) onBack();
  }

  function handleDeleteClick() {
    onDelete(task);
    onBack();
  }

  const unusedPresets = task.dueAt ? REMINDER_PRESETS.filter((p) => !task.reminders.some((r) => reminderLabel(task, r) === p.label)) : [];

  return (
    <>
      <div className="screen">
        <div className="detail-header">
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="icon-btn back" onClick={onBack} aria-label="Back">
              <Icon icon={ChevronLeft} size={18} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="icon-btn" onClick={() => setEditing((e) => !e)} aria-label={editing ? "Done editing" : "Edit task"}>
                <Icon icon={editing ? Check : Pencil} size={18} />
              </div>
              <div
                className="icon-btn"
                style={{ color: "var(--signal-orange)", borderColor: "var(--signal-orange)" }}
                onClick={handleDeleteClick}
                aria-label={`Delete "${task.name}"`}
              >
                <Icon icon={Trash2} size={18} color="var(--signal-orange)" />
              </div>
            </div>
          </div>
          <div className="event-title">{task.name}</div>
          <div className="task-meta" style={{ fontSize: 14 }}>
            {dueLabel && <span className={overdue ? "due overdue" : "due"}>{dueLabel}</span>}
            {task.recurrenceRule && <span>· Repeats {task.recurrenceRule}</span>}
          </div>
          {event ? (
            <div className="event-link-chip">
              <Icon icon={CalendarDays} size={16} />
              <div className="event-link-chip-body">
                <span className="event-link-chip-name">{event.title}</span>
                <span className="event-link-chip-meta">{eventMetaLabel(event)}</span>
              </div>
              <Icon icon={ChevronRight} size={16} color="var(--slate)" />
            </div>
          ) : (
            list && (
              <div className="event-link-chip" style={{ boxShadow: `inset 3px 0 0 0 ${list.color}, var(--shadow-1)` }}>
                <span className="list-color-dot" style={{ background: list.color }} />
                <div className="event-link-chip-body">
                  <span className="event-link-chip-name">{list.name}</span>
                  <span className="event-link-chip-meta">To-do list</span>
                </div>
                <Icon icon={ChevronRight} size={16} color="var(--slate)" />
              </div>
            )
          )}
        </div>

        {editing && (
          <div className="editing-banner">
            <Icon icon={Pencil} size={16} />
            Editing — changes save when you tap the check
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div className="field">
            <label>Priority</label>
            <div className="chips">
              {PRIORITIES.map((p) => (
                <button key={p.value} type="button" className={"chip" + (task.priority === p.value ? " selected" : "")} onClick={() => onSetPriority(task, p.value)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Reminders</label>
            {task.reminders.length === 0 && <div style={{ color: "var(--slate)", fontSize: 14 }}>No reminders set — add one below.</div>}
            {task.reminders.map((r) => (
              <div className="reminder-row" key={r.id}>
                <span className="label">
                  <span className="dot" />
                  {reminderLabel(task, r)}
                  {reminderDateLabel(task, r) && <span className="reminder-date">{reminderDateLabel(task, r)}</span>}
                </span>
                {editing && (
                  <div className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => onRemoveReminder(task, r.id)} aria-label="Remove reminder">
                    <Icon icon={X} size={14} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="field">
            <label>Add a reminder</label>
            {task.dueAt ? (
              <div className="chips">
                {unusedPresets.map((p) => (
                  <button key={p.label} type="button" className="chip" onClick={() => onAddReminder(task, p.label)}>
                    {p.label}
                  </button>
                ))}
                {unusedPresets.length === 0 && <div style={{ color: "var(--slate)", fontSize: 14 }}>All reminder presets are already set.</div>}
              </div>
            ) : (
              <div style={{ color: "var(--slate)", fontSize: 14 }}>Set a due date to add reminders.</div>
            )}
          </div>

          <div style={{ height: 90 }} />
        </div>
      </div>

      <button className="fab" onClick={handleFabClick} aria-label={task.done ? "Mark not done" : "Mark done"}>
        <Icon icon={Check} size={24} color="var(--canvas-cream)" />
      </button>
    </>
  );
}
