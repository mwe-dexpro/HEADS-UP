import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { resumeProactiveRefresh } from "../api/client";
import { setToken } from "./tokenStore";

/**
 * Lands here after /auth/microsoft/callback redirects back with
 * `#access_token=...&expires_at=...`. A URL fragment, not a query string or
 * a cookie — fragments are never sent to any server (ours or an
 * intermediary's) and never appear in server logs. Read once, stored in
 * memory, then stripped from the URL immediately.
 */
export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const expiresAt = Number(params.get("expires_at"));
    if (accessToken && expiresAt) {
      setToken(accessToken, expiresAt);
      resumeProactiveRefresh();
    }
    window.history.replaceState(null, "", window.location.pathname);
    navigate("/", { replace: true });
  }, [navigate]);

  return <p>Signing in…</p>;
}
