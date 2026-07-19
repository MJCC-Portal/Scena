// Scena display gateway — the only API kiosks talk to.
//
// A kiosk never holds a Supabase session, service key, or manager JWT.
// It gets an opaque device token at pair_init (stored hashed here) and
// presents it on every state poll. The gateway resolves the effective
// scene server-side: the screen's assigned scene, falling back to the
// org's active display session ("take live" broadcast).
//
// verify_jwt is OFF: kiosks are unauthenticated until claimed. All data
// access happens with the service role inside this function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAIR_TTL_MS = 10 * 60 * 1000;
const SIGNED_URL_TTL_S = 3600;

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

    const body = await req.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "pair_init") {
      // Fresh device: mint an opaque token and a 6-digit code to show on screen.
      for (let attempt = 0; attempt < 5; attempt++) {
        const token = randomHex(32);
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
        const { error } = await admin.from("display_connections").insert({
          label: "Unpaired display",
          token_hash: await sha256(token),
          pair_code_hash: await sha256(code),
          pair_expires_at: new Date(Date.now() + PAIR_TTL_MS).toISOString(),
        });
        if (!error) return json({ token, code, expires_in: PAIR_TTL_MS / 1000 }, 200);
        if (!String(error.message).includes("display_connections_pair_code_idx")) throw error;
      }
      throw new Error("could not allocate pairing code");
    }

    if (action === "state") {
      const token = typeof body.token === "string" ? body.token : "";
      if (!token || token.length > 200) return json({ error: "invalid_token" }, 401);
      const { data: conn, error: connError } = await admin
        .from("display_connections")
        .select("id, org_id, label, assigned_scene_id, revoked_at, claimed_at, pair_expires_at")
        .eq("token_hash", await sha256(token))
        .maybeSingle();
      if (connError) throw connError;
      if (!conn) return json({ status: "unknown_device" }, 200);
      if (conn.revoked_at) return json({ status: "revoked" }, 200);

      await admin.from("display_connections")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", conn.id);

      if (!conn.claimed_at) {
        const expired = conn.pair_expires_at && new Date(String(conn.pair_expires_at)).getTime() < Date.now();
        return json({ status: expired ? "pair_expired" : "pending" }, 200);
      }

      // Effective scene: per-screen assignment wins, else the active session.
      let sceneId: string | null = conn.assigned_scene_id ? String(conn.assigned_scene_id) : null;
      let sessionStatus: string | null = null;
      if (!sceneId && conn.org_id) {
        const { data: session, error: sessionError } = await admin
          .from("display_sessions")
          .select("current_scene_id, status")
          .eq("org_id", conn.org_id)
          .eq("status", "active")
          .maybeSingle();
        if (sessionError) throw sessionError;
        sessionStatus = session ? String(session.status) : null;
        sceneId = session?.current_scene_id ? String(session.current_scene_id) : null;
      }
      if (!sceneId) return json({ status: "standby", screen_name: conn.label }, 200);

      const { data: scene, error: sceneError } = await admin
        .from("scenes")
        .select("id, name, scene_type, config, is_active")
        .eq("id", sceneId)
        .maybeSingle();
      if (sceneError) throw sceneError;
      if (!scene || !scene.is_active) return json({ status: "standby", screen_name: conn.label }, 200);

      const payload: Record<string, unknown> = {
        status: "showing",
        screen_name: conn.label,
        session_status: sessionStatus,
        scene: { id: scene.id, name: scene.name, scene_type: scene.scene_type, config: scene.config },
        server_time: new Date().toISOString(),
      };

      // Slideshow scenes reference an uploaded deck; hand the kiosk a
      // short-lived signed URL for the private object, never the bucket.
      const assetId = (scene.config as Record<string, unknown> | null)?.asset_id;
      if (scene.scene_type === "slideshow" && typeof assetId === "string") {
        const { data: asset } = await admin
          .from("presentation_assets")
          .select("storage_path")
          .eq("id", assetId)
          .maybeSingle();
        if (asset?.storage_path) {
          const { data: signed } = await admin.storage.from("presentations")
            .createSignedUrl(String(asset.storage_path), SIGNED_URL_TTL_S);
          if (signed?.signedUrl) payload.slideshow_url = signed.signedUrl;
        }
      }
      return json(payload, 200);
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("display-gateway failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
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
