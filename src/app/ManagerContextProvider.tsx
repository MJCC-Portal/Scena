// Organization-context boundary — loads once, at the /app guard, and is
// consumed by every nested manager page via useManagerContext(). Replaces
// the previous pattern (src/App.tsx's Harness) of loading context once and
// threading it through props; a React context achieves the same
// single-load guarantee without prop drilling through the route tree.

import { createContext, useContext } from "react";
import type { ManagerContext } from "../auth/organization-context";

export const ManagerContextReactContext = createContext<ManagerContext | null>(null);

export function ManagerContextProvider({ value, children }: { value: ManagerContext; children: React.ReactNode }) {
  return <ManagerContextReactContext.Provider value={value}>{children}</ManagerContextReactContext.Provider>;
}

/** Throws if called outside a /app route — every nested manager page is
 * guaranteed a loaded context by ManagerGuard, so a null value here means
 * a page was rendered outside its intended route tree (a bug, not a
 * runtime state to handle gracefully). */
export function useManagerContext(): ManagerContext {
  const ctx = useContext(ManagerContextReactContext);
  if (!ctx) throw new Error("useManagerContext() called outside a /app route — ManagerGuard did not run.");
  return ctx;
}
