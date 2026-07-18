-- Marquee manager identity bridge: maps an immutable MJCC/KpnCompute
-- identity to a local Supabase Auth user, and seeds the single MJCC
-- organization used to resolve org membership. mjcc_user_id is the only
-- identity link key; email is never used to look up or merge accounts.
-- Apply through the authorized Supabase MCP session after review.

create table public.mjcc_identities (
  mjcc_user_id text primary key check (length(btrim(mjcc_user_id)) > 0),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  mjcc_username text not null check (length(btrim(mjcc_username)) > 0),
  mjcc_role text not null check (mjcc_role in ('staff', 'assistant', 'manager', 'admin', 'sudo')),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mjcc_identities_revoked_idx
  on public.mjcc_identities(revoked_at)
  where revoked_at is not null;

-- The mjcc_user_id <-> user_id mapping must never change once linked.
-- mjcc_username / mjcc_role / revoked_at / updated_at may be refreshed on
-- every sign-in (they mirror MJCC's live profile), but relinking the
-- identity itself requires deleting and re-inserting the row -- a
-- deliberate, auditable action rather than a silent update.
create or replace function public.forbid_mjcc_identity_relink()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.mjcc_user_id is distinct from old.mjcc_user_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception
      'mjcc_identities mapping is immutable; delete and re-insert to relink instead of updating mjcc_user_id/user_id/created_at';
  end if;
  return new;
end;
$$;

create trigger mjcc_identities_immutable_mapping
  before update on public.mjcc_identities
  for each row execute function public.forbid_mjcc_identity_relink();

-- KpnCompute/MJCCv1 is single-tenant today: its SSO identity payload carries
-- no per-user org id. Marquee therefore resolves every MJCC manager into one
-- well-known organization, seeded here under a fixed slug. The SSO exchange
-- function re-resolves (select-or-create) the same slug at runtime so a
-- fresh database that hasn't run this migration yet still provisions safely.
insert into public.organizations (name, slug, status)
values ('MJCC', 'mjcc', 'active')
on conflict (slug) do nothing;

alter table public.mjcc_identities enable row level security;
alter table public.mjcc_identities force row level security;

-- Only the service-role-driven SSO exchange Edge Function reads or writes
-- this table; no client role gets any access, mirroring the
-- display_session_codes / display_connections hardening pattern in 0001.
revoke all on table public.mjcc_identities from anon, authenticated;

create policy mjcc_identities_deny_clients on public.mjcc_identities
  for all to anon, authenticated
  using (false)
  with check (false);

revoke all on function public.forbid_mjcc_identity_relink() from public;
