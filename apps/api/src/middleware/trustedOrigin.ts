import type { MiddlewareHandler } from "hono";
import type { Env } from "../types.js";

/**
 * CSRF defense for the two routes that rely on an ambient cookie
 * (/auth/refresh, /auth/logout): CORS alone doesn't block a simple
 * cross-site POST from being *sent* and processed, only from letting the
 * attacker's page *read* the response — for a state-changing action that's
 * not enough, since the attacker doesn't need to read anything. This
 * middleware checks the `Origin` header against the same allow-list CORS
 * uses and rejects anything else outright, belt-and-suspenders alongside
 * SameSite=None + Path-scoping on the cookie itself.
 */
export const requireTrustedOrigin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const allowed = new Set(c.env.FRONTEND_ORIGINS.split(",").map((o) => o.trim()));
  const origin = c.req.header("origin");
  if (!origin || !allowed.has(origin)) {
    return c.json({ error: "origin not allowed" }, 403);
  }
  await next();
};
