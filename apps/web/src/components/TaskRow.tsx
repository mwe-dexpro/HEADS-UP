import type { EventRecord, List } from "@heads-up/shared";
import { Bell, Check, Flag, Repeat } from "lucide-react";
import type { BucketedTask } from "../lib/taskBuckets";
import { Icon } from "./Icon";

interface EventProgress {
  done: number;
  total: number;
}

interface TaskRowProps {
  bucketed: BucketedTask;
  event: EventRecord | undefined;
  list: List | undefined;
  eventProgress: EventProgress | undefined;
  onToggle: (bucketed: BucketedTask) => void;
  onOpen: (bucketed: BucketedTask) => void;
}

/** One row in a Home-screen list — see design/project/app.jsx's TaskRow.
 * Tapping the row opens Task Detail; tapping the checkbox itself only
 * toggles done (it stops the click from also bubbling up into onOpen). */
export function TaskRow({ bucketed, event, list, eventProgress, onToggle, onOpen }: TaskRowProps) {
  const { task, dueLabel } = bucketed;
  const overdue = bucketed.bucket === "overdue" && !task.done;
  const highPriority = task.priority === "high" && !task.done;
  const listColor = list?.color;
  const showProgress = eventProgress && eventProgress.total > 1;

  return (
    <div
      className={"task-row" + (overdue ? " overdue" : "") + (highPriority ? " high-priority" : "")}
      style={listColor ? { boxShadow: `inset 4px 0 0 0 ${listColor}, var(--shadow-1)` } : undefined}
      onClick={() => onOpen(bucketed)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(bucketed);
      }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark "${task.name}" not done` : `Mark "${task.name}" done`}
        className={"check" + (task.done ? " done" : "")}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(bucketed);
        }}
      >
        {task.done && <Icon icon={Check} size={14} />}
      </button>
      <div className="task-body">
        <div className={"task-title" + (task.done ? " done" : "")}>{task.name}</div>
        <div className="task-meta">
          {dueLabel && <span className={"due" + (overdue ? " overdue" : "")}>{dueLabel}</span>}
          {highPriority && (
            <span className="task-meta-icon">
              <Icon icon={Flag} size={13} color="var(--clay-brown)" />
            </span>
          )}
          {task.recurrenceRule && (
            <span className="task-meta-icon">
              <Icon icon={Repeat} size={13} color="var(--slate)" />
            </span>
          )}
          {task.reminders.length > 0 && (
            <span className="task-meta-icon">
              <Icon icon={Bell} size={13} color="var(--slate)" />
              {task.reminders.length}
            </span>
          )}
        </div>
        {(event || list) && (
          <div className="task-meta-event">
            {event ? (
              <span>{event.title}</span>
            ) : (
              list && (
                <span className="pill-tag" style={{ background: `color-mix(in oklch, ${list.color} 16%, var(--white))`, color: list.color }}>
                  <span className="dot" style={{ background: list.color }} />
                  {list.name}
                </span>
              )
            )}
            {showProgress && <span className="task-progress-count"> · {eventProgress.done}/{eventProgress.total}</span>}
          </div>
        )}
      </div>
      {showProgress && (
        <div className="task-progress-bottom">
          <div className="task-progress-bottom-fill" style={{ width: `${(eventProgress.done / eventProgress.total) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
