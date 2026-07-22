alter table public.organizations
  add column if not exists owner_user_id uuid;

update public.organizations o
set owner_user_id = coalesce(
  o.owner_user_id,
  (
    select om.user_id
    from public.organization_members om
    where om.org_id = o.id
      and om.role = 'owner'
      and om.status = 'active'
    order by om.joined_at, om.created_at
    limit 1
  ),
  o.created_by
)
where o.owner_user_id is null;

comment on column public.organizations.owner_user_id is
  'Canonical owner relationship for the Workspace. created_by remains audit history.';
