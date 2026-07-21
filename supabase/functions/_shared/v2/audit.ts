// Audit-event helper — SHAPE ONLY, NOT WIRED TO ANY LIVE ENDPOINT. There
// is currently no `audit_events` table in the live database. The proposed
// DDL and field list are documented in docs/API_V2.md; this session did
// not apply it because Phase 2 is foundation-only and no v2 endpoint yet
// produces a real audit-worthy action (see docs/API_V2.md for why this is
// deliberate, not an oversight).
//
// Once the table exists, a route calls recordAuditEvent() after a
// successful mutation with the actor/action/resource/request_id — never
// with raw secrets or credentials (INV-6).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuditEventInput {
  actorUserId: string | null;
  orgId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  requestId: string;
  source: "user" | "system" | "webhook" | "worker";
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/** No-op until `audit_events` exists live — logs locally instead so the call site is already correct once the table lands. */
export async function recordAuditEvent(_admin: SupabaseClient, event: AuditEventInput): Promise<void> {
  console.log(JSON.stringify({
    level: "info",
    message: "audit_event (not yet persisted — no audit_events table live)",
    action: event.action,
    resource_type: event.resourceType,
    resource_id: event.resourceId,
    request_id: event.requestId,
    source: event.source,
  }));
}
