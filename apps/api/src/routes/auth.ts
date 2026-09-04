import { eq } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono, type Context } from "hono";
import { createDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { pkceChallengeFromVerifier, randomToken } from "../lib/crypto.js";
import { newId } from "../lib/ids.js";
import { signAccessToken } from "../lib/jwt.js";
import { buildAuthorizeUrl, exchangeCodeForIdToken, verifyIdToken } from "../lib/microsoft.js";
import { setOAuthTxnCookie, readAndClearOAuthTxnCookie } from "../lib/oauthTxn.js";
import { checkRateLimit, clientIp } from "../lib/rateLimit.js";
import { issueRefreshTokenFamily, revokeFamilyForToken, rotateRefreshToken } from "../lib/refreshTokens.js";
import { requireTrustedOrigin } from "../middleware/trustedOrigin.js";
import type { AuthVariables, Env } from "../types.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes — see docs/DECISIONS.md ADR-003
const REFRESH_COOKIE_NAME = "hu_refresh";

const auth = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function redirectUri(env: Env): string {
  return `${env.API_BASE_URL}/auth/microsoft/callback`;
}

function setRefreshCookie(c: Context, token: string): void {
  // Path scoped to exactly this one endpoint — the cookie is never attached
  // to /events, /tasks, etc., so a leaked request log or a compromised data
  // route can't expose it. SameSite=None is required because the SPA
  // (GitHub Pages) and this API (Workers) are different origins; the Origin
  // check in requireTrustedOrigin is what actually stops cross-site misuse.
  setCookie(c, REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/auth/refresh",
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function findOrCreateUser(db: ReturnType<typeof createDb>, identity: { msAccountId: string; email: string; name: string }) {
  const existing = await db.query.users.findFirst({ where: eq(users.msAccountId, identity.msAccountId) });
  if (existing) return existing;
  const [created] = await db
    .insert(users)
    .values({ id: newId(), email: identity.email, name: identity.name, msAccountId: identity.msAccountId })
    .returning();
  return created;
}

auth.post("/microsoft/start", async (c) => {
  const { allowed } = await checkRateLimit(createDb(c.env.DB), `${clientIp(c)}:auth-start`, 20, 5 * 60 * 1000);
  if (!allowed) return c.json({ error: "too many requests" }, 429);

  const state = randomToken(16);
  const nonce = randomToken(16);
  const codeVerifier = randomToken(32);
  const codeChallenge = await pkceChallengeFromVerifier(codeVerifier);
  setOAuthTxnCookie(c, { state, nonce, codeVerifier });
  const url = buildAuthorizeUrl(c.env, { redirectUri: redirectUri(c.env), state, nonce, codeChallenge });
  return c.json({ url });
});

auth.get("/microsoft/callback", async (c) => {
  const db = createDb(c.env.DB);
  const { allowed } = await checkRateLimit(db, `${clientIp(c)}:auth-callback`, 20, 5 * 60 * 1000);
  if (!allowed) return c.json({ error: "too many requests" }, 429);

  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const txn = readAndClearOAuthTxnCookie(c);

  // Constant-shape failure: any mismatch here (missing code, missing/expired
  // txn cookie, or a state that doesn't match) is indistinguishable to the
  // caller — no hint about which check failed.
  if (!code || !txn || !returnedState || returnedState !== txn.state) {
    return c.json({ error: "invalid oauth callback" }, 400);
  }

  try {
    const idToken = await exchangeCodeForIdToken(c.env, { code, codeVerifier: txn.codeVerifier, redirectUri: redirectUri(c.env) });
    const identity = await verifyIdToken(c.env, idToken, txn.nonce);
    const user = await findOrCreateUser(db, identity);

    const { rawToken } = await issueRefreshTokenFamily(db, c.env.REFRESH_TOKEN_PEPPER, user.id);
    setRefreshCookie(c, rawToken);
    const { token, expiresAt } = await signAccessToken(c.env.JWT_SIGNING_KEY, { sub: user.id, email: user.email }, ACCESS_TOKEN_TTL_SECONDS);

    // Hand the access token back via a one-time redirect fragment rather
    // than a cookie — fragments aren't sent to the server on subsequent
    // requests or logged by intermediaries, and the SPA route that reads it
    // stores it in memory only and then drops it from the URL immediately.
    const redirect = new URL(c.env.FRONTEND_ORIGINS.split(",")[0]);
    redirect.pathname = "/auth/complete";
    redirect.hash = `access_token=${encodeURIComponent(token)}&expires_at=${expiresAt}`;
    return c.redirect(redirect.toString(), 302);
  } catch (err) {
    console.error("oauth callback failed", err);
    return c.json({ error: "sign-in failed" }, 400);
  }
});

auth.post("/refresh", requireTrustedOrigin, async (c) => {
  const db = createDb(c.env.DB);
  const { allowed } = await checkRateLimit(db, `${clientIp(c)}:auth-refresh`, 60, 5 * 60 * 1000);
  if (!allowed) return c.json({ error: "too many requests" }, 429);

  const presented = getCookie(c, REFRESH_COOKIE_NAME);
  if (!presented) return c.json({ error: "no refresh token" }, 401);

  const result = await rotateRefreshToken(db, c.env.REFRESH_TOKEN_PEPPER, presented);
  if (!result.ok) {
    deleteCookie(c, REFRESH_COOKIE_NAME, { path: "/auth/refresh" });
    return c.json({ error: "invalid refresh token" }, 401);
  }

  setRefreshCookie(c, result.rawToken);
  const user = await db.query.users.findFirst({ where: eq(users.id, result.userId) });
  if (!user) return c.json({ error: "invalid refresh token" }, 401);

  const { token, expiresAt } = await signAccessToken(c.env.JWT_SIGNING_KEY, { sub: user.id, email: user.email }, ACCESS_TOKEN_TTL_SECONDS);
  return c.json({ accessToken: token, expiresAt, user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } });
});

auth.post("/logout", requireTrustedOrigin, async (c) => {
  const presented = getCookie(c, REFRESH_COOKIE_NAME);
  if (presented) {
    await revokeFamilyForToken(createDb(c.env.DB), c.env.REFRESH_TOKEN_PEPPER, presented);
  }
  deleteCookie(c, REFRESH_COOKIE_NAME, { path: "/auth/refresh" });
  return c.json({ ok: true });
});

export default auth;
