import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return respond({ error: { code: "METHOD_NOT_ALLOWED", message: "POST required." } }, 405);

  try {
    const url = required("SUPABASE_URL");
    const anon = required("SUPABASE_ANON_KEY");
    const service = required("SUPABASE_SERVICE_ROLE_KEY");
    const stripe = required("STRIPE_SECRET_KEY");
    const appUrl = required("SCENA_APP_URL").replace(/\/$/, "");
    const authorization = req.headers.get("authorization") ?? "";

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data.user) return respond({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } }, 401);

    const { data: customer } = await admin.from("billing_customers").select("stripe_customer_id").eq("user_id", data.user.id).maybeSingle();
    if (!customer?.stripe_customer_id) return respond({ error: { code: "NOT_FOUND", message: "No billing account exists for this user." } }, 404);

    const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { authorization: `Bearer ${stripe}`, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ customer: customer.stripe_customer_id, return_url: `${appUrl}/account/billing` }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? "Stripe portal request failed");
    return respond({ portal_url: payload.url }, 200);
  } catch (error) {
    console.error("billing-portal failed", error);
    return respond({ error: { code: "PORTAL_FAILED", message: "Billing portal could not be opened." } }, 500);
  }
});

function required(name: string) { const value = Deno.env.get(name)?.trim(); if (!value) throw new Error(`missing ${name}`); return value; }
function respond(body: unknown, status: number) { return new Response(JSON.stringify(body), { status, headers }); }
