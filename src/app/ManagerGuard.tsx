// Manager authentication + organization-context guard for everything
// under /app. Loads context exactly once per mount (not per nested route
// — React Router keeps this component mounted across nested navigation),
// and is the single place that decides /login vs /unauthorized vs
// rendering the guarded subtree. This replaces the auth check that used
// to live inline in src/App.tsx's root component.
//
// The decision itself (resolveGuardState) is a plain async function, kept
// separate from the component so it's directly unit-testable without
// mounting a router — see src/app/ManagerGuard.test.ts.

import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../services/supabase/client";
import { loadManagerContext, type ManagerContext } from "../auth/organization-context";
import { ManagerContextProvider } from "./ManagerContextProvider";

export type GuardState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "unauthorized"; message: string }
  | { status: "ready"; context: ManagerContext };

export async function resolveGuardState(): Promise<GuardState> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  if (!data.session) return { status: "unauthenticated" };
  try {
    const context = await loadManagerContext();
    return { status: "ready", context };
  } catch (err) {
    return { status: "unauthorized", message: err instanceof Error ? err.message : "Access unavailable." };
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
    return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Loading your MJCC workspace…</p></div></main>;
  }
  if (state.status === "unauthenticated") return <Navigate to="/login" replace />;
  if (state.status === "unauthorized") return <Navigate to="/unauthorized" replace state={{ message: state.message }} />;

  return (
    <ManagerContextProvider value={state.context}>
      <Outlet />
    </ManagerContextProvider>
  );
}
