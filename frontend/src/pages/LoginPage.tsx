import type { FormEvent } from "react";

interface LoginPageProps {
  username: string;
  password: string;
  submitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function LoginPage({
  username,
  password,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit
}: Readonly<LoginPageProps>) {
  return (
    <section className="card login-card">
      <h2>Role Based Login</h2>
      <p>Sign in to continue. Your role controls what you can do in this application.</p>
      <form className="stack" onSubmit={onSubmit}>
        <input
          placeholder="Email"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
        />
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Signing in..." : "Login"}
        </button>
      </form>
    </section>
  );
}
