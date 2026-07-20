import { requireSupabase } from "../services/supabase/client";
import { broadcastOrgInvalidation } from "../services/supabase/invalidation";
import { ApiError, mapPostgresError } from "../shared/errors";
import { requireBoolean, requireString, requireUuid } from "../shared/validation";
import type { Json, Tables } from "../shared/database.types";
import { getRenderableMenu, type RenderableMenu } from "./menus";

export type Scene = Tables<"scenes">;
export type SceneType = "menu" | "powerpoint";

export async function listScenes(orgId: string, locationId?: string): Promise<Scene[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  let query = supabase.from("scenes").select("*").eq("org_id", orgId).order("name");
  if (locationId) query = query.eq("location_id", requireUuid(locationId, "location_id"));
  const { data, error } = await query;
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

export async function createMenuScene(orgId: string, locationId: string, name: string, menuId: string, config: Json = {}): Promise<Scene> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  requireUuid(menuId, "menu_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("scenes")
    .insert({ org_id: orgId, location_id: locationId, name: cleanName, scene_type: "menu", menu_id: menuId, config })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function createPresentationScene(
  orgId: string,
  locationId: string,
  name: string,
  presentationAssetId: string,
  config: Json = {},
): Promise<Scene> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  requireUuid(presentationAssetId, "presentation_asset_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data: asset, error: assetError } = await supabase
    .from("presentation_assets")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("id", presentationAssetId)
    .maybeSingle();
  if (assetError) throw mapPostgresError(assetError);
  if (!asset) throw ApiError.notFound("Presentation");
  if (asset.status !== "ready") throw new ApiError("PRESENTATION_NOT_READY", "This presentation hasn't finished processing yet.", 409);

  const { data, error } = await supabase
    .from("scenes")
    .insert({ org_id: orgId, location_id: locationId, name: cleanName, scene_type: "powerpoint", presentation_asset_id: presentationAssetId, config })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function updateScene(
  orgId: string,
  sceneId: string,
  patch: Partial<{ name: string; config: Json; is_active: boolean }>,
): Promise<Scene> {
  requireUuid(orgId, "org_id");
  requireUuid(sceneId, "scene_id");
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = requireString(patch.name, "name", { max: 120 });
  if (patch.config !== undefined) update.config = patch.config;
  if (patch.is_active !== undefined) update.is_active = requireBoolean(patch.is_active, "is_active");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("scenes").update(update).eq("org_id", orgId).eq("id", sceneId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

/** Scenes referenced by layout tiles RESTRICT the delete — deactivate first if a tile still points at it. */
export async function deleteScene(orgId: string, sceneId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(sceneId, "scene_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("scenes").delete().eq("org_id", orgId).eq("id", sceneId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export type ResolvedSceneContent =
  | { scene_type: "menu"; menu: RenderableMenu }
  | { scene_type: "powerpoint"; manifest_key: string; slide_count: number };

/** Resolves a scene down to what a display actually renders — a full menu payload or a presentation manifest reference. Never returns a bare foreign key for the kiosk to chase itself. */
export async function resolveSceneContent(orgId: string, scene: Scene): Promise<ResolvedSceneContent | null> {
  const supabase = requireSupabase();
  if (scene.scene_type === "menu") {
    if (!scene.menu_id) return null;
    const menu = await getRenderableMenu(orgId, scene.menu_id);
    return menu ? { scene_type: "menu", menu } : null;
  }
  if (!scene.presentation_asset_id) return null;
  const { data: asset, error } = await supabase
    .from("presentation_assets")
    .select("lxc_manifest_key, slide_count, status")
    .eq("org_id", orgId)
    .eq("id", scene.presentation_asset_id)
    .maybeSingle();
  if (error) throw mapPostgresError(error);
  if (!asset || asset.status !== "ready" || !asset.lxc_manifest_key || asset.slide_count === null) return null;
  return { scene_type: "powerpoint", manifest_key: asset.lxc_manifest_key, slide_count: asset.slide_count };
}
