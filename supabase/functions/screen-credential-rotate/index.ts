// Manager-triggered device credential rotation — issues a new device
// token for a screen already claimed by the caller's organization and
// invalidates the old one immediately (device_token_hash is a unique
// column, so the update is atomic: old token stops authenticating the
// instant this succeeds). The raw token is returned exactly once; only
// its hash persists.

import { serveJson, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { requireManager } from "../_shared/managerAuth.ts";
import { randomHex, sha256 } from "../_shared/crypto.ts";
import { ApiError } from "../_shared/errors.ts";

serveJson(async (req) => {
  const admin = adminClient();
  const manager = await requireManager(admin, req, { minRole: "operator" });

  const body = (await req.json()) as Record<string, unknown>;
  const screenId = typeof body.screen_id === "string" ? body.screen_id : "";
  if (!screenId) throw ApiError.validation("screen_id is required.", { field: "screen_id" });

  const { data: screen, error: screenError } = await admin
    .from("screens")
    .select("id, status")
    .eq("id", screenId)
    .eq("org_id", manager.orgId)
    .maybeSingle();
  if (screenError) throw ApiError.internal(screenError.message);
  if (!screen) throw ApiError.crossOrg("That screen does not belong to your organization.");
  if (screen.status === "revoked") throw new ApiError("SCREEN_REVOKED", "A revoked screen cannot be re-credentialed — pair a new device instead.", 409);

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randomHex(32);
    const { error: updateError } = await admin.from("screens").update({ device_token_hash: await sha256(token) }).eq("id", screenId);
    if (!updateError) return json({ screen_id: screenId, device_token: token }, 200);
    if (!String(updateError.message).includes("device_token_hash")) throw ApiError.internal(updateError.message);
  }
  throw ApiError.internal("Could not allocate a new device credential after several attempts.");
}, ["POST"]);
