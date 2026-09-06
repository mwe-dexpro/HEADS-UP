import type { EventRecord, EventsListResponse, List, ListsListResponse, TaskRecord, TasksListResponse } from "@heads-up/shared";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { apiJson } from "../api/client";
import { getCached, setCached } from "../cache/secureCache";
import {
  type CalendarItem,
  type CalendarItemFilter,
  type CalendarSubView,
  buildCalendarItems,
  dayGroupLabel,
  headerLabel,
  isSameDay,
  itemsOnDay,
  monthGridDays,
  shiftAnchor,
  sortByTime,
  startOfDay,
  viewDays,
  weekdayShortLabels,
} from "../lib/calendarView";
import { Icon } from "../components/Icon";

const TASKS_CACHE_KEY = "tasks";
const EVENTS_CACHE_KEY = "events";
const LISTS_CACHE_KEY = "lists";

const SUB_VIEWS: { key: CalendarSubView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "day3", label: "3 Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "agenda", label: "Agenda" },
];

const ITEM_FILTERS: { key: CalendarItemFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "tasks", label: "To-dos" },
];

const GRID_HOUR_START = 8;
const GRID_HOUR_END = 20;
const GRID_HOUR_HEIGHT = 40;

function formatHour(h: number): string {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? "AM" : "PM"}`;
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

function itemDotColor(item: CalendarItem, listsById: Map<string, List>): string {
  if (item.kind === "task") return (item.listId && listsById.get(item.listId)?.color) || "var(--ink)";
  return "var(--signal-orange-light)";
}

interface SegTabsProps<T extends string> {
  items: { key: T; label: string }[];
  active: T;
  onChange: (key: T) => void;
}

function SegTabs<T extends string>({ items, active, onChange }: SegTabsProps<T>) {
  return (
    <div className="seg-tabs dense">
      {items.map((it) => (
        <button key={it.key} type="button" className={"seg-tab" + (active === it.key ? " active" : "")} onClick={() => onChange(it.key)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

interface CalHeaderProps {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function CalHeader({ label, onPrev, onNext, onToday }: CalHeaderProps) {
  return (
    <div className="cal-nav">
      <button type="button" className="icon-btn cal-nav-btn" onClick={onPrev} aria-label="Previous">
        <Icon icon={ChevronLeft} size={16} />
      </button>
      <span className="cal-nav-label">{label}</span>
      <button type="button" className="icon-btn cal-nav-btn" onClick={onNext} aria-label="Next">
        <Icon icon={ChevronRight} size={16} />
      </button>
      <button type="button" className="today-btn" onClick={onToday}>
        Today
      </button>
    </div>
  );
}

interface AgendaItemCardProps {
  item: CalendarItem;
  listsById: Map<string, List>;
}

function AgendaItemCard({ item, listsById }: AgendaItemCardProps) {
  const list = item.listId ? listsById.get(item.listId) : undefined;
  const isEvent = item.kind === "event";
  return (
    <div className="agenda-card">
      <div className="agenda-row-time">
        {item.allDay ? <span className="d">All day</span> : <span className="t">{formatClock(item.startMinutes!)}</span>}
      </div>
      <span className="agenda-row-dot" style={{ background: itemDotColor(item, listsById) }} />
      <div className="agenda-row-body">
        <div className={"agenda-row-name" + (!isEvent && item.done ? " done" : "")}>{item.name}</div>
        {isEvent && item.location && (
          <div className="agenda-row-loc">
            <Icon icon={MapPin} size={12} color="var(--slate)" />
            <span>{item.location}</span>
          </div>
        )}
        {!isEvent && list && <div className="agenda-row-loc">{list.name}</div>}
      </div>
    </div>
  );
}

interface AgendaListProps {
  date: Date;
  items: CalendarItem[];
  listsById: Map<string, List>;
  now: Date;
}

function AgendaDayList({ date, items, listsById, now }: AgendaListProps) {
  const dayItems = sortByTime(itemsOnDay(items, date));
  return (
    <div className="agenda">
      <div className="agenda-label">{dayGroupLabel(date, now)}</div>
      {dayItems.length === 0 && <div className="agenda-empty">Nothing scheduled</div>}
      {dayItems.map((it) => (
        <AgendaItemCard key={`${it.kind}-${it.id}`} item={it} listsById={listsById} />
      ))}
    </div>
  );
}

interface AgendaViewProps {
  items: CalendarItem[];
  listsById: Map<string, List>;
  now: Date;
}

/** The flat "Agenda" sub-tab — every item across all time, grouped by day.
 * Unlike Day/3-Day/Week/Month, it has no anchor to page through: it's meant
 * to be an at-a-glance scroll of everything ahead (and behind). */
function AgendaView({ items, listsById, now }: AgendaViewProps) {
  const byKey = new Map<number, CalendarItem[]>();
  for (const it of items) {
    const key = it.date.getTime();
    const arr = byKey.get(key) ?? [];
    arr.push(it);
    byKey.set(key, arr);
  }
  const groups = [...byKey.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, arr]) => ({ date: new Date(time), items: sortByTime(arr) }));

  return (
    <div className="agenda-list">
      {groups.length === 0 && <div className="agenda-empty">Nothing to show</div>}
      {groups.map((g) => (
        <div key={g.date.getTime()} className="agenda-group">
          <div className="agenda-label">{dayGroupLabel(g.date, now)}</div>
          {g.items.map((it) => (
            <AgendaItemCard key={`${it.kind}-${it.id}`} item={it} listsById={listsById} />
          ))}
        </div>
      ))}
    </div>
  );
}

interface MonthGridProps {
  anchor: Date;
  items: CalendarItem[];
  listsById: Map<string, List>;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  now: Date;
}

function MonthGrid({ anchor, items, listsById, selectedDate, onSelect, now }: MonthGridProps) {
  const cells = monthGridDays(anchor);
  return (
    <div className="month-view">
      <div className="cal-weekdays">
        {weekdayShortLabels().map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const today = isSameDay(d, now);
          const selected = isSameDay(d, selectedDate);
          const dayItems = itemsOnDay(items, d);
          return (
            <button
              type="button"
              key={d.getTime()}
              className={"month-cell" + (inMonth ? "" : " outside") + (selected ? " selected" : "")}
              onClick={() => onSelect(d)}
              aria-label={`Show ${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
            >
              <span className={"month-daynum" + (today ? " today" : "")}>{d.getDate()}</span>
              {dayItems.length > 0 && (
                <span className="month-dots">
                  {dayItems.slice(0, 3).map((it) => (
                    <span key={`${it.kind}-${it.id}`} className="month-dot" style={{ background: itemDotColor(it, listsById) }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TimeGridProps {
  days: Date[];
  items: CalendarItem[];
  listsById: Map<string, List>;
  now: Date;
}

/** The Day/3-Day/Week hour-by-hour grid. Auto-scrolling to the current time
 * on mount is intentionally out of scope for this slice — the page scrolls
 * naturally (see design/base.css's header comment on responsiveness), and
 * the fixed 8am–8pm range already covers most of a normal day. */
function TimeGrid({ days, items, listsById, now }: TimeGridProps) {
  const hours = Array.from({ length: GRID_HOUR_END - GRID_HOUR_START }, (_, i) => GRID_HOUR_START + i);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const cols = `40px repeat(${days.length}, 1fr)`;

  function taskStyle(item: CalendarItem): CSSProperties | undefined {
    if (item.kind !== "task") return undefined;
    const color = item.listId ? listsById.get(item.listId)?.color : undefined;
    return color ? { borderColor: color, color } : undefined;
  }

  return (
    <div className="tg">
      <div className="tg-header" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => (
          <div key={d.getTime()} className={"tg-daylabel" + (isSameDay(d, now) ? " today" : "")}>
            <span className="dow">{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
            <span className="dnum">{d.getDate()}</span>
          </div>
        ))}
      </div>
      <div className="tg-allday" style={{ gridTemplateColumns: cols }}>
        <div className="tg-allday-label">All-day</div>
        {days.map((d) => {
          const dayItems = itemsOnDay(items, d).filter((it) => it.allDay);
          return (
            <div key={d.getTime()} className="tg-allday-col">
              {dayItems.map((it) => (
                <div
                  key={`${it.kind}-${it.id}`}
                  className={"tg-allday-chip" + (it.kind === "task" ? " task" : "")}
                  style={taskStyle(it)}
                >
                  {it.name}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="tg-grid" style={{ gridTemplateColumns: cols, height: hours.length * GRID_HOUR_HEIGHT }}>
        <div className="tg-gutter">
          {hours.map((h) => (
            <div key={h} className="tg-hour" style={{ height: GRID_HOUR_HEIGHT }}>
              {formatHour(h)}
            </div>
          ))}
        </div>
        {days.map((d) => {
          const dayToday = isSameDay(d, now);
          const dayItems = itemsOnDay(items, d).filter(
            (it): it is CalendarItem & { startMinutes: number } =>
              !it.allDay &&
              it.startMinutes !== null &&
              it.startMinutes >= GRID_HOUR_START * 60 &&
              it.startMinutes < GRID_HOUR_END * 60
          );
          return (
            <div key={d.getTime()} className="tg-col">
              {hours.map((h, hi) => (
                <div key={h} className="tg-hourline" style={{ top: hi * GRID_HOUR_HEIGHT }} />
              ))}
              {dayToday && nowMinutes >= GRID_HOUR_START * 60 && nowMinutes <= GRID_HOUR_END * 60 && (
                <div className="tg-now" style={{ top: ((nowMinutes - GRID_HOUR_START * 60) / 60) * GRID_HOUR_HEIGHT }} />
              )}
              {dayItems.map((it) => (
                <div
                  key={`${it.kind}-${it.id}`}
                  className={"tg-event" + (it.kind === "task" ? " task" : "")}
                  style={{
                    top: ((it.startMinutes - GRID_HOUR_START * 60) / 60) * GRID_HOUR_HEIGHT,
                    height: GRID_HOUR_HEIGHT - 4,
                    ...taskStyle(it),
                  }}
                >
                  <span className="tg-event-name">{it.name}</span>
                  <span className="tg-event-time">{formatClock(it.startMinutes)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The multi-view calendar — Day / 3-Day / Week / Month / Agenda, with an
 * All/Events/To-dos filter, built against the live API rather than the
 * design prototype's mock data (see docs/ROADMAP.md's Phase 2 list, and
 * design/project/calendar-view.jsx for the prototype this ports).
 *
 * Deliberately view-only for this first slice, matching Home's own
 * narrower-on-purpose precedent: tapping an event or task is a no-op until
 * Event/Task Detail land, so there's nothing here to edit yet — just time
 * navigation, the sub-view switch, and the item-type filter.
 */
export function CalendarScreen() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subView, setSubView] = useState<CalendarSubView>("week");
  const [itemFilter, setItemFilter] = useState<CalendarItemFilter>("all");
  const today = startOfDay(new Date());
  const [anchor, setAnchor] = useState<Date>(today);
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  useEffect(() => {
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
          setError(err instanceof Error ? err.message : "failed to load your calendar");
        }
      } finally {
        setLoaded(true);
      }
    }
    void load();
  }, []);

  if (!loaded) return <div className="screen" />;

  const now = new Date();
  const listsById = new Map(lists.map((l) => [l.id, l]));
  const items = buildCalendarItems(events, tasks, itemFilter);

  function goToday() {
    setAnchor(today);
    setSelectedDate(today);
  }

  const tabsRow = <div className="cal-subtabs-row">{<SegTabs items={SUB_VIEWS} active={subView} onChange={setSubView} />}</div>;
  const filterRow = <div className="cal-filter-row">{<SegTabs items={ITEM_FILTERS} active={itemFilter} onChange={setItemFilter} />}</div>;

  return (
    <div className="screen">
      <div className="topbar">
        <div>
          <h1>Calendar</h1>
          <div className="sub">Events and to-dos, together</div>
        </div>
      </div>

      {offline && <p className="status-banner">Offline — showing the last cached calendar. Changes need a connection.</p>}
      {error && <p className="status-banner error">{error}</p>}

      <div className="cal-view">
        {tabsRow}
        {filterRow}
        {subView === "agenda" ? (
          <AgendaView items={items} listsById={listsById} now={now} />
        ) : (
          <>
            <CalHeader
              label={headerLabel(subView, anchor)}
              onPrev={() => setAnchor(shiftAnchor(subView, anchor, -1))}
              onNext={() => setAnchor(shiftAnchor(subView, anchor, 1))}
              onToday={goToday}
            />
            {subView === "month" ? (
              <>
                <MonthGrid anchor={anchor} items={items} listsById={listsById} selectedDate={selectedDate} onSelect={setSelectedDate} now={now} />
                <AgendaDayList date={selectedDate} items={items} listsById={listsById} now={now} />
              </>
            ) : (
              <TimeGrid days={viewDays(subView, anchor)!} items={items} listsById={listsById} now={now} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
