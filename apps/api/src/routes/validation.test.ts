import { describe, expect, it } from "vitest";
import { createListSchema, createTaskSchema } from "./validation.js";

describe("createListSchema color", () => {
  it.each(["#abc", "#aabbcc", "#aabbccdd", "var(--accent-500)", "var(--x)"])("accepts %s", (color) => {
    expect(createListSchema.safeParse({ name: "List", color }).success).toBe(true);
  });

  it.each([
    "red", // named CSS colors aren't in the narrow allow-list
    "rgb(0,0,0)",
    "#ff", // wrong length
    "#gggggg", // not hex
    "",
    "var(--)", // no token name
    "var(bad)", // missing --
    "url(javascript:alert(1))",
    "#fff;background:url(javascript:alert(1))",
    "#fff\" onmouseover=\"alert(1)",
    "<script>alert(1)</script>",
  ])("rejects %s", (color) => {
    expect(createListSchema.safeParse({ name: "List", color }).success).toBe(false);
  });
});

describe("createTaskSchema reminders", () => {
  const base = { name: "Task" };

  it("accepts a before_due reminder with minutesBefore", () => {
    const result = createTaskSchema.safeParse({ ...base, reminders: [{ kind: "before_due", minutesBefore: 30 }] });
    expect(result.success).toBe(true);
  });

  it("rejects a before_due reminder missing minutesBefore", () => {
    const result = createTaskSchema.safeParse({ ...base, reminders: [{ kind: "before_due" }] });
    expect(result.success).toBe(false);
  });

  it("accepts an absolute reminder with at", () => {
    const result = createTaskSchema.safeParse({ ...base, reminders: [{ kind: "absolute", at: "2026-01-01T00:00:00Z" }] });
    expect(result.success).toBe(true);
  });

  it("rejects an absolute reminder missing at", () => {
    const result = createTaskSchema.safeParse({ ...base, reminders: [{ kind: "absolute" }] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 reminders", () => {
    const reminders = Array.from({ length: 21 }, () => ({ kind: "before_due" as const, minutesBefore: 10 }));
    expect(createTaskSchema.safeParse({ ...base, reminders }).success).toBe(false);
  });

  it("rejects a task name that's empty after trimming", () => {
    expect(createTaskSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an eventId that isn't a UUID", () => {
    expect(createTaskSchema.safeParse({ ...base, eventId: "not-a-uuid" }).success).toBe(false);
  });
});
