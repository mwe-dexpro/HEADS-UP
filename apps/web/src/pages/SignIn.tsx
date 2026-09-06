import { useAuth } from "../auth/AuthContext";

export function SignIn() {
  const { signIn } = useAuth();
  return (
    <main className="page signin">
      <h1>Heads Up</h1>
      <p>Events and tasks, planned and reminded in advance.</p>
      <button onClick={() => void signIn()}>Sign in with Microsoft</button>
    </main>
  );
}
