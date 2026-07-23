-- UI/API integration hardening after the real production Asset and Board
-- acceptance run. This migration narrows internal helper execution and fixes
-- the remaining mutable function search_path advisory without changing data.

alter function public.asset_job_type_for_kind(text)
  set search_path = public, pg_temp;

revoke all on function public.asset_job_type_for_kind(text)
  from public, anon, authenticated;
grant execute on function public.asset_job_type_for_kind(text)
  to service_role;

revoke all on function public.enforce_workspace_board_quota()
  from public, anon, authenticated;
grant execute on function public.enforce_workspace_board_quota()
  to service_role;

comment on function public.asset_job_type_for_kind(text) is
  'Internal Asset queue helper. Not part of the browser RPC surface.';

comment on function public.enforce_workspace_board_quota() is
  'Internal Boards insert trigger. Direct RPC execution is intentionally revoked.';
