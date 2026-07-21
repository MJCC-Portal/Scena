// /auth/callback — the route to prefer once KpnCompute is reconfigured
// to redirect handoffs here directly (see docs/AUTHENTICATION.md). Shares
// its exchange logic with the root route's current real-world handling
// of the same fragment via useSsoExchange, so both paths behave
// identically and never drift.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { consumeAndExchangeSso } from "../../app/useSsoExchange";
import { resolveManagerDestination, type ManagerDestination } from "../../app/authResolution";

export function CallbackPage() {
  const [destination, setDestination] = useState<ManagerDestination | { to: "/login"; error: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const exchange = await consumeAndExchangeSso();
      if (exchange.outcome === "no_code") {
        if (active) setDestination({ to: "/login", error: "Missing sign-in code." });
        return;
      }
      if (exchange.outcome === "error") {
        if (active) setDestination({ to: "/login", error: exchange.message });
        return;
      }
      const dest = await resolveManagerDestination();
      if (active) setDestination(dest);
    })();
    return () => { active = false; };
  }, []);

  if (!destination) return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Completing sign-in…</p></div></main>;
  if (destination.to === "/login") return <Navigate to="/login" replace state={{ error: "error" in destination ? destination.error : undefined }} />;
  if (destination.to === "/unauthorized") return <Navigate to="/unauthorized" replace state={{ message: destination.message }} />;
  return <Navigate to={destination.to} replace />;
}
