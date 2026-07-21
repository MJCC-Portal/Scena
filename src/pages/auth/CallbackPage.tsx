// /auth/callback — lands here after Google OAuth or an emailed sign-in
// link. supabase-js's detectSessionInUrl already exchanges the code/token
// for a session as part of client initialization; this route just waits
// for that to land (or a provider-reported error) and routes onward.
// Team-required vs. Team-present is resolved downstream by ManagerGuard,
// not here.

import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../services/supabase/client";

type Outcome = { to: "/login"; error: string } | { to: "/app/home" };

async function waitForSession(timeoutMs = 5000): Promise<Session | null> {
  const client = supabase;
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (data.session) return data.session;
  return new Promise((resolve) => {
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      sub.subscription.unsubscribe();
      resolve(session);
    });
    setTimeout(() => {
      sub.subscription.unsubscribe();
      resolve(null);
    }, timeoutMs);
  });
}

export function CallbackPage() {
  const [searchParams] = useSearchParams();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const providerError = searchParams.get("error_description") ?? searchParams.get("error");
      if (providerError) {
        if (active) setOutcome({ to: "/login", error: providerError });
        return;
      }
      const session = await waitForSession();
      if (!active) return;
      if (!session) {
        setOutcome({ to: "/login", error: "Sign-in did not complete. Try again." });
        return;
      }
      setOutcome({ to: "/app/home" });
    })();
    return () => { active = false; };
  }, [searchParams]);

  if (!outcome) return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Completing sign-in…</p></div></main>;
  if (outcome.to === "/login") return <Navigate to="/login" replace state={{ error: outcome.error }} />;
  return <Navigate to="/app/home" replace />;
}
