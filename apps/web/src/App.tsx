import { CalendarDays, ListChecks } from "lucide-react";
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthCallback } from "./auth/AuthCallback";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { Icon } from "./components/Icon";
import { CalendarScreen } from "./pages/CalendarScreen";
import { HomeScreen } from "./pages/HomeScreen";
import { SignIn } from "./pages/SignIn";

type Tab = "home" | "calendar";

const TABS: { key: Tab; label: string; icon: typeof ListChecks }[] = [
  { key: "home", label: "Home", icon: ListChecks },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
];

/** The signed-in app frame: whichever tab's screen, plus the bottom tab bar.
 * Only Home and Calendar exist so far — Lists and Settings are still open
 * Phase-2 items per docs/ROADMAP.md, same "narrower on purpose" precedent
 * Home itself was built under. */
function AppShell() {
  const [tab, setTab] = useState<Tab>("home");
  return (
    <main className="app-shell">
      {tab === "home" ? <HomeScreen /> : <CalendarScreen />}
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={"tab" + (tab === t.key ? " active" : "")}
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? "page" : undefined}
          >
            <Icon icon={t.icon} size={22} />
            {t.label}
          </button>
        ))}
      </nav>
    </main>
  );
}

function Gate() {
  const { state } = useAuth();
  if (state.status === "loading") return <p style={{ padding: 24 }}>Loading…</p>;
  return state.status === "signedIn" ? <AppShell /> : <SignIn />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/auth/complete" element={<AuthCallback />} />
        <Route path="/" element={<Gate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
