// Scena presentation upload API — LXC integration boundary.
//
// PowerPoint source files live on the private LXC presentation-processing
// service, never in this Supabase project's storage. This function only
// registers metadata and brokers a signed job with the LXC service; the
// browser uploads bytes directly to whatever URL the LXC job hands back.
// Processing completion/failure arrives asynchronously via
// presentation-callback (a separate, LXC-authenticated function) — this
// function never marks an asset 'ready' itself.

import { serveJson, json, requiredEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { requireManager } from "../_shared/managerAuth.ts";
import { ApiError } from "../_shared/errors.ts";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";
const MAX_SIZE_BYTES = 104857600;

serveJson(async (req) => {
  const admin = adminClient();
  const manager = await requireManager(admin, req, { minRole: "operator" });
  const body = (await req.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "create") {
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    if (!filename || filename.length > 255 || !/\.pptx?$/i.test(filename)) {
      throw ApiError.validation("filename must end with .ppt or .pptx.", { field: "filename" });
    }
    const mimeType = filename.toLowerCase().endsWith(".pptx") ? PPTX_MIME : PPT_MIME;

    const { data: asset, error: insertError } = await admin
      .from("presentation_assets")
      .insert({ org_id: manager.orgId, original_filename: filename, mime_type: mimeType, status: "pending_upload", uploaded_by: manager.userId })
      .select("id")
      .single();
    if (insertError) throw ApiError.internal(insertError.message);

    const job = await createLxcJob({ assetId: asset.id, orgId: manager.orgId, filename, mimeType });

    const { error: updateError } = await admin.from("presentation_assets").update({ lxc_source_key: job.source_key }).eq("id", asset.id);
    if (updateError) throw ApiError.internal(updateError.message);

    return json({ asset_id: asset.id, upload_url: job.upload_url, upload_method: job.upload_method ?? "PUT", source_key: job.source_key }, 200);
  }

  if (action === "complete") {
    const assetId = typeof body.asset_id === "string" ? body.asset_id : "";
    if (!assetId) throw ApiError.validation("asset_id is required.", { field: "asset_id" });
    const { data: asset, error: assetError } = await admin
      .from("presentation_assets")
      .select("id, status, lxc_source_key")
      .eq("id", assetId)
      .eq("org_id", manager.orgId)
      .maybeSingle();
    if (assetError) throw ApiError.internal(assetError.message);
    if (!asset) throw ApiError.notFound("Presentation");
    if (asset.status !== "pending_upload") throw ApiError.validation("This asset has already left the pending_upload state.");

    // The browser cannot be trusted to say "the upload finished" — ask
    // the LXC service to confirm the object landed, then flip our status
    // to 'uploaded' so processing can begin. Manifest/slide_count/ready
    // still only ever arrive through the authenticated callback.
    await confirmLxcUpload(String(asset.lxc_source_key));
    const { error: updateError } = await admin.from("presentation_assets").update({ status: "uploaded" }).eq("id", assetId).eq("status", "pending_upload");
    if (updateError) throw ApiError.internal(updateError.message);
    return json({ asset_id: assetId, status: "uploaded" }, 200);
  }

  throw ApiError.validation("Unknown action.", { field: "action" });
}, ["POST"]);

async function createLxcJob(input: { assetId: string; orgId: string; filename: string; mimeType: string }) {
  const baseUrl = requiredEnv("LXC_PRESENTATIONS_URL");
  const apiKey = requiredEnv("LXC_PRESENTATIONS_API_KEY");
  const callbackSecret = requiredEnv("SCENA_LXC_CALLBACK_SECRET");
  const supabaseUrl = requiredEnv("SUPABASE_URL");

  const response = await fetch(`${baseUrl}/presentation-jobs`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      presentation_asset_id: input.assetId,
      org_id: input.orgId,
      original_filename: input.filename,
      mime_type: input.mimeType,
      callback_url: `${supabaseUrl}/functions/v1/presentation-callback`,
      callback_secret: callbackSecret,
    }),
  });
  if (!response.ok) throw ApiError.internal(`LXC presentation service rejected the job (${response.status}).`);
  const data = (await response.json()) as { upload_url: string; upload_method?: string; source_key: string };
  if (!data.upload_url || !data.source_key) throw ApiError.internal("LXC presentation service returned an incomplete job.");
  return data;
}

async function confirmLxcUpload(sourceKey: string) {
  const baseUrl = requiredEnv("LXC_PRESENTATIONS_URL");
  const apiKey = requiredEnv("LXC_PRESENTATIONS_API_KEY");
  const response = await fetch(`${baseUrl}/presentation-jobs/${encodeURIComponent(sourceKey)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw ApiError.validation("The presentation file has not finished uploading yet.");
  const data = (await response.json()) as { uploaded?: boolean; size_bytes?: number };
  if (!data.uploaded) throw ApiError.validation("The presentation file has not finished uploading yet.");
  if (typeof data.size_bytes === "number" && data.size_bytes > MAX_SIZE_BYTES) throw ApiError.validation("Presentation file exceeds the 100 MB limit.");
}
