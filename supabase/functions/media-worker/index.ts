import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "scena-assets";
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

type Worker = {
  id: string;
  name: string;
  capabilities: string[];
  max_concurrent_jobs: number;
};

type Context = {
  admin: SupabaseClient;
  worker: Worker;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return error("METHOD_NOT_ALLOWED", "POST required.", 405);

  const requestId = crypto.randomUUID();
  try {
    const context = await authenticateWorker(req);
    const body = await req.json() as Record<string, unknown>;
    const action = text(body.action);

    if (action === "ping") {
      await context.admin.from("media_workers").update({ last_seen_at: new Date().toISOString() }).eq("id", context.worker.id);
      return json({ ok: true, worker_id: context.worker.id, worker_name: context.worker.name, capabilities: context.worker.capabilities, request_id: requestId });
    }
    if (action === "claim") return await claimJob(context, body, requestId);
    if (action === "heartbeat") return await heartbeat(context, body, requestId);
    if (action === "upload_targets") return await uploadTargets(context, body, requestId);
    if (action === "complete") return await completeJob(context, body, requestId);
    if (action === "fail") return await failJob(context, body, requestId);

    return error("VALIDATION_FAILED", "Unknown action.", 400, requestId);
  } catch (cause) {
    console.error(JSON.stringify({
      event: "media_worker_request_failed",
      request_id: requestId,
      error_name: cause instanceof Error ? cause.name : "unknown",
      error_message: cause instanceof Error ? cause.message : "unknown",
    }));
    return mapError(cause, requestId);
  }
});

async function claimJob(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const leaseSeconds = clampInteger(body.lease_seconds, 600, 60, 3600);
  const { count, error: countError } = await context.admin
    .from("asset_processing_jobs")
    .select("id", { count: "exact", head: true })
    .eq("lease_owner", context.worker.id)
    .in("status", ["leased", "processing"])
    .gte("lease_expires_at", new Date().toISOString());
  if (countError) throw new Error(`worker concurrency check failed: ${countError.message}`);
  if ((count ?? 0) >= context.worker.max_concurrent_jobs) {
    return json({ job: null, reason: "worker_capacity_reached", request_id: requestId });
  }

  const leaseToken = randomToken();
  const leaseHash = await sha256Hex(leaseToken);
  const { data: claimed, error: claimError } = await context.admin.rpc("claim_asset_processing_job", {
    target_worker_id: context.worker.id,
    target_lease_token_hash: leaseHash,
    lease_seconds: leaseSeconds,
  });
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return json({ job: null, request_id: requestId });

  const job = asRecord(claimed);
  const assetId = String(job.asset_id ?? "");
  const { data: asset, error: assetError } = await context.admin
    .from("assets")
    .select("id,workspace_id,asset_kind,original_filename,mime_type,source_object_path,source_size_bytes,metadata")
    .eq("id", assetId)
    .single();
  if (assetError || !asset?.source_object_path) throw new Error(`claimed Asset unavailable: ${assetError?.message ?? "source missing"}`);

  const { data: source, error: sourceError } = await context.admin.storage.from(BUCKET).createSignedUrl(String(asset.source_object_path), 900);
  if (sourceError || !source?.signedUrl) throw new Error(`source URL failed: ${sourceError?.message ?? "missing URL"}`);

  return json({
    job: {
      ...job,
      lease_token: leaseToken,
      lease_seconds: leaseSeconds,
      source: {
        bucket: BUCKET,
        object_path: asset.source_object_path,
        signed_download_url: source.signedUrl,
        original_filename: asset.original_filename,
        mime_type: asset.mime_type,
        asset_kind: asset.asset_kind,
        size_bytes: asset.source_size_bytes,
        metadata: asset.metadata,
      },
    },
    request_id: requestId,
  });
}

