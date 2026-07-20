-- Dependency-safe rollback for 0008_manager_sso_identity_bridge.sql.
-- Removes only the auth-integration objects that migration added.
-- Never drops auth.users, organizations, organization_members, or any
-- other pre-existing table, and never deletes unrelated auth records.
-- Do NOT run against production without explicit approval.

drop trigger if exists external_identities_immutable_mapping on public.external_identities;
drop trigger if exists external_identities_set_updated_at on public.external_identities;
drop policy if exists external_identities_manager_select on public.external_identities;
drop policy if exists external_identities_self_select on public.external_identities;
drop table if exists public.external_identities;
drop function if exists public.forbid_external_identity_relink();

-- Intentionally NOT rolled back:
--   * the 'mjcc' organization seed and backfilled organization_members
--     rows (live tenancy data once managers sign in);
--   * grant execute on public.has_org_role to authenticated (shared by
--     other new-schema policies).
