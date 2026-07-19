import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APP = "marquee";
const ORG_SLUG = "mjcc";

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json() as { code?: unknown };
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (code.length < 32 || code.length > 200) return json({ error: "invalid_request" }, 400);

    const kpnUrl = required("MJCC_SSO_EXCHANGE_URL");
    const kpnSecret = required("MJCC_SSO_SECRET");
    const supabaseUrl = required("SUPABASE_URL");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey = required("SUPABASE_ANON_KEY");
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const upstream = await fetch(kpnUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Sso-Secret": kpnSecret },
      body: JSON.stringify({ code }),
    });
    if (!upstream.ok) return json({ error: "invalid_or_expired_handoff" }, 401);
    const identity = await upstream.json() as Record<string, unknown>;
    if (identity.target_app !== APP || typeof identity.mjcc_user_id !== "string") {
      return json({ error: "invalid_handoff" }, 401);
    }

    const { data: org, error: orgError } = await admin.from("organizations").select("id").eq("slug", ORG_SLUG).single();
    if (orgError || !org) return json({ error: "organization_not_configured" }, 503);

    const externalId = String(identity.mjcc_user_id);
    const { data: existing, error: lookupError } = await admin
      .from("external_identities")
      .select("user_id")
      .eq("provider", "mjcc")
      .eq("external_user_id", externalId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const role = mapRole(String(identity.mjcc_role ?? ""));
    if (!role) return json({ error: "role_not_allowed" }, 403);

    let userId: string;
    let loginEmail: string;
    if (existing?.user_id) {
      userId = String(existing.user_id);
      const { data: authUser, error: userError } = await admin.auth.admin.getUserById(userId);
      if (userError || !authUser.user?.email) throw new Error("local auth user missing");
      loginEmail = authUser.user.email;
    } else {
      loginEmail = `mjcc-${externalId}@sso.invalid`;
      const created = await admin.auth.admin.createUser({
        email: loginEmail,
        email_confirm: true,
        app_metadata: { mjcc_user_id: externalId, provider: "mjcc", role },
      });
      if (created.error || !created.data.user) throw new Error("could not provision local auth user");
      userId = created.data.user.id;
      const { error: identityError } = await admin.from("external_identities").insert({
        org_id: org.id,
        provider: "mjcc",
        external_user_id: externalId,
        user_id: userId,
        role_snapshot: role,
      });
      if (identityError) throw identityError;
    }

    const { error: memberError } = await admin.from("organization_members").upsert(
      { org_id: org.id, user_id: userId, role },
      { onConflict: "org_id,user_id" },
    );
    if (memberError) throw memberError;

    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: loginEmail });
    const tokenHash = link.data?.properties?.hashed_token;
    if (link.error || !tokenHash) throw new Error("could not create local session token");
    const sessionClient = createClient(supabaseUrl, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const session = await sessionClient.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (session.error || !session.data.session) throw new Error("could not mint local session");

    return json({
      access_token: session.data.session.access_token,
      refresh_token: session.data.session.refresh_token,
      expires_in: session.data.session.expires_in,
      user: { id: userId, mjcc_user_id: externalId, org_id: org.id, role, display_name: identity.display_name ?? identity.username },
    }, 200);
  } catch (error) {
    console.error("mjcc-sso-exchange failed", error);
    return json({ error: "internal_error" }, 500);
  }
});

function mapRole(role: string): "owner" | "admin" | "operator" | null {
  if (role === "sudo") return "owner";
  if (role === "admin") return "admin";
  if (role === "manager") return "operator";
  return null;
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
