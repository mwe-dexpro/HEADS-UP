import { sql } from "drizzle-orm";
import type { Context } from "hono";
import type { Db } from "../db/client.js";
import { rateLimitBuckets } from "../db/schema.js";

/** Cloudflare sets this on every request; it can't be spoofed by the client
 * the way an X-Forwarded-For header could. */
export function clientIp(c: Context): string {
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

/**
 * Fixed-window request counter. Used on /auth/* to blunt brute-force and
 * credential/token abuse (docs/THREAT-MODEL.md "Denial of service").
 * One upsert per call — `ON CONFLICT DO UPDATE ... RETURNING` makes the
 * increment-and-read atomic without a separate transaction.
 */
export async function checkRateLimit(db: Db, key: string, limit: number, windowMs: number): Promise<{ allowed: boolean }> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });
  return { allowed: (row?.count ?? 0) <= limit };
}
