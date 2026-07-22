# Scena Database Schema

Verified directly against the live Supabase project via `mcp__supabase__list_tables` (verbose) and `mcp__supabase__list_migrations` on 2026-07-22. This replaces the `docs/DATABASE_SCHEMA.md` deleted in v1.0.4 — it is a fresh, re-verified document, not a restoration of the old text (the old text described the pre-native-auth MJCC schema and would now be stale).

All 26 tables in the `public` schema have `rls_enabled: true`. Row counts at verification time: `plans`=3, `profiles`=1, `user_preferences`=1, `billing_events`=1, everything else=0 (pre-launch, no real customer data yet — consistent with [docs/sop/Roadmap.md](sop/Roadmap.md) Stage 0).

Live migration count: **29 applied**. Local `supabase/migrations/` has only 10 files. The 19 newest live migrations (native auth, team invitations, paid-team provisioning, quota enforcement, Stripe billing control plane, notification outbox) have no corresponding file in the repo — they were applied directly against the live project. Treat the live database as the authoritative schema; do not write a new migration that re-creates something already live without first pulling the existing migration body down for parity.

## 1. Teams (`organizations`)

The table is literally named `organizations`; its own DB comment states product APIs and UI should call these **Teams**, matching [docs/sop/Purpose.md](sop/Purpose.md) §3.3.

- **`organizations`** — `id`, `name`, `slug` (unique, lowercase-slug format), `status` (`active`/`suspended`), `created_by` → `auth.users`, timestamps.
- **`organization_members`** — composite PK `(org_id, user_id)`. `role` constrained to exactly `owner`/`admin`/`operator`/`designer`/`viewer` — matches SOP §7 roles exactly. `status` (`active`/`invited`/`suspended`), `invited_by` → `auth.users`.
- **`organization_entitlements`** — PK `org_id`. `plan_code` constrained to `plus`/`pro`/`max`. Columns `max_displays`, `max_boards`, `max_members`, `max_concurrent_sessions`, `max_displays_per_session` (hard-locked to `4` by a check constraint), `automation_tier` (`none`/`basic`/`advanced`), `allow_display_groups`, `allow_session_groups`, `allow_resource_access_controls` (booleans). These map one-to-one to the Plus/Pro/Max limits in SOP §6 — see the table below.
- **`organization_preferences`** — PK `org_id`. `timezone`, `locale`, `branding` (jsonb), `default_session_settings` (jsonb).
- **`team_invitations`** — hashed (`token_hash`, 64-char, unique), expiring (`expires_at` default +7 days) invitations. `role` restricted to `admin`/`operator`/`designer`/`viewer` (cannot invite a second `owner` directly). `status`: `pending`/`accepted`/`revoked`/`expired`.

### Plan limits: SOP vs. schema (verified match)

| Plan | max_displays | max_boards | max_members | max_concurrent_sessions | automation_tier | groups / ACL |
|---|---|---|---|---|---|---|
| Plus | 2 | 10 | 5 | 1 | none | false / false / false |
| Pro | 5 | 30 | 10 | 2 | basic (daily/weekly, per SOP) | false / false / false |
| Max | 15 | 50 | 25 | 4 | advanced (hourly/daily/weekly, per SOP) | true / true / true |

`max_displays_per_session` is a global constant (`4`) for every plan, matching SOP §6.4's "every Session is limited to four active Displays regardless of plan."

