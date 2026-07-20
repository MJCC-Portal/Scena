import { requireSupabase } from "../services/supabase/client";
import { broadcastOrgInvalidation } from "../services/supabase/invalidation";
import { ApiError, mapPostgresError } from "../shared/errors";
import { requireBoolean, requirePercent, requireString, requireUuid } from "../shared/validation";
import type { Json, Tables } from "../shared/database.types";

export type Layout = Tables<"display_layouts">;
export type LayoutTile = Tables<"display_layout_tiles">;

export interface RenderableLayout extends Layout {
  tiles: LayoutTile[];
}

export async function listLayouts(orgId: string, locationId?: string): Promise<Layout[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  let query = supabase.from("display_layouts").select("*").eq("org_id", orgId).order("name");
  if (locationId) query = query.eq("location_id", requireUuid(locationId, "location_id"));
  const { data, error } = await query;
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

export async function createLayout(
  orgId: string,
  locationId: string,
  input: { name: string; canvas_width?: number; canvas_height?: number; background_color?: string },
): Promise<Layout> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const name = requireString(input.name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("display_layouts")
    .insert({
      org_id: orgId,
      location_id: locationId,
      name,
      canvas_width: input.canvas_width ?? 1920,
      canvas_height: input.canvas_height ?? 1080,
      background_color: input.background_color ?? "#000000",
    })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function updateLayout(
  orgId: string,
  layoutId: string,
  patch: Partial<{ name: string; canvas_width: number; canvas_height: number; background_color: string; is_active: boolean }>,
): Promise<Layout> {
  requireUuid(orgId, "org_id");
  requireUuid(layoutId, "layout_id");
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = requireString(patch.name, "name", { max: 120 });
  if (patch.canvas_width !== undefined) update.canvas_width = patch.canvas_width;
  if (patch.canvas_height !== undefined) update.canvas_height = patch.canvas_height;
  if (patch.background_color !== undefined) update.background_color = patch.background_color;
  if (patch.is_active !== undefined) update.is_active = requireBoolean(patch.is_active, "is_active");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_layouts").update(update).eq("org_id", orgId).eq("id", layoutId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

/** Layouts referenced by a session/session-screen/automation RESTRICT the
 * delete; deactivating (is_active=false) is the safe default action. */
export async function deleteLayout(orgId: string, layoutId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(layoutId, "layout_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("display_layouts").delete().eq("org_id", orgId).eq("id", layoutId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export async function duplicateLayout(orgId: string, layoutId: string, newName: string): Promise<RenderableLayout> {
  requireUuid(orgId, "org_id");
  requireUuid(layoutId, "layout_id");
  const name = requireString(newName, "name", { max: 120 });
  const source = await getRenderableLayout(orgId, layoutId);
  if (!source) throw ApiError.notFound("Layout");

  const supabase = requireSupabase();
  const { data: layout, error: layoutError } = await supabase
    .from("display_layouts")
    .insert({
      org_id: orgId,
      location_id: source.location_id,
      name,
      canvas_width: source.canvas_width,
      canvas_height: source.canvas_height,
      background_color: source.background_color,
    })
    .select("*")
    .single();
  if (layoutError) throw mapPostgresError(layoutError);

  if (source.tiles.length > 0) {
    const { error: tilesError } = await supabase.from("display_layout_tiles").insert(
      source.tiles.map((t) => ({
        org_id: orgId,
        location_id: source.location_id,
        layout_id: layout.id,
        scene_id: t.scene_id,
        x_percent: t.x_percent,
        y_percent: t.y_percent,
        width_percent: t.width_percent,
        height_percent: t.height_percent,
        z_index: t.z_index,
        is_visible: t.is_visible,
        config: t.config,
      })),
    );
    if (tilesError) throw mapPostgresError(tilesError);
  }
  broadcastOrgInvalidation(orgId);
  return (await getRenderableLayout(orgId, layout.id))!;
}

export async function getRenderableLayout(orgId: string, layoutId: string): Promise<RenderableLayout | null> {
  requireUuid(orgId, "org_id");
  requireUuid(layoutId, "layout_id");
  const supabase = requireSupabase();
  const { data: layout, error: layoutError } = await supabase.from("display_layouts").select("*").eq("org_id", orgId).eq("id", layoutId).maybeSingle();
  if (layoutError) throw mapPostgresError(layoutError);
  if (!layout) return null;
  const { data: tiles, error: tilesError } = await supabase
    .from("display_layout_tiles")
    .select("*")
    .eq("org_id", orgId)
    .eq("layout_id", layoutId)
    .order("z_index");
  if (tilesError) throw mapPostgresError(tilesError);
  return { ...layout, tiles: tiles ?? [] };
}

export interface TileInput {
  scene_id: string;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  z_index?: number;
  is_visible?: boolean;
  config?: Json;
}

function validateTileGeometry(t: TileInput) {
  const x = requirePercent(t.x_percent, "x_percent");
  const y = requirePercent(t.y_percent, "y_percent");
  const w = requirePercent(t.width_percent, "width_percent");
  const h = requirePercent(t.height_percent, "height_percent");
  if (w <= 0) throw ApiError.validation("width_percent must be greater than 0.", { field: "width_percent" });
  if (h <= 0) throw ApiError.validation("height_percent must be greater than 0.", { field: "height_percent" });
  if (x + w > 100) throw ApiError.validation("Tile extends past the right edge of the canvas.", { field: "width_percent" });
  if (y + h > 100) throw ApiError.validation("Tile extends past the bottom edge of the canvas.", { field: "height_percent" });
  return { x, y, w, h };
}

export async function addTile(orgId: string, locationId: string, layoutId: string, input: TileInput): Promise<LayoutTile> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  requireUuid(layoutId, "layout_id");
  requireUuid(input.scene_id, "scene_id");
  const { x, y, w, h } = validateTileGeometry(input);
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("display_layout_tiles")
    .insert({
      org_id: orgId,
      location_id: locationId,
      layout_id: layoutId,
      scene_id: input.scene_id,
      x_percent: x,
      y_percent: y,
      width_percent: w,
      height_percent: h,
      z_index: input.z_index ?? 0,
      is_visible: input.is_visible ?? true,
      config: input.config ?? {},
    })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function updateTile(orgId: string, tileId: string, patch: Partial<TileInput>): Promise<LayoutTile> {
  requireUuid(orgId, "org_id");
  requireUuid(tileId, "tile_id");
  const update: Record<string, unknown> = {};
  if (patch.scene_id !== undefined) update.scene_id = requireUuid(patch.scene_id, "scene_id");
  if (patch.x_percent !== undefined) update.x_percent = requirePercent(patch.x_percent, "x_percent");
  if (patch.y_percent !== undefined) update.y_percent = requirePercent(patch.y_percent, "y_percent");
  if (patch.width_percent !== undefined) update.width_percent = requirePercent(patch.width_percent, "width_percent");
  if (patch.height_percent !== undefined) update.height_percent = requirePercent(patch.height_percent, "height_percent");
  if (patch.z_index !== undefined) update.z_index = patch.z_index;
  if (patch.is_visible !== undefined) update.is_visible = requireBoolean(patch.is_visible, "is_visible");
  if (patch.config !== undefined) update.config = patch.config;
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("display_layout_tiles").update(update).eq("org_id", orgId).eq("id", tileId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function removeTile(orgId: string, tileId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(tileId, "tile_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("display_layout_tiles").delete().eq("org_id", orgId).eq("id", tileId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export async function reorderTileLayers(orgId: string, order: Array<{ id: string; z_index: number }>): Promise<void> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  for (const entry of order) {
    requireUuid(entry.id, "id");
    const { error } = await supabase.from("display_layout_tiles").update({ z_index: entry.z_index }).eq("org_id", orgId).eq("id", entry.id);
    if (error) throw mapPostgresError(error);
  }
  broadcastOrgInvalidation(orgId);
}
