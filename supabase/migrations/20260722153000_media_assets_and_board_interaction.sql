-- Scena media assets, Proxmox worker queue, and Canva-style Board draft foundation.
-- Canonical product terms use Workspace, Asset, Board, Scene, Element, Revision,
-- and Publication. Legacy presentation/display tables remain untouched for compatibility.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('scena-assets', 'scena-assets', false, 262144000, null)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('image','powerpoint','pdf','video','audio','font','other')),
  original_filename text not null check (length(btrim(original_filename)) between 1 and 255),
  mime_type text not null check (length(btrim(mime_type)) between 1 and 255),
  source_bucket text not null default 'scena-assets' check (source_bucket = 'scena-assets'),
  source_object_path text unique,
  source_size_bytes bigint check (source_size_bytes is null or source_size_bytes > 0),
  source_checksum_sha256 text check (source_checksum_sha256 is null or source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending_upload' check (status in ('pending_upload','uploaded','queued','processing','ready','failed','archived')),
  page_count integer check (page_count is null or page_count >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  error_code text,
  error_message_safe text,
  uploaded_by uuid not null references auth.users(id),
  source_uploaded_at timestamptz,
  processed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

comment on table public.assets is 'Workspace-owned source media. PowerPoints, PDFs, images, video, audio, fonts, and future media all enter through this canonical Asset table.';

create table if not exists public.asset_upload_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid unique references public.assets(id) on delete set null,
  uploaded_by uuid not null references auth.users(id),
  quota_month date not null,
  source_size_bytes bigint not null check (source_size_bytes > 0),
  created_at timestamptz not null default now()
);

comment on table public.asset_upload_events is 'Immutable source-upload usage ledger. Deleting or archiving an Asset never refunds monthly upload quota.';

create table if not exists public.asset_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  asset_id uuid not null,
  page_number integer not null check (page_number > 0),
  title text,
  extracted_text text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, page_number),
  unique (workspace_id, asset_id, id),
  foreign key (workspace_id, asset_id) references public.assets(workspace_id, id) on delete cascade
);

create table if not exists public.asset_variants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  asset_id uuid not null,
  asset_page_id uuid,
  variant_type text not null check (variant_type in ('source_render','thumbnail','preview','display_1080p','display_4k','audio_playback','audio_preview','waveform','manifest','extracted_text','other')),
  bucket_id text not null default 'scena-assets' check (bucket_id = 'scena-assets'),
  object_path text not null unique,
  mime_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  checksum_sha256 text check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (workspace_id, asset_id) references public.assets(workspace_id, id) on delete cascade,
  foreign key (workspace_id, asset_id, asset_page_id) references public.asset_pages(workspace_id, asset_id, id) on delete cascade
);

create table if not exists public.media_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 1 and 120),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active','disabled')),
  capabilities text[] not null default array['powerpoint_import','pdf_import','image_ingest','scene_render','thumbnail_render']::text[],
  max_concurrent_jobs integer not null default 1 check (max_concurrent_jobs between 1 and 8),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  asset_id uuid not null,
  job_type text not null check (job_type in ('powerpoint_import','pdf_import','image_ingest','video_ingest','audio_ingest','font_ingest','scene_render','thumbnail_render')),
  status text not null default 'queued' check (status in ('queued','leased','processing','retry_wait','succeeded','failed','dead_letter','cancelled')),
  priority integer not null default 0,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  available_at timestamptz not null default now(),
  lease_owner uuid references public.media_workers(id),
  lease_token_hash text check (lease_token_hash is null or lease_token_hash ~ '^[0-9a-f]{64}$'),
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  expected_outputs jsonb not null default '[]'::jsonb check (jsonb_typeof(expected_outputs) = 'array'),
  error_code text,
  error_message_safe text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, asset_id) references public.assets(workspace_id, id) on delete cascade
);

create unique index if not exists asset_processing_jobs_one_active_kind_idx
on public.asset_processing_jobs(asset_id, job_type)
where status in ('queued','leased','processing','retry_wait');

create index if not exists asset_processing_jobs_claim_idx
on public.asset_processing_jobs(status, available_at, priority desc, created_at)
where status in ('queued','leased','processing','retry_wait');

create index if not exists asset_upload_events_workspace_month_idx
on public.asset_upload_events(workspace_id, quota_month);

