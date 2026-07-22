drop index if exists public.organization_members_one_active_team_per_user_idx;

comment on table public.organization_members is
  'Workspace memberships. A user may own or belong to multiple Workspaces; the primary key prevents duplicate membership within one Workspace.';

notify pgrst, 'reload schema';
