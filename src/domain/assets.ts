// Asset domain module — the SOP-canonical "Asset" (docs/sop/Purpose.md
// §3, §11) maps onto presentation_assets, the only table this release
// has for uploaded content (TIMELINE.md §3: "Do not pretend a canonical
// ... generic assets table already exists"). This file did not exist
// before this session; presentation_assets access was previously only
// reachable inline from scenes.ts (creating a presentation-backed scene)
// and the presentation-upload/presentation-callback Edge Functions —
// there was no list/detail/delete surface for an Asset library page.
//
// Upload itself is NOT reimplemented here — this wraps the existing,
// already-deployed presentation-upload Edge Function
// (supabase/functions/presentation-upload/index.ts) exactly as
// src/domain/billing.ts wraps billing-checkout, so there is exactly one
// place that talks to the LXC presentation-processing boundary.

import { requireSupabase, callEdgeFunction } from "../services/supabase/client";
import { ApiError, mapPostgresError } from "../shared/errors";
import { requireFilename, requireUuid } from "../shared/validation";

// lxc_source_key / lxc_manifest_key are internal LXC job/storage pointers,
// not needed by any UI and not returned to the browser — mirrors the
// device_token_hash exclusion pattern in src/domain/screens.ts.
export interface Asset {
  id: string;
  org_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number | null;
  checksum_sha256: string | null;
  status: string;
  slide_count: number | null;
  error_message: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

const SAFE_COLUMNS =
  "id, org_id, original_filename, mime_type, size_bytes, checksum_sha256, status, slide_count, error_message, uploaded_by, created_at, updated_at";

export async function listAssets(orgId: string): Promise<Asset[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("presentation_assets")
    .select(SAFE_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw mapPostgresError(error);
  return (data ?? []) as unknown as Asset[];
}

export async function getAsset(orgId: string, assetId: string): Promise<Asset | null> {
  requireUuid(orgId, "org_id");
  requireUuid(assetId, "asset_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("presentation_assets")
    .select(SAFE_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw mapPostgresError(error);
  return data as unknown as Asset | null;
}

/**
 * Deletes an Asset only if no Scene currently references it — a Scene ->
 * presentation_asset_id foreign key is RESTRICT (see docs/DATABASE_SCHEMA.md
 * §7), so an unguarded delete would just surface as an opaque Postgres FK
 * violation. Checking first lets us return a stable, actionable
 * RESOURCE_CONFLICT instead, per the release's "return stable errors,
 * never raw database errors" rule.
 */
export async function deleteAsset(orgId: string, assetId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(assetId, "asset_id");
  const supabase = requireSupabase();

  const { count, error: refError } = await supabase
    .from("scenes")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("presentation_asset_id", assetId);
  if (refError) throw mapPostgresError(refError);
  if ((count ?? 0) > 0) {
    throw ApiError.resourceConflict("This Asset is used by one or more Boards and can't be deleted until it's removed from them.", {
      referencing_scenes: count,
    });
  }

  const { error, count: deleteCount } = await supabase
    .from("presentation_assets")
    .delete({ count: "exact" })
    .eq("org_id", orgId)
    .eq("id", assetId);
  if (error) throw mapPostgresError(error);
  if (!deleteCount) throw ApiError.notFound("Asset");
}

export interface CreateUploadResult {
  asset_id: string;
  upload_url: string;
  upload_method: string;
}

/** Step 1 of the upload flow: registers the Asset and gets a signed LXC upload URL. The browser PUTs the file bytes directly to upload_url — bytes never pass through this module or Supabase storage. */
export async function createAssetUpload(filename: string): Promise<CreateUploadResult> {
  const cleanFilename = requireFilename(filename, [".ppt", ".pptx"]);
  const result = await callEdgeFunction<{ asset_id: string; upload_url: string; upload_method?: string; source_key: string }>(
    "presentation-upload",
    { action: "create", filename: cleanFilename },
  );
  return { asset_id: result.asset_id, upload_url: result.upload_url, upload_method: result.upload_method ?? "PUT" };
}

export interface ConfirmUploadResult {
  asset_id: string;
  status: string;
}

/** Step 2: after the browser's PUT to upload_url succeeds, confirm so
 * Scena can verify the object landed and move the Asset to 'uploaded'.
 * Processing to 'ready' (or 'failed') happens later, asynchronously, via
 * presentation-callback — this call never marks an Asset ready itself. */
export async function confirmAssetUpload(assetId: string): Promise<ConfirmUploadResult> {
  requireUuid(assetId, "asset_id");
  return callEdgeFunction<ConfirmUploadResult>("presentation-upload", { action: "complete", asset_id: assetId });
}
