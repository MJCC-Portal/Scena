# Changelog

## 2026-07-20 — Backend rebuild gap closure: invalidation, verified tests, scheduler

Closed the verification and correctness gaps left open by the previous
rebuild pass. Two real bugs found and fixed in the process (see below) —
not hypothetical: one broke every kiosk's live-update path outright, the
other silently stranded failed one-shot automations forever.

**Bug fixes:**
- `src/shared/errors.ts#mapPostgresError` only read `.message` off real
  `Error` instances; PostgREST/Supabase errors are plain objects, so
  every mapped error silently fell through to a generic 400. Caught by
  running the test suite for the first time off the network share (see
  below) — 2 of 45 tests failed until fixed.
- The kiosk's realtime subscription (`Display.tsx`) used
  `postgres_changes` on `display_sessions`/`display_session_screens` via
  an unauthenticated (`anon`-role) connection. Every relevant RLS policy
  is scoped `to authenticated` — the kiosk never signs in by design — so
  this subscription structurally could never receive an event. Replaced
  with Realtime **Broadcast** (not RLS-gated) on a per-org channel,
  wired into every domain mutation and mutating Edge Function that can
  change what a kiosk renders.
- `automations-run`: a failed one-shot automation left `next_run_at =
  null`, which can never again satisfy `next_run_at <= now()` — silently
  stranded forever with no signal. Now retries on a 5-minute backoff
  until fixed or disabled.

**Added**: `src/services/supabase/invalidation.ts`,
`supabase/functions/_shared/broadcast.ts`,
`src/lib/display.test.ts`-equivalent
(`src/lib/display.invalidation.test.ts`, 6 tests),
`docs/SCHEDULER.md`, `docs/api-inventory.json`.

**Changed**: broadcast wiring added to
`src/domain/{menus,scenes,layouts,sessions,screens}.ts` (every
display-affecting mutation) and
`supabase/functions/{screen-claim,presentation-callback,automations-run}/index.ts`;
`display-gateway` now returns `org_id` so the kiosk knows which channel
to join; `docs/DATABASE_SCHEMA.md` §5 rewritten with exact
SQL/rollback/locking-risk/recommendation for both proposed (still
unapplied) migrations.

**Verification** (all off a local working copy at `C:\scena-work` — the
network-share `spawn EPERM` from the prior session was confirmed
environment-specific, not fixable from within the repo):
`npm ci` clean · `npx tsc -b` clean · `npx vitest run` **51/51 passing,
0 failing, 0 skipped** · `npm run build` succeeds (211 KB bundle) · all 8
Edge Functions pass `deno check` individually · automation
claim-race-safety and the full screen pairing→claim→heartbeat→
credential-rotation→reuse-rejection lifecycle both verified against the
live database via non-destructive, rolled-back SQL transactions.

## 2026-07-20 — Full application rebuild on the live display-management schema

Rebuilt the application code (manager service layer, kiosk client, Edge
Functions) around the live database, which had moved well past the old
`display_connections`/single-scene model into a normalized
locations → menus/scenes → layouts/tiles → sessions/session-screens →
automations schema with per-session entitlement enforcement, display-mode
validation, and pairing all implemented as triggers/constraints. No
database objects were dropped, renamed, or restructured — see
`docs/DATABASE_SCHEMA.md` for the full compatibility report and the two
proposed-but-unapplied hardening migrations.

**Removed** (old-model, incompatible with the live schema):
`src/lib/scenes.ts`, `src/lib/sessions.ts`, `src/lib/screens.ts`,
`src/lib/presentations.ts`, `src/lib/supabase.ts`, `src/boards.tsx`.

