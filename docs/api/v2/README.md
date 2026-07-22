# Scena API v2

This directory captures the live Scena edge function surface, the planned API v2 manager router, and the migration boundary between them.

## Status

- `src/api/v2` contains the browser client foundation and shared v2 request/response primitives.
- `supabase/functions/_shared/v2` contains the planned v2 request/response/auth helpers.
- No `supabase/functions/scena-api` router is deployed yet in this repository.
- The live system is currently built around existing edge functions such as `screen-register`, `display-gateway`, `screen-claim`, `presentation-upload`, `presentation-callback`, `automations-run`, `billing-checkout`, `billing-portal`, and `billing-webhook`.

## Target vs Live API

### Target API

The planned v2 router is exposed at:

`{SUPABASE_URL}/functions/v1/scena-api/v2/{resource}`

It uses manager JWT authentication and the v2 envelope contract.

See `docs/api/v2/openapi.json` for the v2 request/response contract.

### Live API

Current live endpoints are separate edge functions with distinct auth and integration models.

- `screen-register` — kiosk registration, no manager auth.
- `display-gateway` — kiosk polling, device credential authentication.
- `screen-claim` — manager pairing flow, manager auth.
- `screen-credential-rotate` — manager-triggered device credential rotation.
- `presentation-upload` — manager-facing presentation ingestion job creation and upload confirmation.
- `presentation-callback` — LXC callback for processing completion/failure.
- `automations-run` — scheduler worker execution boundary.
- `billing-checkout` — Stripe Checkout session creation.
- `billing-portal` — Stripe customer portal session creation.
- `billing-webhook` — Stripe webhook ingestion and subscription synchronization.

See `docs/api/v2/api-inventory.json` for the planned v2 paths and live edge function inventory.

## Live Display Protocol

The live kiosk protocol is implemented by `screen-register`, `display-gateway`, and `screen-claim`.

### Registration and Pairing

1. Kiosk calls `screen-register` to create a new `screens` row with status `pairing`.
2. `screen-register` returns a high-entropy `device_token`, a `screen_id`, and a 6-digit pairing code.
3. A manager uses `screen-claim` with the pairing code, a display name, and a location to claim the screen.
4. On success, the screen row transitions to `ready` and is assigned `org_id` and `location_id`.

### Kiosk State Polling

- Kiosks poll `display-gateway` with the opaque `device_token`.
- The token is hashed and matched against `screens.device_token_hash`.
- The kiosk receives a resolved display state, including:
  - current session assignment
  - display layout and tile content
  - present menu or presentation manifest data
- If the screen is still in pairing mode, `display-gateway` returns `{ status: "pending" }`.

### Credential Rotation and Revocation

- Managers may call `screen-credential-rotate` to issue a new `device_token` for a claimed screen.
- The old token is invalidated immediately by replacing `screens.device_token_hash`.
- A revoked screen returns `SCREEN_REVOKED` from `display-gateway`.

## Stripe Billing and Subscription Flow

### Checkout

- `billing-checkout` creates or reuses a Stripe customer.
- It validates the requested plan against `plans.stripe_price_id`.
- It creates a Stripe Checkout session with metadata for:
  - `scena_user_id`
  - `plan_code`
  - `team_name`
  - `team_slug`
- It records an open row in `checkout_sessions`.

### Portal

- `billing-portal` creates a Stripe billing portal session for a customer already linked to the current user.

### Webhooks

- `billing-webhook` receives Stripe events signed with `stripe-signature`.
- It deduplicates events using `billing_events.stripe_event_id`.
- It handles:
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
  - `invoice.upcoming`
- The webhook updates subscription state via stored procedures such as `finalize_paid_team_subscription` and `sync_paid_team_subscription`.

## Scheduler and Automation

- `automations-run` is the trusted worker webhook endpoint.
- It is authenticated with `x-scena-callback-secret`.
- It claims due automations using a concurrency-safe conditional update.
- It executes actions such as:
  - `start_session`
  - `stop_session`
  - `set_display_mode`
  - `set_shared_layout`
  - `set_screen_layout`
  - `enable_screen` / `disable_screen`
  - `switch_primary_screen`
- On success or failure it updates `display_automations.last_run_at` and reschedules as appropriate.

## Plans and Roles

- Manager roles: `owner`, `admin`, `operator`, `designer`, `viewer`.
- Manager authorization is enforced by `requireManager()` in `supabase/functions/_shared/managerAuth.ts`.
- Billing plan codes observed in code: `plus`, `pro`, `max`.
- `billing-checkout` enforces active plan configuration and duplicate checkout prevention.

## Error Contract

- Scena uses a stable shared error contract in `src/shared/errors.ts` and `supabase/functions/_shared/errors.ts`.
- Live and planned v2 endpoints share common codes such as:
  - `UNAUTHENTICATED`
  - `FORBIDDEN`
  - `VALIDATION_FAILED`
  - `RESOURCE_NOT_FOUND`
  - `SCREEN_REVOKED`
  - `PLAN_REQUIRED`
  - `SUBSCRIPTION_INACTIVE`
  - `IDEMPOTENCY_CONFLICT`

See `docs/api/v2/error-catalog.json` for the full current catalog.

## Schema Mapping

This documentation maps the current live schema and domain model to the planned API surfaces.

- `organizations`, `organization_members`, `organization_entitlements` — Team and plan metadata.
- `locations` — physical deployment locations for Displays, Menus, Scenes, and Sessions.
- `menus`, `menu_sections`, `menu_items` — menu content.
- `presentation_assets` — uploaded presentation assets and LXC manifest references.
- `scenes` — menu or presentation scenes linked to locations and assets.
- `display_layouts`, `display_layout_tiles` — layout boards and tile placement.
- `display_sessions`, `display_session_screens` — active session assignment for screens.
- `display_automations` — scheduled automation actions and recurrence rules.
- `screens`, `screen_pairing_codes` — kiosk registration, pairing, and device credential state.

See `docs/api/v2/schema-map.json` for the complete mapping.

## Contract Files

- `docs/api/v2/openapi.json` — planned v2 OpenAPI contract.
- `docs/api/v2/api-inventory.json` — combined planned v2 path inventory and actual live edge function inventory.
- `docs/api/v2/error-catalog.json` — stable error code catalog.
- `docs/api/v2/capability-matrix.json` — current implementation status and gaps.
- `docs/api/v2/state-machines.json` — runtime state-machine definitions for pairing, display state, presentations, automations, and billing.
- `docs/api/v2/schema-map.json` — domain-to-table schema mapping.

## Notes

- This documentation is intentionally explicit about the current live edge functions vs the future v2 manager router.
- The v2 router is foundation-only at present; actual manager data mutations still happen through the existing domain and edge function stack.
- Keep these docs in sync with `src/api/v2`, `supabase/functions/_shared/v2`, and the live edge function implementations.