create index if not exists assets_workspace_created_idx
on public.assets(workspace_id, created_at desc);

create index if not exists asset_pages_asset_number_idx
on public.asset_pages(asset_id, page_number);

create index if not exists asset_variants_asset_idx
on public.asset_variants(asset_id, asset_page_id, variant_type);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  canvas_width integer not null default 1920 check (canvas_width between 64 and 7680),
  canvas_height integer not null default 1080 check (canvas_height between 64 and 7680),
  background_color text not null default '#000000' check (background_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  status text not null default 'active' check (status in ('active','archived')),
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id)
);

create table if not exists public.board_scenes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  board_id uuid not null,
  name text not null check (length(btrim(name)) between 1 and 120),
  sort_order integer not null default 0 check (sort_order >= 0),
  duration_ms integer not null default 10000 check (duration_ms between 1000 and 86400000),
  transition_type text not null default 'fade' check (transition_type in ('none','fade','slide_left','slide_right','zoom','dissolve')),
  transition_config jsonb not null default '{}'::jsonb check (jsonb_typeof(transition_config) = 'object'),
  background jsonb not null default '{"type":"color","value":"#000000"}'::jsonb check (jsonb_typeof(background) = 'object'),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, board_id, id),
  foreign key (workspace_id, board_id) references public.boards(workspace_id, id) on delete cascade
);

create table if not exists public.scene_elements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  board_id uuid not null,
  scene_id uuid not null,
  element_type text not null check (element_type in ('text','image','shape','asset_page','clock','date','countdown','qr_static','qr_dynamic','music_player','ticker','carousel','video','weather','data_text')),
  render_mode text not null check (render_mode in ('static','live','interactive')),
  name text,
  x numeric(12,4) not null default 0,
  y numeric(12,4) not null default 0,
  width numeric(12,4) not null check (width > 0),
  height numeric(12,4) not null check (height > 0),
  rotation numeric(8,4) not null default 0,
  opacity numeric(6,5) not null default 1 check (opacity between 0 and 1),
  z_index integer not null default 0,
  is_locked boolean not null default false,
  is_visible boolean not null default true,
  asset_id uuid,
  asset_page_id uuid,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, board_id, scene_id) references public.board_scenes(workspace_id, board_id, id) on delete cascade,
  foreign key (workspace_id, asset_id) references public.assets(workspace_id, id) on delete restrict,
  foreign key (workspace_id, asset_id, asset_page_id) references public.asset_pages(workspace_id, asset_id, id) on delete restrict,
  check ((asset_page_id is null) or (asset_id is not null))
);

create table if not exists public.board_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  board_id uuid not null,
  board_version integer not null check (board_version > 0),
  label text check (label is null or length(btrim(label)) between 1 and 120),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (board_id, board_version),
  foreign key (workspace_id, board_id) references public.boards(workspace_id, id) on delete cascade
);

create table if not exists public.board_publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  board_id uuid not null,
  revision_id uuid not null references public.board_revisions(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','rendering','ready','failed','retired')),
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  error_code text,
  error_message_safe text,
  published_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  retired_at timestamptz,
  foreign key (workspace_id, board_id) references public.boards(workspace_id, id) on delete cascade
);

create index if not exists boards_workspace_updated_idx on public.boards(workspace_id, updated_at desc);
create index if not exists board_scenes_board_order_idx on public.board_scenes(board_id, sort_order, created_at);
create index if not exists scene_elements_scene_z_idx on public.scene_elements(scene_id, z_index, created_at);
create index if not exists board_revisions_board_created_idx on public.board_revisions(board_id, created_at desc);
create index if not exists board_publications_board_created_idx on public.board_publications(board_id, created_at desc);

create or replace function public.asset_job_type_for_kind(target_kind text)
returns text
language sql
immutable
as $$
  select case target_kind
    when 'powerpoint' then 'powerpoint_import'
    when 'pdf' then 'pdf_import'
    when 'image' then 'image_ingest'
    when 'video' then 'video_ingest'
    when 'audio' then 'audio_ingest'
    when 'font' then 'font_ingest'
    else 'image_ingest'
  end;
$$;

