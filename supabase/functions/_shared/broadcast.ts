// Deno-side twin of src/services/supabase/invalidation.ts — Edge
// Functions run stateless per-request, so instead of holding a socket
// open they send a one-off Realtime Broadcast via Supabase's REST
// broadcast endpoint, service-role authenticated. Same channel naming
// (`org:{orgId}`) and same "hint only, never throws" contract as the
// browser-side sender — see that file for why Broadcast (not
// `postgres_changes`) is the mechanism the kiosk can actually receive.

import { requiredEnv } from "./http.ts";

export async function broadcastOrgInvalidation(orgId: string): Promise<void> {
  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ messages: [{ topic: `org:${orgId}`, event: "invalidate", payload: { at: Date.now() } }] }),
    });
  } catch (err) {
    // Best-effort — the kiosk's own poll interval is the backstop, so a
    // broadcast failure must never fail the write it's announcing.
    console.warn("broadcastOrgInvalidation failed (non-fatal)", err instanceof Error ? err.message : String(err));
  }
}
