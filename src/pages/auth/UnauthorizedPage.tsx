// /unauthorized — reached for a genuine error resolving account context
// (e.g. a database error), or for a signed-in account whose Personal
// Workspace hasn't finished provisioning yet (ManagerGuard passes a
// specific message for that case via location state).

import { useLocation } from "react-router-dom";
import { signOut } from "../../auth/session";
import { Button } from "../../components/ui/Button";
import { ScenaMark } from "../../components/brand/ScenaMark";

export function UnauthorizedPage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message ?? "Your Scena account could not be loaded.";

  return (
    <main className="scena-auth-shell">
      <section className="scena-auth-card scena-glass-medium">
        <div className="scena-auth-card__logo" aria-hidden="true"><ScenaMark size={26} color="#fff" /></div>
        <h1>Access unavailable</h1>
        <p className="scena-auth-card__desc">{message}</p>
        <Button variant="secondary" block onClick={() => signOut()}>Sign out</Button>
      </section>
    </main>
  );
}
