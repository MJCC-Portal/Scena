drop trigger if exists organizations_require_entitlement on public.organizations;
drop trigger if exists organization_entitlements_prevent_orphan on public.organization_entitlements;
drop function if exists private.require_team_entitlement();
drop function if exists private.prevent_team_entitlement_orphan();

create or replace function private.require_workspace_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organization_entitlements oe where oe.org_id = new.id) then
    raise exception 'Every Workspace requires an entitlement record';
  end if;
  return new;
end;
$$;

create constraint trigger organizations_require_entitlement
after insert or update on public.organizations
deferrable initially deferred
for each row execute function private.require_workspace_entitlement();

create or replace function private.prevent_workspace_entitlement_orphan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.organizations o where o.id = old.org_id)
     and not exists (select 1 from public.organization_entitlements oe where oe.org_id = old.org_id) then
    raise exception 'A Workspace cannot exist without an entitlement record';
  end if;
  return old;
end;
$$;

create constraint trigger organization_entitlements_prevent_orphan
after delete on public.organization_entitlements
deferrable initially deferred
for each row execute function private.prevent_workspace_entitlement_orphan();

create or replace function public.enforce_organization_membership_invariants()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  active_owner_count integer;
  active_member_count integer;
  member_limit integer;
  initial_owner_allowed boolean := false;
  target_workspace_type text;
  target_creator uuid;
begin
  select o.workspace_type, o.created_by
    into target_workspace_type, target_creator
  from public.organizations o where o.id = new.org_id;

  if target_workspace_type is null then raise exception 'Workspace does not exist'; end if;

  if tg_op = 'INSERT' then
    select exists (
      select 1 from public.organizations o
      where o.id = new.org_id and o.created_by = new.user_id
        and not exists (select 1 from public.organization_members om where om.org_id = new.org_id)
    ) into initial_owner_allowed;

    if target_workspace_type = 'personal' then
      if not initial_owner_allowed or new.user_id is distinct from target_creator
         or new.role <> 'owner' or new.status <> 'active' then
        raise exception 'A Personal Workspace supports exactly one active Owner';
      end if;
      return new;
    end if;

    if new.status = 'active' then
      select oe.max_members into member_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
      if member_limit is not null then
        select count(*) into active_member_count from public.organization_members om
        where om.org_id = new.org_id and om.status = 'active';
        if active_member_count >= member_limit then
          raise exception 'This Workspace allows at most % active member(s)', member_limit;
        end if;
      end if;
    end if;

    if new.role = 'owner' and not initial_owner_allowed
       and not private.has_org_role(new.org_id, array['owner']) then
      raise exception 'Only a Workspace owner may add another owner';
    end if;
    return new;
  end if;

  if new.org_id is distinct from old.org_id or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Workspace membership identity is immutable';
  end if;

  if target_workspace_type = 'personal' then
    if new.user_id is distinct from target_creator or new.role <> 'owner' or new.status <> 'active' then
      raise exception 'A Personal Workspace must retain its single active Owner';
    end if;
    return new;
  end if;

  if new.status = 'active' and old.status is distinct from 'active' then
    select oe.max_members into member_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
    select count(*) into active_member_count from public.organization_members om
    where om.org_id = new.org_id and om.status = 'active' and om.user_id <> new.user_id;
    if member_limit is null or active_member_count >= member_limit then
      raise exception 'This Workspace has reached its active member limit';
    end if;
  end if;

  if new.role = 'owner' and old.role is distinct from 'owner'
     and not private.has_org_role(new.org_id, array['owner']) then
    raise exception 'Only a Workspace owner may promote another owner';
  end if;

  if old.role = 'owner' and old.status = 'active'
     and (new.role is distinct from 'owner' or new.status is distinct from 'active') then
    if not private.has_org_role(old.org_id, array['owner']) then
      raise exception 'Only a Workspace owner may change an owner membership';
    end if;
    select count(*) into active_owner_count from public.organization_members om
    where om.org_id = old.org_id and om.role = 'owner' and om.status = 'active' and om.user_id <> old.user_id;
    if active_owner_count = 0 then raise exception 'A Team Workspace must retain at least one active Owner'; end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_organization_membership_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
declare active_owner_count integer;
begin
  if pg_trigger_depth() > 1 then return old; end if;
  if old.role = 'owner' and old.status = 'active' then
    if not private.has_org_role(old.org_id, array['owner']) then
      raise exception 'Only a Workspace owner may remove an owner';
    end if;
    select count(*) into active_owner_count from public.organization_members om
    where om.org_id = old.org_id and om.role = 'owner' and om.status = 'active' and om.user_id <> old.user_id;
    if active_owner_count = 0 then raise exception 'A Workspace must retain at least one active Owner'; end if;
  end if;
  return old;
end;
$$;

create or replace function public.initialize_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (org_id,user_id,role,status,joined_at)
    values (new.id,new.created_by,'owner','active',now()) on conflict (org_id,user_id) do nothing;
  end if;
  insert into public.organization_preferences (org_id) values (new.id) on conflict (org_id) do nothing;
  insert into public.locations (org_id,name,slug,status)
  values (new.id,'Main','main','active') on conflict (org_id,slug) do nothing;
  return new;
end;
$$;

create or replace function public.enforce_team_invitation_workspace_type()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_workspace_type text;
begin
  select o.workspace_type into target_workspace_type from public.organizations o where o.id = new.org_id;
  if target_workspace_type <> 'team' then raise exception 'Personal Workspaces do not support invitations'; end if;
  return new;
end;
$$;
revoke all on function public.enforce_team_invitation_workspace_type() from public, anon, authenticated;
drop trigger if exists team_invitations_enforce_workspace_type on public.team_invitations;
create trigger team_invitations_enforce_workspace_type
before insert or update on public.team_invitations
for each row execute function public.enforce_team_invitation_workspace_type();

create or replace function public.enforce_team_display_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare display_limit integer; display_count integer;
begin
  if new.org_id is null or new.status = 'revoked' then return new; end if;
  select oe.max_displays into display_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
  select count(*) into display_count from public.screens s
  where s.org_id = new.org_id and s.status <> 'revoked' and s.id <> new.id;
  if display_limit is null or display_count >= display_limit then raise exception 'This Workspace has reached its Display limit'; end if;
  return new;
end;
$$;

create or replace function public.enforce_team_board_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare board_limit integer; board_count integer;
begin
  if not new.is_active then return new; end if;
  select oe.max_boards into board_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
  select count(*) into board_count from public.display_layouts b
  where b.org_id = new.org_id and b.is_active and b.id <> new.id;
  if board_limit is null or board_count >= board_limit then raise exception 'This Workspace has reached its active Board limit'; end if;
  return new;
end;
$$;

create or replace function public.enforce_team_concurrent_session_quota()
returns trigger language plpgsql security definer set search_path = '' as $$
declare session_limit integer; active_count integer;
begin
  if new.status <> 'active' or old.status = 'active' then return new; end if;
  select oe.max_concurrent_sessions into session_limit from public.organization_entitlements oe where oe.org_id = new.org_id;
  select count(*) into active_count from public.display_sessions ds
  where ds.org_id = new.org_id and ds.status = 'active' and ds.id <> new.id;
  if session_limit is null or active_count >= session_limit then raise exception 'This Workspace has reached its concurrent Session limit'; end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
