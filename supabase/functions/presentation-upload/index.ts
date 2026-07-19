// Scena presentation upload API.
//
// Managers (owner/admin/operator) request a short-lived signed upload URL
// for the private "presentations" bucket, upload the .pptx directly from
// the browser, then confirm completion so the registry row records size,
// checksum, and processing status. Clients never receive service
// credentials and never write presentation_assets directly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "presentations";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_SIZE_BYTES = 104857600; // keep in sync with the bucket file_size_limit

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = required("SUPABASE_URL");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !auth.user) return json({ error: "unauthorized" }, 401);
    const userId = auth.user.id;

    const body = await req.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    const { data: membership, error: memberError } = await admin
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return json({ error: "no_organization_access" }, 403);
    if (!["owner", "admin", "operator"].includes(String(membership.role))) {
      return json({ error: "role_not_allowed" }, 403);
    }
    const orgId = String(membership.org_id);

    if (action === "create") {
      const filename = typeof body.filename === "string" ? body.filename.trim() : "";
      if (!filename || filename.length > 255 || !/\.pptx$/i.test(filename)) {
        return json({ error: "invalid_filename" }, 400);
      }
      const sceneId = typeof body.scene_id === "string" && body.scene_id ? body.scene_id : null;
      if (sceneId) {
        const { data: scene, error: sceneError } = await admin
          .from("scenes").select("id").eq("id", sceneId).eq("org_id", orgId).maybeSingle();
        if (sceneError) throw sceneError;
        if (!scene) return json({ error: "scene_not_found" }, 404);
      }

      const assetId = crypto.randomUUID();
      const storagePath = `${orgId}/${assetId}.pptx`;
      const { error: insertError } = await admin.from("presentation_assets").insert({
        id: assetId,
        org_id: orgId,
        scene_id: sceneId,
        storage_path: storagePath,
        original_filename: filename,
        mime_type: PPTX_MIME,
        status: "pending_upload",
        uploaded_by: userId,
      });
      if (insertError) throw insertError;

      const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (signError || !signed) throw signError ?? new Error("could not create signed upload url");

      return json({ asset_id: assetId, path: signed.path, token: signed.token }, 200);
    }

    if (action === "complete") {
      const assetId = typeof body.asset_id === "string" ? body.asset_id : "";
      const checksum = typeof body.checksum_sha256 === "string" ? body.checksum_sha256.toLowerCase() : "";
      if (!assetId) return json({ error: "invalid_request" }, 400);
      if (!/^[0-9a-f]{64}$/.test(checksum)) return json({ error: "invalid_checksum" }, 400);

      const { data: asset, error: assetError } = await admin
        .from("presentation_assets")
        .select("id, org_id, storage_path, status")
        .eq("id", assetId)
        .eq("org_id", orgId)
        .maybeSingle();
      if (assetError) throw assetError;
      if (!asset) return json({ error: "asset_not_found" }, 404);
      if (asset.status !== "pending_upload") return json({ error: "asset_not_pending" }, 409);

      // Confirm the object actually landed in the private bucket and read
      // its stored size; trust storage, not the client, for size.
      const folder = String(asset.storage_path).split("/").slice(0, -1).join("/");
      const objectName = String(asset.storage_path).split("/").at(-1) ?? "";
      const { data: objects, error: listError } = await admin.storage.from(BUCKET).list(folder, { search: objectName });
      if (listError) throw listError;
      const stored = (objects ?? []).find((entry) => entry.name === objectName);
      if (!stored) return json({ error: "object_not_uploaded" }, 409);
      const sizeBytes = Number(stored.metadata?.size ?? 0);
      if (!sizeBytes || sizeBytes > MAX_SIZE_BYTES) return json({ error: "object_invalid_size" }, 409);

      const { error: updateError } = await admin
        .from("presentation_assets")
        .update({ status: "uploaded", size_bytes: sizeBytes, checksum_sha256: checksum, updated_at: new Date().toISOString() })
        .eq("id", assetId)
        .eq("status", "pending_upload");
      if (updateError) throw updateError;

      return json({ asset_id: assetId, status: "uploaded", size_bytes: sizeBytes }, 200);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("presentation-upload failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
