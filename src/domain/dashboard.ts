// Dashboard summary aggregation — TIMELINE.md Block B requires real
// counts ("Do not create fake metrics"). src/pages/home/HomePage.tsx is
// currently a static welcome message with no data; this module is the
// backend piece Wednesday's UI build wires up, not a UI change itself.
//
// Every count is a head-only, exact count query (no rows fetched) so this
// stays cheap regardless of Team size.

import { requireSupabase } from "../services/supabase/client";
import { mapPostgresError } from "../shared/errors";
import { requireUuid } from "../shared/validation";
import { getEntitlement, type Entitlement } from "./organizations";

/** A screen is "online" if it has polled display-gateway within this
 * window. display-gateway stamps last_seen_at on every poll
 * (supabase/functions/display-gateway/index.ts); there is no separate
 * heartbeat/liveness table, so this is a threshold over that column, not
 * a fabricated status. 5 minutes is deliberately generous relative to
 * typical kiosk poll intervals to avoid false "offline" flicker. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export interface DashboardSummary {
  board_count: number;
  asset_count: number;
  display_count: number;
  displays_online: number;
  plan: Entitlement;
}

export async function getDashboardSummary(orgId: string): Promise<DashboardSummary> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();

  const [boardCount, assetCount, displayCount, displaysOnline, plan] = await Promise.all([
    countRows(supabase, "display_layouts", orgId),
    countRows(supabase, "presentation_assets", orgId),
    countRows(supabase, "screens", orgId),
    supabase
      .from("screens")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "ready")
      .gte("last_seen_at", onlineSince)
      .then(({ count, error }) => {
        if (error) throw mapPostgresError(error);
        return count ?? 0;
      }),
    getEntitlement(orgId),
  ]);

  return { board_count: boardCount, asset_count: assetCount, display_count: displayCount, displays_online: displaysOnline, plan };
}

async function countRows(supabase: ReturnType<typeof requireSupabase>, table: "display_layouts" | "presentation_assets" | "screens", orgId: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId);
  if (error) throw mapPostgresError(error);
  return count ?? 0;
}
