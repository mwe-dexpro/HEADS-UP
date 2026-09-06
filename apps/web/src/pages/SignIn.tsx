import { useAuth } from "../auth/AuthContext";

export function SignIn() {
  const { signIn } = useAuth();
  return (
    <main className="app-shell signin-screen">
      <h1>Heads Up</h1>
      <p>Events and tasks, planned and reminded in advance.</p>
      <button className="btn btn-primary" onClick={() => void signIn()}>
        Sign in with Microsoft
      </button>
    </main>
  );
}
