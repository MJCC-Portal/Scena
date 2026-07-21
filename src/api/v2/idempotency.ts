// Idempotency-key helper for the v2 client. Generates the key the caller
// attaches to a mutation that can safely be retried (checkout creation,
// Team provisioning, Session commands, etc. — see docs/API_V2.md's
// idempotency targets list).
//
// This is the CLIENT half only. There is currently no server-side
// idempotency store — no v2 endpoint in this phase performs a mutation
// that needs one yet, and adding an unused `idempotency_keys` table now
// would violate this repo's "no migration merely to look clean" rule.
// The proposed schema for when a real endpoint needs it is documented in
// docs/API_V2.md; supabase/functions/_shared/v2/idempotency.ts has the
// matching (currently unwired) server-side helper shape.

import { IDEMPOTENCY_KEY_HEADER } from "./request";

export { IDEMPOTENCY_KEY_HEADER };

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
