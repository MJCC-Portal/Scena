// Global 404 — used for both an unmatched top-level path and (via the
// /app/* catch-all child route) an unmatched manager path. Manager-looking
// unknown paths get a link back to /app/home rather than a dead end.

import { Link, useLocation } from "react-router-dom";

export function NotFoundPage() {
  const location = useLocation();
  const looksLikeManagerPath = location.pathname.startsWith("/app");
  return (
    <section style={{ padding: 24 }}>
      <div className="view-head">
        <h1>Page not found</h1>
        <p>Nothing lives at <code>{location.pathname}</code>.</p>
      </div>
      <p><Link to={looksLikeManagerPath ? "/app/home" : "/"}>{looksLikeManagerPath ? "Back to home" : "Back to Scena"}</Link></p>
    </section>
  );
}
