import { requireSupabase } from "../services/supabase/client";
import { mapPostgresError } from "../shared/errors";
import { requireSlug, requireString, requireUuid } from "../shared/validation";
import type { Tables } from "../shared/database.types";

export type Location = Tables<"locations">;

export async function listLocations(orgId: string): Promise<Location[]> {
  requireUuid(orgId, "org_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("locations").select("*").eq("org_id", orgId).order("name");
  if (error) throw mapPostgresError(error);
  return data ?? [];
}

export async function getLocation(orgId: string, locationId: string): Promise<Location | null> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("locations").select("*").eq("org_id", orgId).eq("id", locationId).maybeSingle();
  if (error) throw mapPostgresError(error);
  return data;
}

export async function createLocation(orgId: string, input: { name: string; slug: string; timezone?: string }): Promise<Location> {
  requireUuid(orgId, "org_id");
  const name = requireString(input.name, "name", { max: 120 });
  const slug = requireSlug(input.slug);
  const timezone = input.timezone ? requireString(input.timezone, "timezone", { max: 64 }) : "America/New_York";
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("locations").insert({ org_id: orgId, name, slug, timezone }).select("*").single();
  if (error) throw mapPostgresError(error);
  return data;
}

export async function updateLocation(
  orgId: string,
  locationId: string,
  patch: Partial<{ name: string; slug: string; timezone: string }>,
): Promise<Location> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const update: Record<string, string> = {};
  if (patch.name !== undefined) update.name = requireString(patch.name, "name", { max: 120 });
  if (patch.slug !== undefined) update.slug = requireSlug(patch.slug);
  if (patch.timezone !== undefined) update.timezone = requireString(patch.timezone, "timezone", { max: 64 });
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("locations").update(update).eq("org_id", orgId).eq("id", locationId).select("*").single();
  if (error) throw mapPostgresError(error);
  return data;
}

/** Locations aren't deletable — only deactivated, so history (menus, scenes, sessions) referencing them stays intact. */
export async function setLocationActive(orgId: string, locationId: string, active: boolean): Promise<Location> {
  requireUuid(orgId, "org_id");
  requireUuid(locationId, "location_id");
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("locations")
    .update({ status: active ? "active" : "inactive" })
    .eq("org_id", orgId)
    .eq("id", locationId)
    .select("*")
    .single();
  if (error) throw mapPostgresError(error);
  return data;
}
