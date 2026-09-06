import type { EventRecord, TaskRecord } from "@heads-up/shared";
import { describe, expect, it } from "vitest";
import {
  addDays,
  buildCalendarItems,
  dayGroupLabel,
  eventToCalendarItem,
  groupByDay,
  headerLabel,
  isSameDay,
  itemsOnDay,
  monthGridDays,
  shiftAnchor,
  sortByTime,
  startOfMonth,
  startOfWeek,
  taskToCalendarItem,
  viewDays,
} from "./calendarView";

const NOW = new Date(2026, 7, 18, 9, 30); // Tue, Aug 18 2026, 9:30 AM local

function event(overrides: Partial<EventRecord>): EventRecord {
  return {
    id: "e1",
    userId: "u1",
    title: "Test event",
    start: "2026-08-18T00:00:00",
    end: null,
    allDay: true,
    location: null,
    description: null,
    recurrenceRule: null,
    source: "manual",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function task(overrides: Partial<TaskRecord>): TaskRecord {
  return {
    id: "t1",
    userId: "u1",
    eventId: null,
    listId: null,
    name: "Test task",
    done: false,
    doneAt: null,
    priority: "normal",
    dueAt: null,
    order: 0,
    recurrenceRule: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    reminders: [],
    ...overrides,
  };
}

describe("startOfWeek", () => {
  it("anchors to the preceding Sunday", () => {
    // Aug 18 2026 is a Tuesday
    const ws = startOfWeek(NOW);
    expect(ws.getDay()).toBe(0);
    expect(ws.getDate()).toBe(16);
  });
});

describe("monthGridDays", () => {
  it("always returns 42 cells starting on a Sunday and covering the month", () => {
    const cells = monthGridDays(NOW);
    expect(cells).toHaveLength(42);
    expect(cells[0].getDay()).toBe(0);
    const inMonth = cells.filter((d) => d.getMonth() === startOfMonth(NOW).getMonth() && d.getFullYear() === NOW.getFullYear());
    expect(inMonth).toHaveLength(31); // August has 31 days
  });
});

describe("viewDays", () => {
  it("returns a single day for 'day'", () => {
    const days = viewDays("day", NOW);
    expect(days).toHaveLength(1);
    expect(isSameDay(days![0], NOW)).toBe(true);
  });

  it("returns 3 consecutive days starting at the anchor for 'day3'", () => {
    const days = viewDays("day3", NOW)!;
    expect(days.map((d) => d.getDate())).toEqual([18, 19, 20]);
  });

  it("returns the full Sun–Sat week for 'week'", () => {
    const days = viewDays("week", NOW)!;
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0);
    expect(days[6].getDay()).toBe(6);
  });

  it("returns null for 'month' and 'agenda'", () => {
    expect(viewDays("month", NOW)).toBeNull();
    expect(viewDays("agenda", NOW)).toBeNull();
  });
});

describe("shiftAnchor", () => {
  it("pages 'day' by one day", () => {
    expect(shiftAnchor("day", NOW, 1).getDate()).toBe(19);
    expect(shiftAnchor("day", NOW, -1).getDate()).toBe(17);
  });

  it("pages 'day3' by three days", () => {
    expect(shiftAnchor("day3", NOW, 1).getDate()).toBe(21);
  });

  it("pages 'week' by seven days", () => {
    expect(shiftAnchor("week", NOW, 1).getDate()).toBe(25);
  });

  it("pages 'month' by one calendar month, landing on the 1st", () => {
    const next = shiftAnchor("month", NOW, 1);
    expect(next.getMonth()).toBe(8); // September
    expect(next.getDate()).toBe(1);
  });
});

describe("headerLabel", () => {
  it("renders a full month + year for 'month'", () => {
    expect(headerLabel("month", NOW)).toBe("August 2026");
  });

  it("renders the full weekday + date for 'day'", () => {
    expect(headerLabel("day", NOW)).toBe("Tuesday, August 18");
  });

  it("renders a date range for 'week', abbreviating the shared month once", () => {
    expect(headerLabel("week", NOW)).toBe("Aug 16–22, 2026");
  });
});

describe("dayGroupLabel", () => {
  it("labels today, tomorrow, and yesterday relative to `now`", () => {
    expect(dayGroupLabel(NOW, NOW)).toBe("Today · Tuesday, August 18");
    expect(dayGroupLabel(addDays(NOW, 1), NOW)).toBe("Tomorrow · Wednesday, August 19");
    expect(dayGroupLabel(addDays(NOW, -1), NOW)).toBe("Yesterday · Monday, August 17");
  });

  it("falls back to the plain weekday + date otherwise", () => {
    expect(dayGroupLabel(addDays(NOW, 5), NOW)).toBe("Sunday, August 23");
  });
});

describe("eventToCalendarItem", () => {
  it("treats an all-day event as having no start time", () => {
    const item = eventToCalendarItem(event({ allDay: true, start: "2026-08-18T00:00:00" }));
    expect(item.allDay).toBe(true);
    expect(item.startMinutes).toBeNull();
  });

  it("derives start (and end, when same-day) minutes for a timed event", () => {
    const item = eventToCalendarItem(event({ allDay: false, start: "2026-08-18T14:30:00", end: "2026-08-18T15:00:00" }));
    expect(item.startMinutes).toBe(14 * 60 + 30);
    expect(item.endMinutes).toBe(15 * 60);
  });

  it("leaves endMinutes null when the event's end falls on a different day", () => {
    const item = eventToCalendarItem(event({ allDay: false, start: "2026-08-18T22:00:00", end: "2026-08-19T02:00:00" }));
    expect(item.endMinutes).toBeNull();
  });
});

describe("taskToCalendarItem", () => {
  it("returns null for a standalone/undated task", () => {
    expect(taskToCalendarItem(task({ dueAt: null }))).toBeNull();
  });

  it("is all-day when the due time has no time-of-day component", () => {
    const item = taskToCalendarItem(task({ dueAt: "2026-08-18T00:00:00" }))!;
    expect(item.allDay).toBe(true);
    expect(item.startMinutes).toBeNull();
  });

  it("carries a start time when the due time has one", () => {
    const item = taskToCalendarItem(task({ dueAt: "2026-08-18T09:15:00" }))!;
    expect(item.allDay).toBe(false);
    expect(item.startMinutes).toBe(9 * 60 + 15);
  });
});

describe("buildCalendarItems", () => {
  const events = [event({ id: "e1" })];
  const tasks = [task({ id: "t1", dueAt: "2026-08-18T09:00:00" }), task({ id: "t2", dueAt: null })];

  it("includes both kinds for 'all', dropping undated tasks", () => {
    const items = buildCalendarItems(events, tasks, "all");
    expect(items.map((i) => i.id)).toEqual(["e1", "t1"]);
  });

  it("includes only events for 'events'", () => {
    expect(buildCalendarItems(events, tasks, "events").map((i) => i.kind)).toEqual(["event"]);
  });

  it("includes only dated tasks for 'tasks'", () => {
    expect(buildCalendarItems(events, tasks, "tasks").map((i) => i.id)).toEqual(["t1"]);
  });
});

describe("itemsOnDay / sortByTime / groupByDay", () => {
  const items = buildCalendarItems(
    [event({ id: "e1", allDay: false, start: "2026-08-18T08:00:00" })],
    [
      task({ id: "t1", dueAt: "2026-08-18T07:00:00" }),
      task({ id: "t2", dueAt: "2026-08-19T00:00:00" }),
    ],
    "all",
  );

  it("filters to a single day", () => {
    expect(itemsOnDay(items, NOW).map((i) => i.id).sort()).toEqual(["e1", "t1"]);
  });

  it("sorts by start time, with untimed items first", () => {
    const day = itemsOnDay(items, NOW);
    expect(sortByTime(day).map((i) => i.id)).toEqual(["t1", "e1"]);
  });

  it("groups into chronologically-ordered day buckets", () => {
    const groups = groupByDay(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(["t1", "e1"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["t2"]);
  });
});
