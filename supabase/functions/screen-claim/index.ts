// Manager screen claim — binds a pairing code shown on a kiosk to the
// calling manager's organization and location.
//
// This is the only write path that attaches org_id/location_id to a
// screen, so it runs service-role after verifying the caller is an
// owner/admin/operator (requireManager). Everything else about a screen
// (rename, reassign location, revoke) is plain RLS-protected CRUD in
// src/domain/screens.ts; this function exists because claiming crosses
// the pairing-code table, which no client role can read or write.
//
// Attempt/lockout tracking (screen_pairing_codes.attempt_count /
// locked_until) is scoped to the pairing-code row itself: because
// code_hash is looked up via its unique index, an attacker cannot
// enumerate rows without already guessing a valid hash, so the fields
// exist to stop a manager hammering retries against one stale/expired
// code rather than to defend the (inherently small) 6-digit code space —
// that defense is the 30-minute expiry plus single-use consumption.

import { serveJson, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { requireManager } from "../_shared/managerAuth.ts";
import { sha256 } from "../_shared/crypto.ts";
import { ApiError } from "../_shared/errors.ts";
import { broadcastOrgInvalidation } from "../_shared/broadcast.ts";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

serveJson(async (req) => {
  const admin = adminClient();
  const manager = await requireManager(admin, req, { minRole: "operator" });

  const body = (await req.json()) as Record<string, unknown>;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const locationId = typeof body.location_id === "string" ? body.location_id : "";
  if (!/^\d{6}$/.test(code)) throw ApiError.validation("code must be a 6-digit code.", { field: "code" });
  if (!name || name.length > 80) throw ApiError.validation("name is required (max 80 characters).", { field: "name" });
  if (!locationId) throw ApiError.validation("location_id is required.", { field: "location_id" });

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("org_id", manager.orgId)
    .maybeSingle();
  if (locationError) throw ApiError.internal(locationError.message);
  if (!location) throw ApiError.crossOrg("That location does not belong to your organization.");

  const codeHash = await sha256(code);
  const { data: pairing, error: pairingError } = await admin
    .from("screen_pairing_codes")
    .select("screen_id, expires_at, consumed_at, attempt_count, locked_until")
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (pairingError) throw ApiError.internal(pairingError.message);
  if (!pairing) throw new ApiError("PAIRING_CODE_INVALID", "That pairing code was not recognized.", 404);

  const now = Date.now();
  if (pairing.locked_until && new Date(pairing.locked_until).getTime() > now) {
    throw new ApiError("PAIRING_CODE_LOCKED", "Too many attempts — try again later or re-pair the kiosk.", 423);
  }
  if (pairing.consumed_at) throw new ApiError("PAIRING_CODE_CONSUMED", "That pairing code was already used.", 409);
  if (new Date(pairing.expires_at).getTime() < now) {
    await bumpAttempt(admin, pairing.screen_id, pairing.attempt_count);
    throw new ApiError("PAIRING_CODE_EXPIRED", "That pairing code expired — re-pair the kiosk.", 410);
  }

  // Consume the code and activate the screen in one pass. The unique
  // (screen_id) PK on screen_pairing_codes plus this update's WHERE guard
  // makes a concurrent double-claim race resolve to exactly one winner.
  const { error: consumeError } = await admin
    .from("screen_pairing_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("screen_id", pairing.screen_id)
    .is("consumed_at", null);
  if (consumeError) throw ApiError.internal(consumeError.message);

  const { data: screen, error: screenError } = await admin
    .from("screens")
    .update({ org_id: manager.orgId, location_id: locationId, name, status: "ready", claimed_at: new Date().toISOString() })
    .eq("id", pairing.screen_id)
    .eq("status", "pairing")
    .select("id, name, org_id, location_id, status, claimed_at")
    .maybeSingle();
  if (screenError) throw ApiError.internal(screenError.message);
  if (!screen) throw new ApiError("PAIRING_CODE_CONSUMED", "That pairing code was already used.", 409);

  await broadcastOrgInvalidation(manager.orgId);
  return json({ screen }, 200);
}, ["POST"]);

async function bumpAttempt(admin: ReturnType<typeof adminClient>, screenId: string, currentAttempts: number) {
  const nextAttempts = currentAttempts + 1;
  const patch: Record<string, unknown> = { attempt_count: nextAttempts };
  if (nextAttempts >= MAX_ATTEMPTS) patch.locked_until = new Date(Date.now() + LOCKOUT_MS).toISOString();
  await admin.from("screen_pairing_codes").update(patch).eq("screen_id", screenId);
}