create or replace function public.finalize_asset_upload(
  target_asset_id uuid,
  target_user_id uuid,
  target_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_asset public.assets%rowtype;
  month_start date := date_trunc('month', timezone('UTC', now()))::date;
  upload_limit integer;
  used_uploads integer;
  queued_job_id uuid;
begin
  if target_size_bytes is null or target_size_bytes <= 0 or target_size_bytes > 262144000 then
    raise exception 'invalid asset size';
  end if;

  select * into target_asset
  from public.assets
  where id = target_asset_id
  for update;

  if not found then raise exception 'asset not found'; end if;

  if not exists (
    select 1 from public.organization_members m
    where m.org_id = target_asset.workspace_id
      and m.user_id = target_user_id
      and m.status = 'active'
      and m.role in ('owner','admin','operator','designer')
  ) then
    raise exception 'workspace role required';
  end if;

  if target_asset.status <> 'pending_upload' then
    if target_asset.status in ('uploaded','queued','processing','ready') then
      select id into queued_job_id
      from public.asset_processing_jobs
      where asset_id = target_asset.id
      order by created_at desc
      limit 1;
      return jsonb_build_object('asset_id', target_asset.id, 'status', target_asset.status, 'job_id', queued_job_id, 'idempotent', true);
    end if;
    raise exception 'asset cannot be finalized from status %', target_asset.status;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_asset.workspace_id::text || ':' || month_start::text, 0));

  select e.max_asset_uploads_per_month into upload_limit
  from public.organization_entitlements e
  where e.org_id = target_asset.workspace_id;

  if upload_limit is not null then
    select count(*) into used_uploads
    from public.asset_upload_events u
    where u.workspace_id = target_asset.workspace_id
      and u.quota_month = month_start;

    if used_uploads >= upload_limit then
      raise exception 'monthly asset upload limit reached';
    end if;
  end if;

  insert into public.asset_upload_events(workspace_id, asset_id, uploaded_by, quota_month, source_size_bytes)
  values (target_asset.workspace_id, target_asset.id, target_user_id, month_start, target_size_bytes)
  on conflict (asset_id) do nothing;

  update public.assets
  set source_size_bytes = target_size_bytes,
      source_uploaded_at = now(),
      status = 'queued',
      error_code = null,
      error_message_safe = null,
      updated_at = now()
  where id = target_asset.id;

  insert into public.asset_processing_jobs(workspace_id, asset_id, job_type, status)
  values (target_asset.workspace_id, target_asset.id, public.asset_job_type_for_kind(target_asset.asset_kind), 'queued')
  on conflict do nothing
  returning id into queued_job_id;

  if queued_job_id is null then
    select id into queued_job_id
    from public.asset_processing_jobs
    where asset_id = target_asset.id
      and status in ('queued','leased','processing','retry_wait')
    order by created_at desc
    limit 1;
  end if;

  return jsonb_build_object('asset_id', target_asset.id, 'status', 'queued', 'job_id', queued_job_id, 'idempotent', false);
end;
$$;

