# Scena API v2 — Index

This directory maps Scena's live API surfaces, database-backed domain APIs, and planned manager-router contracts.

The product authority is [`docs/sop/Purpose.md`](sop/Purpose.md). Every authenticated user receives one free Personal Workspace. Additional Personal Workspaces use a $15 one-time purchase. Team Workspaces use recurring Plus, Pro, or Max subscriptions.

## Verification vocabulary

- **live-backend-verified**: deployed and supported by direct database/runtime verification.
- **database-verified**: checked against the live Supabase schema.
- **source-verified**: implementation exists and has been inspected in the repository.
- **planned**: target design only. It must not be represented as deployed.
- **end-to-end verified**: completed through the actual customer-facing path, including external providers.

A successful deployment is not, by itself, end-to-end verification.

## Current Workspace and consumer model

```text
Authenticated user
→ profile and preferences
→ one free Personal Workspace
→ sole Owner membership
→ Personal Free entitlements
```

A user may own multiple Personal Workspaces and may own or belong to multiple Team Workspaces. Every Workspace has an explicit type, canonical `owner_user_id`, memberships, entitlements, and isolated resources.

The live database retains legacy table names such as `organizations` for compatibility. The Workspace-named API views are:

- `workspaces`
- `workspace_memberships`
- `workspace_entitlements`

## Consumer billing API

The live consumer billing contract is documented in [`api/v2/consumer-billing.openapi.json`](api/v2/consumer-billing.openapi.json).

### `billing-checkout` v8

Status: **live-backend-verified**.

Authenticated request:

```json
{
  "offering_code": "personal_additional | plus | pro | max",
  "workspace_name": "Customer-facing Workspace name",
  "workspace_slug": "optional-workspace-slug"
}
```

Behavior:

- `personal_additional` creates Stripe Checkout in `payment` mode.
- `plus`, `pro`, and `max` create Stripe Checkout in `subscription` mode.
- The response contains a Stripe-hosted Checkout URL.
- No paid Workspace is created by the Checkout response or browser return URL.
- Only one open Checkout is allowed per account.
- Workspace slugs are checked against existing and open-Checkout reservations.
- The server generates a collision-resistant slug when one is omitted.

The older `plan_code`, `team_name`, and `team_slug` request names remain accepted temporarily for compatibility, but new UI work must use Workspace terminology.

### `billing-webhook` v7

Status: **live-backend-verified**.

The endpoint:

- Requires a valid Stripe signature.
- Stores Stripe events in `billing_events` for idempotent processing.
- Provisions an additional Personal Workspace only after a verified paid one-time Checkout.
- Provisions a Team Workspace only after a verified active or trialing subscription Checkout.
- Validates registered Checkout user, Stripe customer, offering type, price, amount, and currency.
- Stores one-time purchases in `workspace_purchases`.
- Stores recurring Team billing in `workspace_subscriptions`.
- Marks the registered Checkout complete with its `provisioned_workspace_id`.
- Returns the same Workspace on safe webhook replay rather than creating a duplicate.

## Billing offerings

| Offering code | Workspace type | Billing mode | Price |
|---|---|---|---:|
| `personal_free` | Personal | Free | $0 |
| `personal_additional` | Personal | One-time | $15 |
| `plus` | Team | Subscription | $15/month |
| `pro` | Team | Subscription | $25/month |
| `max` | Team | Subscription | $40/month |

`personal_free` is provisioned automatically by the Auth database trigger and is not a Checkout offering.

## Verified acceptance coverage

Transactional database acceptance tests passed for:

1. One-time Personal Workspace purchase.
2. Plus Team Workspace subscription.
3. Canonical ownership and active Owner membership.
4. Correct Personal and Plus entitlements.
5. Checkout completion and billing record creation.
6. Idempotent replay returning the same Workspace.
7. Multiple active Workspace memberships for one user.

The acceptance transactions were rolled back after verification.

An actual Stripe-hosted customer Checkout using a real authenticated browser session is still required before moving the billing system from controlled test mode to production promotion.

## Document map

| Document | Scope | Status |
|---|---|---|
| [`sop/Purpose.md`](sop/Purpose.md) | Product and operating standard | Owner-approved authority |
| [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) | Database overview | Requires Workspace-model refresh |
| [`API_V2_PROGRESS.md`](API_V2_PROGRESS.md) | Engineering ledger | Historical plus current checkpoints |
| [`api/v2/consumer-billing.openapi.json`](api/v2/consumer-billing.openapi.json) | Live consumer Checkout and webhook contract | Live-backend-verified |
| [`api/v2/openapi.json`](api/v2/openapi.json) | Planned central manager router | Planned, not deployed |
| [`api/v2/README.md`](api/v2/README.md) | Edge Function and schema inventory | Mixed live/planned status |
| [`api/v2/api-inventory.json`](api/v2/api-inventory.json) | Function inventory | Requires billing version refresh |
| [`api/v2/capability-matrix.json`](api/v2/capability-matrix.json) | Capability state | Requires Workspace-model refresh |

## Production gate

Consumer billing may move toward production only after all of the following are verified in the intended Stripe mode:

```text
New account
→ free Personal Workspace appears
→ additional Personal Checkout completes
→ verified webhook creates exactly one additional Personal Workspace
→ Team plan Checkout completes
→ verified webhook creates exactly one Team Workspace
→ Workspace switcher exposes all authorized Workspaces
→ replay creates no duplicate Workspace
```

Image processing and the Asset worker queue remain a separate implementation phase after this consumer signup and billing gate.
