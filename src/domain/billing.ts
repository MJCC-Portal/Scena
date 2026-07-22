import { requireSupabase, callEdgeFunction } from "../services/supabase/client";
import { mapPostgresError } from "../shared/errors";

export type WorkspaceType = "personal" | "team";
export type BillingMode = "free" | "one_time" | "subscription";
export type CheckoutOfferingCode = "personal_additional" | "plus" | "pro" | "max";

export interface Plan {
  plan_code: string;
  name: string;
  unit_amount: number | null;
  currency: string | null;
  billing_interval: string | null;
  workspace_type: WorkspaceType;
  billing_mode: BillingMode;
}

export interface CheckoutRequest {
  offering_code: CheckoutOfferingCode;
  workspace_name: string;
  workspace_slug?: string;
}

export interface CheckoutResult {
  checkout_url: string;
  checkout_session_id: string;
  offering_code: CheckoutOfferingCode;
  workspace_type: WorkspaceType;
  billing_mode: Exclude<BillingMode, "free">;
  workspace_slug: string;
  request_id: string;
}

export async function listActiveOfferings(): Promise<Plan[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("plans")
    .select("plan_code, name, unit_amount, currency, billing_interval, workspace_type, billing_mode")
    .eq("is_active", true)
    .order("unit_amount", { ascending: true });
  if (error) throw mapPostgresError(error);
  return (data ?? []) as Plan[];
}

/** Backward-compatible alias while the pricing UI moves to Workspace terminology. */
export const listActivePlans = listActiveOfferings;

export async function startWorkspaceCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
  const workspaceName = request.workspace_name.trim();
  const workspaceSlug = request.workspace_slug?.trim().toLowerCase();

  if (!workspaceName || workspaceName.length > 120) {
    throw Object.assign(new Error("Workspace name is required and must be at most 120 characters."), {
      code: "VALIDATION_FAILED",
    });
  }

  if (workspaceSlug && !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(workspaceSlug)) {
    throw Object.assign(new Error("Workspace slug must be 3-64 lowercase letters, numbers, or hyphens."), {
      code: "VALIDATION_FAILED",
    });
  }

  return callEdgeFunction<CheckoutResult>("billing-checkout", {
    offering_code: request.offering_code,
    workspace_name: workspaceName,
    ...(workspaceSlug ? { workspace_slug: workspaceSlug } : {}),
  });
}

export async function startPersonalWorkspaceCheckout(
  workspaceName: string,
  workspaceSlug?: string,
): Promise<CheckoutResult> {
  return startWorkspaceCheckout({
    offering_code: "personal_additional",
    workspace_name: workspaceName,
    workspace_slug: workspaceSlug,
  });
}

/** Backward-compatible Team helper used by the existing pricing screen. */
export async function startTeamCheckout(
  planCode: "plus" | "pro" | "max",
  teamName: string,
  teamSlug?: string,
): Promise<CheckoutResult> {
  return startWorkspaceCheckout({
    offering_code: planCode,
    workspace_name: teamName,
    workspace_slug: teamSlug,
  });
}