**Added**: `src/shared/{errors,validation,database.types}.ts`,
`src/services/supabase/client.ts`, `src/auth/{sso,organization-context}.ts`,
`src/domain/{organizations,locations,menus,scenes,layouts,screens,sessions,automations}.ts`,
`src/display/resolveDisplayState.ts` (+ tests), unit tests under
`src/shared/*.test.ts`, `vitest.config.ts`,
`supabase/functions/_shared/{errors,http,crypto,adminClient,managerAuth,displayState,cron}.ts`,
`supabase/functions/{screen-register,screen-credential-rotate,presentation-callback,automations-run}/index.ts`,
`docs/DATABASE_SCHEMA.md`, `docs/API.md`.

**Rewritten**: `src/App.tsx` (minimal functional harness, not a styled
portal — see docs/API.md), `src/Display.tsx` + `src/lib/display.ts`
(kiosk client: registration, polling, offline caching, realtime-hint
refresh), `supabase/functions/screen-claim/index.ts`,
`supabase/functions/display-gateway/index.ts`,
`supabase/functions/presentation-upload/index.ts`.

**Verification**: `npx tsc -b` clean (strict mode, zero errors) after
every change. `npm run build` / `npx vitest run` cannot execute in this
environment — `esbuild.exe` fails to spawn from this network share
(`spawn EPERM`, reproduced identically with sandboxing disabled and after
approving/re-running its postinstall script), a pre-existing environment
restriction unrelated to this rebuild. Business-rule error mapping was
instead verified against real trigger output via non-destructive,
rolled-back SQL transactions against the live database (entitlement
limit, draft-session-required, and display-mode/shared-layout messages
all matched `src/shared/errors.ts#mapPostgresError` exactly).

## 2026-07-20 — Manager SSO integrated into the rebuilt menu-board schema

The new menu-board schema (applied directly in the Supabase SQL editor,
outside tracked migrations) dropped `public.external_identities` and
emptied `organizations` / `organization_members`, which broke MJCC
manager sign-in: `mjcc-sso-exchange` resolves local users through that
table. This change restores the SSO bridge on top of the new schema
without altering any of its tables.

### Database (applied via Supabase MCP)
- `supabase/migrations/0008_manager_sso_identity_bridge.sql`
  - Recreated `external_identities` (provider `mjcc`, immutable
    `(provider, external_user_id)` → `user_id` mapping enforced by
    trigger, `last_login_at` audit column).
  - RLS: self + org-manager read only; all writes service-role only.
  - Re-seeded the `mjcc` organization (entitlements auto-created by the
    schema's `organizations_initialize` trigger).
  - Backfilled identity + `owner` membership for the surviving
    production auth user from `auth.users.raw_app_meta_data`
    (`mjcc_user_id`), so no duplicate account is created on next login.
- `supabase/migrations/0009_harden_auth_function_grants.sql`
  - Revoked anon/authenticated EXECUTE on trigger functions and anon
    EXECUTE on membership-check functions (advisor findings).
- Rollback script:
  `supabase/migrations/_drafts/rollback_0008_manager_sso_identity_bridge.sql`.

### Edge Function (code updated, NOT yet deployed)
- `supabase/functions/mjcc-sso-exchange/index.ts`
  - Fails closed (`403 organization_suspended`) when the org is not
    active.
  - Refreshes `role_snapshot` / `last_login_at` on every sign-in.
  - Deploy manually via the project-scoped Supabase CLI.

### Verification
- RLS behavior tested via rolled-back SQL transactions: member sees own
  org/membership/identity, non-member sees zero rows, client-role
  writes to `external_identities` denied.
- `npx.cmd tsc -b` clean. `vite build` blocked by a pre-existing
  environment issue (esbuild.exe cannot spawn from the network share).
- Supabase security advisors: no anon-facing findings remain.

### Known follow-ups
- Frontend/Edge display pipeline still references the old
  `display_connections` model while the live DB now has
  `screens` / `screen_pairing_codes` / `display_session_screens` —
  needs a separate migration of the app code to the new schema.
- The schema build scripts (`01_delete_current_menu_board_schema.sql`,
  `02_create_menu_board_schema.sql`) were run from outside the repo and
  are not committed; the live schema is the only copy.
