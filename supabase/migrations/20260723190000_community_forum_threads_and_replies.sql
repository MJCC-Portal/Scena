create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general' check (category in ('general', 'setup', 'boards', 'displays', 'plans')),
  title text not null check (length(btrim(title)) between 8 and 140),
  body text not null check (length(btrim(body)) between 20 and 5000),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null check (length(btrim(author_name)) between 1 and 80),
  is_answered boolean not null default false,
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  body text not null check (length(btrim(body)) between 2 and 5000),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null check (length(btrim(author_name)) between 1 and 80),
  is_accepted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists community_threads_activity_idx on public.community_threads (last_activity_at desc);
create index if not exists community_threads_category_idx on public.community_threads (category, last_activity_at desc);
create index if not exists community_replies_thread_idx on public.community_replies (thread_id, created_at);

alter table public.community_threads enable row level security;
alter table public.community_replies enable row level security;

grant select on public.community_threads to anon, authenticated;
grant select on public.community_replies to anon, authenticated;
grant insert, update, delete on public.community_threads to authenticated;
grant insert, update, delete on public.community_replies to authenticated;

drop policy if exists community_threads_public_read on public.community_threads;
create policy community_threads_public_read on public.community_threads
  for select to anon, authenticated using (true);

drop policy if exists community_threads_auth_insert on public.community_threads;
create policy community_threads_auth_insert on public.community_threads
  for insert to authenticated
  with check ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists community_threads_owner_update on public.community_threads;
create policy community_threads_owner_update on public.community_threads
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists community_threads_owner_delete on public.community_threads;
create policy community_threads_owner_delete on public.community_threads
  for delete to authenticated using (author_id = (select auth.uid()));

drop policy if exists community_replies_public_read on public.community_replies;
create policy community_replies_public_read on public.community_replies
  for select to anon, authenticated using (true);

drop policy if exists community_replies_auth_insert on public.community_replies;
create policy community_replies_auth_insert on public.community_replies
  for insert to authenticated
  with check ((select auth.uid()) is not null and author_id = (select auth.uid()));

drop policy if exists community_replies_owner_update on public.community_replies;
create policy community_replies_owner_update on public.community_replies
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists community_replies_owner_delete on public.community_replies;
create policy community_replies_owner_delete on public.community_replies
  for delete to authenticated using (author_id = (select auth.uid()));

create or replace function public.community_sync_thread_activity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_threads
      set reply_count = reply_count + 1,
          is_answered = true,
          last_activity_at = greatest(last_activity_at, new.created_at)
      where id = new.thread_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.community_threads
      set reply_count = greatest(reply_count - 1, 0),
          is_answered = exists (select 1 from public.community_replies where thread_id = old.thread_id and is_accepted)
      where id = old.thread_id;
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists community_sync_thread_activity_trigger on public.community_replies;
create trigger community_sync_thread_activity_trigger
after insert or delete on public.community_replies
for each row execute function public.community_sync_thread_activity();

insert into public.community_threads (category, title, body, author_name, is_answered)
values
  ('setup', 'How do I keep a Raspberry Pi display running after a power loss?', 'I am setting up a small lobby network with Raspberry Pi players. What should I configure so the display reconnects and starts Scena again after the power comes back?', 'Scena Team', true),
  ('displays', 'What resolution should I use for a lobby TV?', 'I am building my first Board for a 4K television. Should I design at 1920×1080 or match the full 4K panel?', 'Scena Team', true),
  ('boards', 'What is the easiest way to organize content for multiple locations?', 'I have several locations that share brand content but need different local announcements. How should I structure Boards, Assets, and Sessions?', 'Scena Team', false)
on conflict do nothing;

insert into public.community_replies (thread_id, body, author_name, is_accepted)
select id, 'Use a quality power supply, disable screen blanking, enable Chromium to reopen the Scena player on login, and test a full power-cycle before mounting the display. Ethernet is preferred for fixed installations.', 'Scena Team', true
from public.community_threads
where title = 'How do I keep a Raspberry Pi display running after a power loss?'
and not exists (select 1 from public.community_replies r where r.thread_id = public.community_threads.id);

insert into public.community_replies (thread_id, body, author_name, is_accepted)
select id, 'Design at the resolution you will operate most often. 1920×1080 is a practical starting point with broad browser support; use 4K when the screen and player are both stable at that resolution and the viewing distance benefits from it.', 'Scena Team', true
from public.community_threads
where title = 'What resolution should I use for a lobby TV?'
and not exists (select 1 from public.community_replies r where r.thread_id = public.community_threads.id);
