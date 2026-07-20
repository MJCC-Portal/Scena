import { requireSupabase } from "../services/supabase/client";
import { ApiError, mapPostgresError } from "../shared/errors";
import type { Role } from "../shared/validation";

export interface ManagerOrganization {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
}

export interface ManagerContext {
  userId: string;
  organization: ManagerOrganization;
  role: Role;
}

/**
 * Loads the signed-in manager's organization + role. A user may in
 * principle hold memberships in more than one organization; today's MJCC
 * bridge only ever provisions one, so we resolve the first active one and
 * surface ORGANIZATION_SUSPENDED / MEMBERSHIP_REQUIRED distinctly so the
 * caller can render the right message instead of a generic failure.
 */
export async function loadManagerContext(): Promise<ManagerContext> {
  const supabase = requireSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw ApiError.unauthenticated();

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("org_id, role, organizations(id, name, slug, status)")
    .order("created_at", { ascending: true });
  if (membershipError) throw mapPostgresError(membershipError);
  if (!memberships || memberships.length === 0) throw ApiError.membershipRequired();

  const active = memberships.find((m) => {
    const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
    return org?.status === "active";
  });
  if (!active) throw ApiError.organizationSuspended();

  const org = Array.isArray(active.organizations) ? active.organizations[0] : active.organizations;
  if (!org) throw ApiError.membershipRequired();

  return {
    userId: userData.user.id,
    organization: { id: org.id, name: org.name, slug: org.slug, status: org.status as "active" | "suspended" },
    role: active.role as Role,
  };
}

export function canManage(role: Role): boolean {
  return role !== "viewer";
}
export function isAdmin(role: Role): boolean {
  return role === "owner" || role === "admin";
}
export function isOwner(role: Role): boolean {
  return role === "owner";
}