**Column naming note:** `max_boards` is the live column name, even though no `boards` table exists yet (see [docs/api/v2/README.md](api/v2/README.md#vocabulary-gap-sop-canonical-terms-vs-live-schema) for the vocabulary gap). What this column is actually enforced against today (`menus`? `scenes`? `display_layouts`?) was not verified in this pass — flagged as an open question, not guessed.

## 2. Users

- **`profiles`** — PK `user_id` → `auth.users`. `display_name`, `avatar_url`, `timezone`, `onboarding_state` (`needs_profile`/`complete`).
- **`user_preferences`** — PK `user_id`. `last_org_id` → `organizations`, `theme` (`system`/`light`/`dark`), `locale`, `notifications` (jsonb, default `{"team":true,"product":true,"security":true}`).

Credentials and OAuth identities live in Supabase Auth (`auth.users`), not in `public` — per `profiles`' own DB comment.

## 3. Locations

- **`locations`** — PK `id`, `org_id` → `organizations`, `name`, `slug`, `timezone`, `status` (`active`/`inactive`). Referenced by `menus`, `scenes`, `display_layouts`, `screens`, `display_sessions` via composite `(org_id, location_id)` foreign keys — every content and display row is scoped to one location within one Team.

## 4. Displays (`screens`)

DB-internal name is `screens`; SOP §3.4 mandates the customer-facing term **Display**.

- **`screens`** — PK `id`. `org_id`, `location_id` (both nullable until claimed — composite FK to `locations`). `device_token_hash` (unique). `status`: `pairing`/`ready`/`revoked`. `claimed_at`, `last_seen_at`, `revoked_at`.
- **`screen_pairing_codes`** — PK `screen_id`. `code_hash` (unique), `expires_at` (default +30 min), `consumed_at`, `attempt_count`, `locked_until` — matches SOP §12 Stage 8's pairing-code lifecycle (expires, single-use, attempt-limited) exactly.

**Live gap:** the function that creates `screens` rows (`screen-register`) is not deployed — see [docs/api/v2/README.md](api/v2/README.md). This table's `pairing` status path cannot currently be entered through production.

## 5. Sessions

- **`display_sessions`** — PK `id`. `org_id`, `location_id`. `status`: `draft`/`active`/`stopped`. `display_mode`: `independent`/`duplicate`/`extend`/`single`. `shared_layout_id` (nullable, composite FK to `display_layouts`). `created_by`/`started_by`/`stopped_by` → `auth.users`.
- **`display_session_screens`** — join table assigning a `screen_id` to a `session_id` with an optional per-screen `layout_id` override, `assignment_status` (`configured`/`active`/`removed`), viewport percentages (`x/y/width/height_percent`), `rotation_degrees` (0/90/180/270), `is_primary`, `screen_order`.

## 6. Layouts ("Boards" in SOP terms — see vocabulary gap)

- **`display_layouts`** — PK `id`. `org_id`, `location_id`. `canvas_width`/`canvas_height` (default 1920×1080), `background_color` (hex), `is_active`.
- **`display_layout_tiles`** — PK `id`. `layout_id`, `scene_id`. Position (`x/y/width/height_percent`), `z_index`, `is_visible`, `config` (jsonb).

SOP §11 mandates "Board, not display layout" and "Board Element, not tile" as customer-facing terms. The schema uses `display_layouts`/`display_layout_tiles` throughout — no rename has happened at the data layer. See [docs/api/v2/README.md](api/v2/README.md#vocabulary-gap-sop-canonical-terms-vs-live-schema).

## 7. Content (Scenes, Menus, Presentation Assets)

- **`scenes`** — PK `id`. `scene_type`: `menu` or `powerpoint`. Points to either `menu_id` or `presentation_asset_id` depending on type. `config` (jsonb).
- **`presentation_assets`** — PK `id`. `original_filename`, `mime_type` (locked to PowerPoint MIME types), `size_bytes`, `checksum_sha256`, `lxc_source_key`/`lxc_manifest_key`, `status`: `pending_upload`/`uploaded`/`processing`/`ready`/`failed`. This is the nearest live analog to the SOP's generic "Asset" concept, but it is PowerPoint-specific, not a generic asset model.
- **`menus`** → **`menu_sections`** → **`menu_items`** — three-level menu content tree (name/price/description/image/sold-out/visibility/sort order at the item level).

## 8. Automations

- **`display_automations`** — PK `id`. `action_type` constrained to `start_session`/`stop_session`/`set_display_mode`/`set_shared_layout`/`set_screen_layout`/`enable_screen`/`disable_screen`/`switch_primary_screen`. `schedule_type`: `once` or `cron` (`run_once_at` or `cron_expression` + `timezone`). `next_run_at`/`last_run_at` for scheduler bookkeeping.

**Live gap:** the worker that executes due automations (`automations-run`) is not deployed — rows in this table are currently inert in production.

## 9. Billing

- **`plans`** — PK `plan_code` (`plus`/`pro`/`max`). `stripe_product_id` (unique), `stripe_price_id` (unique), `unit_amount`, `billing_interval`, `is_active`.
- **`workspace_subscriptions`** — PK `org_id`. `owner_user_id`, `stripe_customer_id`, `stripe_subscription_id` (unique), `status` (`trialing`/`active`/`past_due`/`unpaid`/`paused`/`cancelled`/`incomplete`/`incomplete_expired`), `current_period_start/end`, `cancel_at_period_end`.
- **`checkout_sessions`** — PK `id`. `stripe_checkout_session_id` (unique), `requested_team_name`/`requested_team_slug` (validated before Stripe is even called), `status` (`open`/`complete`/`expired`/`cancelled`/`failed`).
- **`billing_customers`** — PK `user_id`. One Stripe customer per user (`stripe_customer_id` unique).
- **`billing_events`** — PK `stripe_event_id`. Raw webhook event log: `event_type`, `livemode`, `payload` (jsonb), `processing_status` (`received`/`processing`/`processed`/`failed`/`ignored`).
- **`billing_notification_outbox`** — durable email queue generated from verified billing events. `notification_type`: `subscription_started`/`renewal_reminder`/`payment_failed`/`cancellation_scheduled`/`subscription_disabled`/`subscription_reactivated`. `status`: `pending`/`processing`/`sent`/`failed`/`cancelled`.

Two database functions drive billing state transitions: `finalize_paid_team_subscription` (Checkout → Team) and `sync_paid_team_subscription` (ongoing Stripe state sync), both called from `billing-webhook`.

## What does not exist yet

Verified absent from the live schema (not merely unverified):

- No `boards`, `board_elements`, or generic `assets` table — see the vocabulary gap above.
- No `audit_events` table. [docs/sop/Purpose.md](sop/Purpose.md) requires audit events for Team deletion and other sensitive actions; `supabase/functions/_shared/v2/audit.ts` exists as shape-only scaffolding, not wired to any table.
- No `idempotency_keys` table. Client-side idempotency key generation exists in `src/api/v2`, but there's no server-side store to enforce it yet. DDL for both tables was drafted in a prior session (see [docs/API_V2_PROGRESS.md](API_V2_PROGRESS.md)) but never applied — a git/docs transaction is not authorization to apply it; that requires an explicit, separate migration decision.

## Security advisors (last checked, per prior session — re-verify before relying on this)

3 `INFO` findings: RLS enabled with no policy on `billing_events`, `billing_notification_outbox`, `screen_pairing_codes`. 3 `WARN` findings: `SECURITY DEFINER` RPCs (`accept_team_invitation`, `create_team_invitation`, `revoke_team_invitation`) callable by `authenticated`. These were not re-triaged in this pass — run `mcp__supabase__get_advisors` again before treating this as current.
