import type { TaskRecord } from "@heads-up/shared";
import { describe, expect, it } from "vitest";
import { bucketTask, REMINDER_PRESETS } from "./taskBuckets";

const NOW = new Date(2026, 7, 18, 9, 30); // Tue, Aug 18 2026, 9:30 AM local

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

describe("bucketTask", () => {
  it("buckets a done task regardless of its due date, labeling when it was completed", () => {
    const result = bucketTask(task({ done: true, doneAt: "2026-08-14T00:00:00" }), NOW);
    expect(result.bucket).toBe("done");
    expect(result.isToday).toBe(false);
    expect(result.dueLabel).toBe("Completed Aug 14");
  });

  it("has no bucket when there's no due date — standalone tasks stay off the Home feed until scheduled", () => {
    const result = bucketTask(task({}), NOW);
    expect(result.bucket).toBeNull();
    expect(result.dueLabel).toBeNull();
  });

  it("buckets a past due date as overdue, counting whole days", () => {
    const result = bucketTask(task({ dueAt: "2026-08-16T00:00:00" }), NOW);
    expect(result.bucket).toBe("overdue");
    expect(result.dueLabel).toBe("Overdue by 2 days");
  });

  it("singularizes 'day' when overdue by exactly one day", () => {
    const result = bucketTask(task({ dueAt: "2026-08-17T00:00:00" }), NOW);
    expect(result.dueLabel).toBe("Overdue by 1 day");
  });

  it("flags a same-day due date as today, split out of next3", () => {
    const result = bucketTask(task({ dueAt: "2026-08-18T17:00:00" }), NOW);
    expect(result.bucket).toBe("next3");
    expect(result.isToday).toBe(true);
    expect(result.dueLabel).toBe("Today · 5:00 PM");
  });

  it("omits the time suffix for a midnight (all-day) due date", () => {
    const result = bucketTask(task({ dueAt: "2026-08-18T00:00:00" }), NOW);
    expect(result.dueLabel).toBe("Today");
  });

  it("buckets 1-3 days out as next3 with a weekday label", () => {
    const result = bucketTask(task({ dueAt: "2026-08-21T00:00:00" }), NOW);
    expect(result.bucket).toBe("next3");
    expect(result.isToday).toBe(false);
    expect(result.dueLabel).toBe("Fri, Aug 21");
  });

  it("buckets 4-7 days out as nextweek", () => {
    const result = bucketTask(task({ dueAt: "2026-08-24T20:00:00" }), NOW);
    expect(result.bucket).toBe("nextweek");
    expect(result.dueLabel).toBe("Mon, Aug 24 · 8:00 PM");
  });

  it("buckets beyond 7 days as upcoming", () => {
    const result = bucketTask(task({ dueAt: "2026-09-15T00:00:00" }), NOW);
    expect(result.bucket).toBe("upcoming");
    expect(result.dueLabel).toBe("Tue, Sep 15");
  });

  it("appends a recurrence suffix when the task repeats", () => {
    const result = bucketTask(task({ dueAt: "2026-09-15T00:00:00", recurrenceRule: "quarterly" }), NOW);
    expect(result.dueLabel).toBe("Tue, Sep 15 · repeats quarterly");
  });
});

describe("REMINDER_PRESETS", () => {
  const dueAt = "2026-08-22T14:00:00.000Z";

  it("'1 week before' is 7 days of before_due minutes", () => {
    const preset = REMINDER_PRESETS.find((p) => p.label === "1 week before")!;
    expect(preset.toInput(dueAt)).toEqual({ kind: "before_due", minutesBefore: 7 * 24 * 60, at: null });
  });

  it("'1 hour before' is 60 before_due minutes", () => {
    const preset = REMINDER_PRESETS.find((p) => p.label === "1 hour before")!;
    expect(preset.toInput(dueAt)).toEqual({ kind: "before_due", minutesBefore: 60, at: null });
  });

  it("'Morning of' resolves to 8am on the due date itself, as an absolute reminder", () => {
    const preset = REMINDER_PRESETS.find((p) => p.label === "Morning of")!;
    const input = preset.toInput(dueAt);
    expect(input.kind).toBe("absolute");
    expect(input.minutesBefore).toBeNull();
    const at = new Date(input.at!);
    expect(at.getHours()).toBe(8);
    expect(at.getMinutes()).toBe(0);
    expect(at.getDate()).toBe(new Date(dueAt).getDate());
  });
});
