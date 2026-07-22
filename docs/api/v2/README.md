# Scena API v2

This directory captures the live Scena edge function surface, the planned API v2 manager router, and the migration boundary between them.

See [docs/API_V2.md](../../API_V2.md) for the document index and per-file verification status (which parts of this set are live-verified vs. not yet reverified), including the SOP/database baseline these docs are now derived from.

## Status

- `src/api/v2` contains the browser client foundation and shared v2 request/response primitives.
- `supabase/functions/_shared/v2` contains the planned v2 request/response/auth helpers.
- No `supabase/functions/scena-api` router is deployed yet in this repository.
- Seven edge functions are actually deployed (verified via `mcp__supabase__list_edge_functions`, 2026-07-22): `mjcc-sso-exchange` (deployed, no active frontend reference — see below), `display-gateway`, `screen-claim`, `presentation-upload`, `billing-checkout`, `billing-portal`, `billing-webhook`.
- Four functions have source in the repo but are **not deployed**: `screen-register`, `screen-credential-rotate`, `presentation-callback`, `automations-run`. A prior version of this file incorrectly listed all of these as live — corrected here. See [api-inventory.json](api-inventory.json) for the verified per-function status and what each gap breaks (e.g. `screen-claim` is live but has nothing to claim without `screen-register`).
- `marquee-sso` has no tracked implementation source (confirmed via `git ls-files`) — not a repository capability, not deployed. An untracked, empty local directory does not change that. Likely a leftover from the product's earlier "Marquee" name (see `supabase/migrations/0001_marquee_core_tenancy.sql`), before it was renamed to Scena.

## Target vs Live API

### Target API

The planned v2 router is exposed at:

`{SUPABASE_URL}/functions/v1/scena-api/v2/{resource}`

It uses manager JWT authentication and the v2 envelope contract.

See `docs/api/v2/openapi.json` for the v2 request/response contract.

### Live API

Current live endpoints are separate edge functions with distinct auth and integration models. **Deployed** (verified via `list_edge_functions`):

- `display-gateway` — kiosk polling, device credential authentication.
- `screen-claim` — manager pairing flow, manager auth.
- `presentation-upload` — manager-facing presentation ingestion job creation and upload confirmation.
- `billing-checkout` — Stripe Checkout session creation.
- `billing-portal` — Stripe customer portal session creation.
- `billing-webhook` — Stripe webhook ingestion and subscription synchronization.
- `mjcc-sso-exchange` — deployment status: deployed (v9, ACTIVE). Frontend reference status: no active reference found. Runtime status: deprecated behavior confirmed at the currently deployed version — re-verified via `get_logs` this session, v9 returns `OPTIONS 404`; an earlier "`returns 410 Gone`" claim was sourced from a different, superseded deployment (version 4) and has been corrected. Superseded by native Supabase Auth; deletion deferred.

**Source exists, not deployed:**

- `screen-register` — kiosk registration, no manager auth. Without this deployed, kiosks cannot self-register, so `screen-claim` has nothing to claim.
- `screen-credential-rotate` — manager-triggered device credential rotation.
- `presentation-callback` — LXC callback for processing completion/failure. Without this deployed, uploads created by `presentation-upload` can never reach `ready` status through the live path.
- `automations-run` — scheduler worker execution boundary. Without this deployed, `display_automations` rows are inert.

See `docs/api/v2/api-inventory.json` for the full verified inventory, and `docs/api/v2/capability-matrix.json` for which end-to-end capabilities this breaks.

## Kiosk / Display Protocol

The protocol below is implemented in source by `screen-register`, `display-gateway`, and `screen-claim`. **Only `display-gateway` and `screen-claim` are deployed.** `screen-register` is not, so step 1 cannot currently happen against production — no kiosk can create its own `screens` row today.

### Registration and Pairing (not fully live — see above)

1. Kiosk calls `screen-register` to create a new `screens` row with status `pairing`. **Not deployed.**
2. `screen-register` returns a high-entropy `device_token`, a `screen_id`, and a 6-digit pairing code.
3. A manager uses `screen-claim` with the pairing code, a display name, and a location to claim the screen. Deployed, but unreachable without step 1/2 having created a row to claim.
4. On success, the screen row transitions to `ready` and is assigned `org_id` and `location_id`.

### Kiosk State Polling

- Kiosks poll `display-gateway` with the opaque `device_token`.
- The token is hashed and matched against `screens.device_token_hash`.
- The kiosk receives a resolved display state, including:
  - current session assignment
  - display layout and tile content
  - present menu or presentation manifest data
- If the screen is still in pairing mode, `display-gateway` returns `{ status: "pending" }`.

### Credential Rotation and Revocation (not deployed)

- Source describes managers calling `screen-credential-rotate` to issue a new `device_token` for a claimed screen, invalidating the old token by replacing `screens.device_token_hash`. **This function is not deployed** — managers cannot currently rotate a display credential in production.
- A revoked screen returns `SCREEN_REVOKED` from `display-gateway` (deployed).

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

## Scheduler and Automation (not deployed)

- Source describes `automations-run` as the trusted worker webhook endpoint, authenticated with `x-scena-callback-secret`, claiming due automations with a concurrency-safe conditional update, and executing actions (`start_session`, `stop_session`, `set_display_mode`, `set_shared_layout`, `set_screen_layout`, `enable_screen` / `disable_screen`, `switch_primary_screen`), then updating `display_automations.last_run_at` and rescheduling.
- **This function is not deployed.** `display_automations` rows can be created through the domain layer, but nothing in production currently executes them.

## Presentation Processing Callback (not deployed)

