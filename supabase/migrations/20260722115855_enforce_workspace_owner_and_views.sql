create or replace function public.initialize_organization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_members (org_id,user_id,role,status,joined_at)
  values (new.id,new.owner_user_id,'owner','active',now())
  on conflict (org_id,user_id) do nothing;
  insert into public.organization_preferences (org_id) values (new.id)
  on conflict (org_id) do nothing;
  insert into public.locations (org_id,name,slug,status)
  values (new.id,'Main','main','active') on conflict (org_id,slug) do nothing;
  return new;
end;
$$;

create or replace function public.enforce_workspace_identity_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.workspace_type is distinct from old.workspace_type
     or new.provisioning_kind is distinct from old.provisioning_kind
     or new.created_by is distinct from old.created_by then
    raise exception 'Workspace type, provisioning kind, and creator are immutable';
  end if;

  if new.owner_user_id is distinct from old.owner_user_id then
    if old.workspace_type = 'personal' then
      raise exception 'Personal Workspace ownership is not transferable';
    end if;
    if not exists (
      select 1 from public.organization_members om
      where om.org_id = old.id and om.user_id = new.owner_user_id
        and om.role = 'owner' and om.status = 'active'
    ) then
      raise exception 'The new Team Workspace owner must already be an active Owner member';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_organization_membership_invariants()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  active_owner_count integer;
  active_member_count integer;
  member_limit integer;
  initial_owner_allowed boolean := false;
  target_workspace_type text;
  target_owner_user_id uuid;
begin
  select o.workspace_type, o.owner_user_id
  into target_workspace_type, target_owner_user_id
  from public.organizations o where o.id = new.org_id;

  if target_workspace_type is null then raise exception 'Workspace does not exist'; end if;

  if tg_op = 'INSERT' then
    select exists (
      select 1 from public.organizations o
      where o.id = new.org_id and o.owner_user_id = new.user_id
        and not exists (select 1 from public.organization_members om where om.org_id = new.org_id)
    ) into initial_owner_allowed;

    if target_workspace_type = 'personal' then
      if not initial_owner_allowed or new.user_id is distinct from target_owner_user_id
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

  if old.user_id = target_owner_user_id and (new.role <> 'owner' or new.status <> 'active') then
    raise exception 'The canonical Workspace owner must remain an active Owner member';
  end if;

  if target_workspace_type = 'personal' then
    if new.user_id is distinct from target_owner_user_id or new.role <> 'owner' or new.status <> 'active' then
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
declare target_owner_user_id uuid; active_owner_count integer;
begin
  if pg_trigger_depth() > 1 then return old; end if;
  select o.owner_user_id into target_owner_user_id from public.organizations o where o.id = old.org_id;
  if old.user_id = target_owner_user_id then
    raise exception 'The canonical Workspace owner membership cannot be removed';
  end if;
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

create or replace function public.provision_initial_personal_workspace(p_user_id uuid,p_display_name text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare workspace_id uuid; workspace_name text; workspace_slug text;
begin
  select o.id into workspace_id from public.organizations o
  where o.owner_user_id = p_user_id and o.workspace_type = 'personal'
    and o.provisioning_kind = 'initial_free' limit 1;
  if workspace_id is not null then return workspace_id; end if;

  workspace_name := coalesce(nullif(btrim(p_display_name), ''), 'Personal') || '''s Workspace';
  workspace_slug := 'personal-' || left(replace(p_user_id::text, '-', ''), 24);
  begin
    insert into public.organizations (
      name,slug,status,created_by,owner_user_id,workspace_type,provisioning_kind
    ) values (
      workspace_name,workspace_slug,'active',p_user_id,p_user_id,'personal','initial_free'
    ) returning id into workspace_id;
  exception when unique_violation then
    select o.id into workspace_id from public.organizations o
    where o.owner_user_id=p_user_id and o.workspace_type='personal' and o.provisioning_kind='initial_free' limit 1;
  end;
  if workspace_id is null then raise exception 'Unable to provision initial Personal Workspace'; end if;

  insert into public.organization_entitlements (
    org_id,plan_code,max_displays,max_boards,max_members,max_concurrent_sessions,
    max_displays_per_session,max_asset_uploads_per_month,automation_tier,
    allow_display_groups,allow_session_groups,allow_resource_access_controls
  ) values (workspace_id,'personal_free',2,5,1,1,4,5,'none',false,false,false)
  on conflict (org_id) do nothing;

  update public.user_preferences set last_org_id=coalesce(last_org_id,workspace_id),updated_at=now()
  where user_id=p_user_id;
  return workspace_id;
end;
$$;

alter table public.organizations alter column owner_user_id set not null;
alter table public.organizations drop constraint if exists organizations_owner_user_id_fkey;
alter table public.organizations add constraint organizations_owner_user_id_fkey
  foreign key (owner_user_id) references auth.users(id) on delete restrict;

create index if not exists organizations_owner_user_id_idx on public.organizations (owner_user_id);
create index if not exists organizations_type_owner_idx on public.organizations (workspace_type,owner_user_id,status);
create unique index if not exists organizations_one_initial_personal_per_owner_idx
  on public.organizations (owner_user_id)
  where workspace_type='personal' and provisioning_kind='initial_free';

create or replace view public.workspaces with (security_invoker = true) as
select o.id,o.name,o.slug,o.workspace_type as type,o.owner_user_id,o.provisioning_kind,
       o.status,o.created_by,o.created_at,o.updated_at
from public.organizations o;

create or replace view public.workspace_memberships with (security_invoker = true) as
select om.org_id as workspace_id,om.user_id,om.role,om.status,om.invited_by,
       om.joined_at,om.created_at,om.updated_at
from public.organization_members om;

create or replace view public.workspace_entitlements with (security_invoker = true) as
select oe.org_id as workspace_id,oe.plan_code,oe.max_displays,oe.max_boards,oe.max_members,
       oe.max_concurrent_sessions,oe.max_displays_per_session,oe.max_asset_uploads_per_month,
       oe.automation_tier,oe.allow_display_groups,oe.allow_session_groups,
       oe.allow_resource_access_controls,oe.updated_at
from public.organization_entitlements oe;

revoke all on table public.workspaces from anon,authenticated;
revoke all on table public.workspace_memberships from anon,authenticated;
revoke all on table public.workspace_entitlements from anon,authenticated;
grant select on table public.workspaces to authenticated;
grant select on table public.workspace_memberships to authenticated;
grant select on table public.workspace_entitlements to authenticated;
grant all on table public.workspaces to service_role;
grant all on table public.workspace_memberships to service_role;
grant all on table public.workspace_entitlements to service_role;

notify pgrst, 'reload schema';
