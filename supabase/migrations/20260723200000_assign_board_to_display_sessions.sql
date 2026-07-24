-- Assign an optional Workspace Board to a live Display Session.
-- A NULL board_id intentionally preserves the legacy Layout playback path.
alter table public.display_sessions
  add column if not exists board_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'display_sessions_board_workspace_fk'
      and conrelid = 'public.display_sessions'::regclass
  ) then
    alter table public.display_sessions
      add constraint display_sessions_board_workspace_fk
      foreign key (org_id, board_id)
      references public.boards(workspace_id, id)
      on delete set null;
  end if;
end;
$$;

create index if not exists display_sessions_board_idx
  on public.display_sessions(board_id)
  where board_id is not null;