async function heartbeat(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const jobId = uuid(body.job_id, "job_id");
  const leaseToken = requiredText(body.lease_token, "lease_token");
  const leaseSeconds = clampInteger(body.lease_seconds, 600, 60, 3600);
  const leaseHash = await sha256Hex(leaseToken);
  const { data: accepted, error: heartbeatError } = await context.admin.rpc("heartbeat_asset_processing_job", {
    target_worker_id: context.worker.id,
    target_job_id: jobId,
    target_lease_token_hash: leaseHash,
    lease_seconds: leaseSeconds,
  });
  if (heartbeatError) throw new Error(heartbeatError.message);
  if (!accepted) return error("LEASE_INVALID", "The job lease is invalid or expired.", 409, requestId);
  return json({ job_id: jobId, status: "processing", lease_seconds: leaseSeconds, request_id: requestId });
}

async function uploadTargets(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const jobId = uuid(body.job_id, "job_id");
  const leaseToken = requiredText(body.lease_token, "lease_token");
  const requested = Array.isArray(body.outputs) ? body.outputs as unknown[] : [];
  if (requested.length === 0 || requested.length > 500) {
    return error("VALIDATION_FAILED", "Between 1 and 500 output targets are required.", 400, requestId);
  }

  const leaseHash = await sha256Hex(leaseToken);
  const { data: leaseAccepted, error: leaseError } = await context.admin.rpc("heartbeat_asset_processing_job", {
    target_worker_id: context.worker.id,
    target_job_id: jobId,
    target_lease_token_hash: leaseHash,
    lease_seconds: 900,
  });
  if (leaseError) throw new Error(leaseError.message);
  if (!leaseAccepted) return error("LEASE_INVALID", "The job lease is invalid or expired.", 409, requestId);

  const { data: job, error: jobError } = await context.admin
    .from("asset_processing_jobs")
    .select("id,workspace_id,asset_id,status")
    .eq("id", jobId)
    .eq("lease_owner", context.worker.id)
    .single();
  if (jobError || !job) throw new Error(`job lookup failed: ${jobError?.message ?? "missing job"}`);

  const canonical: Record<string, unknown>[] = [];
  const uploadTargets: Record<string, unknown>[] = [];

  for (const value of requested) {
    const item = asRecord(value);
    const relativePath = requiredText(item.relative_path, "relative_path");
    validateRelativePath(relativePath);
    const objectPath = `workspaces/${job.workspace_id}/assets/${job.asset_id}/outputs/${job.id}/${relativePath}`;
    const variantType = text(item.variant_type) || "other";
    const mimeType = text(item.mime_type) || "application/octet-stream";
    const descriptor = {
      relative_path: relativePath,
      object_path: objectPath,
      variant_type: variantType,
      mime_type: mimeType,
      page_number: nullableInteger(item.page_number),
    };

    const { data: signed, error: signedError } = await context.admin.storage
      .from(BUCKET)
      .createSignedUploadUrl(objectPath, { upsert: true });
    if (signedError || !signed?.signedUrl || !signed?.token) {
      throw new Error(`output URL failed for ${relativePath}: ${signedError?.message ?? "missing upload token"}`);
    }

    canonical.push(descriptor);
    uploadTargets.push({
      ...descriptor,
      signed_upload_url: signed.signedUrl,
      signed_upload_token: signed.token,
      upload_method: "PUT",
    });
  }

  const { data: outputsAccepted, error: outputError } = await context.admin.rpc("set_asset_processing_job_outputs", {
    target_worker_id: context.worker.id,
    target_job_id: jobId,
    target_lease_token_hash: leaseHash,
    target_outputs: canonical,
  });
  if (outputError) throw new Error(outputError.message);
  if (!outputsAccepted) return error("LEASE_INVALID", "The job lease is invalid or expired.", 409, requestId);

  return json({ job_id: jobId, outputs: uploadTargets, request_id: requestId });
}

async function completeJob(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const jobId = uuid(body.job_id, "job_id");
  const leaseToken = requiredText(body.lease_token, "lease_token");
  const outputs = Array.isArray(body.outputs) ? body.outputs : [];
  if (outputs.length === 0 || outputs.length > 500) return error("VALIDATION_FAILED", "Processed outputs are required.", 400, requestId);
  const manifestPath = text(body.manifest_path) || null;
  const pageCount = nullableInteger(body.page_count);
  const assetMetadata = isRecord(body.asset_metadata) ? body.asset_metadata : {};
  const leaseHash = await sha256Hex(leaseToken);

  const { data: completed, error: completeError } = await context.admin.rpc("complete_asset_processing_job", {
    target_worker_id: context.worker.id,
    target_job_id: jobId,
    target_lease_token_hash: leaseHash,
    target_outputs: outputs,
    target_manifest_path: manifestPath,
    target_page_count: pageCount,
    target_asset_metadata: assetMetadata,
  });
  if (completeError) throw new Error(completeError.message);
  return json({ ...asRecord(completed), request_id: requestId });
}

