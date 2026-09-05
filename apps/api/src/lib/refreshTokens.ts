import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { refreshTokens } from "../db/schema.js";
import { hmacSha256Hex, randomToken } from "./crypto.js";
import { newId } from "./ids.js";

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Rotating refresh tokens with reuse detection — see docs/THREAT-MODEL.md
 * "Spoofing". Every token belongs to a `familyId` created at sign-in.
 * Rotating replaces the current row; replaying a token that's already been
 * rotated out (or is otherwise unknown/expired) revokes the *entire*
 * family, forcing a fresh sign-in. That's the standard tell for token theft:
 * a legitimate client only ever presents the newest token, so a stale
 * replay means someone else has a copy.
 */

export async function issueRefreshTokenFamily(
  db: Db,
  pepper: string,
  userId: string,
): Promise<{ rawToken: string; familyId: string }> {
  const familyId = newId();
  const rawToken = await issueTokenRow(db, pepper, userId, familyId);
  return { rawToken, familyId };
}

async function issueTokenRow(db: Db, pepper: string, userId: string, familyId: string): Promise<string> {
  const rawToken = randomToken(32);
  const tokenHash = await hmacSha256Hex(pepper, rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();
  await db.insert(refreshTokens).values({
    id: newId(),
    userId,
    tokenHash,
    familyId,
    expiresAt,
  });
  return rawToken;
}

export type RotateResult = { ok: true; rawToken: string; userId: string } | { ok: false; reason: "invalid" | "reused" };

export async function rotateRefreshToken(db: Db, pepper: string, presentedRawToken: string): Promise<RotateResult> {
  const tokenHash = await hmacSha256Hex(pepper, presentedRawToken);
  const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash) });

  if (!row || new Date(row.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "invalid" };
  }
  if (row.revokedAt) {
    // This exact token was already rotated out before this request even
    // started — reuse. Revoke the whole family; whoever holds it next
    // (legitimate or not) has to sign in again.
    await revokeFamily(db, row.familyId);
    return { ok: false, reason: "reused" };
  }

  // Atomic compare-and-swap, not a plain UPDATE: the SELECT above and this
  // UPDATE are two separate statements, so two concurrent requests
  // presenting the *same* token could otherwise both pass the revokedAt
  // check above and both mint a new token from it — exactly the double-use
  // this whole scheme exists to catch, just via a race instead of a
  // deliberate replay (see docs/DECISIONS.md ADR-021). Conditioning the
  // UPDATE on `revoked_at IS NULL` makes only one of the two concurrent
  // writes actually claim the row; D1/SQLite serializes writes to a
  // database, so exactly one of two racing UPDATEs returns a row and the
  // other returns none.
  const [claimed] = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
    .returning();

  if (!claimed) {
    // Lost the race — someone else (another request, legitimate or not)
    // claimed this token first. Treated the same as an explicit replay:
    // conservative, and it's the standard trade-off for rotation-with-
    // detection (a genuine double-tab reload racing itself pays the same
    // cost as an attacker would — see ADR-021's stated consequence).
    await revokeFamily(db, row.familyId);
    return { ok: false, reason: "reused" };
  }

  const rawToken = await issueTokenRow(db, pepper, row.userId, row.familyId);
  return { ok: true, rawToken, userId: row.userId };
}

export async function revokeFamily(db: Db, familyId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(refreshTokens.familyId, familyId));
}

export async function revokeFamilyForToken(db: Db, pepper: string, presentedRawToken: string): Promise<void> {
  const tokenHash = await hmacSha256Hex(pepper, presentedRawToken);
  const row = await db.query.refreshTokens.findFirst({ where: eq(refreshTokens.tokenHash, tokenHash) });
  if (row) await revokeFamily(db, row.familyId);
}
