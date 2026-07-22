import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "scena-assets";
const MAX_SOURCE_BYTES = 262_144_000;
const EDITOR_ROLES = new Set(["owner", "admin", "operator", "designer"]);

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type AssetKind = "image" | "powerpoint" | "pdf" | "video" | "audio" | "font" | "other";

type AuthContext = {
  userId: string;
  admin: SupabaseClient;
  userClient: SupabaseClient;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return error("METHOD_NOT_ALLOWED", "POST required.", 405);

  const requestId = crypto.randomUUID();

  try {
    const auth = await authenticate(req);
    const body = await req.json() as Record<string, unknown>;
    const action = text(body.action);

    if (action === "create") return await createAsset(auth, body, requestId);
    if (action === "finalize") return await finalizeAsset(auth, body, requestId);
    if (action === "list") return await listAssets(auth, body, requestId);
    if (action === "get") return await getAsset(auth, body, requestId);
    if (action === "signed_read") return await signedRead(auth, body, requestId);
    if (action === "archive") return await archiveAsset(auth, body, requestId);

    return error("VALIDATION_FAILED", "Unknown action.", 400, requestId);
  } catch (cause) {
    console.error(JSON.stringify({
      event: "asset_upload_failed",
      request_id: requestId,
      error_name: cause instanceof Error ? cause.name : "unknown",
      error_message: cause instanceof Error ? cause.message : "unknown",
    }));
    return mapError(cause, requestId);
  }
});

async function createAsset(auth: AuthContext, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const workspaceId = uuid(body.workspace_id, "workspace_id");
  const filename = text(body.filename);
  const mimeType = text(body.mime_type).toLowerCase();
  const declaredSize = integer(body.size_bytes, 0);

  if (!filename || filename.length > 255 || filename.includes("/") || filename.includes("\\")) {
    return error("VALIDATION_FAILED", "A valid filename is required.", 400, requestId);
  }
  if (!mimeType || mimeType.length > 255) {
    return error("VALIDATION_FAILED", "A valid MIME type is required.", 400, requestId);
  }
  if (declaredSize > MAX_SOURCE_BYTES) {
    return error("ASSET_TOO_LARGE", "Source files may not exceed 250 MB.", 413, requestId);
  }

  await requireWorkspaceRole(auth.admin, workspaceId, auth.userId, true);

  const assetKind = classifyAsset(filename, mimeType);
  const assetId = crypto.randomUUID();
  const safeFilename = storageFilename(filename);
  const sourcePath = `workspaces/${workspaceId}/assets/${assetId}/source/${safeFilename}`;

  const { error: insertError } = await auth.admin.from("assets").insert({
    id: assetId,
    workspace_id: workspaceId,
    asset_kind: assetKind,
    original_filename: filename,
    mime_type: mimeType,
    source_bucket: BUCKET,
    source_object_path: sourcePath,
    status: "pending_upload",
    uploaded_by: auth.userId,
    metadata: declaredSize > 0 ? { declared_size_bytes: declaredSize } : {},
  });
  if (insertError) throw new Error(`asset insert failed: ${insertError.message}`);

  const { data: upload, error: uploadError } = await auth.admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(sourcePath, { upsert: false });

  if (uploadError || !upload?.signedUrl || !upload?.token) {
    await auth.admin.from("assets").delete().eq("id", assetId).eq("status", "pending_upload");
    throw new Error(`signed upload failed: ${uploadError?.message ?? "missing upload token"}`);
  }

  return json({
    asset_id: assetId,
    workspace_id: workspaceId,
    asset_kind: assetKind,
    status: "pending_upload",
    bucket: BUCKET,
    object_path: sourcePath,
    signed_upload_url: upload.signedUrl,
    signed_upload_token: upload.token,
    upload_method: "PUT",
    max_source_bytes: MAX_SOURCE_BYTES,
    request_id: requestId,
  }, 201);
}