async function failJob(context: Context, body: Record<string, unknown>, requestId: string): Promise<Response> {
  const jobId = uuid(body.job_id, "job_id");
  const leaseToken = requiredText(body.lease_token, "lease_token");
  const errorCode = (text(body.error_code) || "PROCESSING_FAILED").slice(0, 120);
  const safeMessage = (text(body.error_message_safe) || "Media processing failed.").slice(0, 500);
  const leaseHash = await sha256Hex(leaseToken);

  const { data: failed, error: failError } = await context.admin.rpc("fail_asset_processing_job", {
    target_worker_id: context.worker.id,
    target_job_id: jobId,
    target_lease_token_hash: leaseHash,
    target_error_code: errorCode,
    target_error_message_safe: safeMessage,
  });
  if (failError) throw new Error(failError.message);
  return json({ ...asRecord(failed), request_id: requestId });
}

async function authenticateWorker(req: Request): Promise<Context> {
  const rawToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (rawToken.length < 32 || rawToken.length > 512) throw new HttpError("WORKER_UNAUTHENTICATED", "A valid worker token is required.", 401);
  const tokenHash = await sha256Hex(rawToken);
  const admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error: workerError } = await admin
    .from("media_workers")
    .select("id,name,capabilities,max_concurrent_jobs,status")
    .eq("token_hash", tokenHash)
    .eq("status", "active")
    .maybeSingle();
  if (workerError) throw new Error(`worker authentication failed: ${workerError.message}`);
  if (!data) throw new HttpError("WORKER_UNAUTHENTICATED", "A valid worker token is required.", 401);
  return {
    admin,
    worker: {
      id: String(data.id),
      name: String(data.name),
      capabilities: Array.isArray(data.capabilities) ? data.capabilities.map(String) : [],
      max_concurrent_jobs: Number(data.max_concurrent_jobs ?? 1),
    },
  };
}

function validateRelativePath(value: string): void {
  if (value.length > 240 || value.startsWith("/") || value.endsWith("/") || value.includes("..") || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value)) {
    throw new HttpError("VALIDATION_FAILED", "Output relative_path is invalid.", 400);
  }
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function requiredText(value: unknown, field: string): string {
  const parsed = text(value);
  if (!parsed) throw new HttpError("VALIDATION_FAILED", `${field} is required.`, 400);
  return parsed;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uuid(value: unknown, field: string): string {
  const parsed = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new HttpError("VALIDATION_FAILED", `${field} must be a UUID.`, 400);
  }
  return parsed;
}

function clampInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

function nullableInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new HttpError("VALIDATION_FAILED", "Expected an integer value.", 400);
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

class HttpError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function mapError(cause: unknown, requestId: string): Response {
  if (cause instanceof HttpError) return error(cause.code, cause.message, cause.status, requestId);
  const message = cause instanceof Error ? cause.message : "";
  if (message.includes("invalid or expired lease") || message.includes("invalid lease")) return error("LEASE_INVALID", "The job lease is invalid or expired.", 409, requestId);
  if (message.includes("output object missing") || message.includes("manifest object missing")) return error("OUTPUT_INCOMPLETE", "One or more processed outputs have not finished uploading.", 409, requestId);
  if (message.includes("job not found")) return error("JOB_NOT_FOUND", "Processing job not found.", 404, requestId);
  return error("WORKER_REQUEST_FAILED", "The media worker request could not be completed.", 500, requestId);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function error(code: string, message: string, status: number, requestId?: string): Response {
  return json({ error: { code, message, ...(requestId ? { request_id: requestId } : {}) } }, status);
}
