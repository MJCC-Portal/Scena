// Route-level error element for /app — catches render/loader exceptions
// in the manager route tree without white-screening the whole app.
// Renders a recoverable error, not a raw stack trace or backend message.

import { Link, useRouteError } from "react-router-dom";
import { ApiError } from "../shared/errors";

export function RouteErrorBoundary() {
  const error = useRouteError();
  const message = error instanceof ApiError ? error.message : "Something went wrong loading this page.";

  return (
    <section>
      <div className="view-head">
        <h1>Application error</h1>
        <p>{message}</p>
      </div>
      <p><Link to="/app/home">Back to home</Link></p>
    </section>
  );
}
