// / — decides the correct destination for a plain visit to the app root.
// There is no MJCC handoff fragment to consume here anymore: Supabase Auth
// (Google OAuth or the email link) always lands the browser on
// /auth/callback, never on bare `/`. This route only has to answer
// "signed in or not" and hand off to ManagerGuard for everything else.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { resolveManagerDestination, type ManagerDestination } from "./authResolution";

export function RootRoute() {
  const [destination, setDestination] = useState<ManagerDestination | null>(null);

  useEffect(() => {
    let active = true;
    resolveManagerDestination().then((dest) => { if (active) setDestination(dest); });
    return () => { active = false; };
  }, []);

  if (!destination) {
    return <main className="auth-shell"><div className="auth-card loading-card"><div className="spinner" /></div></main>;
  }
  return <Navigate to={destination.to} replace />;
}
