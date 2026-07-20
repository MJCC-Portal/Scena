-- Manager SSO identity bridge for the rebuilt menu-board schema.
--
-- The 2026-07-20 schema rebuild (applied ad hoc, outside tracked
-- migrations) dropped public.external_identities and emptied
-- organizations / organization_members, which broke the existing MJCC
-- SSO flow: supabase/functions/mjcc-sso-exchange resolves the local
-- Supabase Auth user through external_identities (provider = 'mjcc',
-- external_user_id = immutable MJCC user id) and then upserts
-- organization_members. This migration restores that bridge on top of
-- the new schema without touching auth.users or any unrelated table.
--
-- Additive only. Rollback: supabase/migrations/_drafts/
-- rollback_0008_manager_sso_identity_bridge.sql
-- Apply through the authorized Supabase MCP session after review.

-- 1. Identity bridge table (same contract the Edge Function already
--    depends on, plus last_login_at for auditable sign-in tracking).
create table if not exists public.external_identities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider = 'mjcc'),
  external_user_id text not null check (length(btrim(external_user_id)) > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_snapshot text check (role_snapshot in ('owner', 'admin', 'operator', 'viewer')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One external identity can only ever resolve to one local user.
  unique (provider, external_user_id),
  -- One local user carries at most one identity per organization.
  unique (org_id, user_id)
);

create index if not exists external_identities_user_idx on public.external_identities(user_id);
create index if not exists external_identities_org_idx on public.external_identities(org_id);

create trigger external_identities_set_updated_at
  before update on public.external_identities
  for each row execute function public.set_updated_at();

-- 2. The identity <-> user mapping is immutable once linked. Profile
--    mirrors (role_snapshot, last_login_at) may refresh on every
--    sign-in; relinking requires an explicit delete + insert so it
--    stays a deliberate, auditable action.
create or replace function public.forbid_external_identity_relink()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $$
begin
  if new.provider is distinct from old.provider
     or new.external_user_id is distinct from old.external_user_id
     or new.user_id is distinct from old.user_id
     or new.org_id is distinct from old.org_id
     or new.created_at is distinct from old.created_at then
    raise exception
      'external_identities mapping is immutable; delete and re-insert to relink';
  end if;
  return new;
end;
$$;

revoke all on function public.forbid_external_identity_relink() from public;

create trigger external_identities_immutable_mapping
  before update on public.external_identities
  for each row execute function public.forbid_external_identity_relink();

-- 3. RLS: writes stay service-role only (the SSO exchange function).
--    Reads are allowed to the identity's own user and to org managers.
alter table public.external_identities enable row level security;
alter table public.external_identities force row level security;

revoke all on table public.external_identities from anon, authenticated;
grant select on table public.external_identities to authenticated;

create policy external_identities_self_select on public.external_identities
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy external_identities_manager_select on public.external_identities
  for select to authenticated
  using ((select public.has_org_role(org_id, array['owner', 'admin', 'operator'])));

grant execute on function public.has_org_role(uuid, text[]) to authenticated;

-- 4. Seed the single MJCC tenant. KpnCompute/MJCC SSO is single-tenant:
--    the identity payload carries no per-user org id, so every MJCC
--    manager resolves into this fixed-slug organization. created_by is
--    null (no browser actor); the organizations_initialize trigger
--    still seeds default entitlements.
insert into public.organizations (name, slug, status)
values ('MJCC', 'mjcc', 'active')
on conflict (slug) do nothing;

-- 5. Backfill: relink Supabase Auth users the SSO exchange provisioned
--    before the rebuild. The immutable MJCC id survives in
--    auth.users.raw_app_meta_data (written by mjcc-sso-exchange), so no
--    identity is guessed from email. Roles outside the allowed set fall
--    back to the least-privileged sensible default.
insert into public.external_identities (org_id, provider, external_user_id, user_id, role_snapshot)
select o.id,
       'mjcc',
       u.raw_app_meta_data ->> 'mjcc_user_id',
       u.id,
       case when u.raw_app_meta_data ->> 'role' in ('owner', 'admin', 'operator', 'viewer')
            then u.raw_app_meta_data ->> 'role' end
from auth.users u
join public.organizations o on o.slug = 'mjcc'
where coalesce(btrim(u.raw_app_meta_data ->> 'mjcc_user_id'), '') <> ''
on conflict (provider, external_user_id) do nothing;

insert into public.organization_members (org_id, user_id, role)
select o.id,
       u.id,
       case when u.raw_app_meta_data ->> 'role' in ('owner', 'admin', 'operator', 'viewer')
            then u.raw_app_meta_data ->> 'role'
            else 'viewer' end
from auth.users u
join public.organizations o on o.slug = 'mjcc'
where coalesce(btrim(u.raw_app_meta_data ->> 'mjcc_user_id'), '') <> ''
on conflict (org_id, user_id) do nothing;
