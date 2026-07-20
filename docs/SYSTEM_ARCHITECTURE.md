# Scena system architecture

Scena is one Supabase project serving two client surfaces that never share
credentials:

- **Manager portal** — authenticated managers (MJCC SSO) manage locations,
  menus, scenes, layouts, screens, sessions, and automations for their
  organization.
- **Kiosk display** — a physical screen, paired once, that authenticates with
  its own opaque device credential and renders whatever a manager's active
  session resolves to for it.

Both surfaces talk to the same Supabase project, but through different trust
boundaries (below). Manager traffic is RLS-protected PostgREST reads/writes
plus a handful of privileged Edge Functions; kiosk traffic is exclusively one
Edge Function (`display-gateway`), because a kiosk holds neither a Supabase
session nor RLS grants of any kind.

## Manager path

```
Future manager UI
  -> Feature hooks/controllers        (src/ui/features/* — not built in v1.0.0)
  -> Typed API client                 (src/services/supabase/client.ts)
  -> Domain services                  (src/domain/*.ts)
  -> Supabase RLS + PostgreSQL        (organization_members / has_org_role / is_org_member)
       + privileged Edge Functions    (pairing, credentials, presentations, automations)
```

Domain modules (`src/domain/organizations.ts`, `locations.ts`, `menus.ts`,
`scenes.ts`, `layouts.ts`, `screens.ts`, `sessions.ts`, `automations.ts`) call
the Supabase client directly for ordinary CRUD — authorization is enforced by
RLS on every table (`is_org_member`/`has_org_role`, both `SECURITY DEFINER`
functions reading `organization_members`), not by client-side checks. Domain
modules validate request *shape* (`src/shared/validation.ts`) for fast
feedback and translate raised Postgres errors into the stable contract
(`src/shared/errors.ts#mapPostgresError`) — the database's triggers and
constraints remain the actual authority for business rules (entitlement
limits, display-mode validity, session lifecycle — see `ENGINE.md`).

Five operations are too sensitive or multi-step for direct RLS-protected
writes and go through service-role Edge Functions instead: MJCC SSO exchange,
screen pairing/claim, device credential rotation, presentation upload/
callback, and automation execution. See `API_REFERENCE.md`.

## Kiosk path

```
Kiosk client                          (src/Display.tsx, src/lib/display.ts)
  -> Device credential                (opaque token, hashed at rest — never a Supabase JWT)
  -> Display gateway                  (supabase/functions/display-gateway)
  -> Authoritative display-state resolver
       (supabase/functions/_shared/displayState.ts#resolveDisplayState)
  -> Sessions, layouts, tiles, scenes, and content
       (display_sessions, display_session_screens, display_layouts,
        display_layout_tiles, scenes, menus/menu_sections/menu_items,
        presentation_assets)
```

A kiosk registers once (`screen-register`), gets a device token + a 6-digit
pairing code, and polls `display-gateway` with that token on every request.
The gateway hashes the token, matches it against `screens.device_token_hash`,
and resolves state scoped entirely to that screen's own `org_id`/`location_id`
— a kiosk cannot request an arbitrary organization or session.

## Trust boundaries

| Boundary | Enforced by |
|---|---|
| Manager ↔ organization data | Supabase RLS (`is_org_member`, `has_org_role`), never client-side gating alone |
| Manager role (owner/admin/operator/viewer) | Same RLS functions, reading `organization_members.role` |
| Kiosk ↔ manager | Kiosk never holds a Supabase session; device token is a separate, table-scoped credential (`screens.device_token_hash`), hashed, rotatable, revocable |
| Kiosk ↔ organization data | `display-gateway` resolves everything through the screen's own row — the kiosk supplies only its token, never an org/session ID |
| Browser ↔ service-role secrets | Never reach the browser; only Edge Functions hold `SUPABASE_SERVICE_ROLE_KEY` |
| LXC presentation service ↔ Scena | Shared-secret authenticated callback (`presentation-callback`), not a manager or kiosk credential |
| Automation scheduler ↔ Scena | Shared-secret authenticated (`automations-run`), external to this repo |

## Multi-tenant organization model

