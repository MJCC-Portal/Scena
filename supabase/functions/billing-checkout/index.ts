import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "content-type": "application/json; charset=utf-8",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST required." } }, 405);

  try {
    const supabaseUrl = required("SUPABASE_URL");
    const anonKey = required("SUPABASE_ANON_KEY");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = required("STRIPE_SECRET_KEY");
    const appUrl = required("SCENA_APP_URL").replace(/\/$/, "");
    const authorization = req.headers.get("authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.email) return json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, 401);
    const user = userData.user;
    const email = user.email!;

    const body = await req.json() as Record<string, unknown>;
    const planCode = text(body.plan_code).toLowerCase();
    const teamName = text(body.team_name);
    const teamSlug = text(body.team_slug).toLowerCase();
    if (!['plus','pro','max'].includes(planCode)) return json({ error: { code: "VALIDATION_FAILED", message: "Choose Plus, Pro, or Max." } }, 400);
    if (!teamName || teamName.length > 120) return json({ error: { code: "VALIDATION_FAILED", message: "Team name is required." } }, 400);
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(teamSlug)) return json({ error: { code: "VALIDATION_FAILED", message: "Team slug must be 3-64 lowercase letters, numbers, or hyphens." } }, 400);

    const { data: existingMembership } = await admin.from("organization_members").select("org_id").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (existingMembership) return json({ error: { code: "TEAM_LIMIT_REACHED", message: "This account already belongs to an active Team." } }, 409);

    const { data: plan, error: planError } = await admin.from("plans").select("plan_code,stripe_price_id,is_active").eq("plan_code", planCode).single();
    if (planError || !plan?.is_active) return json({ error: { code: "PLAN_REQUIRED", message: "That plan is unavailable." } }, 400);
    if (!plan.stripe_price_id) return json({ error: { code: "PRICE_NOT_CONFIGURED", message: "This plan is not available for checkout yet." } }, 503);

    await admin.from("checkout_sessions").update({ status: "expired", updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("status", "open").lt("expires_at", new Date().toISOString());
    const { data: openCheckout } = await admin.from("checkout_sessions").select("stripe_checkout_session_id").eq("user_id", user.id).eq("status", "open").maybeSingle();
    if (openCheckout) return json({ error: { code: "RESOURCE_CONFLICT", message: "A checkout is already open for this account." } }, 409);

    let stripeCustomerId: string;
    const { data: customerRow } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (customerRow?.stripe_customer_id) {
      stripeCustomerId = customerRow.stripe_customer_id;
    } else {
      const customer = await stripePost(stripeKey, "/v1/customers", {
        email,
        "metadata[scena_user_id]": user.id,
        "metadata[product]": "scena",
      });
      stripeCustomerId = String(customer.id);
      const { error: customerInsertError } = await admin.from("billing_customers").insert({ user_id: user.id, stripe_customer_id: stripeCustomerId });
      if (customerInsertError) throw customerInsertError;
    }

    const session = await stripePost(stripeKey, "/v1/checkout/sessions", {
      mode: "subscription",
      customer: stripeCustomerId,
      "line_items[0][price]": plan.stripe_price_id,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/billing/processing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      "metadata[scena_user_id]": user.id,
      "metadata[plan_code]": planCode,
      "metadata[team_name]": teamName,
      "metadata[team_slug]": teamSlug,
      "subscription_data[metadata][scena_user_id]": user.id,
      "subscription_data[metadata][plan_code]": planCode,
      "subscription_data[metadata][team_name]": teamName,
      "subscription_data[metadata][team_slug]": teamSlug,
      allow_promotion_codes: "true",
      billing_address_collection: "auto",
    });

    const expiresAt = typeof session.expires_at === "number" ? new Date(session.expires_at * 1000).toISOString() : null;
    const { error: checkoutInsertError } = await admin.from("checkout_sessions").insert({
      stripe_checkout_session_id: session.id,
      user_id: user.id,
      plan_code: planCode,
      requested_team_name: teamName,
      requested_team_slug: teamSlug,
      stripe_customer_id: stripeCustomerId,
      status: "open",
      expires_at: expiresAt,
    });
    if (checkoutInsertError) throw checkoutInsertError;

    return json({ checkout_url: session.url, checkout_session_id: session.id }, 200);
  } catch (error) {
    console.error("billing-checkout failed", error);
    return json({ error: { code: "CHECKOUT_FAILED", message: "Checkout could not be started." } }, 500);
  }
});

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
async function stripePost(secret: string, path: string, values: Record<string,string>) {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Stripe request failed");
  return payload;
}
function json(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers: cors }); }
