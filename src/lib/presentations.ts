import { supabase } from "./supabase";

export type PresentationAsset = {
  id: string;
  org_id: string;
  scene_id: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number | null;
  checksum_sha256: string | null;
  status: "pending_upload" | "uploaded" | "processing" | "ready" | "failed";
  uploaded_by: string;
  created_at: string;
  updated_at: string;
};

const BUCKET = "presentations";

function requireClient() {
  if (!supabase) throw new Error("Scena data access is not configured");
  return supabase;
}

export async function listPresentationAssets(orgId: string): Promise<PresentationAsset[]> {
  const { data, error } = await requireClient()
    .from("presentation_assets")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not load presentations");
  return (data ?? []) as PresentationAsset[];
}

async function invokeUploadApi<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireClient().functions.invoke("presentation-upload", { body: payload });
  if (error) {
    const context = (error as { context?: Response }).context;
    const detail = context ? await context.json().catch(() => null) as { error?: string } | null : null;
    throw new Error(uploadErrorMessage(detail?.error));
  }
  return data as T;
}

export async function uploadPresentation(file: File, sceneId?: string | null): Promise<PresentationAsset["id"]> {
  if (!/\.pptx$/i.test(file.name)) throw new Error("Only PowerPoint (.pptx) files can be uploaded");
  if (file.size === 0) throw new Error("This file is empty");
  if (file.size > 104857600) throw new Error("Presentations are limited to 100 MB");

  const created = await invokeUploadApi<{ asset_id: string; path: string; token: string }>({
    action: "create",
    filename: file.name,
    scene_id: sceneId ?? null,
  });

  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksum = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const { error: uploadError } = await requireClient()
    .storage.from(BUCKET)
    .uploadToSignedUrl(created.path, created.token, file, {
      contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
  if (uploadError) throw new Error("The upload did not complete. Please try again.");

  await invokeUploadApi<{ asset_id: string; status: string }>({
    action: "complete",
    asset_id: created.asset_id,
    checksum_sha256: checksum,
  });
  return created.asset_id;
}

function uploadErrorMessage(code: string | undefined): string {
  switch (code) {
    case "unauthorized": return "Your session has expired. Sign in again to upload.";
    case "no_organization_access": return "Your account is not linked to an MJCC organization";
    case "role_not_allowed": return "Viewers cannot upload presentations";
    case "invalid_filename": return "Only PowerPoint (.pptx) files can be uploaded";
    case "scene_not_found": return "The selected scene no longer exists";
    case "object_not_uploaded": return "The upload did not complete. Please try again.";
    case "object_invalid_size": return "The uploaded file was rejected by storage";
    default: return "Presentation upload failed";
  }
}
