import { Navigate, Route, Routes } from "react-router-dom";
import { AuthCallback } from "./auth/AuthCallback";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { SignIn } from "./pages/SignIn";
import { TasksPage } from "./pages/TasksPage";

function Gate() {
  const { state } = useAuth();
  if (state.status === "loading") return <p className="page">Loading…</p>;
  return state.status === "signedIn" ? <TasksPage /> : <SignIn />;
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
