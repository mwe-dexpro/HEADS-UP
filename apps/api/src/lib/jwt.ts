import { importJWK, jwtVerify, SignJWT, type JWK } from "jose";

const ALG = "ES256";
const ISSUER = "heads-up-api";
const AUDIENCE = "heads-up-web";

export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
}

/** The private JWK's public half — `d` (the private scalar) dropped. Safe
 * to derive at request time; verification only ever needs x/y/crv/kty. */
function toPublicJwk(privateJwk: JWK): JWK {
  const { d: _d, ...pub } = privateJwk;
  return pub;
}

function parseSigningKey(jwtSigningKey: string): JWK {
  try {
    return JSON.parse(jwtSigningKey) as JWK;
  } catch {
    throw new Error("JWT_SIGNING_KEY is not valid JSON — expected a private EC JWK. Run `npm run keys:generate`.");
  }
}

// The secret is static for an isolate's whole lifetime, but every
// authenticated request (every /me, /tasks, /events, /lists call) used to
// re-run JSON.parse + a fresh async crypto.subtle.importKey for it — real,
// repeated work on the hottest path in the app, for a value that never
// changes. Cached per isolate the same way Microsoft's remote JWKS already
// is (lib/microsoft.ts's getJwks). Keyed by the raw secret string rather
// than unconditionally singleton-cached so a changed secret (a different
// value passed in, however that would happen) can't silently reuse a stale
// imported key.
const signKeyCache = new Map<string, Promise<Awaited<ReturnType<typeof importJWK>>>>();
const verifyKeyCache = new Map<string, Promise<Awaited<ReturnType<typeof importJWK>>>>();

function getSignKey(jwtSigningKey: string) {
  let key = signKeyCache.get(jwtSigningKey);
  if (!key) {
    key = importJWK(parseSigningKey(jwtSigningKey), ALG);
    signKeyCache.set(jwtSigningKey, key);
  }
  return key;
}

function getVerifyKey(jwtSigningKey: string) {
  let key = verifyKeyCache.get(jwtSigningKey);
  if (!key) {
    key = importJWK(toPublicJwk(parseSigningKey(jwtSigningKey)), ALG);
    verifyKeyCache.set(jwtSigningKey, key);
  }
  return key;
}

export async function signAccessToken(
  jwtSigningKey: string,
  claims: AccessTokenClaims,
  expiresInSeconds: number,
): Promise<{ token: string; expiresAt: number }> {
  const key = await getSignKey(jwtSigningKey);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  const token = await new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: exp * 1000 };
}

export async function verifyAccessToken(jwtSigningKey: string, token: string): Promise<AccessTokenClaims> {
  const key = await getVerifyKey(jwtSigningKey);
  const { payload } = await jwtVerify(token, key, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: [ALG],
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("access token missing required claims");
  }
  return { sub: payload.sub, email: payload.email };
}
