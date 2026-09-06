import { Navigate, Route, Routes } from "react-router-dom";
import { AuthCallback } from "./auth/AuthCallback";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { HomeScreen } from "./pages/HomeScreen";
import { SignIn } from "./pages/SignIn";

function Gate() {
  const { state } = useAuth();
  if (state.status === "loading") return <p style={{ padding: 24 }}>Loading…</p>;
  return state.status === "signedIn" ? <HomeScreen /> : <SignIn />;
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
