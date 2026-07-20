// Kiosk device registration — the first call an unpaired kiosk makes.
//
// Creates (or, if the kiosk already has a locally-stored device token,
// this is skipped client-side and the kiosk goes straight to
// display-state) a persistent `screens` row with status='pairing' and a
// high-entropy device credential, plus a short-lived 6-digit pairing code
// a manager types into the portal. The credential is returned to the
// kiosk exactly once, in this response, and never again — only its hash
// is stored (screens.device_token_hash). No Supabase session, service
// key, or manager JWT ever reaches the kiosk.

import { serveJson, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { randomHex, randomSixDigitCode, sha256 } from "../_shared/crypto.ts";
import { ApiError } from "../_shared/errors.ts";

const PAIR_TTL_MS = 30 * 60 * 1000; // matches screen_pairing_codes_check1 (expires_at <= created_at + 30m)

serveJson(async () => {
  const admin = adminClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const deviceToken = randomHex(32);
    const code = randomSixDigitCode();
    const deviceTokenHash = await sha256(deviceToken);
    const codeHash = await sha256(code);

    const { data: screen, error: screenError } = await admin
      .from("screens")
      .insert({ name: "New Screen", device_token_hash: deviceTokenHash, status: "pairing" })
      .select("id")
      .single();
    if (screenError) {
      if (String(screenError.message).includes("device_token_hash")) continue; // collision, retry
      throw ApiError.internal(screenError.message);
    }

    const { error: codeError } = await admin.from("screen_pairing_codes").insert({
      screen_id: screen.id,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + PAIR_TTL_MS).toISOString(),
    });
    if (codeError) {
      if (String(codeError.message).includes("screen_pairing_codes_code_hash_key")) {
        await admin.from("screens").delete().eq("id", screen.id); // pairing code collision, roll back the screen row and retry
        continue;
      }
      throw ApiError.internal(codeError.message);
    }

    return json({ screen_id: screen.id, device_token: deviceToken, code, expires_in: PAIR_TTL_MS / 1000 }, 200);
  }
  throw ApiError.internal("Could not allocate a pairing code after several attempts.");
}, ["POST"]);
