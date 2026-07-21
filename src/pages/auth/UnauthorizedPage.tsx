// /unauthorized — a distinct screen for an authenticated user with no
// valid membership (MEMBERSHIP_REQUIRED) or a suspended organization
// (ORGANIZATION_SUSPENDED), separate from /login's "not signed in" case.

import { useLocation } from "react-router-dom";
import { signOut } from "../../auth/sso";

export function UnauthorizedPage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message ?? "Your account does not have access to a Scena organization.";

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
