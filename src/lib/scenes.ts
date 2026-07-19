import { supabase } from "./supabase";

export type MenuSceneConfig = { title: string; items: string[] };
export type SceneConfig = { title?: string; items?: string[]; asset_id?: string };
export type Scene = {
  id: string;
  org_id: string;
  name: string;
  scene_type: "menu" | "queue" | "slideshow" | "media" | "layout";
  config: SceneConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function requireClient() {
  if (!supabase) throw new Error("Scena data access is not configured");
  return supabase;
}

export async function listScenes(orgId: string): Promise<Scene[]> {
  const { data, error } = await requireClient().from("scenes").select("*").eq("org_id", orgId).order("updated_at", { ascending: false });
  if (error) throw new Error("Could not load scenes");
  return (data ?? []) as Scene[];
}

export async function createMenuScene(orgId: string, name: string, config: MenuSceneConfig): Promise<Scene> {
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Your session has expired");
  const { data, error } = await client.from("scenes").insert({
    org_id: orgId,
    name: name.trim(),
    scene_type: "menu",
    config,
    created_by: auth.user.id,
    updated_by: auth.user.id,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "Could not create scene");
  return data as Scene;
}

export async function createSlideshowScene(orgId: string, name: string, assetId: string): Promise<Scene> {
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Your session has expired");
  const { data, error } = await client.from("scenes").insert({
    org_id: orgId,
    name: name.trim(),
    scene_type: "slideshow",
    config: { title: name.trim(), asset_id: assetId },
    created_by: auth.user.id,
    updated_by: auth.user.id,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "Could not create scene");
  return data as Scene;
}

export async function updateMenuScene(sceneId: string, name: string, config: SceneConfig, isActive: boolean): Promise<Scene> {
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Your session has expired");
  const { data, error } = await client.from("scenes").update({
    name: name.trim(), config, is_active: isActive, updated_by: auth.user.id, updated_at: new Date().toISOString(),
  }).eq("id", sceneId).select("*").single();
  if (error || !data) throw new Error(error?.message || "Could not update scene");
  return data as Scene;
}

export async function deleteScene(sceneId: string): Promise<void> {
  const { error } = await requireClient().from("scenes").delete().eq("id", sceneId);
  if (error) throw new Error(error.message || "Could not delete scene");
}