revoke all on function public.finalize_asset_upload(uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.finalize_asset_upload(uuid,uuid,bigint) to service_role;

create or replace function public.claim_asset_processing_job(
  target_worker_id uuid,
  target_lease_token_hash text,
  lease_seconds integer default 600
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  claimed public.asset_processing_jobs%rowtype;
  worker public.media_workers%rowtype;
begin
  select * into worker from public.media_workers where id = target_worker_id and status = 'active' for update;
  if not found then raise exception 'worker unavailable'; end if;
  if target_lease_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid lease token hash'; end if;
  if lease_seconds < 60 or lease_seconds > 3600 then raise exception 'invalid lease duration'; end if;

  select j.* into claimed
  from public.asset_processing_jobs j
  where j.job_type = any(worker.capabilities)
    and j.attempt_count < j.max_attempts
    and (
      (j.status in ('queued','retry_wait') and j.available_at <= now())
      or (j.status in ('leased','processing') and j.lease_expires_at < now())
    )
  order by j.priority desc, j.available_at, j.created_at
  for update skip locked
  limit 1;

  if not found then
    update public.media_workers set last_seen_at = now(), updated_at = now() where id = worker.id;
    return null;
  end if;

  update public.asset_processing_jobs
  set status = 'leased',
      attempt_count = attempt_count + 1,
      lease_owner = worker.id,
      lease_token_hash = target_lease_token_hash,
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      heartbeat_at = now(),
      started_at = coalesce(started_at, now()),
      error_code = null,
      error_message_safe = null,
      updated_at = now()
  where id = claimed.id
  returning * into claimed;

  update public.assets set status = 'processing', updated_at = now() where id = claimed.asset_id and status in ('queued','uploaded','processing');
  update public.media_workers set last_seen_at = now(), updated_at = now() where id = worker.id;

  return jsonb_build_object(
    'job_id', claimed.id,
    'workspace_id', claimed.workspace_id,
    'asset_id', claimed.asset_id,
    'job_type', claimed.job_type,
    'attempt_count', claimed.attempt_count,
    'max_attempts', claimed.max_attempts,
    'lease_expires_at', claimed.lease_expires_at
  );
end;
$$;

create or replace function public.heartbeat_asset_processing_job(
  target_worker_id uuid,
  target_job_id uuid,
  target_lease_token_hash text,
  lease_seconds integer default 600
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.asset_processing_jobs
  set status = 'processing',
      heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      updated_at = now()
  where id = target_job_id
    and lease_owner = target_worker_id
    and lease_token_hash = target_lease_token_hash
    and status in ('leased','processing')
    and lease_expires_at >= now();
  update public.media_workers set last_seen_at = now(), updated_at = now() where id = target_worker_id;
  return found;
end;
$$;

create or replace function public.set_asset_processing_job_outputs(
  target_worker_id uuid,
  target_job_id uuid,
  target_lease_token_hash text,
  target_outputs jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(target_outputs) <> 'array' or jsonb_array_length(target_outputs) > 500 then
    raise exception 'invalid output list';
  end if;
  update public.asset_processing_jobs
  set expected_outputs = target_outputs, updated_at = now()
  where id = target_job_id
    and lease_owner = target_worker_id
    and lease_token_hash = target_lease_token_hash
    and status in ('leased','processing')
    and lease_expires_at >= now();
  return found;
end;
$$;

create or replace function public.complete_asset_processing_job(
  target_worker_id uuid,
  target_job_id uuid,
  target_lease_token_hash text,
  target_outputs jsonb,
  target_manifest_path text default null,
  target_page_count integer default null,
  target_asset_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  target_job public.asset_processing_jobs%rowtype;
  output_item jsonb;
  output_path text;
  expected_prefix text;
  page_number_value integer;
  page_id_value uuid;
  object_size bigint;
begin
  if jsonb_typeof(target_outputs) <> 'array' or jsonb_array_length(target_outputs) = 0 or jsonb_array_length(target_outputs) > 500 then
    raise exception 'invalid output list';
  end if;
  if jsonb_typeof(target_asset_metadata) <> 'object' then raise exception 'invalid asset metadata'; end if;

  select * into target_job
  from public.asset_processing_jobs
  where id = target_job_id
  for update;

  if not found then raise exception 'job not found'; end if;
  if target_job.lease_owner <> target_worker_id
     or target_job.lease_token_hash <> target_lease_token_hash
     or target_job.status not in ('leased','processing')
     or target_job.lease_expires_at < now() then
    raise exception 'invalid or expired lease';
  end if;

  expected_prefix := 'workspaces/' || target_job.workspace_id || '/assets/' || target_job.asset_id || '/outputs/' || target_job.id || '/';

  for output_item in select value from jsonb_array_elements(target_outputs)
  loop
    output_path := output_item->>'object_path';
    if output_path is null or left(output_path, length(expected_prefix)) <> expected_prefix or output_path like '%..%' then
      raise exception 'invalid output path';
    end if;

    select nullif((o.metadata->>'size')::bigint, 0) into object_size
    from storage.objects o
    where o.bucket_id = 'scena-assets' and o.name = output_path;
    if not found then raise exception 'output object missing: %', output_path; end if;

    page_number_value := nullif(output_item->>'page_number','')::integer;
    page_id_value := null;

    if page_number_value is not null then
      insert into public.asset_pages(workspace_id, asset_id, page_number, title, extracted_text, width, height, duration_ms, metadata)
      values (
        target_job.workspace_id,
        target_job.asset_id,
        page_number_value,
        nullif(output_item->>'title',''),
        nullif(output_item->>'extracted_text',''),
        nullif(output_item->>'width','')::integer,
        nullif(output_item->>'height','')::integer,
        nullif(output_item->>'duration_ms','')::integer,
        coalesce(output_item->'page_metadata','{}'::jsonb)
      )
      on conflict (asset_id, page_number) do update
      set title = excluded.title,
          extracted_text = excluded.extracted_text,
          width = excluded.width,
          height = excluded.height,
          duration_ms = excluded.duration_ms,
          metadata = excluded.metadata,
          updated_at = now()
      returning id into page_id_value;
    end if;

    insert into public.asset_variants(
      workspace_id, asset_id, asset_page_id, variant_type, object_path, mime_type,
      width, height, duration_ms, size_bytes, checksum_sha256, metadata
    )
    values (
      target_job.workspace_id,
      target_job.asset_id,
      page_id_value,
      coalesce(nullif(output_item->>'variant_type',''),'other'),
      output_path,
      coalesce(nullif(output_item->>'mime_type',''),'application/octet-stream'),
      nullif(output_item->>'width','')::integer,
      nullif(output_item->>'height','')::integer,
      nullif(output_item->>'duration_ms','')::integer,
      coalesce(nullif(output_item->>'size_bytes','')::bigint, object_size),
      nullif(output_item->>'checksum_sha256',''),
      coalesce(output_item->'metadata','{}'::jsonb)
    )
    on conflict (object_path) do update
    set variant_type = excluded.variant_type,
        mime_type = excluded.mime_type,
        width = excluded.width,
        height = excluded.height,
        duration_ms = excluded.duration_ms,
        size_bytes = excluded.size_bytes,
        checksum_sha256 = excluded.checksum_sha256,
        metadata = excluded.metadata;
  end loop;

  if target_manifest_path is not null then
    if left(target_manifest_path, length(expected_prefix)) <> expected_prefix or target_manifest_path like '%..%' then
      raise exception 'invalid manifest path';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'scena-assets' and name = target_manifest_path) then
      raise exception 'manifest object missing';
    end if;
  end if;

  update public.assets
  set status = 'ready',
      page_count = coalesce(target_page_count, page_count),
      metadata = metadata || target_asset_metadata || case when target_manifest_path is null then '{}'::jsonb else jsonb_build_object('manifest_path', target_manifest_path) end,
      processed_at = now(),
      error_code = null,
      error_message_safe = null,
      updated_at = now()
  where id = target_job.asset_id;

  update public.asset_processing_jobs
  set status = 'succeeded',
      completed_at = now(),
      lease_expires_at = null,
      heartbeat_at = now(),
      updated_at = now()
  where id = target_job.id;

  update public.media_workers set last_seen_at = now(), updated_at = now() where id = target_worker_id;

  return jsonb_build_object('job_id', target_job.id, 'asset_id', target_job.asset_id, 'status', 'ready');
end;
$$;

create or replace function public.fail_asset_processing_job(
  target_worker_id uuid,
  target_job_id uuid,
  target_lease_token_hash text,
  target_error_code text,
  target_error_message_safe text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_job public.asset_processing_jobs%rowtype;
  next_status text;
  retry_seconds integer;
begin
  select * into target_job from public.asset_processing_jobs where id = target_job_id for update;
  if not found then raise exception 'job not found'; end if;
  if target_job.lease_owner <> target_worker_id or target_job.lease_token_hash <> target_lease_token_hash or target_job.status not in ('leased','processing') then
    raise exception 'invalid lease';
  end if;

  if target_job.attempt_count < target_job.max_attempts then
    next_status := 'retry_wait';
    retry_seconds := least(3600, 30 * (2 ^ greatest(target_job.attempt_count - 1, 0))::integer);
    update public.asset_processing_jobs
    set status = next_status,
        available_at = now() + make_interval(secs => retry_seconds),
        lease_owner = null,
        lease_token_hash = null,
        lease_expires_at = null,
        error_code = left(coalesce(target_error_code,'PROCESSING_FAILED'),120),
        error_message_safe = left(coalesce(target_error_message_safe,'Media processing failed.'),500),
        updated_at = now()
    where id = target_job.id;
    update public.assets set status = 'queued', error_code = left(coalesce(target_error_code,'PROCESSING_FAILED'),120), error_message_safe = left(coalesce(target_error_message_safe,'Media processing failed.'),500), updated_at = now() where id = target_job.asset_id;
  else
    next_status := 'dead_letter';
    update public.asset_processing_jobs
    set status = next_status,
        completed_at = now(),
        lease_expires_at = null,
        error_code = left(coalesce(target_error_code,'PROCESSING_FAILED'),120),
        error_message_safe = left(coalesce(target_error_message_safe,'Media processing failed.'),500),
        updated_at = now()
    where id = target_job.id;
    update public.assets set status = 'failed', error_code = left(coalesce(target_error_code,'PROCESSING_FAILED'),120), error_message_safe = left(coalesce(target_error_message_safe,'Media processing failed.'),500), updated_at = now() where id = target_job.asset_id;
  end if;

  return jsonb_build_object('job_id', target_job.id, 'asset_id', target_job.asset_id, 'status', next_status);
end;
$$;

revoke all on function public.claim_asset_processing_job(uuid,text,integer) from public, anon, authenticated;
revoke all on function public.heartbeat_asset_processing_job(uuid,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.set_asset_processing_job_outputs(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.complete_asset_processing_job(uuid,uuid,text,jsonb,text,integer,jsonb) from public, anon, authenticated;
revoke all on function public.fail_asset_processing_job(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_asset_processing_job(uuid,text,integer) to service_role;
grant execute on function public.heartbeat_asset_processing_job(uuid,uuid,text,integer) to service_role;
grant execute on function public.set_asset_processing_job_outputs(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.complete_asset_processing_job(uuid,uuid,text,jsonb,text,integer,jsonb) to service_role;
grant execute on function public.fail_asset_processing_job(uuid,uuid,text,text,text) to service_role;

create or replace function public.board_snapshot(target_board_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  result jsonb;
  target_workspace_id uuid;
begin
  select workspace_id into target_workspace_id from public.boards where id = target_board_id;
  if not found then raise exception 'board not found'; end if;
  if auth.uid() is null or not private.is_org_member(target_workspace_id) then raise exception 'workspace membership required'; end if;

  select jsonb_build_object(
    'board', jsonb_build_object(
      'id', b.id,
      'workspace_id', b.workspace_id,
      'name', b.name,
      'canvas_width', b.canvas_width,
      'canvas_height', b.canvas_height,
      'background_color', b.background_color,
      'status', b.status,
      'version', b.version
    ),
    'scenes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name', s.name,
          'sort_order', s.sort_order,
          'duration_ms', s.duration_ms,
          'transition_type', s.transition_type,
          'transition_config', s.transition_config,
          'background', s.background,
          'is_hidden', s.is_hidden,
          'elements', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', e.id,
              'element_type', e.element_type,
              'render_mode', e.render_mode,
              'name', e.name,
              'x', e.x,
              'y', e.y,
              'width', e.width,
              'height', e.height,
              'rotation', e.rotation,
              'opacity', e.opacity,
              'z_index', e.z_index,
              'is_locked', e.is_locked,
              'is_visible', e.is_visible,
              'asset_id', e.asset_id,
              'asset_page_id', e.asset_page_id,
              'config', e.config
            ) order by e.z_index, e.created_at)
            from public.scene_elements e where e.scene_id = s.id
          ), '[]'::jsonb)
        ) order by s.sort_order, s.created_at
      )
      from public.board_scenes s where s.board_id = b.id
    ), '[]'::jsonb)
  ) into result
  from public.boards b
  where b.id = target_board_id;

  return result;
end;
$$;

create or replace function public.save_board_draft(
  target_board_id uuid,
  expected_version integer,
  target_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_board public.boards%rowtype;
  scene_item jsonb;
  element_item jsonb;
  target_scene_id uuid;
  target_element_id uuid;
  total_elements integer := 0;
  new_version integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if jsonb_typeof(target_snapshot) <> 'object' or jsonb_typeof(target_snapshot->'scenes') <> 'array' then raise exception 'invalid Board snapshot'; end if;
  if jsonb_array_length(target_snapshot->'scenes') > 100 then raise exception 'scene limit exceeded'; end if;

  select * into target_board from public.boards where id = target_board_id for update;
  if not found then raise exception 'board not found'; end if;
  if not private.has_org_role(target_board.workspace_id, array['owner','admin','operator','designer']) then raise exception 'editor role required'; end if;
  if target_board.version <> expected_version then raise exception 'board version conflict: expected %, current %', expected_version, target_board.version; end if;

  update public.boards
  set name = coalesce(nullif(btrim(target_snapshot->'board'->>'name'),''), name),
      canvas_width = coalesce(nullif(target_snapshot->'board'->>'canvas_width','')::integer, canvas_width),
      canvas_height = coalesce(nullif(target_snapshot->'board'->>'canvas_height','')::integer, canvas_height),
      background_color = coalesce(nullif(target_snapshot->'board'->>'background_color',''), background_color),
      updated_by = auth.uid(),
      updated_at = now()
  where id = target_board.id;

  delete from public.board_scenes where board_id = target_board.id;

  for scene_item in select value from jsonb_array_elements(target_snapshot->'scenes')
  loop
    target_scene_id := coalesce(nullif(scene_item->>'id','')::uuid, gen_random_uuid());
    insert into public.board_scenes(
      id, workspace_id, board_id, name, sort_order, duration_ms,
      transition_type, transition_config, background, is_hidden
    ) values (
      target_scene_id,
      target_board.workspace_id,
      target_board.id,
      coalesce(nullif(btrim(scene_item->>'name'),''),'Scene'),
      coalesce(nullif(scene_item->>'sort_order','')::integer,0),
      coalesce(nullif(scene_item->>'duration_ms','')::integer,10000),
      coalesce(nullif(scene_item->>'transition_type',''),'fade'),
      coalesce(scene_item->'transition_config','{}'::jsonb),
      coalesce(scene_item->'background','{"type":"color","value":"#000000"}'::jsonb),
      coalesce((scene_item->>'is_hidden')::boolean,false)
    );

    if scene_item ? 'elements' then
      if jsonb_typeof(scene_item->'elements') <> 'array' then raise exception 'invalid elements list'; end if;
      total_elements := total_elements + jsonb_array_length(scene_item->'elements');
      if total_elements > 1000 then raise exception 'element limit exceeded'; end if;

      for element_item in select value from jsonb_array_elements(scene_item->'elements')
      loop
        target_element_id := coalesce(nullif(element_item->>'id','')::uuid, gen_random_uuid());
        insert into public.scene_elements(
          id, workspace_id, board_id, scene_id, element_type, render_mode, name,
          x, y, width, height, rotation, opacity, z_index, is_locked, is_visible,
          asset_id, asset_page_id, config
        ) values (
          target_element_id,
          target_board.workspace_id,
          target_board.id,
          target_scene_id,
          element_item->>'element_type',
          coalesce(nullif(element_item->>'render_mode',''), case when element_item->>'element_type' in ('clock','date','countdown','qr_dynamic','music_player','ticker','carousel','video','weather','data_text') then 'live' else 'static' end),
          nullif(element_item->>'name',''),
          coalesce(nullif(element_item->>'x','')::numeric,0),
          coalesce(nullif(element_item->>'y','')::numeric,0),
          coalesce(nullif(element_item->>'width','')::numeric,100),
          coalesce(nullif(element_item->>'height','')::numeric,100),
          coalesce(nullif(element_item->>'rotation','')::numeric,0),
          coalesce(nullif(element_item->>'opacity','')::numeric,1),
          coalesce(nullif(element_item->>'z_index','')::integer,0),
          coalesce((element_item->>'is_locked')::boolean,false),
          coalesce((element_item->>'is_visible')::boolean,true),
          nullif(element_item->>'asset_id','')::uuid,
          nullif(element_item->>'asset_page_id','')::uuid,
          coalesce(element_item->'config','{}'::jsonb)
        );
      end loop;
    end if;
  end loop;

  new_version := target_board.version + 1;
  update public.boards set version = new_version, updated_by = auth.uid(), updated_at = now() where id = target_board.id;

  return jsonb_build_object('board_id', target_board.id, 'version', new_version, 'scene_count', jsonb_array_length(target_snapshot->'scenes'), 'element_count', total_elements);
end;
$$;

create or replace function public.create_board_revision(target_board_id uuid, target_label text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_board public.boards%rowtype;
  target_snapshot jsonb;
  target_revision_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into target_board from public.boards where id = target_board_id for update;
  if not found then raise exception 'board not found'; end if;
  if not private.has_org_role(target_board.workspace_id, array['owner','admin','operator','designer']) then raise exception 'editor role required'; end if;
  target_snapshot := public.board_snapshot(target_board.id);
  insert into public.board_revisions(workspace_id, board_id, board_version, label, snapshot, created_by)
  values (target_board.workspace_id, target_board.id, target_board.version, nullif(btrim(target_label),''), target_snapshot, auth.uid())
  on conflict (board_id, board_version) do update set label = coalesce(excluded.label, public.board_revisions.label)
  returning id into target_revision_id;
  return jsonb_build_object('revision_id', target_revision_id, 'board_id', target_board.id, 'version', target_board.version);
end;
$$;

revoke all on function public.board_snapshot(uuid) from public, anon;
revoke all on function public.save_board_draft(uuid,integer,jsonb) from public, anon;
revoke all on function public.create_board_revision(uuid,text) from public, anon;
grant execute on function public.board_snapshot(uuid) to authenticated;
grant execute on function public.save_board_draft(uuid,integer,jsonb) to authenticated;
grant execute on function public.create_board_revision(uuid,text) to authenticated;

create or replace function public.enforce_workspace_board_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  board_limit integer;
  board_count integer;
begin
  select max_boards into board_limit from public.organization_entitlements where org_id = new.workspace_id;
  if board_limit is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('boards:' || new.workspace_id::text,0));
  select count(*) into board_count from public.boards where workspace_id = new.workspace_id and status = 'active';
  if board_count >= board_limit then raise exception 'workspace Board limit reached'; end if;
  return new;
end;
$$;

drop trigger if exists boards_enforce_quota on public.boards;
create trigger boards_enforce_quota before insert on public.boards for each row execute function public.enforce_workspace_board_quota();

create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger asset_pages_set_updated_at before update on public.asset_pages for each row execute function public.set_updated_at();
create trigger media_workers_set_updated_at before update on public.media_workers for each row execute function public.set_updated_at();
create trigger asset_processing_jobs_set_updated_at before update on public.asset_processing_jobs for each row execute function public.set_updated_at();
create trigger boards_set_updated_at before update on public.boards for each row execute function public.set_updated_at();
create trigger board_scenes_set_updated_at before update on public.board_scenes for each row execute function public.set_updated_at();
create trigger scene_elements_set_updated_at before update on public.scene_elements for each row execute function public.set_updated_at();

alter table public.assets enable row level security;
alter table public.asset_upload_events enable row level security;
alter table public.asset_pages enable row level security;
alter table public.asset_variants enable row level security;
alter table public.media_workers enable row level security;
alter table public.asset_processing_jobs enable row level security;
alter table public.boards enable row level security;
alter table public.board_scenes enable row level security;
alter table public.scene_elements enable row level security;
alter table public.board_revisions enable row level security;
alter table public.board_publications enable row level security;

create policy assets_select_member on public.assets for select to authenticated using (private.is_org_member(workspace_id));
create policy asset_upload_events_select_member on public.asset_upload_events for select to authenticated using (private.is_org_member(workspace_id));
create policy asset_pages_select_member on public.asset_pages for select to authenticated using (private.is_org_member(workspace_id));
create policy asset_variants_select_member on public.asset_variants for select to authenticated using (private.is_org_member(workspace_id));
create policy asset_processing_jobs_select_member on public.asset_processing_jobs for select to authenticated using (private.is_org_member(workspace_id));
create policy boards_select_member on public.boards for select to authenticated using (private.is_org_member(workspace_id));
create policy board_scenes_select_member on public.board_scenes for select to authenticated using (private.is_org_member(workspace_id));
create policy scene_elements_select_member on public.scene_elements for select to authenticated using (private.is_org_member(workspace_id));
create policy board_revisions_select_member on public.board_revisions for select to authenticated using (private.is_org_member(workspace_id));
create policy board_publications_select_member on public.board_publications for select to authenticated using (private.is_org_member(workspace_id));

revoke all on public.media_workers from anon, authenticated;
revoke all on public.asset_processing_jobs from anon;

grant select on public.assets, public.asset_upload_events, public.asset_pages, public.asset_variants,
  public.asset_processing_jobs, public.boards, public.board_scenes, public.scene_elements,
  public.board_revisions, public.board_publications to authenticated;

grant all on public.assets, public.asset_upload_events, public.asset_pages, public.asset_variants,
  public.media_workers, public.asset_processing_jobs, public.boards, public.board_scenes,
  public.scene_elements, public.board_revisions, public.board_publications to service_role;
