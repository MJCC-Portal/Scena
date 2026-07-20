import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ApiError } from "./errors.ts";

export interface ManagerAuthContext {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "operator" | "viewer";
}

const MANAGER_ROLES = ["owner", "admin", "operator"] as const;

/**
 * Resolves the caller's manager identity from a bearer JWT and verifies
 * organization membership + (optionally) role, all server-side. Never
 * trusts an org_id or role claim the browser supplies directly — those
 * come only from this lookup against organization_members.
 */
export async function requireManager(
  admin: SupabaseClient,
  req: Request,
  opts: { minRole?: "owner" | "admin" | "operator" | "viewer"; requireOrgActive?: boolean } = {},
): Promise<ManagerAuthContext> {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw ApiError.unauthenticated();

  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) throw ApiError.unauthenticated();

  const { data: membership, error: memberError } = await admin
    .from("organization_members")
    .select("org_id, role, organizations(status)")
    .eq("user_id", authData.user.id)
    .limit(1)
    .maybeSingle();
  if (memberError) throw ApiError.internal(memberError.message);
  if (!membership) throw ApiError.membershipRequired();

  const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
  if ((opts.requireOrgActive ?? true) && org?.status !== "active") throw ApiError.organizationSuspended();

  const role = String(membership.role) as ManagerAuthContext["role"];
  if (opts.minRole && opts.minRole !== "viewer") {
    const allowed: readonly string[] = opts.minRole === "owner" ? ["owner"] : opts.minRole === "admin" ? ["owner", "admin"] : MANAGER_ROLES;
    if (!allowed.includes(role)) throw ApiError.forbidden(`This action requires the ${opts.minRole} role or higher.`);
  }

  return { userId: authData.user.id, orgId: String(membership.org_id), role };
}
