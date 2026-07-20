-- Lock down function EXECUTE grants flagged by the Supabase security
-- advisors after the schema rebuild: every SECURITY DEFINER helper and
-- trigger function was callable by anon/authenticated through
-- /rest/v1/rpc. Membership checks stay executable by authenticated
-- (RLS policies evaluate them as the calling role); trigger functions
-- need no client EXECUTE at all to keep firing.
-- Apply through the authorized Supabase MCP session after review.

-- Trigger functions: never client-callable.
revoke execute on function public.initialize_organization() from public, anon, authenticated;
revoke execute on function public.handle_display_session_status() from public, anon, authenticated;
revoke execute on function public.prepare_session_screen_assignment() from public, anon, authenticated;
revoke execute on function public.validate_display_session_activation() from public, anon, authenticated;
revoke execute on function public.validate_new_display_session() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.forbid_external_identity_relink() from anon, authenticated;

-- Membership checks: authenticated only (used inside RLS policies that
-- are already scoped `to authenticated`); anon never needs them.
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_manager(uuid) from public, anon;
revoke execute on function public.claimed_display_session_id() from public, anon;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_manager(uuid) to authenticated;
grant execute on function public.claimed_display_session_id() to authenticated;
