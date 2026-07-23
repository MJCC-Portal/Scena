// /auth/callback — lands here after Google OAuth or an emailed sign-in
// link. Scena uses PKCE and explicitly exchanges the short-lived Auth Code
// before routing onward. Access and refresh tokens never belong in the URL.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { completeAuthRedirect } from "../../auth/session";
import { Spinner } from "../../components/ui/Progress";

type Outcome = { to: "/login"; error: string } | { to: "/app/home" };

export function CallbackPage() {
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const session = await completeAuthRedirect();
        if (!active) return;

        if (!session) {
          setOutcome({ to: "/login", error: "Sign-in did not complete. Try again." });
          return;
        }

        setOutcome({ to: "/app/home" });
      } catch (error) {
        if (!active) return;
        setOutcome({
          to: "/login",
          error: error instanceof Error ? error.message : "Sign-in did not complete. Try again.",
        });
      }
    })();

    return () => { active = false; };
  }, []);

  if (!outcome) {
    return (
      <main className="scena-auth-shell">
        <div className="scena-auth-card scena-glass-medium" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Spinner />
          <p style={{ color: "var(--scena-text-secondary)", fontSize: "var(--scena-text-sm)" }}>Completing sign-in…</p>
        </div>
      </main>
    );
  }

  if (outcome.to === "/login") {
    return <Navigate to="/login" replace state={{ error: outcome.error }} />;
  }

  return <Navigate to="/app/home" replace />;
}
