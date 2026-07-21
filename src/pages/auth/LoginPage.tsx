// /login — preserves the existing MJCC/KpnCompute SSO launch markup from
// the pre-router src/App.tsx sign-in card verbatim; not redesigned in
// this task. Redirects to /app/home if already authenticated.

import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { mjccPortalUrl, startMjccSignIn } from "../../auth/sso";
import { resolveManagerDestination } from "../../app/authResolution";

export function LoginPage() {
  const location = useLocation();
  const passedError = (location.state as { error?: string } | null)?.error ?? "";
  const [checked, setChecked] = useState(false);
  const [alreadyAuthenticated, setAlreadyAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;
    resolveManagerDestination().then((dest) => {
      if (!active) return;
      if (dest.to === "/app/home") setAlreadyAuthenticated(true);
      setChecked(true);
    });
    return () => { active = false; };
  }, []);

  if (!checked) return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /></div></main>;
  if (alreadyAuthenticated) return <Navigate to="/app/home" replace />;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
        <h1>Sign in to Scena</h1>
        <p className="muted">Use your central MJCC account to run boards, queues, and kiosk screens.</p>
        {passedError && <div className="error">{passedError}</div>}
        <button className="btn gold" onClick={startMjccSignIn}>Continue with MJCC</button>
        <p className="fine">Managers sign in once through KpnCompute ({mjccPortalUrl}). Scena never stores a separate manager password.</p>
      </section>
    </main>
  );
}
