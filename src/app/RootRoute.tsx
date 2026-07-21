// / — decides the correct destination. Handles the current real MJCC
// handoff shape (KpnCompute redirects here with `#code=...`, not to
// /auth/callback) before falling through to the normal
// authenticated/unauthenticated/unauthorized decision. See
// docs/AUTHENTICATION.md for why /auth/callback also exists as the
// preferred future target.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { consumeAndExchangeSso } from "./useSsoExchange";
import { resolveManagerDestination, type ManagerDestination } from "./authResolution";

export function RootRoute() {
  const [destination, setDestination] = useState<ManagerDestination | { to: "/login"; error: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const exchange = await consumeAndExchangeSso();
      if (exchange.outcome === "error") {
        if (active) setDestination({ to: "/login", error: exchange.message });
        return;
      }
      const dest = await resolveManagerDestination();
      if (active) setDestination(dest);
    })();
    return () => { active = false; };
  }, []);

  if (!destination) {
    return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /><p>Loading your MJCC workspace…</p></div></main>;
  }
  if (destination.to === "/login" && "error" in destination) {
    return <Navigate to="/login" replace state={{ error: destination.error }} />;
  }
  if (destination.to === "/unauthorized") return <Navigate to="/unauthorized" replace state={{ message: destination.message }} />;
  return <Navigate to={destination.to} replace />;
}
