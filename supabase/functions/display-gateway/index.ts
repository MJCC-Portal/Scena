// Scena display gateway — the only API kiosks talk to.
//
// A kiosk never holds a Supabase session, service key, or manager JWT.
// It authenticates with the opaque device token issued at registration
// (screen-register) or claim (screen-claim); every state poll re-sends
// that token, hashed and matched against screens.device_token_hash here.
// The kiosk cannot request an arbitrary organization or session — its
// identity is entirely determined by which screen row the token resolves
// to, and every downstream lookup is scoped through that screen's own
// org_id/location_id.
//
// verify_jwt is OFF: kiosks are unauthenticated until claimed. All data
// access happens with the service role inside this function.

import { serveJson, json } from "../_shared/http.ts";
import { adminClient } from "../_shared/adminClient.ts";
import { sha256 } from "../_shared/crypto.ts";
import { ApiError } from "../_shared/errors.ts";
import { resolveDisplayState, type LayoutData, type SessionData, type SessionScreenData, type TileData } from "../_shared/displayState.ts";

serveJson(async (req) => {
  const admin = adminClient();
  const body = (await req.json()) as Record<string, unknown>;
  const token = typeof body.device_token === "string" ? body.device_token : "";
  if (!token || token.length > 200) throw new ApiError("DEVICE_CREDENTIAL_INVALID", "Missing or malformed device token.", 401);

  const { data: screen, error: screenError } = await admin
    .from("screens")
    .select("id, org_id, location_id, name, status, revoked_at")
    .eq("device_token_hash", await sha256(token))
    .maybeSingle();
  if (screenError) throw ApiError.internal(screenError.message);
  if (!screen) throw new ApiError("DEVICE_CREDENTIAL_INVALID", "Unrecognized device.", 401);
  if (screen.status === "revoked" || screen.revoked_at) throw new ApiError("SCREEN_REVOKED", "This screen's credential has been revoked.", 403);

  await admin.from("screens").update({ last_seen_at: new Date().toISOString() }).eq("id", screen.id);

  if (screen.status === "pairing") return json({ status: "pending", screen_name: screen.name }, 200);

  // org_id lets the kiosk join its org's `org:{orgId}` invalidation
  // broadcast channel (Realtime Broadcast, not RLS-gated postgres_changes
  // — see _shared/broadcast.ts and src/services/supabase/invalidation.ts
  // for why: this kiosk connection has no Supabase session at all).

  // Ready screen: find its current live assignment, if any.
  const { data: sessionScreen, error: ssError } = await admin
    .from("display_session_screens")
    .select("id, session_id, is_enabled, is_primary, layout_id, rotation_degrees, viewport_x_percent, viewport_y_percent, viewport_width_percent, viewport_height_percent")
    .eq("screen_id", screen.id)
    .eq("assignment_status", "active")
    .maybeSingle();
  if (ssError) throw ApiError.internal(ssError.message);

  let session: SessionData | null = null;
  if (sessionScreen) {
    const { data: sessionRow, error: sessionError } = await admin
      .from("display_sessions")
      .select("id, name, status, display_mode, shared_layout_id, updated_at")
      .eq("id", sessionScreen.session_id)
      .maybeSingle();
    if (sessionError) throw ApiError.internal(sessionError.message);
    session = sessionRow as SessionData | null;
  }

  const layoutId = session && (session.display_mode === "duplicate" || session.display_mode === "extend") ? session.shared_layout_id : sessionScreen?.layout_id ?? null;
  const layout = layoutId ? await fetchResolvedLayout(admin, screen.org_id!, layoutId) : null;

  const resolved = resolveDisplayState(
    screen.name,
    session,
    (sessionScreen as SessionScreenData | null) ?? null,
    (id) => (layout && layout.id === id ? layout : null),
    () => new Date().toISOString(),
  );
  return json({ ...resolved, org_id: screen.org_id }, 200);
}, ["POST"]);

async function fetchResolvedLayout(admin: ReturnType<typeof adminClient>, orgId: string, layoutId: string): Promise<LayoutData | null> {
  const { data: layoutRow, error: layoutError } = await admin
    .from("display_layouts")
    .select("id, name, canvas_width, canvas_height, background_color, updated_at")
    .eq("org_id", orgId)
    .eq("id", layoutId)
    .maybeSingle();
  if (layoutError) throw ApiError.internal(layoutError.message);
  if (!layoutRow) return null;

  const { data: tileRows, error: tilesError } = await admin
    .from("display_layout_tiles")
    .select("id, scene_id, x_percent, y_percent, width_percent, height_percent, z_index, is_visible, config")
    .eq("org_id", orgId)
    .eq("layout_id", layoutId)
    .eq("is_visible", true)
    .order("z_index");
  if (tilesError) throw ApiError.internal(tilesError.message);

  const tiles: TileData[] = [];
  for (const tile of tileRows ?? []) {
    const content = await resolveSceneContent(admin, orgId, tile.scene_id);
    tiles.push({ ...tile, content });
  }
  return { ...layoutRow, tiles };
}

/** Deno-side twin of src/domain/scenes.ts#resolveSceneContent — same
 * resolution rules, service-role I/O instead of the browser client. */
async function resolveSceneContent(admin: ReturnType<typeof adminClient>, orgId: string, sceneId: string): Promise<unknown> {
  const { data: scene, error: sceneError } = await admin
    .from("scenes")
    .select("scene_type, menu_id, presentation_asset_id, is_active")
    .eq("org_id", orgId)
    .eq("id", sceneId)
    .maybeSingle();
  if (sceneError) throw ApiError.internal(sceneError.message);
  if (!scene || !scene.is_active) return null;

  if (scene.scene_type === "menu" && scene.menu_id) {
    const { data: menu, error: menuError } = await admin.from("menus").select("id, name").eq("org_id", orgId).eq("id", scene.menu_id).maybeSingle();
    if (menuError) throw ApiError.internal(menuError.message);
    if (!menu) return null;
    const { data: sections, error: sectionsError } = await admin
      .from("menu_sections")
      .select("id, name, sort_order, menu_items(id, name, description, price, image_url, is_sold_out, is_visible, sort_order)")
      .eq("org_id", orgId)
      .eq("menu_id", menu.id)
      .eq("is_visible", true)
      .order("sort_order");
    if (sectionsError) throw ApiError.internal(sectionsError.message);
    return {
      scene_type: "menu",
      menu: {
        id: menu.id,
        name: menu.name,
        sections: (sections ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          items: ((s as unknown as { menu_items: Array<Record<string, unknown>> }).menu_items ?? [])
            .filter((i) => i.is_visible)
            .sort((a, b) => (a.sort_order as number) - (b.sort_order as number)),
        })),
      },
    };
  }

  if (scene.scene_type === "powerpoint" && scene.presentation_asset_id) {
    const { data: asset, error: assetError } = await admin
      .from("presentation_assets")
      .select("status, lxc_manifest_key, slide_count")
      .eq("org_id", orgId)
      .eq("id", scene.presentation_asset_id)
      .maybeSingle();
    if (assetError) throw ApiError.internal(assetError.message);
    if (!asset || asset.status !== "ready" || !asset.lxc_manifest_key || asset.slide_count === null) return null;
    return { scene_type: "powerpoint", manifest_key: asset.lxc_manifest_key, slide_count: asset.slide_count };
  }
  return null;
}
