// /login — Google OAuth is the primary sign-in action; a one-time email
// link is the optional secondary path (docs/AUTHENTICATION.md). No MJCC
// portal launch, no handoff fragment. Redirects to /app/home if already
// authenticated.

import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { GoogleLogo } from "@phosphor-icons/react";
import { sendEmailSignInLink, signInWithGoogle } from "../../auth/session";
import { resolveManagerDestination } from "../../app/authResolution";
import { Button } from "../../components/ui/Button";
import { ScenaMark } from "../../components/brand/ScenaMark";
import { Field } from "../../components/ui/Field";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Progress";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

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

  if (!checked) {
    return (
      <main className="scena-auth-shell">
        <div className="scena-auth-card scena-glass-medium">
          <Spinner />
        </div>
      </main>
    );
  }
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
    <main className="scena-auth-shell">
      <section className="scena-auth-card scena-glass-medium">
        <div className="scena-auth-card__logo" aria-hidden="true"><ScenaMark size={26} color="#fff" /></div>
        <h1>Sign in to Scena</h1>
        <p className="scena-auth-card__desc">Sign in with Google, or with a one-time email link.</p>

        {(passedError || formError) && (
          <div style={{ marginBottom: 20, textAlign: "left" }}>
            <ErrorBanner error={new Error(passedError || formError)} title="Sign-in failed" />
          </div>
        )}

        <Button variant="primary" block size="lg" icon={<GoogleLogo size={20} weight="bold" />} onClick={handleGoogleSignIn}>
          Continue with Google
        </Button>

        {magicLinkSent ? (
          <p className="scena-auth-card__fine">Check {email} for a sign-in link.</p>
        ) : (
          <>
            <div className="scena-auth-divider">or</div>
            <form onSubmit={handleEmailSignIn} className="scena-auth-form">
              <Field label="Email">
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Button type="submit" variant="secondary" block disabled={submitting} loading={submitting}>
                Email me a sign-in link
              </Button>
            </form>
          </>
        )}

        <p className="scena-auth-card__fine">Scena accounts are personal — you can create or join a Team after signing in.</p>
      </section>
    </main>
  );
}
