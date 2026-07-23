// Global 404 — used for both an unmatched top-level path and (via the
// /app/* catch-all child route) an unmatched manager path. Manager-looking
// unknown paths get a link back to /app/home rather than a dead end.
// Deliberately playful: grain, a bobbing gradient 404, and drifting brand
// petals (all motion off under prefers-reduced-motion).

import { Link, useLocation } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { ScenaMark } from "../../components/brand/ScenaMark";

const PETALS = [
  { size: 38, top: "14%", left: "9%", duration: "13s", opacity: 0.45 },
  { size: 22, top: "24%", left: "82%", duration: "9s", opacity: 0.6 },
  { size: 52, top: "68%", left: "12%", duration: "16s", opacity: 0.3 },
  { size: 28, top: "76%", left: "78%", duration: "11s", opacity: 0.5 },
  { size: 16, top: "42%", left: "90%", duration: "8s", opacity: 0.55 },
  { size: 20, top: "58%", left: "4%", duration: "10s", opacity: 0.4 },
];

export function NotFoundPage() {
  const location = useLocation();
  const looksLikeManagerPath = location.pathname.startsWith("/app");
  return (
    <div className="scena-void">
      <div className="scena-void__noise" aria-hidden="true" />
      {PETALS.map((petal, index) => (
        <span
          key={index}
          className="scena-void__petal"
          aria-hidden="true"
          style={{
            top: petal.top,
            left: petal.left,
            opacity: petal.opacity,
            ["--petal-duration" as string]: petal.duration,
          }}
        >
          <ScenaMark size={petal.size} color="var(--scena-brand)" />
        </span>
      ))}
      <div className="scena-void__code" aria-hidden="true">404</div>
      <h1>Page not found</h1>
      <p className="scena-void__desc">
        Nothing lives at <code>{location.pathname}</code> — maybe it drifted off the Board.
      </p>
      <Link to={looksLikeManagerPath ? "/app/home" : "/"}>
        <Button variant="primary">{looksLikeManagerPath ? "Back to home" : "Back to Scena"}</Button>
      </Link>
    </div>
  );
}
