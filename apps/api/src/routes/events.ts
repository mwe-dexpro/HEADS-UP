import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db/client.js";
import { events } from "../db/schema.js";
import { logAudit } from "../lib/audit.js";
import { newId } from "../lib/ids.js";
import { findOwned } from "../lib/ownership.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthVariables, Env } from "../types.js";
import { createEventSchema, updateEventSchema } from "./validation.js";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db.query.events.findMany({ where: eq(events.userId, c.get("userId")) });
  return c.json({ events: rows });
});

app.post("/", async (c) => {
  const parsed = createEventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const [row] = await db
    .insert(events)
    .values({
      id: newId(),
      userId,
      title: parsed.data.title,
      start: parsed.data.start,
      end: parsed.data.end ?? null,
      allDay: parsed.data.allDay ?? false,
      location: parsed.data.location ?? null,
      description: parsed.data.description ?? null,
      recurrenceRule: parsed.data.recurrenceRule ?? null,
    })
    .returning();
  return c.json({ event: row }, 201);
});

app.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const row = await findOwned((where) => db.query.events.findFirst({ where }), events.id, events.userId, c.req.param("id"), c.get("userId"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ event: row });
});

app.patch("/:id", async (c) => {
  const parsed = updateEventSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await findOwned((where) => db.query.events.findFirst({ where }), events.id, events.userId, id, userId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const [row] = await db
    .update(events)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning();
  return c.json({ event: row });
});

app.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await findOwned((where) => db.query.events.findFirst({ where }), events.id, events.userId, id, userId);
  if (!existing) return c.json({ error: "not found" }, 404);

  // Cascades to the event's tasks (see schema.ts) — an event's tasks don't
  // outlive it, matching the design (a task's due-in-advance timeline only
  // makes sense relative to the event it's for).
  await db.delete(events).where(and(eq(events.id, id), eq(events.userId, userId)));
  await logAudit(db, userId, "delete", "event", id);
  return c.body(null, 204);
});

export default app;
