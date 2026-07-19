import { supabase } from "./supabase";

export type DisplaySession = {
  id: string;
  org_id: string;
  name: string;
  status: "draft" | "active" | "stopped" | "expired";
  current_scene_id: string | null;
  started_by: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

function requireClient() {
  if (!supabase) throw new Error("Scena data access is not configured");
  return supabase;
}

export async function getActiveSession(orgId: string): Promise<DisplaySession | null> {
  const { data, error } = await requireClient()
    .from("display_sessions")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("Could not load the active session");
  return (data ?? null) as DisplaySession | null;
}

// "Take live": stop whatever is active, then start a new session on the
// chosen scene. The partial unique index (one active session per org)
// backstops races between two managers.
export async function takeSceneLive(orgId: string, sceneId: string, sceneName: string): Promise<DisplaySession> {
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Your session has expired");
  const now = new Date().toISOString();
  const { error: stopError } = await client
    .from("display_sessions")
    .update({ status: "stopped", ended_at: now, updated_at: now })
    .eq("org_id", orgId)
    .eq("status", "active");
  if (stopError) throw new Error(stopError.message || "Could not stop the current session");
  const { data, error } = await client.from("display_sessions").insert({
    org_id: orgId,
    name: sceneName,
    status: "active",
    current_scene_id: sceneId,
    started_by: auth.user.id,
    started_at: now,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message || "Could not start the session");
  return data as DisplaySession;
}

export async function stopSession(orgId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await requireClient()
    .from("display_sessions")
    .update({ status: "stopped", ended_at: now, updated_at: now })
    .eq("org_id", orgId)
    .eq("status", "active");
  if (error) throw new Error(error.message || "Could not stop the session");
}
