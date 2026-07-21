import { requireSupabase, callEdgeFunction } from "../services/supabase/client";
import { mapPostgresError } from "../shared/errors";

export interface Plan {
  plan_code: string;
  name: string;
  unit_amount: number | null;
  currency: string | null;
  billing_interval: string | null;
}

export interface CheckoutResult {
  checkout_url: string;
  checkout_session_id: string;
}

export async function listActivePlans(): Promise<Plan[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("plans")
    .select("plan_code, name, unit_amount, currency, billing_interval")
    .eq("is_active", true)
    .order("unit_amount", { ascending: true });
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

export async function startTeamCheckout(planCode: string, teamName: string, teamSlug: string): Promise<CheckoutResult> {
  return callEdgeFunction<CheckoutResult>("billing-checkout", {
    plan_code: planCode,
    team_name: teamName,
    team_slug: teamSlug,
  });
}
