import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthVariables, Env } from "../types.js";

const me = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

me.get("/", requireAuth(), async (c) => {
  const db = createDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(users.id, c.get("userId")) });
  if (!user) return c.json({ error: "not found" }, 404);
  return c.json({ user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } });
});

export default me;
