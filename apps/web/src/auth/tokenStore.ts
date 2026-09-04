// The access token lives here — a module-level variable, not React state,
// and never localStorage/sessionStorage/a cookie. See docs/THREAT-MODEL.md
// "Information disclosure": it's gone on tab close/reload (by design — a
// silent refresh restores it, see api/client.ts) and can't be exfiltrated by
// a passive cookie-riding CSRF request the way a cookie-based session could.

let accessToken: string | null = null;
let expiresAt: number | null = null;

type Listener = (signedIn: boolean) => void;
const listeners = new Set<Listener>();

export function setToken(token: string | null, exp: number | null): void {
  accessToken = token;
  expiresAt = exp;
  for (const l of listeners) l(token !== null);
}

export function getToken(): string | null {
  return accessToken;
}

export function getExpiresAt(): number | null {
  return expiresAt;
}

export function onAuthChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
