import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../db/client.js";
import { refreshTokens, users } from "../db/schema.js";
import { newId } from "../lib/ids.js";
import { issueRefreshTokenFamily } from "../lib/refreshTokens.js";
import auth from "./auth.js";

// Regression coverage for docs/DECISIONS.md ADR-019: the refresh cookie's
// Path has to actually reach every route that needs to read it
// (/auth/refresh *and* /auth/logout), not just the route it's named after.
// These tests exercise the real Hono routes end to end against a live D1
// instance, the same way the ADR's own by-hand verification did, rather
// than re-deriving the Path string from source.

const ORIGIN = "https://app.test.example";

async function seedSession() {
  const db = createDb(env.DB);
  const userId = newId();
  await db.insert(users).values({ id: userId, email: `${userId}@example.com`, name: "Test User", msAccountId: userId });
  const { rawToken, familyId } = await issueRefreshTokenFamily(db, env.REFRESH_TOKEN_PEPPER, userId);
  return { db, userId, rawToken, familyId };
}

function cookieHeader(name: string, value: string): string {
  return `${name}=${value}`;
}

describe("POST /auth/logout", () => {
  it("scopes the Set-Cookie clear to Path=/auth", async () => {
    const { rawToken } = await seedSession();

    const res = await auth.request(
      "/logout",
      { method: "POST", headers: { origin: ORIGIN, cookie: cookieHeader("hu_refresh", rawToken) } },
      env,
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/;\s*Path=\/auth(;|$)/i);
  });

  it("actually revokes the presented token's family, not just clearing the browser cookie", async () => {
    const { db, rawToken, familyId } = await seedSession();

    const res = await auth.request(
      "/logout",
      { method: "POST", headers: { origin: ORIGIN, cookie: cookieHeader("hu_refresh", rawToken) } },
      env,
    );
    expect(res.status).toBe(200);

    const rows = await db.query.refreshTokens.findMany({ where: eq(refreshTokens.familyId, familyId) });
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).not.toBeNull();
  });

  it("is a harmless no-op when there's no refresh cookie at all", async () => {
    const res = await auth.request("/logout", { method: "POST", headers: { origin: ORIGIN } }, env);
    expect(res.status).toBe(200);
  });
});

describe("POST /auth/refresh", () => {
  it("scopes the new Set-Cookie to Path=/auth and rotates the token", async () => {
    const { db, rawToken, familyId } = await seedSession();

    const res = await auth.request(
      "/refresh",
      { method: "POST", headers: { origin: ORIGIN, cookie: cookieHeader("hu_refresh", rawToken) } },
      env,
    );

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/;\s*Path=\/auth(;|$)/i);

    const body = (await res.json()) as { accessToken: string };
    expect(typeof body.accessToken).toBe("string");

    const rows = await db.query.refreshTokens.findMany({ where: eq(refreshTokens.familyId, familyId) });
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
  });

  it("rejects a request from an origin that isn't on the allow-list", async () => {
    const { rawToken } = await seedSession();

    const res = await auth.request(
      "/refresh",
      { method: "POST", headers: { origin: "https://evil.example", cookie: cookieHeader("hu_refresh", rawToken) } },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("rejects a request with no refresh cookie", async () => {
    const res = await auth.request("/refresh", { method: "POST", headers: { origin: ORIGIN } }, env);
    expect(res.status).toBe(401);
  });

  it("rejects a replayed (already-rotated) refresh token", async () => {
    const { rawToken } = await seedSession();

    await auth.request("/refresh", { method: "POST", headers: { origin: ORIGIN, cookie: cookieHeader("hu_refresh", rawToken) } }, env);
    const replay = await auth.request(
      "/refresh",
      { method: "POST", headers: { origin: ORIGIN, cookie: cookieHeader("hu_refresh", rawToken) } },
      env,
    );
    expect(replay.status).toBe(401);
  });
});
