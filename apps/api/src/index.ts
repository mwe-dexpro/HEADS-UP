import { Hono } from "hono";
import authRoutes from "./routes/auth.js";
import eventsRoutes from "./routes/events.js";
import listsRoutes from "./routes/lists.js";
import meRoutes from "./routes/me.js";
import tasksRoutes from "./routes/tasks.js";
import { corsMiddleware } from "./middleware/cors.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import type { AuthVariables, Env } from "./types.js";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use("*", securityHeaders);
app.use("*", corsMiddleware);

app.get("/", (c) => c.json({ name: "heads-up-api", ok: true }));

app.route("/auth", authRoutes);
app.route("/me", meRoutes);
app.route("/events", eventsRoutes);
app.route("/tasks", tasksRoutes);
app.route("/lists", listsRoutes);

// Generic error responses only — real detail goes to the Worker's own logs,
// never to the client. See docs/THREAT-MODEL.md "Information disclosure".
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal error" }, 500);
});

app.notFound((c) => c.json({ error: "not found" }, 404));

export default app;
