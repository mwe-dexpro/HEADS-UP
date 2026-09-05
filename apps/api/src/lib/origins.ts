import type { Env } from "../types.js";

/** `FRONTEND_ORIGINS` parsed once per call — cheap, and centralizing it
 * means the three places that need this allow-list (CORS, the CSRF Origin
 * check, and OAuth start's origin validation) can't drift on how it's
 * split/trimmed. */
export function allowedOrigins(env: Env): Set<string> {
  return new Set(env.FRONTEND_ORIGINS.split(",").map((o) => o.trim()));
}

export function isAllowedOrigin(env: Env, origin: string | undefined): origin is string {
  return !!origin && allowedOrigins(env).has(origin);
}
