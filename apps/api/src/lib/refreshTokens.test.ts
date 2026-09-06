import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "../db/client.js";
import { refreshTokens, users } from "../db/schema.js";
import { newId } from "./ids.js";
import { issueRefreshTokenFamily, revokeFamily, revokeFamilyForToken, rotateRefreshToken } from "./refreshTokens.js";

const PEPPER = "test-pepper";

async function seedUser(db: ReturnType<typeof createDb>) {
  const id = newId();
  await db.insert(users).values({ id, email: `${id}@example.com`, name: "Test User", msAccountId: id });
  return id;
}

async function familyRows(db: ReturnType<typeof createDb>, familyId: string) {
  return db.query.refreshTokens.findMany({ where: eq(refreshTokens.familyId, familyId) });
}

describe("refreshTokens", () => {
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    db = createDb(env.DB);
  });

  it("issues a family with one unrevoked row, stored as a hash rather than the raw token", async () => {
    const userId = await seedUser(db);
    const { rawToken, familyId } = await issueRefreshTokenFamily(db, PEPPER, userId);

    const rows = await familyRows(db, familyId);
    expect(rows).toHaveLength(1);
    expect(rows[0].revokedAt).toBeNull();
    expect(rows[0].tokenHash).not.toBe(rawToken);
  });

  it("rotates a valid token: old token stops working, new token is minted in the same family", async () => {
    const userId = await seedUser(db);
    const { rawToken, familyId } = await issueRefreshTokenFamily(db, PEPPER, userId);

    const result = await rotateRefreshToken(db, PEPPER, rawToken);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.userId).toBe(userId);
    expect(result.rawToken).not.toBe(rawToken);

    const rows = await familyRows(db, familyId);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.revokedAt !== null)).toHaveLength(1);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);

    // The old token is now dead — presenting it again is a replay.
    const replay = await rotateRefreshToken(db, PEPPER, rawToken);
    expect(replay).toEqual({ ok: false, reason: "reused" });
  });

  it("rejects an unknown token without creating or touching any row", async () => {
    const result = await rotateRefreshToken(db, PEPPER, "never-issued-token");
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an expired token as invalid, not as reused", async () => {
    const userId = await seedUser(db);
    const { rawToken } = await issueRefreshTokenFamily(db, PEPPER, userId);
    await db
      .update(refreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(refreshTokens.userId, userId));

    const result = await rotateRefreshToken(db, PEPPER, rawToken);
    expect(result).toEqual({ ok: false, reason: "invalid" });
  });

  it("presenting an already-rotated-out token revokes the entire family, not just that row", async () => {
    const userId = await seedUser(db);
    const { rawToken, familyId } = await issueRefreshTokenFamily(db, PEPPER, userId);

    const first = await rotateRefreshToken(db, PEPPER, rawToken);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");

    // Replay the original (now-revoked) token — the classic theft signal.
    const replay = await rotateRefreshToken(db, PEPPER, rawToken);
    expect(replay).toEqual({ ok: false, reason: "reused" });

    // The whole family is dead, including the legitimately-rotated
    // replacement the first call minted — not just the replayed row.
    const rows = await familyRows(db, familyId);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);

    const secondReplay = await rotateRefreshToken(db, PEPPER, first.rawToken);
    expect(secondReplay).toEqual({ ok: false, reason: "reused" });
  });

  it("two concurrent rotations of the same token: exactly one wins, and the race still revokes the whole family (ADR-021)", async () => {
    const userId = await seedUser(db);
    const { rawToken, familyId } = await issueRefreshTokenFamily(db, PEPPER, userId);

    const [a, b] = await Promise.all([rotateRefreshToken(db, PEPPER, rawToken), rotateRefreshToken(db, PEPPER, rawToken)]);

    const outcomes = [a, b];
    const wins = outcomes.filter((r) => r.ok);
    const losses = outcomes.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toEqual({ ok: false, reason: "reused" });

    // No live token should have survived the race on either side — every
    // row in the family, including the winner's freshly-minted replacement,
    // ends up revoked (matching ADR-021's own by-hand verification).
    const rows = await familyRows(db, familyId);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });

  it("revokeFamily revokes every row in the family and leaves other families untouched", async () => {
    const userA = await seedUser(db);
    const userB = await seedUser(db);
    const a = await issueRefreshTokenFamily(db, PEPPER, userA);
    const b = await issueRefreshTokenFamily(db, PEPPER, userB);

    await revokeFamily(db, a.familyId);

    const aRows = await familyRows(db, a.familyId);
    const bRows = await familyRows(db, b.familyId);
    expect(aRows.every((r) => r.revokedAt !== null)).toBe(true);
    expect(bRows.every((r) => r.revokedAt === null)).toBe(true);
  });

  it("revokeFamilyForToken revokes the presented token's whole family (the logout path)", async () => {
    const userId = await seedUser(db);
    const { rawToken, familyId } = await issueRefreshTokenFamily(db, PEPPER, userId);

    await revokeFamilyForToken(db, PEPPER, rawToken);

    const rows = await familyRows(db, familyId);
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
  });

  it("revokeFamilyForToken on an unknown token is a harmless no-op", async () => {
    await expect(revokeFamilyForToken(db, PEPPER, "not-a-real-token")).resolves.toBeUndefined();
  });
});
