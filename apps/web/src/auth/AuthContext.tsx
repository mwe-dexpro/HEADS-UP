import type { User } from "@heads-up/shared";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiJson, refreshAccessToken, signOut as apiSignOut } from "../api/client";
import { clearSecureCache } from "../cache/secureCache";

type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; user: User };

interface AuthContextValue {
  state: AuthState;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The access token doesn't survive a reload (memory-only, by design —
      // see auth/tokenStore.ts) so every fresh load tries a silent refresh
      // against the httpOnly cookie before deciding the user is signed out.
      const ok = await refreshAccessToken();
      if (cancelled) return;
      if (!ok) {
        setState({ status: "signedOut" });
        return;
      }
      try {
        const me = await apiJson<{ user: User }>("/me");
        if (!cancelled) setState({ status: "signedIn", user: me.user });
      } catch {
        if (!cancelled) setState({ status: "signedOut" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function signIn() {
    const { url } = await apiJson<{ url: string }>("/auth/microsoft/start", { method: "POST" });
    window.location.href = url;
  }

  async function signOut() {
    await apiSignOut();
    await clearSecureCache();
    setState({ status: "signedOut" });
  }

  return <AuthContext.Provider value={{ state, signIn, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
