import type { Dispatch, FormEventHandler, SetStateAction } from 'react';

import { ButtonLabel } from '../components/Loading';

type StringSetter = Dispatch<SetStateAction<string>>;
type BooleanSetter = Dispatch<SetStateAction<boolean>>;

type AuthViewProps = Readonly<{
  showRegister: boolean;
  setShowRegister: BooleanSetter;
  setStatus: StringSetter;
  loginEmailOrUser: string;
  setLoginEmailOrUser: StringSetter;
  loginPassword: string;
  setLoginPassword: StringSetter;
  registerEmail: string;
  setRegisterEmail: StringSetter;
  registerUsername: string;
  setRegisterUsername: StringSetter;
  registerPassword: string;
  setRegisterPassword: StringSetter;
  registerConfirmPassword: string;
  setRegisterConfirmPassword: StringSetter;
  loadingLogin: boolean;
  loadingRegister: boolean;
  onLogin: FormEventHandler<HTMLFormElement>;
  onRegister: FormEventHandler<HTMLFormElement>;
}>;

function AuthView({
  showRegister,
  setShowRegister,
  setStatus,
  loginEmailOrUser,
  setLoginEmailOrUser,
  loginPassword,
  setLoginPassword,
  registerEmail,
  setRegisterEmail,
  registerUsername,
  setRegisterUsername,
  registerPassword,
  setRegisterPassword,
  registerConfirmPassword,
  setRegisterConfirmPassword,
  loadingLogin,
  loadingRegister,
  onLogin,
  onRegister,
}: AuthViewProps) {
  return (
    <main className="single-page">
      <section className="card login-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>{showRegister ? '📝 Create Account' : '🔐 Dashboard Login'}</h2>
          <button
            type="button"
            className="small btn-secondary"
            onClick={() => {
              setShowRegister(!showRegister);
              setStatus(showRegister ? 'Sign in to dashboard account.' : 'Create a new account for dashboard access.');
            }}
          >
            {showRegister ? '← Back to Login' : '✨ Sign Up'}
          </button>
        </div>

        {!showRegister ? (
          <>
            <form onSubmit={onLogin}>
              <label>Email or Username</label>
              <input
                type="text"
                placeholder="admin@gmail.com"
                value={loginEmailOrUser}
                onChange={(event) => setLoginEmailOrUser(event.target.value)}
                required
                autoComplete="username"
              />
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="submit" disabled={loadingLogin || loadingRegister}>
                <ButtonLabel loading={loadingLogin} idle="🚀 Login" busy="Signing in..." />
              </button>
            </form>
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(99, 142, 255, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 142, 255, 0.2)',
              }}
            >
              <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                👤 <strong>New user?</strong> Click "Sign Up" to create an account
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: '1rem' }}>
              Create your account below. Your account will be pending until an admin approves it.
            </p>
            <form onSubmit={onRegister}>
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your.email@company.com"
                value={registerEmail}
                onChange={(event) => setRegisterEmail(event.target.value)}
                required
                autoComplete="email"
              />
              <label>Username</label>
              <input
                type="text"
                placeholder="Choose a username (min 3 characters)"
                value={registerUsername}
                onChange={(event) => setRegisterUsername(event.target.value)}
                required
                minLength={3}
                autoComplete="username"
              />
              <label>Password</label>
              <input
                type="password"
                placeholder="Create a password (min 4 characters)"
                value={registerPassword}
                onChange={(event) => setRegisterPassword(event.target.value)}
                required
                minLength={4}
                autoComplete="new-password"
              />
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={registerConfirmPassword}
                onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                required
                minLength={4}
                autoComplete="new-password"
              />
              <button type="submit" className="btn-success" disabled={loadingRegister || loadingLogin}>
                <ButtonLabel loading={loadingRegister} idle="✨ Register" busy="Creating account..." />
              </button>
            </form>
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>
                ℹ️ After registration, your account will be <strong>pending approval</strong>.
                <br />
                👑 An admin will review and approve your account before you can access the dashboard.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export { AuthView };
