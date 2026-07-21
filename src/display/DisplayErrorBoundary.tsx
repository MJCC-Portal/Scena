// Kiosk route error boundary — must never leave the screen permanently
// blank. Attempts to render the last cached "showing" state
// (readCachedDisplayState, src/lib/display.ts) if one exists; otherwise
// falls back to a minimal reconnecting message rather than a raw error.

import { useRouteError } from "react-router-dom";
import { readCachedDisplayState } from "../lib/display";

export function DisplayErrorBoundary() {
  useRouteError();
  const cached = readCachedDisplayState();

  if (cached?.status === "showing") {
    return (
      <div className="display-root">
        <div className="display-center">
          <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
          <p className="display-dim">Showing last known content while the display recovers…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="display-root">
      <div className="display-center">
        <div className="wordmark"><span className="bulbs" aria-hidden="true"><i /><i /><i /></span>SCENA</div>
        <p className="display-dim">Reconnecting…</p>
      </div>
    </div>
  );
}
