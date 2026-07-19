// Scena screen claim — a manager enters the 6-digit code a kiosk is
// showing, binding that device to the manager's organization.
//
// This is the only write path that attaches an org to a display
// connection, so it runs service-role after verifying the caller is an
// owner/admin/operator of the org. Managers' other screen edits
// (rename, assign, unpair) go through column-limited RLS directly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabaseUrl = required("SUPABASE_URL");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "unauthorized" }, 401);
    const { data: auth, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !auth.user) return json({ error: "unauthorized" }, 401);

    const { data: membership, error: memberError } = await admin
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!membership) return json({ error: "no_organization_access" }, 403);
    if (!["owner", "admin", "operator"].includes(String(membership.role))) {
      return json({ error: "role_not_allowed" }, 403);
    }
    const orgId = String(membership.org_id);

    const body = await req.json() as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const sceneId = typeof body.scene_id === "string" && body.scene_id ? body.scene_id : null;
    if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code" }, 400);
    if (!name || name.length > 80) return json({ error: "invalid_name" }, 400);

    if (sceneId) {
      const { data: scene, error: sceneError } = await admin
        .from("scenes").select("id").eq("id", sceneId).eq("org_id", orgId).maybeSingle();
      if (sceneError) throw sceneError;
      if (!scene) return json({ error: "scene_not_found" }, 404);
    }

    const { data: conn, error: connError } = await admin
      .from("display_connections")
      .select("id, pair_expires_at")
      .eq("pair_code_hash", await sha256(code))
      .is("claimed_at", null)
      .is("revoked_at", null)
      .maybeSingle();
    if (connError) throw connError;
    if (!conn) return json({ error: "code_not_found" }, 404);
    if (conn.pair_expires_at && new Date(String(conn.pair_expires_at)).getTime() < Date.now()) {
      return json({ error: "code_expired" }, 410);
    }

    const { data: updated, error: updateError } = await admin
      .from("display_connections")
      .update({
        org_id: orgId,
        label: name,
        assigned_scene_id: sceneId,
        claimed_at: new Date().toISOString(),
        pair_code_hash: null,
        pair_expires_at: null,
      })
      .eq("id", conn.id)
      .is("claimed_at", null)
      .select("id, label, assigned_scene_id, claimed_at")
      .single();
    if (updateError || !updated) throw updateError ?? new Error("claim raced");

    return json({ screen: updated }, 200);
  } catch (error) {
    console.error("screen-claim failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}
function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS_HEADERS },
  });
}
