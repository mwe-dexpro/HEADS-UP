import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../types.js";

// Microsoft identity platform, v2.0 endpoints. `tenant` is "common" so any
// Microsoft or Entra work/school/personal account can sign in — see
// docs/DECISIONS.md ADR-004.
function authorityBase(tenant: string): string {
  return `https://login.microsoftonline.com/${tenant}`;
}

export function buildAuthorizeUrl(env: Env, opts: { redirectUri: string; state: string; nonce: string; codeChallenge: string }): string {
  const url = new URL(`${authorityBase(env.MS_TENANT)}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", env.MS_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", opts.redirectUri);
  // openid+profile+email only — no calendar scope yet. Asking for calendar
  // access before there's a sync feature to use it would be a control that
  // does nothing; see docs/DECISIONS.md ADR-007 (Phase 3 adds it).
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", opts.state);
  url.searchParams.set("nonce", opts.nonce);
  url.searchParams.set("code_challenge", opts.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface MicrosoftTokenResponse {
  id_token: string;
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCodeForIdToken(
  env: Env,
  opts: { code: string; codeVerifier: string; redirectUri: string },
): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.codeVerifier,
  });
  const res = await fetch(`${authorityBase(env.MS_TENANT)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as MicrosoftTokenResponse;
  if (!res.ok || !data.id_token) {
    throw new Error(`Microsoft token exchange failed: ${data.error ?? res.status} ${data.error_description ?? ""}`);
  }
  return data.id_token;
}

// One JWKS fetcher per isolate, cached by `jose` internally (respects the
// endpoint's cache headers) — not re-fetched on every sign-in.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(tenant: string) {
  jwks ??= createRemoteJWKSet(new URL(`${authorityBase(tenant)}/discovery/v2.0/keys`));
  return jwks;
}

export interface MicrosoftIdentity {
  msAccountId: string;
  email: string;
  name: string;
}

/**
 * Verifies the ID token's signature, expiry, audience and nonce, and — because
 * the tenant is "common" — that the issuer is a well-formed v2.0 issuer for
 * the *same* tenant the token itself claims (`tid`), which is the standard
 * multi-tenant check in place of a single fixed issuer string.
 */
export async function verifyIdToken(env: Env, idToken: string, expectedNonce: string): Promise<MicrosoftIdentity> {
  const { payload } = await jwtVerify(idToken, getJwks(env.MS_TENANT), {
    audience: env.MS_CLIENT_ID,
  });
  const tid = payload.tid;
  if (typeof tid !== "string" || payload.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) {
    throw new Error("unexpected issuer");
  }
  if (payload.nonce !== expectedNonce) {
    throw new Error("nonce mismatch");
  }
  const sub = payload.sub;
  const email = (payload.email as string | undefined) ?? (payload.preferred_username as string | undefined);
  const name = (payload.name as string | undefined) ?? email;
  if (typeof sub !== "string" || !email || !name) {
    throw new Error("ID token missing required claims (sub/email/name)");
  }
  return { msAccountId: sub, email, name };
}
