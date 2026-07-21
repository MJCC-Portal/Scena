// /unauthorized — reached only for a genuine error resolving account
// context (e.g. a database error), not for "signed in with no Team"
// (that's TeamRequiredPage, reached from inside ManagerGuard instead).

import { useLocation } from "react-router-dom";
import { signOut } from "../../auth/session";

export function UnauthorizedPage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message ?? "Your Scena account could not be loaded.";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
        <h1>Access unavailable</h1>
        <p className="muted">{message}</p>
        <button className="btn" onClick={() => signOut()}>Sign out</button>
      </section>
    </main>
  );
}
