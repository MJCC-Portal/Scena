// Kiosk route error boundary — must never leave the screen permanently
// blank. Attempts to render the last cached "showing" state
// (readCachedDisplayState, src/lib/display.ts) if one exists; otherwise
// falls back to a minimal reconnecting message rather than a raw error.
// ScenaMark is pure presentation (no src/auth/* or src/app/* imports),
// so kiosk isolation holds.

import { useRouteError } from "react-router-dom";
import { readCachedDisplayState } from "../lib/display";
import { ScenaMark } from "../components/brand/ScenaMark";

function DisplayBrand() {
  return (
    <div className="display-brand">
      <span className="display-brand__mark"><ScenaMark size={44} /></span>
      <span className="display-brand__word">SCENA</span>
    </div>
  );
}

export function DisplayErrorBoundary() {
  useRouteError();
  const cached = readCachedDisplayState();

  if (cached?.status === "showing") {
    return (
      <div className="display-root">
        <div className="display-center">
          <DisplayBrand />
          <p className="display-dim">Showing last known content while the display recovers…</p>
        </div>
      </div>
    );
  }
  return (
    <div className="display-root">
      <div className="display-center">
        <DisplayBrand />
        <p className="display-dim">Reconnecting…</p>
      </div>
    </div>
  );
}
