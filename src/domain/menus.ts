import { requireSupabase } from "../services/supabase/client";
import { broadcastOrgInvalidation } from "../services/supabase/invalidation";
import { mapPostgresError } from "../shared/errors";
import { requireBoolean, requirePrice, requireSortOrder, requireString, requireUuid } from "../shared/validation";
import type { Tables } from "../shared/database.types";

export type Menu = Tables<"menus">;
export type MenuSection = Tables<"menu_sections">;
export type MenuItem = Tables<"menu_items">;

export interface RenderableMenu extends Menu {
  sections: Array<MenuSection & { items: MenuItem[] }>;
}

export async function listMenus(orgId: string, locationId?: string): Promise<Menu[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  let query = supabase.from("menus").select("*").eq("org_id", orgId).order("name");
  if (locationId) query = query.eq("location_id", requireUuid(locationId, "location_id"));
  const { data, error } = await query;
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

export async function createMenu(orgId: string, locationId: string, name: string): Promise<Menu> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("menus").insert({ org_id: orgId, location_id: locationId, name: cleanName }).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function renameMenu(orgId: string, menuId: string, name: string): Promise<Menu> {
  requireUuid(orgId, "org_id");
  requireUuid(menuId, "menu_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("menus").update({ name: cleanName }).eq("org_id", orgId).eq("id", menuId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

/** No archive flag exists on menus in the live schema; deleting is the
 * supported path. Referencing scenes RESTRICT the delete, which is the
 * correct guard against silently orphaning a live scene. */
export async function deleteMenu(orgId: string, menuId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(menuId, "menu_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("menus").delete().eq("org_id", orgId).eq("id", menuId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export async function createSection(orgId: string, menuId: string, name: string, sortOrder = 0): Promise<MenuSection> {
  requireUuid(orgId, "org_id");
  requireUuid(menuId, "menu_id");
  const cleanName = requireString(name, "name", { max: 120 });
  const order = requireSortOrder(sortOrder);
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("menu_sections")
    .insert({ org_id: orgId, menu_id: menuId, name: cleanName, sort_order: order })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function updateSection(
  orgId: string,
  sectionId: string,
  patch: Partial<{ name: string; sort_order: number; is_visible: boolean }>,
): Promise<MenuSection> {
  requireUuid(orgId, "org_id");
  requireUuid(sectionId, "section_id");
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = requireString(patch.name, "name", { max: 120 });
  if (patch.sort_order !== undefined) update.sort_order = requireSortOrder(patch.sort_order);
  if (patch.is_visible !== undefined) update.is_visible = requireBoolean(patch.is_visible, "is_visible");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("menu_sections").update(update).eq("org_id", orgId).eq("id", sectionId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function deleteSection(orgId: string, sectionId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(sectionId, "section_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("menu_sections").delete().eq("org_id", orgId).eq("id", sectionId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export async function reorderSections(orgId: string, order: Array<{ id: string; sort_order: number }>): Promise<void> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  for (const entry of order) {
    requireUuid(entry.id, "id");
    const sortOrder = requireSortOrder(entry.sort_order);
    const { error } = await supabase.from("menu_sections").update({ sort_order: sortOrder }).eq("org_id", orgId).eq("id", entry.id);
    if (error) throw mapPostgresError(error);
  }
  broadcastOrgInvalidation(orgId);
}

export interface MenuItemInput {
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  sort_order?: number;
}

export async function createItem(orgId: string, sectionId: string, input: MenuItemInput): Promise<MenuItem> {
  requireUuid(orgId, "org_id");
  requireUuid(sectionId, "section_id");
  const name = requireString(input.name, "name", { max: 120 });
  const price = requirePrice(input.price);
  const sortOrder = requireSortOrder(input.sort_order ?? 0);
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .insert({
      org_id: orgId,
      section_id: sectionId,
      name,
      description: input.description ?? null,
      price,
      image_url: input.image_url ?? null,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function updateItem(
  orgId: string,
  itemId: string,
  patch: Partial<{ name: string; description: string | null; price: number; image_url: string | null; sort_order: number; is_sold_out: boolean; is_visible: boolean }>,
): Promise<MenuItem> {
  requireUuid(orgId, "org_id");
  requireUuid(itemId, "item_id");
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = requireString(patch.name, "name", { max: 120 });
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.price !== undefined) update.price = requirePrice(patch.price);
  if (patch.image_url !== undefined) update.image_url = patch.image_url;
  if (patch.sort_order !== undefined) update.sort_order = requireSortOrder(patch.sort_order);
  if (patch.is_sold_out !== undefined) update.is_sold_out = requireBoolean(patch.is_sold_out, "is_sold_out");
  if (patch.is_visible !== undefined) update.is_visible = requireBoolean(patch.is_visible, "is_visible");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("menu_items").update(update).eq("org_id", orgId).eq("id", itemId).select("*").single();
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
  return data;
}

export async function deleteItem(orgId: string, itemId: string): Promise<void> {
  requireUuid(orgId, "org_id");
  requireUuid(itemId, "item_id");
  const supabase = requireSupabase();
  const { error } = await supabase.from("menu_items").delete().eq("org_id", orgId).eq("id", itemId);
  if (error) throw mapPostgresError(error);
  broadcastOrgInvalidation(orgId);
}

export async function setItemSoldOut(orgId: string, itemId: string, soldOut: boolean): Promise<MenuItem> {
  return updateItem(orgId, itemId, { is_sold_out: soldOut });
}

export async function reorderItems(orgId: string, order: Array<{ id: string; sort_order: number }>): Promise<void> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  for (const entry of order) {
    requireUuid(entry.id, "id");
    const sortOrder = requireSortOrder(entry.sort_order);
    const { error } = await supabase.from("menu_items").update({ sort_order: sortOrder }).eq("org_id", orgId).eq("id", entry.id);
    if (error) throw mapPostgresError(error);
  }
  broadcastOrgInvalidation(orgId);
}

/** The complete render-ready payload a scene/kiosk needs: menu -> visible sections -> visible items, in order. */
export async function getRenderableMenu(orgId: string, menuId: string): Promise<RenderableMenu | null> {
  requireUuid(orgId, "org_id");
  requireUuid(menuId, "menu_id");
  const supabase = requireSupabase();
  const { data: menu, error: menuError } = await supabase.from("menus").select("*").eq("org_id", orgId).eq("id", menuId).maybeSingle();
  if (menuError) throw mapPostgresError(menuError);
  if (!menu) return null;

  const { data: sections, error: sectionsError } = await supabase
    .from("menu_sections")
    .select("*, menu_items(*)")
    .eq("org_id", orgId)
    .eq("menu_id", menuId)
    .eq("is_visible", true)
    .order("sort_order");
  if (sectionsError) throw mapPostgresError(sectionsError);

  return {
    ...menu,
    sections: (sections ?? []).map((s) => {
      const { menu_items, ...section } = s as MenuSection & { menu_items: MenuItem[] };
      return {
        ...section,
        items: (menu_items ?? []).filter((i) => i.is_visible).sort((a, b) => a.sort_order - b.sort_order),
      };
    }),
  };
}
