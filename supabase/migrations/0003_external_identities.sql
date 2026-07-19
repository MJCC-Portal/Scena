-- MJCC identity bridge: maps an immutable MJCC/KpnCompute identity to a
-- local Supabase Auth user. This is the table mjcc-sso-exchange queries
-- (provider='mjcc', external_user_id=mjcc_user_id).
--
-- This table already existed in production before this file was written
-- (applied ad hoc, not through a tracked migration -- see the "Recorded
-- plan changes" note in docs/BUILD_PLAN.md and the migration-drift finding
-- in docs/CLAUDE_STORAGE_HANDOFF_SUMMARY.md). This file documents the
-- live shape so a fresh environment provisions identically; it is
-- intentionally guarded so it is a no-op against a database that already
-- has it. Do not "fix" the guards to force a recreate -- the two extra
-- constraints and the self/manager select policies below are what the
-- manager shell (loadManagerContext) and the SSO exchange function
-- actually depend on today.

create table if not exists public.external_identities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'mjcc'),
  external_user_id text not null check (length(btrim(external_user_id)) > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_snapshot text check (role_snapshot in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_user_id),
  unique (org_id, user_id)
);

create index if not exists external_identities_user_idx on public.external_identities(user_id);
create index if not exists external_identities_org_idx on public.external_identities(org_id);

alter table public.external_identities enable row level security;
alter table public.external_identities force row level security;

-- Writes stay service-role-only (the SSO exchange function). Reads are
-- allowed for the identity's own owner and for org managers, matching
-- what the manager shell needs to show "linked via MJCC" state.
revoke all on table public.external_identities from anon, authenticated;
grant select on table public.external_identities to authenticated;

drop policy if exists external_identities_deny_clients on public.external_identities;

create policy external_identities_self_select on public.external_identities
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy external_identities_manager_select on public.external_identities
  for select to authenticated
  using ((select public.is_org_manager(org_id)));
