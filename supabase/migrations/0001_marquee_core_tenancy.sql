-- Marquee MVP: organizations, manager membership, display sessions, and scenes.
-- Apply through the authorized Supabase MCP session after review.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('owner', 'admin', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  scene_type text not null check (scene_type in ('menu', 'queue', 'slideshow', 'media', 'layout')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scenes
  add constraint scenes_id_org_unique unique (id, org_id);

create table public.display_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'stopped', 'expired')),
  current_scene_id uuid,
  started_by uuid references auth.users(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint display_sessions_scene_same_org_fk
    foreign key (current_scene_id, org_id)
    references public.scenes(id, org_id),
  check ((status = 'active' and started_at is not null and ended_at is null) or status <> 'active'),
  check (ended_at is null or started_at is null or ended_at >= started_at)
);

-- Sensitive code material is isolated from display-readable session data.
-- Only the access-code Edge Function should read or write this table.
create table public.display_session_codes (
  session_id uuid primary key references public.display_sessions(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

-- A session may be used by more than one kiosk. Token hashes remain server-only.
create table public.display_connections (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.display_sessions(id) on delete cascade,
  label text,
  token_hash text not null unique,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id);
create index scenes_org_idx on public.scenes(org_id);
create index display_sessions_org_status_idx on public.display_sessions(org_id, status);
create index display_sessions_scene_idx on public.display_sessions(current_scene_id);
create index display_sessions_scene_org_idx on public.display_sessions(current_scene_id, org_id);
create index display_sessions_started_by_idx on public.display_sessions(started_by);
create index display_connections_session_idx on public.display_connections(session_id);
create index scenes_created_by_idx on public.scenes(created_by);
create index scenes_updated_by_idx on public.scenes(updated_by);

create unique index one_active_session_per_org
  on public.display_sessions(org_id)
  where status = 'active';

create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = target_org_id
      and om.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_manager(target_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = target_org_id
      and om.user_id = (select auth.uid())
      and om.role in ('owner', 'admin', 'operator')
  );
$$;

-- The access-code Edge Function issues a JWT with this server-controlled claim.
create or replace function public.claimed_display_session_id()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select nullif((select auth.jwt() ->> 'display_session_id'), '')::uuid;
$$;

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;
alter table public.scenes enable row level security;
alter table public.scenes force row level security;
alter table public.display_sessions enable row level security;
alter table public.display_sessions force row level security;
alter table public.display_session_codes enable row level security;
alter table public.display_session_codes force row level security;
alter table public.display_connections enable row level security;
alter table public.display_connections force row level security;

create policy organizations_member_select on public.organizations
  for select to authenticated
  using ((select public.is_org_member(id)));

create policy organization_members_member_select on public.organization_members
  for select to authenticated
  using ((select public.is_org_member(org_id)));

create policy organization_members_manager_insert on public.organization_members
  for insert to authenticated
  with check ((select public.is_org_manager(org_id)));

create policy scenes_select on public.scenes
  for select to authenticated
  using (
    (select public.is_org_member(org_id))
    or exists (
      select 1
      from public.display_sessions ds
      where ds.current_scene_id = scenes.id
        and ds.status = 'active'
        and ds.id = (select public.claimed_display_session_id())
    )
  );

create policy scenes_manager_insert on public.scenes
  for insert to authenticated
  with check ((select public.is_org_manager(org_id)) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));

create policy scenes_manager_update on public.scenes
  for update to authenticated
  using ((select public.is_org_manager(org_id)))
  with check ((select public.is_org_manager(org_id)) and updated_by = (select auth.uid()));

create policy scenes_manager_delete on public.scenes
  for delete to authenticated
  using ((select public.is_org_manager(org_id)));

create policy display_sessions_select on public.display_sessions
  for select to authenticated
  using (
    (select public.is_org_member(org_id))
    or (id = (select public.claimed_display_session_id()) and status = 'active')
  );

create policy display_sessions_manager_insert on public.display_sessions
  for insert to authenticated
  with check ((select public.is_org_manager(org_id)) and started_by is null);

create policy display_sessions_manager_update on public.display_sessions
  for update to authenticated
  using ((select public.is_org_manager(org_id)))
  with check ((select public.is_org_manager(org_id)));

-- Never expose code hashes or connection token hashes to client roles.
revoke all on table public.display_session_codes from anon, authenticated;
revoke all on table public.display_connections from anon, authenticated;

create policy display_session_codes_deny_clients on public.display_session_codes
  for all to anon, authenticated
  using (false)
  with check (false);

create policy display_connections_deny_clients on public.display_connections
  for all to anon, authenticated
  using (false)
  with check (false);

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.is_org_manager(uuid) from public;
revoke all on function public.claimed_display_session_id() from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_manager(uuid) to authenticated;
grant execute on function public.claimed_display_session_id() to authenticated;
