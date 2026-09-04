import type { TaskRecord, TasksListResponse } from "@heads-up/shared";
import { useEffect, useState } from "react";
import { apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getCached, setCached } from "../cache/secureCache";

const TASKS_CACHE_KEY = "tasks";

/**
 * The one real Phase-1 screen: proves the whole pipeline (GitHub Pages
 * frontend → Cloudflare Worker API → D1 → back) end-to-end with a live
 * create/complete/delete loop, rather than a UI-only prototype over mock
 * data. The full design (Home, calendar, Lists tab, Zen mode, Plan Wizard,
 * …) is Phase 2 — see docs/ROADMAP.md.
 */
export function TasksPage() {
  const { state, signOut } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  async function load() {
    try {
      const res = await apiJson<TasksListResponse>("/tasks");
      setTasks(res.tasks);
      setOffline(false);
      void setCached(TASKS_CACHE_KEY, res.tasks);
    } catch (err) {
      const cached = await getCached<TaskRecord[]>(TASKS_CACHE_KEY);
      if (cached) {
        setTasks(cached);
        setOffline(true);
      } else {
        setError(err instanceof Error ? err.message : "failed to load tasks");
      }
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await apiJson("/tasks", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create task");
    }
  }

  async function toggleDone(task: TaskRecord) {
    try {
      await apiJson(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: !task.done }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to update task");
    }
  }

  async function remove(task: TaskRecord) {
    try {
      await apiJson(`/tasks/${task.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to delete task");
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <h1>Heads Up</h1>
        {state.status === "signedIn" && (
          <div className="user-bar">
            <span>{state.user.name}</span>
            <button onClick={() => void signOut()}>Sign out</button>
          </div>
        )}
      </header>

      {offline && <p className="notice">Offline — showing the last cached list. Changes need a connection.</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={(e) => void createTask(e)} className="task-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New task…" />
        <button type="submit">Add</button>
      </form>

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "done" : undefined}>
            <label>
              <input type="checkbox" checked={task.done} onChange={() => void toggleDone(task)} />
              {task.name}
            </label>
            <button onClick={() => void remove(task)} aria-label={`Delete ${task.name}`}>
              ✕
            </button>
          </li>
        ))}
        {tasks.length === 0 && <li className="empty">No tasks yet.</li>}
      </ul>
    </main>
  );
}
