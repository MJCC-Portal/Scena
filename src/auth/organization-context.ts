// Account-context boundary. A signed-in Scena account is valid with zero
// Teams (INV-8 in the API v2 migration plan) — loadAccountContext() never
// throws for a missing Team, it returns `team: null`. The legacy /app/*
// page tree (src/domain/*, AppShellRoute and everything nested under it)
// still assumes a Team, so ManagerGuard converts a present Team into the
// original `ManagerContext` shape via toManagerContext() and only mounts
// that legacy tree once a Team exists; see src/app/ManagerGuard.tsx.

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

export interface AccountProfile {
  displayName: string;
  avatarUrl: string | null;
  onboardingState: string;
}

export interface AccountTeam extends ManagerOrganization {
  role: Role;
}

export interface AccountContext {
  userId: string;
  profile: AccountProfile;
  team: AccountTeam | null;
}

/**
 * Loads the signed-in user's profile and — if one exists — their single
 * active Team membership. A user may hold at most one active membership
 * (enforced server-side by enforce_organization_membership_invariants);
 * we still take the earliest-joined active row defensively rather than
 * assume the invariant holds for every historical row.
 */
export async function loadAccountContext(): Promise<AccountContext> {
  const supabase = requireSupabase();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw ApiError.unauthenticated();

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, onboarding_state")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profileError) throw mapPostgresError(profileError);
  if (!profileRow) throw ApiError.accountProfileRequired();

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("org_id, role, organizations(id, name, slug, status)")
    .eq("status", "active")
    .order("joined_at", { ascending: true });
  if (membershipError) throw mapPostgresError(membershipError);

  const active = memberships?.[0] ?? null;
  const org = active ? (Array.isArray(active.organizations) ? active.organizations[0] : active.organizations) : null;

  return {
    userId: userData.user.id,
    profile: {
      displayName: profileRow.display_name,
      avatarUrl: profileRow.avatar_url,
      onboardingState: profileRow.onboarding_state,
    },
    team: org
      ? { id: org.id, name: org.name, slug: org.slug, status: org.status as "active" | "suspended", role: active!.role as Role }
      : null,
  };
}

/** Converts an AccountContext's Team into the legacy ManagerContext shape, or null with no Team. */
export function toManagerContext(account: AccountContext): ManagerContext | null {
  if (!account.team) return null;
  const { id, name, slug, status, role } = account.team;
  return { userId: account.userId, organization: { id, name, slug, status }, role };
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
