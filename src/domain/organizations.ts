import { requireSupabase } from "../services/supabase/client";
import { ApiError, mapPostgresError } from "../shared/errors";
import { requireRole, requireUuid } from "../shared/validation";

export interface Member {
  user_id: string;
  role: string;
  created_at: string;
}

export interface Entitlement {
  plan_code: string;
  max_screens_per_session: number;
}

/** Per-session capacity — the entitlement trigger enforces the screen
 * limit within a single session, not across the whole organization, so
 * "remaining capacity" only makes sense scoped to one session. */
export interface SessionScreenCapacity extends Entitlement {
  session_id: string;
  screens_in_session: number;
  remaining_screens: number;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("organization_members").select("user_id, role, created_at").eq("org_id", orgId);
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

/**
 * Add or promote a member. RLS (`organization_members_manage_admin`)
 * restricts this to owner/admin callers; we do not duplicate that check
 * client-side because it must be enforced at the database regardless of
 * what the browser believes the caller's role is.
 */
export async function upsertMember(orgId: string, userId: string, role: string): Promise<Member> {
  requireUuid(orgId, "org_id");
  requireUuid(userId, "user_id");
  requireRole(role);
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("organization_members")
    .upsert({ org_id: orgId, user_id: userId, role }, { onConflict: "org_id,user_id" })
    .select("user_id, role, created_at")
    .single();
  if (error) throw mapPostgresError(error);
  return data;
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(userId, "user_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("organization_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) throw mapPostgresError(error);
}

export async function getEntitlement(orgId: string): Promise<Entitlement> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("organization_entitlements").select("plan_code, max_screens_per_session").eq("org_id", orgId).maybeSingle();
  if (error) throw mapPostgresError(error);
  if (!data) throw ApiError.notFound("Entitlement");
  return data;
}

export async function getSessionScreenCapacity(orgId: string, sessionId: string): Promise<SessionScreenCapacity> {
  requireUuid(orgId, "org_id");
  requireUuid(sessionId, "session_id");
  const supabase = requireSupabase();
  const [entitlement, { count, error: countError }] = await Promise.all([
    getEntitlement(orgId),
    supabase
      .from("display_session_screens")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("session_id", sessionId)
      .neq("assignment_status", "removed"),
  ]);
  if (countError) throw mapPostgresError(countError);
  const inSession = count ?? 0;
  return {
    ...entitlement,
    session_id: sessionId,
    screens_in_session: inSession,
    remaining_screens: Math.max(0, entitlement.max_screens_per_session - inSession),
  };
}
