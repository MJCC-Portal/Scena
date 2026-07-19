import { supabase } from "./supabase";

export type Screen = {
  id: string;
  org_id: string;
  session_id: string | null;
  label: string;
  assigned_scene_id: string | null;
  last_seen_at: string | null;
  revoked_at: string | null;
  claimed_at: string | null;
  created_at: string;
};

const ONLINE_WINDOW_MS = 20000;

function requireClient() {
  if (!supabase) throw new Error("Scena data access is not configured");
  return supabase;
}

export function isOnline(screen: Screen): boolean {
  return !!screen.last_seen_at && Date.now() - new Date(screen.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

export async function listScreens(orgId: string): Promise<Screen[]> {
  const { data, error } = await requireClient()
    .from("display_connections")
    .select("id, org_id, session_id, label, assigned_scene_id, last_seen_at, revoked_at, claimed_at, created_at")
    .eq("org_id", orgId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Could not load screens");
  return (data ?? []) as Screen[];
}

export async function claimScreen(code: string, name: string, sceneId: string | null): Promise<void> {
  const { data, error } = await requireClient().functions.invoke("screen-claim", {
    body: { code, name, scene_id: sceneId },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    const detail = context ? await context.json().catch(() => null) as { error?: string } | null : null;
    throw new Error(claimErrorMessage(detail?.error));
  }
  if (!data?.screen) throw new Error("Pairing failed");
}

export async function assignScreen(screenId: string, sceneId: string | null): Promise<void> {
  const { error } = await requireClient()
    .from("display_connections")
    .update({ assigned_scene_id: sceneId })
    .eq("id", screenId);
  if (error) throw new Error("Could not assign the scene");
}

export async function renameScreen(screenId: string, label: string): Promise<void> {
  const { error } = await requireClient()
    .from("display_connections")
    .update({ label: label.trim() })
    .eq("id", screenId);
  if (error) throw new Error("Could not rename the screen");
}

export async function unpairScreen(screenId: string): Promise<void> {
  const { error } = await requireClient()
    .from("display_connections")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", screenId);
  if (error) throw new Error("Could not unpair the screen");
}

// Clearing overrides makes every screen follow the broadcast session.
export async function clearAssignments(orgId: string): Promise<void> {
  const { error } = await requireClient()
    .from("display_connections")
    .update({ assigned_scene_id: null })
    .eq("org_id", orgId)
    .is("revoked_at", null);
  if (error) throw new Error("Could not update screen assignments");
}

function claimErrorMessage(code: string | undefined): string {
  switch (code) {
    case "unauthorized": return "Your session has expired. Sign in again.";
    case "no_organization_access": return "Your account is not linked to an MJCC organization";
    case "role_not_allowed": return "Viewers cannot pair screens";
    case "invalid_code": return "Enter the 6-digit code shown on the kiosk";
    case "invalid_name": return "Give the screen a name";
    case "code_not_found": return "That code doesn't match any waiting kiosk";
    case "code_expired": return "That code expired — refresh the kiosk for a new one";
    case "scene_not_found": return "The chosen starting scene no longer exists";
    default: return "Pairing failed";
  }
}
