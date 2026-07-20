// Trusted callback from the private LXC presentation-processing service.
// Authenticated by a shared secret header (SCENA_LXC_CALLBACK_SECRET),
// never by a manager JWT — the LXC service is a backend peer, not a user.
// This is the only path that can move a presentation_assets row to
// 'ready' or 'failed'.

import { serveJson, json, requiredEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { timingSafeEqual } from "../_shared/crypto.ts";
import { ApiError } from "../_shared/errors.ts";
import { broadcastOrgInvalidation } from "../_shared/broadcast.ts";

serveJson(async (req) => {
  const expectedSecret = requiredEnv("SCENA_LXC_CALLBACK_SECRET");
  const providedSecret = req.headers.get("x-scena-callback-secret") ?? "";
  if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) throw ApiError.unauthenticated("Invalid callback secret.");

  const admin = adminClient();
  const body = (await req.json()) as Record<string, unknown>;
  const assetId = typeof body.presentation_asset_id === "string" ? body.presentation_asset_id : "";
  const outcome = typeof body.outcome === "string" ? body.outcome : "";
  if (!assetId) throw ApiError.validation("presentation_asset_id is required.");
  if (outcome !== "complete" && outcome !== "fail") throw ApiError.validation("outcome must be 'complete' or 'fail'.");

  const { data: asset, error: assetError } = await admin.from("presentation_assets").select("id, org_id, status").eq("id", assetId).maybeSingle();
  if (assetError) throw ApiError.internal(assetError.message);
  if (!asset) throw ApiError.notFound("Presentation");
  if (asset.status === "ready" || asset.status === "failed") return json({ asset_id: assetId, status: asset.status, idempotent: true }, 200);

  if (outcome === "fail") {
    const errorMessage = typeof body.error_message === "string" ? body.error_message.slice(0, 500) : "Processing failed.";
    const { error: updateError } = await admin.from("presentation_assets").update({ status: "failed", error_message: errorMessage }).eq("id", assetId);
    if (updateError) throw ApiError.internal(updateError.message);
    // A failed presentation doesn't change what any scene currently
    // resolves to (resolveSceneContent already required status='ready'),
    // so no kiosk is showing stale content — no broadcast needed here.
    return json({ asset_id: assetId, status: "failed" }, 200);
  }

  const manifestKey = typeof body.lxc_manifest_key === "string" ? body.lxc_manifest_key : "";
  const slideCount = typeof body.slide_count === "number" ? body.slide_count : NaN;
  if (!manifestKey || !Number.isInteger(slideCount) || slideCount <= 0) {
    throw ApiError.validation("lxc_manifest_key and a positive integer slide_count are required to mark a presentation ready.");
  }
  const { error: updateError } = await admin
    .from("presentation_assets")
    .update({ status: "ready", lxc_manifest_key: manifestKey, slide_count: slideCount, error_message: null })
    .eq("id", assetId);
  if (updateError) throw ApiError.internal(updateError.message);
  // Becoming 'ready' is the one presentation-status transition that can
  // change a scene's resolved content for a screen already live.
  await broadcastOrgInvalidation(asset.org_id);
  return json({ asset_id: assetId, status: "ready" }, 200);
}, ["POST"]);
