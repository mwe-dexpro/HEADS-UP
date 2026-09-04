import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, type Db } from "../db/client.js";
import { events, lists, reminders, tasks } from "../db/schema.js";
import { logAudit } from "../lib/audit.js";
import { newId } from "../lib/ids.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthVariables, Env } from "../types.js";
import { createTaskSchema, updateTaskSchema } from "./validation.js";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
app.use("*", requireAuth());

async function loadTaskWithReminders(db: Db, userId: string, id: string) {
  const task = await db.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.userId, userId)) });
  if (!task) return null;
  const taskReminders = await db.query.reminders.findMany({ where: eq(reminders.taskId, id) });
  return { ...task, reminders: taskReminders };
}

/** A task links to an event, a list, or neither — never both — and only to
 * one this user actually owns (otherwise a guessed id from another user's
 * data would silently attach). */
async function assertLinkOwnership(db: Db, userId: string, eventId?: string | null, listId?: string | null): Promise<string | null> {
  if (eventId && listId) return "a task can link to an event or a list, not both";
  if (eventId) {
    const owned = await db.query.events.findFirst({ where: and(eq(events.id, eventId), eq(events.userId, userId)) });
    if (!owned) return "eventId does not exist";
  }
  if (listId) {
    const owned = await db.query.lists.findFirst({ where: and(eq(lists.id, listId), eq(lists.userId, userId)) });
    if (!owned) return "listId does not exist";
  }
  return null;
}

async function replaceReminders(db: Db, taskId: string, input: { kind: "before_due" | "absolute"; minutesBefore?: number | null; at?: string | null }[]) {
  await db.delete(reminders).where(eq(reminders.taskId, taskId));
  if (input.length === 0) return;
  await db.insert(reminders).values(
    input.map((r) => ({
      id: newId(),
      taskId,
      kind: r.kind,
      minutesBefore: r.minutesBefore ?? null,
      at: r.at ?? null,
    })),
  );
}

app.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const rows = await db.query.tasks.findMany({ where: eq(tasks.userId, userId) });
  // Scoped to this user's own task ids — never an unfiltered reminders
  // scan, which would leak other users' reminder data (see
  // docs/THREAT-MODEL.md "Information disclosure").
  const taskIds = rows.map((t) => t.id);
  const userReminders = taskIds.length ? await db.query.reminders.findMany({ where: inArray(reminders.taskId, taskIds) }) : [];
  const byTask = new Map<string, typeof userReminders>();
  for (const r of userReminders) {
    if (!byTask.has(r.taskId)) byTask.set(r.taskId, []);
    byTask.get(r.taskId)!.push(r);
  }
  return c.json({ tasks: rows.map((t) => ({ ...t, reminders: byTask.get(t.id) ?? [] })) });
});

app.post("/", async (c) => {
  const parsed = createTaskSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const ownershipError = await assertLinkOwnership(db, userId, parsed.data.eventId, parsed.data.listId);
  if (ownershipError) return c.json({ error: ownershipError }, 400);

  const id = newId();
  await db.insert(tasks).values({
    id,
    userId,
    eventId: parsed.data.eventId ?? null,
    listId: parsed.data.listId ?? null,
    name: parsed.data.name,
    priority: parsed.data.priority ?? "normal",
    dueAt: parsed.data.dueAt ?? null,
    order: parsed.data.order ?? 0,
    recurrenceRule: parsed.data.recurrenceRule ?? null,
  });
  if (parsed.data.reminders?.length) await replaceReminders(db, id, parsed.data.reminders);

  return c.json({ task: await loadTaskWithReminders(db, userId, id) }, 201);
});

app.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const task = await loadTaskWithReminders(db, c.get("userId"), c.req.param("id"));
  if (!task) return c.json({ error: "not found" }, 404);
  return c.json({ task });
});

app.patch("/:id", async (c) => {
  const parsed = updateTaskSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await db.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.userId, userId)) });
  if (!existing) return c.json({ error: "not found" }, 404);

  const nextEventId = parsed.data.eventId !== undefined ? parsed.data.eventId : existing.eventId;
  const nextListId = parsed.data.listId !== undefined ? parsed.data.listId : existing.listId;
  const ownershipError = await assertLinkOwnership(db, userId, nextEventId, nextListId);
  if (ownershipError) return c.json({ error: ownershipError }, 400);

  const { reminders: reminderInput, ...taskFields } = parsed.data;
  const wasDone = existing.done;
  const willBeDone = parsed.data.done ?? wasDone;

  await db
    .update(tasks)
    .set({
      ...taskFields,
      ...(parsed.data.done !== undefined ? { done: parsed.data.done, doneAt: willBeDone && !wasDone ? new Date().toISOString() : willBeDone ? existing.doneAt : null } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  if (reminderInput) await replaceReminders(db, id, reminderInput);

  return c.json({ task: await loadTaskWithReminders(db, userId, id) });
});

app.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await db.query.tasks.findFirst({ where: and(eq(tasks.id, id), eq(tasks.userId, userId)) });
  if (!existing) return c.json({ error: "not found" }, 404);

  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  await logAudit(db, userId, "delete", "task", id);
  return c.body(null, 204);
});

export default app;
