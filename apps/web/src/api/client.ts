import type { AuthTokenResponse } from "@heads-up/shared";
import { getExpiresAt, getToken, setToken } from "../auth/tokenStore";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

let refreshTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleProactiveRefresh(expiresAt: number): void {
  clearTimeout(refreshTimer);
  const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000); // refresh 60s early
  refreshTimer = setTimeout(() => {
    void refreshAccessToken();
  }, delay);
}

/**
 * Exchanges the httpOnly refresh cookie (sent automatically via
 * `credentials: "include"`, scoped server-side to Path=/auth/refresh) for a
 * new access token. Called on app load — the access token doesn't survive a
 * reload since it's memory-only — and proactively before each one expires.
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) {
      setToken(null, null);
      return false;
    }
    const data = (await res.json()) as AuthTokenResponse;
    setToken(data.accessToken, data.expiresAt);
    scheduleProactiveRefresh(data.expiresAt);
    return true;
  } catch {
    setToken(null, null);
    return false;
  }
}

export async function signOut(): Promise<void> {
  clearTimeout(refreshTimer);
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
  setToken(null, null);
}

/** Restores the proactive-refresh schedule after a token is set directly
 * (e.g. from the OAuth callback fragment) rather than via refreshAccessToken. */
export function resumeProactiveRefresh(): void {
  const exp = getExpiresAt();
  if (exp) scheduleProactiveRefresh(exp);
}

/**
 * Fetch wrapper: attaches the in-memory bearer token, and on a 401 (expired
 * or missing token) tries exactly one silent refresh-and-retry before
 * giving up — never loops.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const token = getToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  };

  let res = await doFetch();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) res = await doFetch();
  }
  return res;
}

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `request failed: ${res.status}` }));
    throw new Error(body.error ?? `request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
