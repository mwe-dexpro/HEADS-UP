// Task mutations shared between HomeScreen, CalendarScreen, and
// TaskDetailScreen: all three keep their own `tasks` state and toast UI
// (matching the existing per-screen-fetch precedent), but the actual
// optimistic-update + API-call logic for toggling/deleting/editing a task
// is identical across them, so it lives here once instead of being copied.

import type { Priority, TaskRecord, TaskResponse } from "@heads-up/shared";
import type { Dispatch, SetStateAction } from "react";
import { apiJson } from "../api/client";
import { REMINDER_PRESETS } from "./taskBuckets";

interface TaskActionsArgs {
  setTasks: Dispatch<SetStateAction<TaskRecord[]>>;
  setError: (message: string | null) => void;
  showToast: (message: string, onUndo?: () => void) => void;
  dismissToast: () => void;
}

function toReminderInput(r: TaskRecord["reminders"][number]) {
  return { kind: r.kind, minutesBefore: r.minutesBefore, at: r.at };
}

export function createTaskActions({ setTasks, setError, showToast, dismissToast }: TaskActionsArgs) {
  async function toggleDone(task: TaskRecord) {
    const willBeDone = !task.done;
    const nowIso = new Date().toISOString();
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: willBeDone, doneAt: willBeDone ? nowIso : null } : t)));
    try {
      await apiJson(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: willBeDone }) });
    } catch (err) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done: task.done, doneAt: task.doneAt } : t)));
      setError(err instanceof Error ? err.message : "failed to update task");
      return;
    }
    if (willBeDone) {
      showToast(`"${task.name}" marked done`, () => void undoToggle(task.id, task.done, task.doneAt));
    }
  }

  async function undoToggle(id: string, wasDone: boolean, wasDoneAt: string | null) {
    dismissToast();
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: wasDone, doneAt: wasDoneAt } : t)));
    try {
      await apiJson(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: wasDone }) });
    } catch {
      // Local state is already reverted for the user; the next load() reconciles with the server.
    }
  }

  async function deleteTask(task: TaskRecord) {
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await apiJson(`/tasks/${task.id}`, { method: "DELETE" });
    } catch (err) {
      setTasks((ts) => [task, ...ts]);
      setError(err instanceof Error ? err.message : "failed to delete task");
      return;
    }
    showToast(`"${task.name}" deleted`, () => void undoDelete(task));
  }

  // Undoing a delete re-creates the task via POST, which mints a new id —
  // nothing else in the schema references a task's id (reminders come along
  // in the same POST body), so that's safe, just worth noting: this is not
  // the same row the server had a moment ago.
  async function undoDelete(task: TaskRecord) {
    dismissToast();
    setTasks((ts) => [task, ...ts]);
    try {
      const { task: created } = await apiJson<TaskResponse>("/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: task.name,
          eventId: task.eventId,
          listId: task.listId,
          priority: task.priority,
          dueAt: task.dueAt,
          order: task.order,
          recurrenceRule: task.recurrenceRule,
          reminders: task.reminders.map(toReminderInput),
        }),
      });
      setTasks((ts) => ts.map((t) => (t.id === task.id ? created : t)));
    } catch {
      // Local state is already reverted for the user; the next load() reconciles with the server.
    }
  }

  async function setPriority(task: TaskRecord, priority: Priority) {
    const prev = task.priority;
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, priority } : t)));
    try {
      await apiJson(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ priority }) });
    } catch (err) {
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, priority: prev } : t)));
      setError(err instanceof Error ? err.message : "failed to update task");
    }
  }

  // Reminders are a whole-array replace on the API, never add/remove-one, so
  // both of these recompute the full list and PATCH it — see
  // apps/api/src/routes/tasks.ts's replaceReminders.
  async function addReminder(task: TaskRecord, presetLabel: string) {
    if (!task.dueAt) return;
    const preset = REMINDER_PRESETS.find((p) => p.label === presetLabel);
    if (!preset) return;
    const nextInputs = [...task.reminders.map(toReminderInput), preset.toInput(task.dueAt)];
    try {
      const { task: updated } = await apiJson<TaskResponse>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ reminders: nextInputs }) });
      setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to add reminder");
    }
  }

  async function removeReminder(task: TaskRecord, reminderId: string) {
    const nextInputs = task.reminders.filter((r) => r.id !== reminderId).map(toReminderInput);
    try {
      const { task: updated } = await apiJson<TaskResponse>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ reminders: nextInputs }) });
      setTasks((ts) => ts.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to update reminders");
    }
  }

  return { toggleDone, deleteTask, setPriority, addReminder, removeReminder };
}

export type TaskActions = ReturnType<typeof createTaskActions>;
