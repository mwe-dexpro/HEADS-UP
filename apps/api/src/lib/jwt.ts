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

export async function signAccessToken(
  jwtSigningKey: string,
  claims: AccessTokenClaims,
  expiresInSeconds: number,
): Promise<{ token: string; expiresAt: number }> {
  const jwk = parseSigningKey(jwtSigningKey);
  const key = await importJWK(jwk, ALG);
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
  const jwk = parseSigningKey(jwtSigningKey);
  const key = await importJWK(toPublicJwk(jwk), ALG);
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
