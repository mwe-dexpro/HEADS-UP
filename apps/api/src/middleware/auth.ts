import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";
import type { AuthVariables, Env } from "../types.js";

/**
 * Verifies the `Authorization: Bearer <jwt>` header and sets `userId`/
 * `userEmail` in context. Every data route reads `userId` from *this*, never
 * from a request body or query param — a client-supplied user id is never
 * trusted (see docs/THREAT-MODEL.md "Tampering" — this is what closes IDOR).
 */
export function requireAuth(): MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> {
  return async (c, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) {
      return c.json({ error: "missing bearer token" }, 401);
    }
    try {
      const claims = await verifyAccessToken(c.env.JWT_SIGNING_KEY, token);
      c.set("userId", claims.sub);
      c.set("userEmail", claims.email);
    } catch {
      // Generic message — don't tell the caller *why* verification failed
      // (expired vs. malformed vs. wrong signature); see THREAT-MODEL.md
      // "Information disclosure".
      return c.json({ error: "invalid or expired token" }, 401);
    }
    await next();
  };
}
