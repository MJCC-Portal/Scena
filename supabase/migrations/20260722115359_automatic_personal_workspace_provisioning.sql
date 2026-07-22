create or replace function public.provision_initial_personal_workspace(
  p_user_id uuid,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_id uuid;
  workspace_name text;
  workspace_slug text;
begin
  select o.id into workspace_id
  from public.organizations o
  where o.created_by = p_user_id
    and o.workspace_type = 'personal'
    and o.provisioning_kind = 'initial_free'
  limit 1;

  if workspace_id is not null then return workspace_id; end if;

  workspace_name := coalesce(nullif(btrim(p_display_name), ''), 'Personal') || '''s Workspace';
  workspace_slug := 'personal-' || left(replace(p_user_id::text, '-', ''), 24);

  begin
    insert into public.organizations (
      name, slug, status, created_by, workspace_type, provisioning_kind
    ) values (
      workspace_name, workspace_slug, 'active', p_user_id, 'personal', 'initial_free'
    ) returning id into workspace_id;
  exception when unique_violation then
    select o.id into workspace_id
    from public.organizations o
    where o.created_by = p_user_id
      and o.workspace_type = 'personal'
      and o.provisioning_kind = 'initial_free'
    limit 1;
  end;

  if workspace_id is null then raise exception 'Unable to provision initial Personal Workspace'; end if;

  insert into public.organization_entitlements (
    org_id, plan_code, max_displays, max_boards, max_members,
    max_concurrent_sessions, max_displays_per_session,
    max_asset_uploads_per_month, automation_tier,
    allow_display_groups, allow_session_groups,
    allow_resource_access_controls
  ) values (
    workspace_id, 'personal_free', 2, 5, 1, 1, 4, 5,
    'none', false, false, false
  ) on conflict (org_id) do nothing;

  update public.user_preferences
  set last_org_id = coalesce(last_org_id, workspace_id), updated_at = now()
  where user_id = p_user_id;

  return workspace_id;
end;
$$;

revoke all on function public.provision_initial_personal_workspace(uuid, text) from public, anon, authenticated;
grant execute on function public.provision_initial_personal_workspace(uuid, text) to service_role;

create or replace function public.handle_new_scena_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_name text;
  inferred_avatar text;
  initial_state text;
begin
  inferred_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Scena user'
  );
  inferred_avatar := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
  );
  initial_state := case when inferred_name = 'Scena user' then 'needs_profile' else 'complete' end;

  insert into public.profiles (user_id,display_name,avatar_url,onboarding_state)
  values (new.id,inferred_name,inferred_avatar,initial_state)
  on conflict (user_id) do nothing;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  perform public.provision_initial_personal_workspace(new.id, inferred_name);
  return new;
end;
$$;

do $$
declare user_row record;
begin
  for user_row in
    select u.id,
           coalesce(p.display_name, nullif(split_part(coalesce(u.email,''),'@',1),''), 'Personal') as display_name
    from auth.users u
    left join public.profiles p on p.user_id = u.id
  loop
    perform public.provision_initial_personal_workspace(user_row.id, user_row.display_name);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
