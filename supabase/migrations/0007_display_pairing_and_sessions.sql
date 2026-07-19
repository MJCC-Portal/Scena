-- Live display pairing + session control (Phase 3/4 slice).
--
-- Model: a kiosk opens the display site, gets a device token and shows a
-- 6-digit pairing code. A manager claims that code, binding the connection
-- to the org with an optional per-screen scene override. The effective
-- scene for a screen is assigned_scene_id, falling back to the org's
-- active display_session scene ("take live" broadcasts).
--
-- Token and pairing-code hashes never reach client roles: manager access
-- is granted per-column, excluding token_hash and pair_code_hash. All
-- writes that mint or bind credentials stay in service-role Edge
-- Functions; managers may only update label/assignment/revocation.
-- Apply through the authorized Supabase MCP session after review.

alter table public.display_connections
  alter column session_id drop not null;

alter table public.display_connections
  add column org_id uuid references public.organizations(id) on delete cascade,
  add column assigned_scene_id uuid references public.scenes(id) on delete set null,
  add column pair_code_hash text,
  add column pair_expires_at timestamptz,
  add column claimed_at timestamptz;

create index display_connections_org_idx on public.display_connections(org_id);
create unique index display_connections_pair_code_idx
  on public.display_connections(pair_code_hash)
  where pair_code_hash is not null and claimed_at is null;

-- Managers see and manage their org's screens, but only safe columns.
drop policy display_connections_deny_clients on public.display_connections;

grant select (id, org_id, session_id, label, assigned_scene_id, last_seen_at, revoked_at, claimed_at, created_at)
  on public.display_connections to authenticated;
grant update (label, assigned_scene_id, revoked_at)
  on public.display_connections to authenticated;

create policy display_connections_manager_select on public.display_connections
  for select to authenticated
  using ((select public.is_org_manager(org_id)));

create policy display_connections_manager_update on public.display_connections
  for update to authenticated
  using ((select public.is_org_manager(org_id)))
  with check ((select public.is_org_manager(org_id)));

-- 0001's insert policy forced started_by to null, which blocks recording
-- the actor when a manager starts a session from the portal.
drop policy display_sessions_manager_insert on public.display_sessions;
create policy display_sessions_manager_insert on public.display_sessions
  for insert to authenticated
  with check (
    (select public.is_org_manager(org_id))
    and (started_by is null or started_by = (select auth.uid()))
  );
