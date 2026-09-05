import { cors } from "hono/cors";
import { isAllowedOrigin } from "../lib/origins.js";
import type { Env } from "../types.js";

/**
 * CORS allow-list built from FRONTEND_ORIGINS — exact origins only, never a
 * wildcard, and `credentials: true` so the refresh cookie can be sent by
 * the browser to /auth/refresh. This is what makes the origin list a
 * security boundary rather than a convenience default (see
 * docs/THREAT-MODEL.md "Tampering"/"Spoofing").
 *
 * Reads FRONTEND_ORIGINS from `c.env` at request time (Workers bindings
 * aren't available at module load, only once a request arrives), so this is
 * a single middleware value rather than a factory.
 */
export const corsMiddleware = cors({
  origin: (origin, c) => (isAllowedOrigin(c.env as Env, origin) ? origin : null),
  credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
});
