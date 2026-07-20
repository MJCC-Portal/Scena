# Scena 1.0.0 — Backend and System Foundation

Version 1.0.0 represents the stable backend, engine, API, authentication,
kiosk, and system foundation before manager UI development begins. It does
not include a manager portal UI, and it makes no change to the live
database schema.

## Included

- MJCC SSO (`mjcc-sso-exchange`), immutable `external_identities` mapping
- Supabase user provisioning
- Organization tenancy, RLS authorization, entitlements
- Locations, menus, sections, items
- Presentation metadata + LXC upload/callback contracts
- Scenes, layouts, tiles
- Persistent screens, device pairing, device credentials, credential rotation
- Display sessions, per-session screen limits, all four display modes (independent/duplicate/extend/single)
- The authoritative display-state resolver
- Realtime Broadcast invalidation (replacing a previously non-functional `postgres_changes` subscription — see Fixed below)
- 4-second polling reconciliation, offline caching
- PowerPoint LXC processing contracts
- The automation worker, with a documented external-scheduler configuration
- Runtime validation, the stable API error contract
- API, engine, system, authentication, display-system, deployment, and UI-integration documentation

## Not included

- Manager portal UI
- Final visual layout editor
- Final kiosk styling / product branding
- Complete production deployment (no Edge Function in this release has been deployed with this code)
- Approved optional schema migrations (both proposed migrations remain unapplied)
- End-to-end LXC infrastructure validation (no live LXC service was available to test against; the contract is implemented and type-checked, not exercised against a real LXC deployment)

## Fixed this release

- **Kiosk invalidation was structurally broken.** The prior implementation subscribed to `postgres_changes` on an unauthenticated (`anon`-role) connection; every relevant RLS policy is `to authenticated` only, so the subscription could never receive an event. Replaced with Realtime Broadcast (not RLS-gated), wired into every mutation that can change what a kiosk renders.
- **`mapPostgresError` silently mishandled every real Postgres error**, checking `err instanceof Error` when PostgREST returns plain objects. Found by running the test suite (2 of 45 tests failed) off a local working copy after the network share proved unable to execute native binaries.
- **A failed one-shot automation was stranded forever** (`next_run_at=null` can never again satisfy `next_run_at <= now()`). Now retries on a 5-minute backoff.

## Verification

- **TypeScript**: `npx tsc -b` — zero errors, strict mode.
- **Tests**: `npx vitest run` — **51 passed, 0 failed, 0 skipped.**
- **Production build**: `npm run build` — succeeds (211 KB JS bundle, 22 KB CSS).
- **Deno verification**: all 8 Edge Functions (`mjcc-sso-exchange`, `screen-register`, `screen-claim`, `screen-credential-rotate`, `display-gateway`, `presentation-upload`, `presentation-callback`, `automations-run`) individually pass `deno check` with zero errors.
- **Rolled-back live-database checks** (non-destructive, verified against the actual production schema, never committed): entitlement screen-per-session limit, draft-session-required lifecycle, display-mode/shared-layout constraint, full screen pairing→claim→heartbeat→credential-rotation→reuse-rejection lifecycle, and automation-worker exactly-once concurrent-claim behavior — all confirmed matching documented behavior.
- **Secret scan**: no `.env` files staged (properly gitignored), no literal secret values found in source, no service-role key returned in any Edge Function response.
- **Documentation validation**: `docs/api-inventory.json` and `docs/openapi.json` both parse as valid JSON; no merge markers or obsolete display-model references (`display_connections`, `display_session_codes`, `assigned_scene_id`, `mjcc_identities`) remain outside historical, already-superseded migration files.

## Deployment state

```
Implemented and committed:
  Full backend service layer, domain modules, 8 Edge Functions, shared
  validation/error contract, kiosk client, all documentation.

Implemented but not deployed:
  All 8 Edge Functions — none carry this release's code in production yet.

External configuration required:
  Automation scheduler (SCHEDULER.md), LXC service credentials, 4 new
  Edge Function secrets (DEPLOYMENT.md).

Proposed database changes awaiting approval:
  §5a grant-hardening on screens/screen_pairing_codes (security priority).
  §5b failure-tracking columns on display_automations (optional).
  Neither is applied by this release.

Known non-blocking limitations:
  No mocked-LXC integration test; Manager/Presentation workflows not
  live-transaction-tested (Screen/Session/Automation workflows were);
  most individual domain CRUD functions lack a dedicated unit test;
  `menus` table not in the Realtime publication (cosmetic, backstopped
  by polling); kiosk-side LXC manifest consumption not yet built.
```

Do not treat any Edge Function as live in production based on this release
— see `docs/DEPLOYMENT.md` for exact deploy commands, none of which have
been run as part of this release.
