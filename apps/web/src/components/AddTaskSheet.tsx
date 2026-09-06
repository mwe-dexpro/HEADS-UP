import type { CreateTaskInput, Priority } from "@heads-up/shared";
import { useState } from "react";
import { REMINDER_PRESETS } from "../lib/taskBuckets";

interface AddTaskSheetProps {
  show: boolean;
  onClose: () => void;
  onCreate: (input: CreateTaskInput) => void;
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

/** Standalone-task creation only (no event/list linking) — Events and Lists
 * are later Phase-2 screens that don't exist yet, see docs/ROADMAP.md. */
export function AddTaskSheet({ show, onClose, onCreate }: AddTaskSheetProps) {
  const [name, setName] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [reminderLabels, setReminderLabels] = useState<string[]>([]);

  function reset() {
    setName("");
    setDueLocal("");
    setPriority("normal");
    setReminderLabels([]);
  }

  function toggleReminder(label: string) {
    setReminderLabels((ls) => (ls.includes(label) ? ls.filter((l) => l !== label) : [...ls, label]));
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dueAt = dueLocal ? new Date(dueLocal).toISOString() : null;
    const reminders = dueAt ? REMINDER_PRESETS.filter((p) => reminderLabels.includes(p.label)).map((p) => p.toInput(dueAt)) : [];
    onCreate({ name: trimmed, priority, dueAt, reminders });
    reset();
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <div className={"sheet-backdrop" + (show ? " show" : "")} onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <h2>New task</h2>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Task name</label>
          <input className="input-plain" placeholder="e.g. Pick up dry cleaning" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Due</label>
          <input
            className="input-plain"
            type="datetime-local"
            value={dueLocal}
            onChange={(e) => setDueLocal(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Priority</label>
          <div className="chips">
            {PRIORITIES.map((p) => (
              <span key={p.value} className={"chip" + (priority === p.value ? " selected" : "")} onClick={() => setPriority(p.value)}>
                {p.label}
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Reminders</label>
          <div className="chips">
            {REMINDER_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className={"chip" + (reminderLabels.includes(p.label) ? " selected" : "")}
                disabled={!dueLocal}
                onClick={() => toggleReminder(p.label)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {!dueLocal && <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 8 }}>Set a due date to add reminders.</div>}
        </div>
        <div className="row-actions">
          <button className="btn btn-primary" disabled={!name.trim()} onClick={submit}>
            Save task
          </button>
        </div>
      </div>
    </div>
  );
}