async function finalizeAsset(auth: AuthContext, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const assetId = uuid(body.asset_id, "asset_id");
  const { data: asset, error: assetError } = await auth.admin
    .from("assets")
    .select("id,workspace_id,status,source_object_path")
    .eq("id", assetId)
    .maybeSingle();
  if (assetError) throw new Error(`asset lookup failed: ${assetError.message}`);
  if (!asset) return error("ASSET_NOT_FOUND", "Asset not found.", 404, requestId);

  await requireWorkspaceRole(auth.admin, String(asset.workspace_id), auth.userId, true);

  if (asset.status !== "pending_upload") {
    const { data: currentJob } = await auth.admin
      .from("asset_processing_jobs")
      .select("id,status")
      .eq("asset_id", assetId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return json({ asset_id: assetId, status: asset.status, job: currentJob, idempotent: true, request_id: requestId });
  }

  const sourcePath = String(asset.source_object_path ?? "");
  if (!sourcePath) return error("UPLOAD_INCOMPLETE", "Asset upload path is missing.", 409, requestId);

  const slash = sourcePath.lastIndexOf("/");
  const folder = sourcePath.slice(0, slash);
  const name = sourcePath.slice(slash + 1);
  const { data: files, error: listError } = await auth.admin.storage.from(BUCKET).list(folder, {
    search: name,
    limit: 20,
  });
  if (listError) throw new Error(`storage verification failed: ${listError.message}`);

  const stored = files?.find((file) => file.name === name);
  const storedSize = Number(stored?.metadata?.size ?? 0);
  if (!stored || !Number.isSafeInteger(storedSize) || storedSize <= 0) {
    return error("UPLOAD_INCOMPLETE", "The source file has not finished uploading.", 409, requestId);
  }
  if (storedSize > MAX_SOURCE_BYTES) {
    await auth.admin.storage.from(BUCKET).remove([sourcePath]);
    return error("ASSET_TOO_LARGE", "Source files may not exceed 250 MB.", 413, requestId);
  }

  const { data: finalized, error: finalizeError } = await auth.admin.rpc("finalize_asset_upload", {
    target_asset_id: assetId,
    target_user_id: auth.userId,
    target_size_bytes: storedSize,
  });
  if (finalizeError) throw new Error(finalizeError.message);

  return json({ ...asRecord(finalized), request_id: requestId });
}

async function listAssets(auth: AuthContext, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const workspaceId = uuid(body.workspace_id, "workspace_id");
  await requireWorkspaceRole(auth.admin, workspaceId, auth.userId, false);

  const limit = Math.min(Math.max(integer(body.limit, 50), 1), 100);
  const status = text(body.status);
  const kind = text(body.asset_kind);

  let query = auth.userClient
    .from("assets")
    .select("id,workspace_id,asset_kind,original_filename,mime_type,source_size_bytes,status,page_count,metadata,error_code,error_message_safe,source_uploaded_at,processed_at,created_at,updated_at")
    .eq("workspace_id", workspaceId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (kind) query = query.eq("asset_kind", kind);

  const { data, error: queryError } = await query;
  if (queryError) throw new Error(`asset list failed: ${queryError.message}`);
  return json({ assets: data ?? [], request_id: requestId });
}

async function getAsset(auth: AuthContext, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const assetId = uuid(body.asset_id, "asset_id");
  const { data: asset, error: assetError } = await auth.userClient
    .from("assets")
    .select("id,workspace_id,asset_kind,original_filename,mime_type,source_size_bytes,status,page_count,metadata,error_code,error_message_safe,source_uploaded_at,processed_at,created_at,updated_at")
    .eq("id", assetId)
    .maybeSingle();
  if (assetError) throw new Error(`asset lookup failed: ${assetError.message}`);
  if (!asset) return error("ASSET_NOT_FOUND", "Asset not found.", 404, requestId);

  const [{ data: pages, error: pagesError }, { data: variants, error: variantsError }, { data: jobs, error: jobsError }] = await Promise.all([
    auth.userClient.from("asset_pages").select("*").eq("asset_id", assetId).order("page_number"),
    auth.userClient.from("asset_variants").select("id,asset_page_id,variant_type,mime_type,width,height,duration_ms,size_bytes,metadata,created_at").eq("asset_id", assetId).order("created_at"),
    auth.userClient.from("asset_processing_jobs").select("id,job_type,status,attempt_count,max_attempts,available_at,lease_expires_at,error_code,error_message_safe,created_at,updated_at,completed_at").eq("asset_id", assetId).order("created_at", { ascending: false }),
  ]);
  if (pagesError || variantsError || jobsError) throw new Error(pagesError?.message ?? variantsError?.message ?? jobsError?.message ?? "asset detail failed");

  return json({ asset, pages: pages ?? [], variants: variants ?? [], jobs: jobs ?? [], request_id: requestId });
}

async function signedRead(auth: AuthContext, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const assetId = uuid(body.asset_id, "asset_id");
  const variantId = optionalUuid(body.variant_id, "variant_id");
  const expiresIn = Math.min(Math.max(integer(body.expires_in, 900), 60), 3600);

  const { data: asset, error: assetError } = await auth.userClient
    .from("assets")
    .select("id,workspace_id,source_object_path")
    .eq("id", assetId)
    .maybeSingle();
  if (assetError) throw new Error(`asset lookup failed: ${assetError.message}`);
  if (!asset) return error("ASSET_NOT_FOUND", "Asset not found.", 404, requestId);

  let objectPath = String(asset.source_object_path ?? "");
  if (variantId) {
    const { data: variant, error: variantError } = await auth.userClient
      .from("asset_variants")
      .select("object_path")
      .eq("id", variantId)
      .eq("asset_id", assetId)
      .maybeSingle();
    if (variantError) throw new Error(`variant lookup failed: ${variantError.message}`);
    if (!variant) return error("VARIANT_NOT_FOUND", "Asset variant not found.", 404, requestId);
    objectPath = String(variant.object_path);
  }

  const { data: signed, error: signedError } = await auth.admin.storage.from(BUCKET).createSignedUrl(objectPath, expiresIn);
  if (signedError || !signed?.signedUrl) throw new Error(`signed read failed: ${signedError?.message ?? "missing URL"}`);
  return json({ asset_id: assetId, variant_id: variantId, signed_url: signed.signedUrl, expires_in: expiresIn, request_id: requestId });
}

async function archiveAsset(auth: AuthContext, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const assetId = uuid(body.asset_id, "asset_id");
  const { data: asset, error: assetError } = await auth.admin.from("assets").select("id,workspace_id,status").eq("id", assetId).maybeSingle();
  if (assetError) throw new Error(`asset lookup failed: ${assetError.message}`);
  if (!asset) return error("ASSET_NOT_FOUND", "Asset not found.", 404, requestId);
  await requireWorkspaceRole(auth.admin, String(asset.workspace_id), auth.userId, true);

  const { error: updateError } = await auth.admin.from("assets").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", assetId);
  if (updateError) throw new Error(`asset archive failed: ${updateError.message}`);
  await auth.admin.from("asset_processing_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("asset_id", assetId).in("status", ["queued", "retry_wait"]);
  return json({ asset_id: assetId, status: "archived", request_id: requestId });
}

async function authenticate(req: Request): Promise<AuthContext> {
  const supabaseUrl = required("SUPABASE_URL");
  const anonKey = required("SUPABASE_ANON_KEY");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError("UNAUTHENTICATED", "Sign in is required.", 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !data.user) throw new HttpError("UNAUTHENTICATED", "Sign in is required.", 401);
  return { userId: data.user.id, admin, userClient };
}

async function requireWorkspaceRole(admin: SupabaseClient, workspaceId: string, userId: string, editor: boolean): Promise<string> {
  const { data, error: membershipError } = await admin
    .from("organization_members")
    .select("role,status,organizations(status)")
    .eq("org_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (membershipError) throw new Error(`membership lookup failed: ${membershipError.message}`);
  if (!data || data.status !== "active") throw new HttpError("WORKSPACE_ACCESS_DENIED", "Workspace membership is required.", 403);
  const workspace = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;
  if (workspace?.status !== "active") throw new HttpError("WORKSPACE_SUSPENDED", "This Workspace is suspended.", 403);
  const role = String(data.role);
  if (editor && !EDITOR_ROLES.has(role)) throw new HttpError("EDITOR_ROLE_REQUIRED", "An editor role is required.", 403);
  return role;
}

function classifyAsset(filename: string, mimeType: string): AssetKind {
  const lower = filename.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || mimeType === "application/vnd.ms-powerpoint" || lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "powerpoint";
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("font/") || /\.(ttf|otf|woff2?)$/i.test(lower)) return "font";
  return "other";
}

function storageFilename(filename: string): string {
  const extension = filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  const stem = filename.replace(/\.[^.]+$/, "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "asset";
  return `${stem}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}${extension}`;
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function uuid(value: unknown, field: string): string {
  const parsed = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new HttpError("VALIDATION_FAILED", `${field} must be a UUID.`, 400);
  }
  return parsed;
}

function optionalUuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  return uuid(value, field);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

class HttpError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function mapError(cause: unknown, requestId: string): Response {
  if (cause instanceof HttpError) return error(cause.code, cause.message, cause.status, requestId);
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("monthly asset upload limit reached")) return error("ASSET_UPLOAD_LIMIT_REACHED", "This Workspace has reached its monthly source Asset upload limit.", 409, requestId);
  if (message.includes("workspace role required")) return error("EDITOR_ROLE_REQUIRED", "An editor role is required.", 403, requestId);
  if (message.includes("asset not found")) return error("ASSET_NOT_FOUND", "Asset not found.", 404, requestId);
  return error("INTERNAL_ERROR", "The Asset request could not be completed.", 500, requestId);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function error(code: string, message: string, status: number, requestId?: string): Response {
  return json({ error: { code, message, ...(requestId ? { request_id: requestId } : {}) } }, status);
}
