// Route-level error element for /app — catches render/loader exceptions
// in the manager route tree without white-screening the whole app.
// Renders a recoverable error, not a raw stack trace or backend message.

import { Link, useRouteError } from "react-router-dom";
import { ApiError } from "../shared/errors";
import { Button } from "../components/ui/Button";
import { ScenaMark } from "../components/brand/ScenaMark";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof ApiError ? error.message : "Something went wrong loading this page.";

  return (
    <div className="scena-void">
      <div className="scena-void__noise" aria-hidden="true" />
      <span className="scena-void__petal" aria-hidden="true" style={{ top: "18%", left: "12%", opacity: 0.35, ["--petal-duration" as string]: "14s" }}>
        <ScenaMark size={44} color="var(--scena-brand)" />
      </span>
      <span className="scena-void__petal" aria-hidden="true" style={{ top: "70%", left: "82%", opacity: 0.45, ["--petal-duration" as string]: "10s" }}>
        <ScenaMark size={26} color="var(--scena-brand)" />
      </span>
      <ScenaMark size={56} color="var(--scena-brand)" />
      <h1>Application error</h1>
      <p className="scena-void__desc">{message}</p>
      <Link to="/app/home">
        <Button variant="primary">Back to home</Button>
      </Link>
    </div>
  );
}
