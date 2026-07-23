// Lazy-loads a route's page bundle behind a shared Suspense fallback, so
// the heaviest/least-common screens (the Board editor, legacy content
// pages, the internal dev showcase) don't ship in the main bundle every
// visitor downloads.
import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { Spinner } from "../components/ui/Progress";

function RouteFallback() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
      <Spinner />
    </div>
  );
}

export function lazyRoute(load: () => Promise<{ default: ComponentType<Record<string, never>> }>) {
  const Loaded = lazy(load);
  return (
    <Suspense fallback={<RouteFallback />}>
      <Loaded />
    </Suspense>
  );
}
