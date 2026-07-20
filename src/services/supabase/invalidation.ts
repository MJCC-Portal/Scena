// Display-invalidation broadcast (Strategy C from docs/DATABASE_SCHEMA.md
// §7): every manager mutation that can affect what a kiosk renders calls
// `broadcastOrgInvalidation(orgId)` after its write succeeds. This is a
// Realtime *Broadcast* send, not `postgres_changes` — broadcast channels
// are plain pub/sub, not gated by table RLS, which matters because the
// kiosk never holds a Supabase session (by design: it authenticates with
// its own opaque device token, never a manager JWT) and so has no RLS
// grant to receive `postgres_changes` events on screens/sessions/layouts/
// scenes/menus/etc. at all — that gap is exactly what made the previous
// `postgres_changes` subscription in Display.tsx a silent no-op.
//
// The broadcast payload carries no data the kiosk trusts — it's a bare
// hint. The kiosk always re-fetches full state via display-gateway after
// receiving one (see src/lib/display.ts), so a missed, duplicated, or
// cross-screen-irrelevant broadcast is harmless: worst case is one extra,
// idempotent poll. The existing interval poll is the unconditional
// backstop for a dropped socket or a missed broadcast.

import { requireSupabase } from "./client";

const channels = new Map<string, ReturnType<ReturnType<typeof requireSupabase>["channel"]>>();

function channelFor(orgId: string) {
  const supabase = requireSupabase();
  let channel = channels.get(orgId);
  if (!channel) {
    channel = supabase.channel(`org:${orgId}`, { config: { broadcast: { self: false, ack: false } } });
    channel.subscribe();
    channels.set(orgId, channel);
  }
  return channel;
}

/** Fire-and-forget: never throws into the caller's mutation flow — a
 * dropped hint is recovered by the kiosk's own polling, so a broadcast
 * failure must never fail (or even delay) the write it's announcing. */
export function broadcastOrgInvalidation(orgId: string): void {
  try {
    channelFor(orgId).send({ type: "broadcast", event: "invalidate", payload: { at: Date.now() } });
  } catch {
    /* best-effort — polling remains the source of truth */
  }
}
