// Automation execution worker. Not manager-triggered — invoke this on an
// interval from trusted infrastructure (a scheduler hitting this URL with
// the shared secret below), so automations fire whether or not any
// manager has the portal open. Not wired to pg_cron: enabling the pg_cron
// extension is a schema change and this run's boundary requires explicit
// approval before touching the live database beyond the two migrations
// already applied — see docs/DATABASE_SCHEMA.md for the proposal.
//
// Concurrency-safe by construction: claiming a due automation is a single
// conditional UPDATE (`next_run_at = null WHERE next_run_at <= now()`),
// so two overlapping worker invocations can never both execute the same
// row — Postgres resolves the race to exactly one writer.
//
// Execution reuses the exact same tables/triggers manager writes go
// through (display_sessions, display_session_screens), so entitlement
// limits, mode/layout validity, and single-live-session-per-screen rules
// are enforced identically whether a human or an automation made the
// change.

import { serveJson, json, requiredEnv } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { timingSafeEqual } from "../_shared/crypto.ts";
import { nextCronOccurrence } from "../_shared/cron.ts";
import { ApiError } from "../_shared/errors.ts";
import { broadcastOrgInvalidation } from "../_shared/broadcast.ts";

const BATCH_SIZE = 20;

interface AutomationRow {
  id: string;
  org_id: string;
  location_id: string;
  session_id: string;
  action_type: string;
  target_session_screen_id: string | null;
  target_layout_id: string | null;
  target_display_mode: string | null;
  schedule_type: "once" | "cron";
  cron_expression: string | null;
}

serveJson(async (req) => {
  const expectedSecret = requiredEnv("SCENA_AUTOMATIONS_RUN_SECRET");
  const providedSecret = req.headers.get("x-scena-callback-secret") ?? "";
  if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) throw ApiError.unauthenticated("Invalid worker secret.");

  const admin = adminClient();
  const nowIso = new Date().toISOString();
  const { data: due, error: dueError } = await admin
    .from("display_automations")
    .select("id, org_id, location_id, session_id, action_type, target_session_screen_id, target_layout_id, target_display_mode, schedule_type, cron_expression")
    .eq("is_enabled", true)
    .lte("next_run_at", nowIso)
    .limit(BATCH_SIZE);
  if (dueError) throw ApiError.internal(dueError.message);

  const results: Array<{ id: string; outcome: "executed" | "skipped_raced" | "failed"; error?: string }> = [];

  for (const automation of (due ?? []) as AutomationRow[]) {
    // Atomic claim: only the first invocation to hit this WHERE wins.
    const { data: claimed, error: claimError } = await admin
      .from("display_automations")
      .update({ next_run_at: null })
      .eq("id", automation.id)
      .eq("is_enabled", true)
      .lte("next_run_at", nowIso)
      .select("id")
      .maybeSingle();
    if (claimError) { results.push({ id: automation.id, outcome: "failed", error: claimError.message }); continue; }
    if (!claimed) { results.push({ id: automation.id, outcome: "skipped_raced" }); continue; }

    try {
      await executeAutomation(admin, automation);
      const patch: Record<string, unknown> = { last_run_at: new Date().toISOString() };
      if (automation.schedule_type === "once") {
        patch.is_enabled = false; // a one-shot automation cannot recur; next_run_at stays null
      } else if (automation.cron_expression) {
        patch.next_run_at = nextCronOccurrence(automation.cron_expression, new Date()).toISOString();
      }
      await admin.from("display_automations").update(patch).eq("id", automation.id);
      await broadcastOrgInvalidation(automation.org_id);
      results.push({ id: automation.id, outcome: "executed" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`automation ${automation.id} failed`, message);
      // No last_error/failure_count column exists on display_automations
      // today (see docs/DATABASE_SCHEMA.md §5b) — last_run_at is the only
      // durable signal until that's added.
      //
      // Retry behavior: cron automations reschedule to their next natural
      // occurrence, same as success. 'once' automations get a fixed
      // 5-minute backoff instead of being left with next_run_at=null —
      // null would never again satisfy `next_run_at <= now()`, silently
      // stranding the automation forever with zero observability. This is
      // a deliberate, bounded-but-unlimited retry loop (no failure_count
      // column to cap it on): a permanently broken 'once' automation
      // retries every 5 minutes until a manager disables it. Strictly
      // better than the alternative (looks scheduled, never runs, no
      // signal at all) — the proposed failure_count migration (§5b) is
      // what would let this circuit-break automatically instead.
      const patch: Record<string, unknown> = { last_run_at: new Date().toISOString() };
      if (automation.schedule_type === "cron" && automation.cron_expression) {
        try { patch.next_run_at = nextCronOccurrence(automation.cron_expression, new Date()).toISOString(); } catch { /* leave next_run_at null */ }
      } else {
        patch.next_run_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      await admin.from("display_automations").update(patch).eq("id", automation.id);
      results.push({ id: automation.id, outcome: "failed", error: message });
    }
  }

  return json({ processed: results.length, results }, 200);
}, ["POST"]);

async function executeAutomation(admin: ReturnType<typeof adminClient>, a: AutomationRow) {
  switch (a.action_type) {
    case "start_session": {
      const { error } = await admin
        .from("display_sessions")
        .update({ status: "active", started_at: new Date().toISOString() })
        .eq("id", a.session_id)
        .eq("org_id", a.org_id)
        .eq("status", "draft");
      if (error) throw error;
      return;
    }
    case "stop_session": {
      const { error } = await admin
        .from("display_sessions")
        .update({ status: "stopped", stopped_at: new Date().toISOString() })
        .eq("id", a.session_id)
        .eq("org_id", a.org_id)
        .eq("status", "active");
      if (error) throw error;
      return;
    }
    case "set_display_mode": {
      const { error } = await admin
        .from("display_sessions")
        .update({ display_mode: a.target_display_mode, shared_layout_id: a.target_layout_id })
        .eq("id", a.session_id)
        .eq("org_id", a.org_id);
      if (error) throw error;
      return;
    }
    case "set_shared_layout": {
      const { error } = await admin.from("display_sessions").update({ shared_layout_id: a.target_layout_id }).eq("id", a.session_id).eq("org_id", a.org_id);
      if (error) throw error;
      return;
    }
    case "set_screen_layout": {
      const { error } = await admin
        .from("display_session_screens")
        .update({ layout_id: a.target_layout_id })
        .eq("id", a.target_session_screen_id)
        .eq("org_id", a.org_id)
        .eq("session_id", a.session_id);
      if (error) throw error;
      return;
    }
    case "enable_screen":
    case "disable_screen": {
      const { error } = await admin
        .from("display_session_screens")
        .update({ is_enabled: a.action_type === "enable_screen" })
        .eq("id", a.target_session_screen_id)
        .eq("org_id", a.org_id)
        .eq("session_id", a.session_id);
      if (error) throw error;
      return;
    }
    case "switch_primary_screen": {
      const { error: clearError } = await admin
        .from("display_session_screens")
        .update({ is_primary: false })
        .eq("org_id", a.org_id)
        .eq("session_id", a.session_id)
        .eq("is_primary", true);
      if (clearError) throw clearError;
      const { error } = await admin
        .from("display_session_screens")
        .update({ is_primary: true })
        .eq("id", a.target_session_screen_id)
        .eq("org_id", a.org_id)
        .eq("session_id", a.session_id);
      if (error) throw error;
      return;
    }
    default:
      throw new Error(`unknown action_type: ${a.action_type}`);
  }
}
