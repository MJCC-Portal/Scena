// Server-side idempotency helper — SHAPE ONLY, NOT WIRED TO ANY LIVE
// ENDPOINT. There is currently no `idempotency_keys` table in the live
// database; this session deliberately did not create one, because no
// v2 endpoint yet performs a mutation that would use it (adding an unused
// table would be a migration solely to "look clean", which this repo's
// rules forbid). See docs/API_V2.md's proposed-migration section for the
// exact DDL to apply when the first idempotent v2 mutation is built
// (expected in Phase 3 — Team/billing alignment).
//
// Once that table exists, an endpoint that supports retries should:
//   1. Read the idempotency key via readIdempotencyKey() (./request.ts).
//   2. Call withIdempotency() below, passing a function that performs the
//      actual mutation and returns the response payload to cache.
//   3. Let this helper insert-if-absent / return the cached result /
//      raise IDEMPOTENCY_CONFLICT on a payload mismatch for a reused key.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface IdempotencyStore {
  /** Table name holding {key, request_hash, response_body, created_at}. Not yet created live. */
  table: string;
}

/**
 * Placeholder for the real implementation. Throws PROCESSING_FAILED-shaped
 * guidance rather than silently no-op'ing, so a future caller can't
 * accidentally ship a "supports idempotency" claim that isn't backed by
 * anything yet.
 */
export async function withIdempotency<T>(
  _admin: SupabaseClient,
  _store: IdempotencyStore,
  _key: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  if (_key) {
    // No store exists yet — proceed without deduping rather than pretending to.
    console.warn(JSON.stringify({ level: "warn", message: "idempotency key supplied but no idempotency store is wired yet", key_present: true }));
  }
  return operation();
}
