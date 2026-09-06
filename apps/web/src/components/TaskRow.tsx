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
}

/** One row in a Home-screen list — see design/project/app.jsx's TaskRow.
 * Tapping the row itself is a no-op for now: it would open Task Detail,
 * which doesn't exist yet (a later Phase-2 item per docs/ROADMAP.md). */
export function TaskRow({ bucketed, event, list, eventProgress, onToggle }: TaskRowProps) {
  const { task, dueLabel } = bucketed;
  const overdue = bucketed.bucket === "overdue" && !task.done;
  const highPriority = task.priority === "high" && !task.done;
  const listColor = list?.color;
  const showProgress = eventProgress && eventProgress.total > 1;

  return (
    <div
      className={"task-row" + (overdue ? " overdue" : "") + (highPriority ? " high-priority" : "")}
      style={listColor ? { boxShadow: `inset 4px 0 0 0 ${listColor}, var(--shadow-1)` } : undefined}
    >
      <div className={"check" + (task.done ? " done" : "")} onClick={() => onToggle(bucketed)}>
        {task.done && <Icon icon={Check} size={14} />}
      </div>
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
