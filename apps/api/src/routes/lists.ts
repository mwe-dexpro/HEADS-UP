import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db/client.js";
import { lists } from "../db/schema.js";
import { logAudit } from "../lib/audit.js";
import { newId } from "../lib/ids.js";
import { findOwned } from "../lib/ownership.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthVariables, Env } from "../types.js";
import { createListSchema, updateListSchema } from "./validation.js";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
app.use("*", requireAuth());

app.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db.query.lists.findMany({ where: eq(lists.userId, c.get("userId")) });
  return c.json({ lists: rows });
});

app.post("/", async (c) => {
  const parsed = createListSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const [row] = await db
    .insert(lists)
    .values({ id: newId(), userId, name: parsed.data.name, color: parsed.data.color })
    .returning();
  return c.json({ list: row }, 201);
});

app.get("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const row = await findOwned((where) => db.query.lists.findFirst({ where }), lists.id, lists.userId, c.req.param("id"), c.get("userId"));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ list: row });
});

app.patch("/:id", async (c) => {
  const parsed = updateListSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid input" }, 400);

  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await findOwned((where) => db.query.lists.findFirst({ where }), lists.id, lists.userId, id, userId);
  if (!existing) return c.json({ error: "not found" }, 404);

  const [row] = await db
    .update(lists)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(and(eq(lists.id, id), eq(lists.userId, userId)))
    .returning();
  return c.json({ list: row });
});

app.delete("/:id", async (c) => {
  const db = createDb(c.env.DB);
  const userId = c.get("userId");
  const id = c.req.param("id");
  const existing = await findOwned((where) => db.query.lists.findFirst({ where }), lists.id, lists.userId, id, userId);
  if (!existing) return c.json({ error: "not found" }, 404);

  await db.delete(lists).where(and(eq(lists.id, id), eq(lists.userId, userId)));
  await logAudit(db, userId, "delete", "list", id);
  return c.body(null, 204);
});

export default app;
