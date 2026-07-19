-- Scena presentation upload pipeline: private storage bucket plus the
-- asset registry that tracks ownership, integrity, and processing state.
-- Clients never write this table or the bucket directly; the
-- presentation-upload Edge Function (service role) issues short-lived
-- signed upload URLs and records every object server-side.
-- Apply through the authorized Supabase MCP session after review.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'presentations',
  'presentations',
  false,
  104857600, -- 100 MiB per deck
  array['application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do nothing;

create table public.presentation_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scene_id uuid,
  storage_path text not null unique check (length(btrim(storage_path)) > 0),
  original_filename text not null check (length(btrim(original_filename)) > 0),
  mime_type text not null default 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    check (mime_type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending_upload'
    check (status in ('pending_upload', 'uploaded', 'processing', 'ready', 'failed')),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A linked scene must belong to the same organization; unlinking a
  -- deleted scene must not orphan-delete the uploaded deck.
  constraint presentation_assets_scene_same_org_fk
    foreign key (scene_id, org_id)
    references public.scenes(id, org_id)
    on delete set null (scene_id)
);

create index presentation_assets_org_idx on public.presentation_assets(org_id);
create index presentation_assets_scene_idx on public.presentation_assets(scene_id, org_id);
create index presentation_assets_uploaded_by_idx on public.presentation_assets(uploaded_by);
create index presentation_assets_pending_idx
  on public.presentation_assets(status)
  where status in ('pending_upload', 'processing');

alter table public.presentation_assets enable row level security;
alter table public.presentation_assets force row level security;

-- Members may see their organization's assets; every write goes through the
-- service-role Edge Function so the registry cannot be forged client-side.
revoke all on table public.presentation_assets from anon, authenticated;
grant select on table public.presentation_assets to authenticated;

create policy presentation_assets_member_select on public.presentation_assets
  for select to authenticated
  using ((select public.is_org_member(org_id)));
