// Rendered by ManagerGuard for an authenticated account with no active
// Team (INV-8: an account is valid with zero Teams; a Team requires a
// paid plan). Lets the user start Team checkout against the already-live
// billing-checkout Edge Function, or sign out. This is intentionally the
// full extent of "account-level" UI for now — a real plans/checkout page
// (with invitation acceptance, etc.) is Phase 3 scope in the API v2 plan.

import { useEffect, useState, type FormEvent } from "react";
import * as Billing from "../../domain/billing";
import { signOut } from "../../auth/session";

export function TeamRequiredPage() {
  const [plans, setPlans] = useState<Billing.Plan[]>([]);
  const [planCode, setPlanCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Billing.listActivePlans().then(setPlans).catch(() => {});
  }, []);

  async function startCheckout(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { checkout_url } = await Billing.startTeamCheckout(planCode, teamName, teamSlug);
      window.location.assign(checkout_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
        <h1>Create a Team to get started</h1>
        <p className="muted">
          You're signed in, but running Boards, Displays, and Sessions requires a paid Team.
        </p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={startCheckout}>
          <label>
            Plan
            <select required value={planCode} onChange={(event) => setPlanCode(event.target.value)}>
              <option value="" disabled>Choose a plan</option>
              {plans.map((plan) => (
                <option key={plan.plan_code} value={plan.plan_code}>
                  {plan.name}
                  {plan.unit_amount != null ? ` — $${(plan.unit_amount / 100).toFixed(2)}/${plan.billing_interval ?? "mo"}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Team name
            <input required value={teamName} onChange={(event) => setTeamName(event.target.value)} />
          </label>
          <label>
            Team URL slug
            <input
              required
              pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]"
              value={teamSlug}
              onChange={(event) => setTeamSlug(event.target.value.toLowerCase())}
            />
          </label>
          <button className="btn gold" type="submit" disabled={submitting}>Continue to checkout</button>
        </form>
        <button className="btn" onClick={() => signOut()} style={{ marginTop: 16 }}>Sign out</button>
      </section>
    </main>
  );
}