Every content table carries `org_id`; most also carry `location_id` with
composite foreign keys like `(id, org_id, location_id)` so a child row's
location can never drift from its parent's org. One organization (`mjcc`) is
seeded today by the MJCC SSO bridge — the schema supports more, but only one
is provisioned in production. See `DATABASE_SCHEMA.md` for the full table
list and constraint inventory.

## Manager authentication

KpnCompute/MJCC issues a short-lived handoff code; `mjcc-sso-exchange`
resolves or provisions a local Supabase Auth user via the immutable
`external_identities` mapping and returns a real Supabase session. Full
detail in `AUTHENTICATION.md`.

## Device authentication

A screen's device token is generated at `screen-register`, never derived from
or convertible into a manager credential. `screen-credential-rotate` reissues
it; revocation (`screens.status = 'revoked'`) is enforced by `display-gateway`
on every request. Full detail in `DISPLAY_SYSTEM.md`.

## RLS vs. service-role responsibilities

- **RLS** (client-facing PostgREST reads/writes): every manager CRUD path in
  `src/domain/*.ts`. Policies are role-scoped (`owner`/`admin`/`operator` can
  write; `viewer` and below can only read) and org-scoped.
- **Service role** (Edge Functions only): anything that crosses a table with
  no client RLS grant at all (`screen_pairing_codes`), issues or rotates a
  credential, or must be authenticated by something other than a Supabase JWT
  (kiosk device token, LXC callback secret, scheduler secret).

## Edge Function boundaries

Eight functions, each doing exactly one privileged thing — full request/
response/error contract in `API_REFERENCE.md`:
`mjcc-sso-exchange`, `screen-register`, `screen-claim`,
`screen-credential-rotate`, `display-gateway`, `presentation-upload`,
`presentation-callback`, `automations-run`.

## Realtime Broadcast invalidation

Kiosks cannot use Supabase's `postgres_changes` Realtime (RLS blocks the
`anon` role from every relevant table, since a kiosk never signs in). Instead,
every domain mutation and mutating Edge Function that can change what a
screen renders sends a Realtime **Broadcast** (not RLS-gated) on that
organization's `org:{orgId}` channel after a successful write
(`src/services/supabase/invalidation.ts`,
`supabase/functions/_shared/broadcast.ts`). The kiosk joins that channel once
it learns its `org_id` and treats every broadcast as a hint to re-fetch full
state — never as data to trust directly.

## Four-second polling reconciliation

`src/Display.tsx` polls `display-gateway` every 4 seconds unconditionally,
independent of the broadcast channel. This is the backstop for a dropped
socket, a missed broadcast, or a kiosk that hasn't joined a channel yet (still
pairing) — bounded staleness, not "eventually" in an unbounded sense.

## Offline cache

`src/lib/display.ts` caches the last successful "showing" payload to
`localStorage`. On a fetch failure it serves that cache back instead of
erroring, and replaces it atomically the moment a fresh authoritative
response arrives — never a partial merge.

## LXC presentation processing

PowerPoint files are uploaded to a private LXC service, not Supabase Storage.
`presentation-upload` brokers the upload job; `presentation-callback`
(shared-secret authenticated) is the only path that can mark a
`presentation_assets` row `ready` or `failed`. See `DEPLOYMENT.md` for the
required `LXC_*` environment variables.

## Automation scheduler

`automations-run` exists as a callable Edge Function but is not
self-triggering — an external scheduler must call it on an interval. See
`SCHEDULER.md` for the chosen configuration.

## Failure boundaries

- A failing domain mutation surfaces a stable error code
  (`src/shared/errors.ts`), never a raw Postgres message.
- A failing kiosk poll falls back to cache; it never renders a browser error
  page.
- A failing automation execution is logged and, for one-shot automations,
  retried on a bounded backoff rather than silently abandoned (see
  `ENGINE.md`).
- A failing broadcast send is swallowed (best-effort) — the 4-second poll is
  the guaranteed recovery path, so a broadcast failure must never block or
  fail the write it was announcing.

## Deployment boundaries

Application code (this repo) and the live database schema are versioned and
approved independently. `v1.0.0` documents the application aligned to the
schema **as it currently exists** — it does not authorize or imply any schema
change. See `DATABASE_SCHEMA.md` for the two migrations proposed but
deliberately left unapplied, and `DEPLOYMENT.md` for exact deployment
commands and the current live-vs-not-yet-deployed status of every Edge
Function.
