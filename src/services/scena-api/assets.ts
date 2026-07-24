import { callScenaFunction } from "./client";
import { classifyUploadableAsset, SCENA_UI_API_CAPABILITIES, type UploadableAssetKind } from "./capabilities";
import { ScenaApiError } from "./errors";

export type AssetKind = "image" | "powerpoint" | "pdf" | "video" | "audio" | "font" | "other";
export type AssetStatus =
  | "pending_upload"
  | "uploaded"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "archived";

export type AssetVariantType =
  | "source_render"
  | "thumbnail"
  | "preview"
  | "display_1080p"
  | "display_4k"
  | "audio_playback"
  | "audio_preview"
  | "waveform"
  | "manifest"
  | "extracted_text"
  | "other";

export interface AssetSummary {
  id: string;
  workspace_id: string;
  asset_kind: AssetKind;
  original_filename: string;
  mime_type: string;
  source_size_bytes: number | null;
  status: AssetStatus;
  page_count: number | null;
  metadata: Record<string, unknown>;
  error_code: string | null;
  error_message_safe: string | null;
  source_uploaded_at: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetPage {
  id: string;
  workspace_id: string;
  asset_id: string;
  page_number: number;
  title: string | null;
  extracted_text: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AssetVariant {
  id: string;
  asset_page_id: string | null;
  variant_type: AssetVariantType;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AssetPreview {
  asset_id: string;
  page_id: string | null;
  page_number: number | null;
  variant_id: string | null;
  variant_type: AssetVariantType | "source";
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  signed_url: string;
  expires_in: number;
  request_id: string;
}

export interface AssetProcessingJob {
  id: string;
  job_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  lease_expires_at: string | null;
  error_code: string | null;
  error_message_safe: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateAssetUploadResponse {
  asset_id: string;
  workspace_id: string;
  asset_kind: AssetKind;
  status: "pending_upload";
  bucket: string;
  object_path: string;
  signed_upload_url: string;
  signed_upload_token: string;
  upload_method: "PUT";
  max_source_bytes: number;
  request_id: string;
}

export interface FinalizeAssetUploadResponse {
  asset_id: string;
  job_id?: string | null;
  status: AssetStatus;
  idempotent: boolean;
  request_id: string;
}

export interface AssetListResponse {
  assets: AssetSummary[];
  request_id: string;
}

export interface AssetDetailResponse {
  asset: AssetSummary;
  pages: AssetPage[];
  variants: AssetVariant[];
  jobs: AssetProcessingJob[];
  request_id: string;
}

export interface SignedAssetReadResponse {
  asset_id: string;
  variant_id: string | null;
  page_id: string | null;
  page_number: number | null;
  variant_type: AssetVariantType | "source";
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  size_bytes: number | null;
  metadata: Record<string, unknown>;
  signed_url: string;
  expires_in: number;
  request_id: string;
}

export interface AssetPreviewOptions {
  pageId?: string | null;
  pageNumber?: number | null;
  preference?: "thumbnail" | "full";
  expiresIn?: number;
  signal?: AbortSignal;
}

export interface AssetListFilters {
  status?: AssetStatus;
  assetKind?: AssetKind;
  limit?: number;
  signal?: AbortSignal;
}

export interface WaitForAssetOptions {
  timeoutMs?: number;
  pollMs?: number;
  signal?: AbortSignal;
}

export async function createAssetUpload(
  workspaceId: string,
  file: Pick<File, "name" | "type" | "size">,
  signal?: AbortSignal,
): Promise<CreateAssetUploadResponse> {
  const kind = classifyUploadableAsset(file);
  if (!kind) {
    throw new ScenaApiError(
      "UNSUPPORTED_ASSET_TYPE",
      "Scena currently accepts images, PDFs, and PowerPoint files up to 250 MB.",
      400,
    );
  }

  return callScenaFunction<CreateAssetUploadResponse>(
    "asset-upload",
    {
      action: "create",
      workspace_id: workspaceId,
      filename: file.name,
      mime_type: normalizedMimeType(file, kind),
      size_bytes: file.size,
    },
    { signal },
  );
}

export async function uploadAssetSource(
  target: Pick<CreateAssetUploadResponse, "signed_upload_url" | "upload_method">,
  file: Blob,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(target.signed_upload_url, {
      method: target.upload_method,
      headers: {
        "content-type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw ScenaApiError.transport("The source Asset could not be uploaded.");
  }

  if (!response.ok) {
    throw new ScenaApiError(
      "SOURCE_UPLOAD_FAILED",
      `The source Asset upload failed with HTTP ${response.status}.`,
      response.status,
    );
  }
}

export async function finalizeAssetUpload(
  assetId: string,
  signal?: AbortSignal,
): Promise<FinalizeAssetUploadResponse> {
  return callScenaFunction<FinalizeAssetUploadResponse>(
    "asset-upload",
    { action: "finalize", asset_id: assetId },
    { signal },
  );
}

export async function uploadAsset(
  workspaceId: string,
  file: File,
  signal?: AbortSignal,
): Promise<FinalizeAssetUploadResponse> {
  const target = await createAssetUpload(workspaceId, file, signal);
  await uploadAssetSource(target, file, signal);
  return finalizeAssetUpload(target.asset_id, signal);
}

export async function listAssets(
  workspaceId: string,
  filters: AssetListFilters = {},
): Promise<AssetListResponse> {
  return callScenaFunction<AssetListResponse>(
    "asset-upload",
    {
      action: "list",
      workspace_id: workspaceId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assetKind ? { asset_kind: filters.assetKind } : {}),
      ...(filters.limit ? { limit: filters.limit } : {}),
    },
    { signal: filters.signal },
  );
}

export async function getAsset(
  assetId: string,
  signal?: AbortSignal,
): Promise<AssetDetailResponse> {
  return callScenaFunction<AssetDetailResponse>(
    "asset-upload",
    { action: "get", asset_id: assetId },
    { signal },
  );
}

export async function signAssetRead(
  assetId: string,
  variantId?: string | null,
  expiresIn = 900,
  signal?: AbortSignal,
): Promise<SignedAssetReadResponse> {
  return callScenaFunction<SignedAssetReadResponse>(
    "asset-upload",
    {
      action: "signed_read",
      asset_id: assetId,
      ...(variantId ? { variant_id: variantId } : {}),
      expires_in: expiresIn,
    },
    { signal },
  );
}

export async function getAssetPreview(
  assetId: string,
  options: AssetPreviewOptions = {},
): Promise<AssetPreview> {
  const detail = await getAsset(assetId, options.signal);
  const variant = selectAssetPreviewVariant(detail, options.preference ?? "thumbnail", {
    pageId: options.pageId,
    pageNumber: options.pageNumber,
  });

  if (!variant) {
    throw new ScenaApiError(
      "PREVIEW_NOT_AVAILABLE",
      "This Asset does not have an image preview yet.",
      409,
      detail.request_id,
    );
  }

  return signAssetRead(assetId, variant.id, options.expiresIn, options.signal);
}

export async function archiveAsset(
  assetId: string,
  signal?: AbortSignal,
): Promise<{ asset_id: string; status: "archived"; request_id: string }> {
  return callScenaFunction(
    "asset-upload",
    { action: "archive", asset_id: assetId },
    { signal },
  );
}

export async function waitForAsset(
  assetId: string,
  options: WaitForAssetOptions = {},
): Promise<AssetDetailResponse> {
  const timeoutMs = options.timeoutMs ?? 180_000;
  const pollMs = Math.max(options.pollMs ?? 1_500, 250);
  const started = Date.now();

  while (true) {
    options.signal?.throwIfAborted();
    const detail = await getAsset(assetId, options.signal);

    if (detail.asset.status === "ready") return detail;
    if (detail.asset.status === "failed" || detail.asset.status === "archived") {
      throw new ScenaApiError(
        detail.asset.error_code ?? "PROCESSING_FAILED",
        detail.asset.error_message_safe ?? "Asset processing did not complete.",
        422,
        detail.request_id,
      );
    }

    if (Date.now() - started >= timeoutMs) {
      throw new ScenaApiError(
        "PROCESSING_TIMEOUT",
        "Asset processing is taking longer than expected. It will continue in the background.",
        408,
        detail.request_id,
      );
    }

    await sleep(pollMs, options.signal);
  }
}

export function selectAssetPreviewVariant(
  detail: Pick<AssetDetailResponse, "variants"> & Partial<Pick<AssetDetailResponse, "pages">>,
  preference: "thumbnail" | "full" = "thumbnail",
  scope: Pick<AssetPreviewOptions, "pageId" | "pageNumber"> = {},
): AssetVariant | null {
  const order: AssetVariantType[] = preference === "thumbnail"
    ? ["thumbnail", "preview", "source_render", "display_1080p"]
    : ["source_render", "preview", "display_1080p", "thumbnail"];

  const pageIdForNumber = scope.pageNumber === undefined || scope.pageNumber === null
    ? null
    : detail.pages?.find((page) => page.page_number === scope.pageNumber)?.id ?? null;
  const scoped = detail.variants.filter((candidate) => {
    if (scope.pageId && candidate.asset_page_id !== scope.pageId) return false;
    if (pageIdForNumber && candidate.asset_page_id !== pageIdForNumber) return false;
    if (scope.pageNumber !== undefined && scope.pageNumber !== null && !pageIdForNumber) return false;
    return true;
  });

  for (const type of order) {
    const variant = scoped.find(
      (candidate) => candidate.variant_type === type && candidate.mime_type.startsWith("image/"),
    );
    if (variant) return variant;
  }
  return null;
}

export function isUploadableAsset(file: Pick<File, "name" | "type" | "size">): boolean {
  return classifyUploadableAsset(file) !== null;
}

export const MAX_ASSET_SOURCE_BYTES = SCENA_UI_API_CAPABILITIES.assets.maxSourceBytes;

function normalizedMimeType(
  file: Pick<File, "name" | "type">,
  kind: UploadableAssetKind,
): string {
  if (file.type) return file.type;
  if (kind === "pdf") return "application/pdf";
  if (kind === "powerpoint") {
    return file.name.toLowerCase().endsWith(".ppt")
      ? "application/vnd.ms-powerpoint"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  return "application/octet-stream";
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
  });
}
