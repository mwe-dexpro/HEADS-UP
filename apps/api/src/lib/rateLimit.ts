import { lt, sql } from "drizzle-orm";
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

  // Opportunistic cleanup: every call also drops buckets from windows
  // before this one, for every key — not just this call's own key, so the
  // whole table stays bounded rather than growing by one row per
  // (ip, route, window) forever with no TTL. One extra DELETE on a route
  // that's already rate-limited (i.e. already low-volume) is cheap; a
  // dedicated Cron Trigger would be the next step if that traffic ever
  // grows enough for this to matter — see docs/DECISIONS.md ADR-023.
  await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.windowStart, windowStart));

  return { allowed: (row?.count ?? 0) <= limit };
}
