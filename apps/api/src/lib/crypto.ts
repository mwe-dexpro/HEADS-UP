// Primitives used by the auth flow. Deliberately thin wrappers over the
// platform's Web Crypto — no hand-rolled algorithms here, only encoding.

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of buf) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A high-entropy opaque token — used for refresh tokens and PKCE verifiers/state/nonce. */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toBase64Url(arr);
}

/**
 * HMAC-SHA256 of `value` keyed by `pepper`, hex-encoded. Used to store
 * refresh tokens as a peppered hash rather than raw — see
 * docs/THREAT-MODEL.md "Information disclosure": a dumped table alone
 * cannot be replayed without also having the pepper (a Worker secret).
 */
export async function hmacSha256Hex(pepper: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** PKCE code_challenge = BASE64URL(SHA256(code_verifier)), per RFC 7636. */
export async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(digest);
}
