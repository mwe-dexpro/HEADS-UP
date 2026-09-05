import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";

// Carries `state`/`nonce`/`codeVerifier` across the redirect to Microsoft and
// back — Workers have no server-side session to stash these in between the
// two requests, so they ride in a short-lived cookie instead. SameSite=Lax
// is enough (and safer than None) because it's only ever read back on the
// top-level GET redirect Microsoft sends the browser on; it never needs to
// accompany a cross-site fetch/XHR.
const COOKIE_NAME = "hu_oauth_txn";

interface OAuthTxn {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** The origin that started sign-in, validated against FRONTEND_ORIGINS at
   * /microsoft/start (see routes/auth.ts). The callback redirects back to
   * *this*, not to FRONTEND_ORIGINS[0] — with more than one allowed origin
   * (a second frontend, a future Capacitor WebView origin in Phase 4),
   * always redirecting to index 0 would silently strand anyone who signed
   * in from a different one. See docs/DECISIONS.md ADR-022. */
  origin: string;
}

export function setOAuthTxnCookie(c: Context, txn: OAuthTxn): void {
  setCookie(c, COOKIE_NAME, JSON.stringify(txn), {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/auth",
    maxAge: 600, // 10 minutes — plenty for an interactive sign-in
  });
}

export function readAndClearOAuthTxnCookie(c: Context): OAuthTxn | null {
  const raw = getCookie(c, COOKIE_NAME);
  deleteCookie(c, COOKIE_NAME, { path: "/auth" });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.state === "string" &&
      typeof parsed.nonce === "string" &&
      typeof parsed.codeVerifier === "string" &&
      typeof parsed.origin === "string"
    ) {
      return parsed as OAuthTxn;
    }
  } catch {
    /* fall through */
  }
  return null;
}
