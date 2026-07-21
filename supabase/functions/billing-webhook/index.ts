import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type BillingOwner = {
  user_id: string;
  org_id: string | null;
  plan_code: string | null;
  status: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respond({ error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  try {
    const signature = req.headers.get("stripe-signature") ?? "";
    if (!(await verifyStripeSignature(rawBody, signature, required("STRIPE_WEBHOOK_SECRET")))) {
      return respond({ error: "invalid_signature" }, 400);
    }

    const event = JSON.parse(rawBody) as any;
    const admin = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: prior } = await admin
      .from("billing_events")
      .select("processing_status")
      .eq("stripe_event_id", String(event.id))
      .maybeSingle();

    if (prior?.processing_status === "processed" || prior?.processing_status === "ignored") {
      return respond({ received: true, duplicate: true }, 200);
    }

    if (!prior) {
      const { error } = await admin.from("billing_events").insert({
        stripe_event_id: String(event.id),
        event_type: String(event.type),
        livemode: Boolean(event.livemode),
        payload: event,
        processing_status: "processing",
      });
      if (error && error.code !== "23505") throw error;
    } else {
      await admin
        .from("billing_events")
        .update({ processing_status: "processing", error_message: null })
        .eq("stripe_event_id", String(event.id));
    }

    try {
      const handled = await processEvent(admin, event);
      await admin
        .from("billing_events")
        .update({
          processing_status: handled ? "processed" : "ignored",
          processed_at: new Date().toISOString(),
        })
        .eq("stripe_event_id", String(event.id));
      return respond({ received: true, handled }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Webhook processing failed";
      await admin
        .from("billing_events")
        .update({ processing_status: "failed", error_message: message.slice(0, 1000) })
        .eq("stripe_event_id", String(event.id));
      throw error;
    }
  } catch (error) {
    console.error("billing-webhook failed", error);
    return respond({ error: "webhook_processing_failed" }, 500);
  }
});

async function processEvent(admin: any, event: any): Promise<boolean> {
  const object = event.data?.object ?? {};

  if (event.type === "checkout.session.completed") {
    if (object.mode !== "subscription" || !object.subscription || !object.customer) {
      throw new Error("Completed Checkout is missing subscription data");
    }

    const metadata = object.metadata ?? {};
    const userId = String(metadata.scena_user_id ?? object.client_reference_id ?? "");
    const planCode = String(metadata.plan_code ?? "");
    const teamName = String(metadata.team_name ?? "");
    const teamSlug = String(metadata.team_slug ?? "");
    if (!userId || !planCode || !teamName || !teamSlug) {
      throw new Error("Checkout metadata is incomplete");
    }

    const subscription = await stripeGet(`/v1/subscriptions/${encodeURIComponent(String(object.subscription))}`);
    const priceId = subscriptionPriceId(subscription);
    if (!priceId) throw new Error("Subscription has no price");

    const { data: plan } = await admin
      .from("plans")
      .select("plan_code")
      .eq("stripe_price_id", priceId)
      .eq("is_active", true)
      .maybeSingle();
    if (!plan || plan.plan_code !== planCode) {
      throw new Error("Checkout plan does not match Stripe price");
    }

    const { data: orgId, error: finalizeError } = await admin.rpc("finalize_paid_team_subscription", {
      target_user_id: userId,
      target_plan_code: planCode,
      target_team_name: teamName,
      target_team_slug: teamSlug,
      target_stripe_customer_id: String(object.customer),
      target_stripe_subscription_id: String(subscription.id),
      target_stripe_price_id: priceId,
      target_status: normalizeStatus(subscription.status),
      target_period_start: subscriptionPeriodStart(subscription),
      target_period_end: subscriptionPeriodEnd(subscription),
      target_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    });
    if (finalizeError) throw finalizeError;

    await admin
      .from("checkout_sessions")
      .update({
        stripe_subscription_id: String(subscription.id),
        status: "complete",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_checkout_session_id", String(object.id))
      .eq("user_id", userId);

    return Boolean(orgId);
  }

  if (event.type === "checkout.session.expired") {
    await admin
      .from("checkout_sessions")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("stripe_checkout_session_id", String(object.id));
    return true;
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscriptionId = String(object.id ?? "");
    if (!subscriptionId) throw new Error("Subscription event has no subscription ID");

    const { data: previous } = await admin
      .from("workspace_subscriptions")
      .select("owner_user_id, org_id, plan_code, status, cancel_at_period_end")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    const synced = await syncSubscription(admin, object);
    const owner = await resolveBillingOwner(admin, subscriptionId, String(object.customer ?? ""));
    if (owner) {
      const previousActive = isActiveStatus(previous?.status);
      const nextActive = isActiveStatus(synced.status);

      if (event.type === "customer.subscription.deleted" || (previousActive && !nextActive)) {
        await queueNotification(admin, event, owner, "subscription_disabled", {
          plan_code: synced.planCode,
          subscription_status: synced.status,
          cancelled_at: unixDate(object.canceled_at),
        });
      } else if (!previous?.cancel_at_period_end && Boolean(object.cancel_at_period_end)) {
        await queueNotification(admin, event, owner, "cancellation_scheduled", {
          plan_code: synced.planCode,
          subscription_status: synced.status,
          access_ends_at: subscriptionPeriodEnd(object),
        });
      } else if (previous && !previousActive && nextActive) {
        await queueNotification(admin, event, owner, "subscription_reactivated", {
          plan_code: synced.planCode,
          subscription_status: synced.status,
        });
      }
    }
    return true;
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const subscriptionId = invoiceSubscriptionId(object);
    if (!subscriptionId) return false;

    const subscription = await stripeGet(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
    const synced = await syncSubscription(admin, subscription);

    if (event.type === "invoice.payment_failed") {
      const owner = await resolveBillingOwner(admin, subscriptionId, invoiceCustomerId(object));
      if (owner) {
        await queueNotification(admin, event, owner, "payment_failed", {
          plan_code: synced.planCode,
          subscription_status: synced.status,
          amount_due: numericOrNull(object.amount_due),
          currency: String(object.currency ?? "usd"),
          hosted_invoice_url: object.hosted_invoice_url ?? null,
          next_payment_attempt: unixDate(object.next_payment_attempt),
        });
      }
    }
    return true;
  }

  if (event.type === "invoice.payment_succeeded") {
    if (String(object.billing_reason ?? "") !== "subscription_create") return true;

    const subscriptionId = invoiceSubscriptionId(object);
    const customerId = invoiceCustomerId(object);
    const owner = await resolveBillingOwner(admin, subscriptionId, customerId);
    if (!owner) throw new Error("Could not resolve the subscription owner for the initial payment");

    let planCode = owner.plan_code;
    if (!planCode && subscriptionId) {
      const subscription = await stripeGet(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`);
      const priceId = subscriptionPriceId(subscription);
      if (priceId) {
        const { data: plan } = await admin
          .from("plans")
          .select("plan_code")
          .eq("stripe_price_id", priceId)
          .maybeSingle();
        planCode = plan?.plan_code ?? null;
      }
    }

    await queueNotification(admin, event, owner, "subscription_started", {
      plan_code: planCode,
      amount_paid: numericOrNull(object.amount_paid),
      currency: String(object.currency ?? "usd"),
      invoice_id: object.id ?? null,
      hosted_invoice_url: object.hosted_invoice_url ?? null,
      subscription_id: subscriptionId,
    });
    return true;
  }

  if (event.type === "invoice.upcoming") {
    const subscriptionId = invoiceSubscriptionId(object);
    const owner = await resolveBillingOwner(admin, subscriptionId, invoiceCustomerId(object));
    if (!owner) throw new Error("Could not resolve the subscription owner for the upcoming invoice");

    await queueNotification(admin, event, owner, "renewal_reminder", {
      plan_code: owner.plan_code,
      amount_due: numericOrNull(object.amount_due),
      currency: String(object.currency ?? "usd"),
      period_start: unixDate(object.period_start),
      period_end: unixDate(object.period_end),
      next_payment_attempt: unixDate(object.next_payment_attempt),
      subscription_id: subscriptionId,
    });
    return true;
  }

  return false;
}

async function syncSubscription(admin: any, subscription: any): Promise<{ planCode: string; status: string }> {
  const priceId = subscriptionPriceId(subscription);
  if (!priceId) throw new Error("Subscription has no price");

  const { data: plan } = await admin
    .from("plans")
    .select("plan_code")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  if (!plan?.plan_code) throw new Error("Subscription price is not mapped to a Scena plan");

  const status = normalizeStatus(subscription.status);
  const { error } = await admin.rpc("sync_paid_team_subscription", {
    target_stripe_subscription_id: String(subscription.id),
    target_plan_code: String(plan.plan_code),
    target_stripe_price_id: priceId,
    target_status: status,
    target_period_start: subscriptionPeriodStart(subscription),
    target_period_end: subscriptionPeriodEnd(subscription),
    target_cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    target_cancelled_at: unixDate(subscription.canceled_at),
  });
  if (error) throw error;
  return { planCode: String(plan.plan_code), status };
}

async function resolveBillingOwner(
  admin: any,
  subscriptionId: string | null,
  customerId: string | null,
): Promise<BillingOwner | null> {
  if (subscriptionId) {
    const { data: subscription } = await admin
      .from("workspace_subscriptions")
      .select("owner_user_id, org_id, plan_code, status")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (subscription?.owner_user_id) {
      return {
        user_id: String(subscription.owner_user_id),
        org_id: subscription.org_id ? String(subscription.org_id) : null,
        plan_code: subscription.plan_code ? String(subscription.plan_code) : null,
        status: subscription.status ? String(subscription.status) : null,
      };
    }
  }

  if (customerId) {
    const { data: customer } = await admin
      .from("billing_customers")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (customer?.user_id) {
      const { data: subscription } = await admin
        .from("workspace_subscriptions")
        .select("org_id, plan_code, status")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      return {
        user_id: String(customer.user_id),
        org_id: subscription?.org_id ? String(subscription.org_id) : null,
        plan_code: subscription?.plan_code ? String(subscription.plan_code) : null,
        status: subscription?.status ? String(subscription.status) : null,
      };
    }
  }

  return null;
}

async function queueNotification(
  admin: any,
  event: any,
  owner: BillingOwner,
  notificationType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("billing_notification_outbox").insert({
    stripe_event_id: String(event.id),
    user_id: owner.user_id,
    org_id: owner.org_id,
    notification_type: notificationType,
    payload: {
      ...payload,
      stripe_event_type: String(event.type),
      livemode: Boolean(event.livemode),
    },
  });
  if (error && error.code !== "23505") throw error;
}

async function stripeGet(path: string): Promise<any> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { authorization: `Bearer ${required("STRIPE_SECRET_KEY")}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Stripe request failed");
  return payload;
}

function subscriptionPriceId(subscription: any): string {
  return String(subscription?.items?.data?.[0]?.price?.id ?? "");
}

function subscriptionPeriodStart(subscription: any): string | null {
  return unixDate(subscription?.current_period_start ?? subscription?.items?.data?.[0]?.current_period_start);
}

function subscriptionPeriodEnd(subscription: any): string | null {
  return unixDate(subscription?.current_period_end ?? subscription?.items?.data?.[0]?.current_period_end);
}

function invoiceSubscriptionId(invoice: any): string | null {
  const candidate =
    invoice?.subscription ??
    invoice?.parent?.subscription_details?.subscription ??
    invoice?.subscription_details?.subscription;
  if (typeof candidate === "string") return candidate;
  if (candidate?.id) return String(candidate.id);
  return null;
}

function invoiceCustomerId(invoice: any): string | null {
  if (typeof invoice?.customer === "string") return invoice.customer;
  if (invoice?.customer?.id) return String(invoice.customer.id);
  return null;
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const expected = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index++) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function normalizeStatus(value: unknown): string {
  const status = String(value ?? "incomplete");
  return status === "canceled" ? "cancelled" : status;
}

function isActiveStatus(value: unknown): boolean {
  return ["active", "trialing"].includes(String(value ?? ""));
}

function unixDate(value: unknown): string | null {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null;
}

function numericOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function required(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function respond(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
