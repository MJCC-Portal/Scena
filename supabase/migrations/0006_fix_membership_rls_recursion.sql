-- organization_members_member_select (0001) calls is_org_member()/
-- is_org_manager() to decide row visibility, but both functions were
-- SECURITY INVOKER and query organization_members themselves -- so the
-- inner query re-triggers the same RLS policy that's calling them,
-- producing "infinite recursion detected in policy for relation
-- organization_members". Never caught before because no real user had
-- completed MJCC sign-in until now (2026-07-19 live test).
--
-- Fix: SECURITY DEFINER so the internal membership check bypasses RLS.
-- Safe here because both functions only ever check the calling user's
-- own auth.uid() against a caller-supplied org_id and return a boolean --
-- they cannot be used to read or leak another user's row.

alter function public.is_org_member(uuid) security definer;
alter function public.is_org_manager(uuid) security definer;
