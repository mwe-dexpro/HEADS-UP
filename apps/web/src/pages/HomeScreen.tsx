import type { CreateTaskInput, EventRecord, EventsListResponse, List, ListsListResponse, TaskRecord, TaskResponse, TasksListResponse } from "@heads-up/shared";
import { ChevronDown, ChevronUp, LogOut, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { getCached, setCached } from "../cache/secureCache";
import { AddTaskSheet } from "../components/AddTaskSheet";
import { Icon } from "../components/Icon";
import { TaskRow } from "../components/TaskRow";
import { Toast, type ToastState } from "../components/Toast";
import { bucketTask, type BucketedTask } from "../lib/taskBuckets";

const TASKS_CACHE_KEY = "tasks";
const EVENTS_CACHE_KEY = "events";
const LISTS_CACHE_KEY = "lists";

interface EventProgress {
  done: number;
  total: number;
}

interface HomeSectionProps {
  id: string;
  dot: string;
  label: string;
  dateHint?: string;
  items: BucketedTask[];
  collapsible: boolean;
  open: boolean;
  onToggleOpen: (id: string) => void;
  eventsById: Map<string, EventRecord>;
  listsById: Map<string, List>;
  eventStats: Map<string, EventProgress>;
  onToggleTask: (bucketed: BucketedTask) => void;
}

/** One labeled group of task rows (Overdue / Today / Next 3 days / …). A
 * top-level component, not defined inline in HomeScreen, so its identity
 * stays stable across renders — an inline component would remount (and
 * lose any in-progress interaction) every time HomeScreen re-renders. */
function HomeSection({ id, dot, label, dateHint, items, collapsible, open, onToggleOpen, eventsById, listsById, eventStats, onToggleTask }: HomeSectionProps) {
  if (items.length === 0) return null;
  const isOpen = !collapsible || open;
  return (
    <>
      <div className={"section-label" + (collapsible ? " collapsible" : "")} onClick={collapsible ? () => onToggleOpen(id) : undefined}>
        <span className="dot" style={{ background: dot }} />
        {label}
        {dateHint && <span className="section-date"> · {dateHint}</span>}
        <span className="count">{items.length}</span>
        {collapsible && <Icon icon={isOpen ? ChevronUp : ChevronDown} size={16} color="var(--slate)" />}
      </div>
      {isOpen && (
        <div className="list">
          {items.map((b) => (
            <TaskRow
              key={b.task.id}
              bucketed={b}
              event={b.task.eventId ? eventsById.get(b.task.eventId) : undefined}
              list={b.task.listId ? listsById.get(b.task.listId) : undefined}
              eventProgress={b.task.eventId ? eventStats.get(b.task.eventId) : undefined}
              onToggle={onToggleTask}
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The Home / "What's next" screen — the "load-bearing screen" per
 * design/project/uploads/event-task-app-spec.md: a single feed of every
 * upcoming/overdue task across events, standalone lists, and no list at
 * all, sorted by urgency. Built against the live API rather than the
 * design prototype's mock data — see docs/ROADMAP.md Phase 2.
 *
 * Deliberately narrower than the full prototype for this first Phase-2
 * slice: no swipe gestures, multi-select, Zen mode, or Plan wizard yet,
 * and task/event linking in "add task" is standalone-only since the
 * Events and Lists screens don't exist yet. Tapping a row (rather than its
 * checkbox) is a no-op until Task Detail lands.
 */
export function HomeScreen() {
  const { state, signOut } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ next3: true, nextweek: true, upcoming: true });
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  async function load() {
    try {
      const [tasksRes, eventsRes, listsRes] = await Promise.all([
        apiJson<TasksListResponse>("/tasks"),
        apiJson<EventsListResponse>("/events"),
        apiJson<ListsListResponse>("/lists"),
      ]);
      setTasks(tasksRes.tasks);
      setEvents(eventsRes.events);
      setLists(listsRes.lists);
      setOffline(false);
      void setCached(TASKS_CACHE_KEY, tasksRes.tasks);
      void setCached(EVENTS_CACHE_KEY, eventsRes.events);
      void setCached(LISTS_CACHE_KEY, listsRes.lists);
    } catch (err) {
      const cachedTasks = await getCached<TaskRecord[]>(TASKS_CACHE_KEY);
      if (cachedTasks) {
        setTasks(cachedTasks);
        setEvents((await getCached<EventRecord[]>(EVENTS_CACHE_KEY)) ?? []);
        setLists((await getCached<List[]>(LISTS_CACHE_KEY)) ?? []);
        setOffline(true);
      } else {
        setError(err instanceof Error ? err.message : "failed to load your tasks");
      }
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function showToast(message: string, onUndo?: () => void) {
    clearTimeout(toastTimer.current);
    setToast({ message, onUndo });
    toastTimer.current = setTimeout(() => setToast(null), 7000);
  }

  function toggleOpen(id: string) {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  async function handleToggleTask(bucketed: BucketedTask) {
    const task = bucketed.task;
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
    setToast(null);
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, done: wasDone, doneAt: wasDoneAt } : t)));
    try {
      await apiJson(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ done: wasDone }) });
    } catch {
      // Local state is already reverted for the user; the next load() reconciles with the server.
    }
  }

  async function handleCreateTask(input: CreateTaskInput) {
    try {
      const { task: created } = await apiJson<TaskResponse>("/tasks", { method: "POST", body: JSON.stringify(input) });
      setTasks((ts) => [created, ...ts]);
      setAddSheetOpen(false);
      showToast(`"${created.name}" added`, () => void undoCreate(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create task");
    }
  }

  async function undoCreate(id: string) {
    setToast(null);
    setTasks((ts) => ts.filter((t) => t.id !== id));
    try {
      await apiJson(`/tasks/${id}`, { method: "DELETE" });
    } catch {
      // Local state is already reverted for the user; the next load() reconciles with the server.
    }
  }

  if (!loaded) return <div className="screen" />;

  const now = new Date();
  const bucketed = tasks.map((t) => bucketTask(t, now));
  const eventsById = new Map(events.map((e) => [e.id, e]));
  const listsById = new Map(lists.map((l) => [l.id, l]));
  const eventStats = new Map<string, EventProgress>();
  for (const t of tasks) {
    if (!t.eventId) continue;
    const s = eventStats.get(t.eventId) ?? { done: 0, total: 0 };
    s.total++;
    if (t.done) s.done++;
    eventStats.set(t.eventId, s);
  }

  const overdue = bucketed.filter((b) => b.bucket === "overdue");
  const today = bucketed.filter((b) => b.bucket === "next3" && b.isToday);
  const next3 = bucketed.filter((b) => b.bucket === "next3" && !b.isToday);
  const nextweek = bucketed.filter((b) => b.bucket === "nextweek");
  const upcoming = bucketed.filter((b) => b.bucket === "upcoming");
  const doneCount = tasks.filter((t) => t.done).length;
  const oneWeekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const doneThisWeekCount = tasks.filter((t) => t.done && t.doneAt && new Date(t.doneAt).getTime() >= oneWeekAgoMs).length;
  const isEmpty = overdue.length === 0 && today.length === 0 && next3.length === 0 && nextweek.length === 0 && upcoming.length === 0 && doneCount === 0;

  const sectionProps = { eventsById, listsById, eventStats, onToggleTask: handleToggleTask, onToggleOpen: toggleOpen };

  return (
    <>
      <div className="screen">
        <div className="topbar">
          <div>
            <h1>What&rsquo;s next</h1>
            <div className="sub">Everything tied to your events and goals</div>
          </div>
          {state.status === "signedIn" && (
            <div className="icon-btn" onClick={() => void signOut()} aria-label={`Sign out of ${state.user.name}'s account`}>
              <Icon icon={LogOut} size={18} />
            </div>
          )}
        </div>

        {offline && <p className="status-banner">Offline — showing the last cached list. Changes need a connection.</p>}
        {error && <p className="status-banner error">{error}</p>}

        {isEmpty ? (
          <div className="empty">
            <div className="ring">
              <Icon icon={Sparkles} size={34} />
            </div>
            <h2>Nothing on your plate yet</h2>
            <p>Add a task and Heads Up will keep track of what needs to happen, and when.</p>
            <button className="btn btn-primary" onClick={() => setAddSheetOpen(true)}>
              Add your first task
            </button>
          </div>
        ) : (
          <>
            <HomeSection id="overdue" dot="var(--signal-orange)" label="Overdue" items={overdue} collapsible={false} open {...sectionProps} />
            <HomeSection id="today" dot="var(--ink)" label="Today" items={today} collapsible={false} open {...sectionProps} />
            <HomeSection id="next3" dot="var(--ink)" label="Next 3 days" items={next3} collapsible open={open.next3} {...sectionProps} />
            <HomeSection id="nextweek" dot="var(--slate)" label="Next week" items={nextweek} collapsible open={open.nextweek} {...sectionProps} />
            <HomeSection id="upcoming" dot="var(--dust-taupe)" label="Upcoming" items={upcoming} collapsible open={open.upcoming} {...sectionProps} />
            {doneThisWeekCount > 0 && (
              <div style={{ padding: "18px 20px 140px", fontSize: 13, color: "var(--slate)", fontWeight: 450 }}>
                {doneThisWeekCount} task{doneThisWeekCount > 1 ? "s" : ""} completed this week
              </div>
            )}
            {doneThisWeekCount === 0 && <div style={{ height: 140 }} />}
          </>
        )}
      </div>

      <button className="fab" onClick={() => setAddSheetOpen(true)} aria-label="Add task">
        <Icon icon={Plus} size={24} color="var(--canvas-cream)" />
      </button>
      <AddTaskSheet show={addSheetOpen} onClose={() => setAddSheetOpen(false)} onCreate={(input) => void handleCreateTask(input)} />
      <Toast toast={toast} />
    </>
  );
}
