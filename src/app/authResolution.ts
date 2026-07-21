// Shared "where should this browser land" decision, used by both / and
// /login. Team membership is no longer part of this decision — an
// authenticated account is always sent to /app/home; ManagerGuard resolves
// the Team-present vs. Team-required split once it gets there (see
// src/app/ManagerGuard.tsx). This keeps the decision here to exactly two
// outcomes and unable to loop back on itself.

import { supabase } from "../services/supabase/client";

export type ManagerDestination = { to: "/login" } | { to: "/app/home" };

export async function resolveManagerDestination(): Promise<ManagerDestination> {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  return data.session ? { to: "/app/home" } : { to: "/login" };
}