- Source describes `presentation-callback` as the LXC callback endpoint that reports processing completion or failure back into `presentation_assets`.
- **This function is not deployed.** `presentation-upload` (deployed) can create an ingestion job, but its result can never be reported back through the live path, so no upload can currently reach `status = 'ready'` in production.

## Plans and Roles

Roles and plan limits are governed by [docs/sop/Purpose.md](../../sop/Purpose.md) §6–7 — that SOP is the source of truth; this section only confirms the SOP matches what the database actually enforces.

- Manager roles: `owner`, `admin`, `operator`, `designer`, `viewer` — matches `organization_members_role_check` exactly.
- Manager authorization is enforced by `requireManager()` in `supabase/functions/_shared/managerAuth.ts`.
- Billing plan codes: `plus`, `pro`, `max` — matches `organization_entitlements.plan_code` check constraint. `organization_entitlements` columns (`max_displays`, `max_boards`, `max_members`, `max_concurrent_sessions`, `max_displays_per_session`, `automation_tier`, `allow_display_groups`, `allow_session_groups`, `allow_resource_access_controls`) map one-to-one to the Plus/Pro/Max limits in the SOP.
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

- `organizations`, `organization_members`, `organization_entitlements` — Team and plan metadata. Table is named `organizations`; its own DB comment says product APIs/UI should call these Teams.
- `locations` — physical deployment locations for Displays, Menus, Scenes, and Sessions.
- `menus`, `menu_sections`, `menu_items` — menu content.
- `presentation_assets` — uploaded presentation assets and LXC manifest references.
- `scenes` — menu or presentation scenes linked to locations and assets.
- `display_layouts`, `display_layout_tiles` — layout boards and tile placement.
- `display_sessions`, `display_session_screens` — active session assignment for screens.
- `display_automations` — scheduled automation actions and recurrence rules.
- `screens`, `screen_pairing_codes` — kiosk registration, pairing, and device credential state.

See `docs/api/v2/schema-map.json` for the complete mapping.

### Board / Asset naming: unresolved architecture decision (not a schema gap)

[docs/sop/Purpose.md](../../sop/Purpose.md) §11 mandates customer-facing terms **Board**, **Board Element**, and **Asset** ("not display layout / tile / presentation record"). **No `boards`, `board_elements`, or generic `assets` table exists in the live schema** at the table-name level (verified via `mcp__supabase__list_tables`) — but that fact alone does not mean new tables are required. It means a naming decision needs to be reconfirmed.

The v1.0.3 `docs/API_V2.md` (deleted in v1.0.4, restored in `docs/API_V2_PROGRESS.md`, not yet re-created as a standalone architecture doc) had already recorded this as a deliberate decision, not an oversight:

> Physical schema (`display_layouts`, `display_layout_tiles`, `screens`, `display_sessions`, `display_session_screens`, `presentation_assets`) are **retained**. Canonical v2 language (Team, Team member, Board, Board Element, Display, Session, Session Display assignment, Asset/PowerPoint Asset) is exposed [at the API/naming layer].

with an explicit mapping table:

| Physical table | Canonical v2 term |
|---|---|
| `display_layouts` | Board |
| `display_layout_tiles` | Board Element |
| `presentation_assets` | Asset / PowerPoint Asset |

**Decision required (owner confirmation needed — not assumed by this pass):**

- **Option A — canonical terms as an alias/naming layer.** Board, Board Element, and Asset are product/API-facing names mapped onto the existing `display_layouts`, `display_layout_tiles`, and `presentation_assets` tables. No new schema. This is what v1.0.3 recorded, before that record was deleted.
- **Option B — distinct future entities.** Board, Board Element, and Asset become their own tables/entities, separate from the current physical schema, requiring an approved migration.

**Current status: no schema option has been approved during this documentation pass.** Option A has prior-recorded precedent (above) but was never re-ratified after the v1.0.3 doc was deleted, and `presentation_assets` alone does not cover non-PowerPoint content (menus are a separate, un-unified content type either way). This documentation must not be read as having silently picked Option B — it has not picked either option; it is surfacing that a decision exists and needs an explicit owner call.

The 12 "planned" v2 paths in `api-inventory.json` (`/v2/boards`, `/v2/layouts`, `/v2/scenes`, `/v2/menus`, `/v2/presentations`) reflect this unresolved question rather than a decided design — they were added in v1.0.5 without a recorded architecture decision, and without carrying forward the v1.0.3 mapping above.

## Contract Files

Each file below now carries a `_verification` block (or, for the two rewritten this pass, an inline `statusLegend`/per-entry status) stating whether its claims were independently re-checked in this documentation pass. Do not treat a file as current just because it's listed here — check its own `_verification.status`.

- `docs/api/v2/openapi.json` — planned v2 OpenAPI contract. **not_reverified**, non-authoritative.
- `docs/api/v2/api-inventory.json` — per-function deployment status + planned v2 path inventory. **Corrected and re-verified this pass** against `list_edge_functions` and `get_logs`.
- `docs/api/v2/error-catalog.json` — stable error code catalog. **not_reverified**, spot-checked only, no false claims found.
- `docs/api/v2/capability-matrix.json` — current implementation status and gaps. **Corrected and re-verified this pass.**
- `docs/api/v2/state-machines.json` — runtime state-machine definitions for pairing, display state, presentations, automations, and billing. **not_reverified**; note text corrected to stop implying all trigger functions are deployed.
- `docs/api/v2/schema-map.json` — domain-to-table schema mapping. **database_verified this pass** against a direct `list_tables` read.

## Notes

- This documentation is intentionally explicit about the current live edge functions vs the future v2 manager router.
- The v2 router is foundation-only at present; actual manager data mutations still happen through the existing domain and edge function stack.
- Keep these docs in sync with `src/api/v2`, `supabase/functions/_shared/v2`, and the live edge function implementations.
