// /login — Google OAuth is the primary sign-in action; a one-time email
// link is the optional secondary path (docs/AUTHENTICATION.md). No MJCC
// portal launch, no handoff fragment. Redirects to /app/home if already
// authenticated.

import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { sendEmailSignInLink, signInWithGoogle } from "../../auth/session";
import { resolveManagerDestination } from "../../app/authResolution";

export function LoginPage() {
  const location = useLocation();
  const passedError = (location.state as { error?: string } | null)?.error ?? "";
  const [checked, setChecked] = useState(false);
  const [alreadyAuthenticated, setAlreadyAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleGoogleSignIn() {
    setFormError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Google sign-in is unavailable.");
    }
  }

  async function handleEmailSignIn(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await sendEmailSignInLink(email);
      setMagicLinkSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not send a sign-in email.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
        <h1>Sign in to Scena</h1>
        <p className="muted">Sign in with Google, or with a one-time email link.</p>
        {(passedError || formError) && <div className="error">{passedError || formError}</div>}
        <button className="btn gold" onClick={handleGoogleSignIn}>Continue with Google</button>
        {magicLinkSent ? (
          <p className="fine">Check {email} for a sign-in link.</p>
        ) : (
          <form onSubmit={handleEmailSignIn} style={{ marginTop: 16 }}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className="btn" type="submit" disabled={submitting}>Email me a sign-in link</button>
          </form>
        )}
        <p className="fine">Scena accounts are personal — you can create or join a Team after signing in.</p>
      </section>
    </main>
  );
}
