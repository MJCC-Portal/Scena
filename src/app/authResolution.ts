// Shared "where should this browser land" decision, used by both / and
// /login so neither route duplicates the auth+membership check logic.
// Never a redirect loop: every call terminates in exactly one of three
// concrete destinations, never back into itself.

import { supabase } from "../services/supabase/client";
import { loadManagerContext } from "../auth/organization-context";

export type ManagerDestination =
  | { to: "/login" }
  | { to: "/app/home" }
  | { to: "/unauthorized"; message: string };

export async function resolveManagerDestination(): Promise<ManagerDestination> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  if (!data.session) return { to: "/login" };
  try {
    await loadManagerContext();
    return { to: "/app/home" };
  } catch (err) {
    return { to: "/unauthorized", message: err instanceof Error ? err.message : "Access unavailable." };
  }
}
