# Scena documentation

## What Scena is

Scena is the manager portal and kiosk display system for digital menu
boards / display screens, built on Supabase (Postgres + Auth + Realtime +
Edge Functions). Managers sign in through KpnCompute/MJCC SSO and control
locations, menus, scenes, layouts, screens, sessions, and automations for
their organization; kiosks are persistent physical screens that pair once
and render whatever a manager's active session resolves to for them.

## What Version 1.0.0 represents

The **backend and system foundation**: database-alignment, domain service
layer, Edge Functions, authentication, display-state resolution, real-time
invalidation, offline handling, presentation processing contracts, and
automation scheduling — all implemented and verified — with **no manager
UI**. This is the foundation Claude Design (or any future UI work) builds
on top of, not a finished product.

## Backend completion status

Complete and verified: MJCC SSO, organization tenancy + RLS authorization,
entitlements, locations/menus/sections/items, presentation metadata +
LXC contract, scenes, layouts + tiles, persistent screens + pairing +
credentials, display sessions + all four display modes, the display-state
resolver, Realtime Broadcast invalidation, 4-second polling reconciliation,
offline caching, the automation worker (with a documented external
scheduler configuration). See `ENGINE.md` for exactly what's
database-enforced vs. application-enforced, and `docs/api-inventory.json`
for per-operation test coverage.

## UI status

**Not started.** `src/App.tsx` is a minimal functional test harness (raw
forms, JSON output) used to exercise the backend in a real browser — not a
designed interface. See `UI_INTEGRATION_GUIDE.md` for the boundary the
future UI must respect.

## Deployment status

Application code is complete and verified locally; **no Edge Function in
this release has been deployed with this session's code**, and no database
change has been made or is required. Full breakdown in `DEPLOYMENT.md`.

## Documentation navigation

- [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) — manager/kiosk paths, trust boundaries, tenancy model.
- [`API_REFERENCE.md`](API_REFERENCE.md) — every implemented operation, human-readable.
- [`api-inventory.json`](api-inventory.json) — the same, machine-readable.
- [`openapi.json`](openapi.json) — Edge Function HTTP transport as OpenAPI.
- [`ENGINE.md`](ENGINE.md) — the behavioral engine: validation, error mapping, authorization, lifecycles, database- vs. application-enforced rules.
- [`AUTHENTICATION.md`](AUTHENTICATION.md) — the MJCC SSO flow end to end.
- [`DISPLAY_SYSTEM.md`](DISPLAY_SYSTEM.md) — screens, pairing, credentials, display modes, invalidation.
- [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) — live schema compatibility report, proposed (unapplied) migrations.
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — environment variables, deploy commands, smoke tests, rollback.
- [`SCHEDULER.md`](SCHEDULER.md) — the automation worker's external scheduler configuration.
- [`UI_INTEGRATION_GUIDE.md`](UI_INTEGRATION_GUIDE.md) — the stable boundary for future UI work.

## Current known limitations

- No mocked-LXC integration test for the presentation upload/callback flow.
- Manager and Presentation workflows are covered by domain code + type-check + unit tests, but not live-transaction-tested end to end the way Screen/Session/Automation workflows were.
- Most individual domain CRUD functions have no dedicated unit test (the validation/error-mapping logic they share does).
- `menus` isn't in the Realtime publication (only `menu_sections`/`menu_items` are) — cosmetic only, backstopped by the 4-second poll.
- No failure-count/circuit-breaker column on `display_automations` yet (proposed, unapplied — see `DATABASE_SCHEMA.md` §5b).
- Kiosk-side consumption of LXC presentation manifests (fetching/rendering the actual slide assets) is not yet built — `display-gateway` hands back a manifest reference only.

## Database safety boundary

The live Supabase database is authoritative. This repository documents its
structure (`DATABASE_SCHEMA.md`) but does not modify it — no migration
ships with this release, and the two proposed migrations remain unapplied
pending explicit approval. See `DEPLOYMENT.md` § Database changes requiring
explicit approval.

## How manager, kiosk, API, engine, and system layers relate

```
System (SYSTEM_ARCHITECTURE.md)
  — the two client paths and their trust boundaries

  Manager path                          Kiosk path
  ↓                                     ↓
  API (API_REFERENCE.md)                API (API_REFERENCE.md)
  — domain modules, RLS-protected       — display-gateway, device-token
    CRUD + privileged Edge Functions      authenticated only

  ↓                                     ↓
  Engine (ENGINE.md)
  — validation, error mapping, authorization, lifecycles: the same engine
    layer serves both paths, split only by which operations each path is
    allowed to call

  ↓
  Database (DATABASE_SCHEMA.md)
  — the actual authority for every business rule; RLS for manager access,
    service-role for the operations no client role should reach directly
```
