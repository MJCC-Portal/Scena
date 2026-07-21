// Authenticated-account guard for everything under /app. Loads context
// exactly once per mount (React Router keeps this component mounted
// across nested navigation), and is the single place that decides
// /login vs. rendering the guarded subtree. An authenticated account with
// no Team is not an error — it renders TeamRequiredPage instead of the
// legacy Team-scoped page tree. Only a genuine failure to load context
// (e.g. a database error) goes to /unauthorized.
//
// The decision itself (resolveGuardState) is a plain async function, kept
// separate from the component so it's directly unit-testable without
// mounting a router — see src/app/authDecisions.test.ts.

import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import { loadAccountContext, toManagerContext, type AccountContext } from "../auth/organization-context";
import { ManagerContextProvider } from "./ManagerContextProvider";
import { TeamRequiredPage } from "../pages/auth/TeamRequiredPage";

export type GuardState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }
  | { status: "ready"; account: AccountContext };

export async function resolveGuardState(): Promise<GuardState> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  if (!data.session) return { status: "unauthenticated" };
  try {
    const account = await loadAccountContext();
    return { status: "ready", account };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Access unavailable." };
  }
}

export function ManagerGuard() {
  const [state, setState] = useState<GuardState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    resolveGuardState().then((next) => { if (active) setState(next); });

    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!session && active) setState({ status: "unauthenticated" });
    });
    return () => { active = false; listener?.data.subscription.unsubscribe(); };
  }, []);

  if (state.status === "loading") {
    return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Loading your Scena account…</p></div></main>;
  }
  if (state.status === "unauthenticated") return <Navigate to="/login" replace />;
  if (state.status === "error") return <Navigate to="/unauthorized" replace state={{ message: state.message }} />;

  const managerContext = toManagerContext(state.account);
  if (!managerContext) return <TeamRequiredPage />;

  return (
    <ManagerContextProvider value={managerContext}>
      <Outlet />
    </ManagerContextProvider>
  );
}
