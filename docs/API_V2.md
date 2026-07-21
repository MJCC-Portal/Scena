# Scena API v2

Status: **foundation only** (Phase 2 of the API v2 migration — see
`docs/API_V2_PROGRESS.md` for the session-by-session engineering log). No
v2 product endpoint is deployed yet. This document is the narrative
architecture reference; `docs/api/v2/openapi.json` and
`docs/api/v2/api-inventory.json` are its machine-readable companions,
covering only what's actually built so far — not the full future surface.

## Version definition

API v2 is the **application contract version** — the envelope shape,
error-code contract, and request/idempotency conventions described here.
It is not a Git tag, not `package.json`'s version, not a migration
version, and not the `/functions/v1/` segment in Supabase Edge Function
URLs (that's platform infrastructure naming).

## Architecture decisions

### 1. One modular router for manager-JWT v2 endpoints

Future manager-facing v2 product endpoints (Teams, Boards, Displays,
Sessions, Automations, Integrations, Audit Events, etc.) will be served by
one Edge Function, `supabase/functions/scena-api/`, with route handlers
under `supabase/functions/scena-api/routes/v2/`, reachable at
`/functions/v1/scena-api/v2/...`. **Not built yet** — no v2 product
resource exists to route to. `src/api/v2/client.ts#requestV2()` already
targets this path so the client contract is stable before the function
exists; calling it today returns a 404 from Supabase's function router,
surfaced as an `ApiV2TransportError`, not a fabricated success.

Rationale: one router keeps the manager-JWT trust boundary in one place
(one `requireManager()` call site pattern, one CORS/idempotency/audit
wiring) instead of N near-identical single-purpose functions that would
each have to reimplement the same auth/envelope/logging boilerplate.

### 2. Separate trust-boundary functions stay separate

`billing-webhook`, `display-gateway`, and (in later phases)
`display-register`, `asset-process-callback`, `automations-run`,
`billing-notifications-run`, and provider ingest webhooks are **not**
folded into `scena-api`. Each has a different caller and a different
credential: Stripe's signature, a Display's opaque device token, or a
scheduler/service secret — none of which is a Supabase manager JWT. Manager
(JWT) and Display (opaque token) authentication must never be accepted
where the other is expected (INV-2 in the migration plan); routing them
through a JWT-checking router would either break them or create exactly
that hole. This phase changes none of them.

### 3. Domain modules vs. the v2 client — no duplicate system

`src/domain/*.ts` (locations, menus, scenes, layouts, screens, sessions,
automations, organizations, billing) keeps doing ordinary RLS-protected
CRUD directly against Supabase — unchanged, not wrapped, not duplicated.
`src/api/v2/*` is net-new infrastructure for the resources that don't
exist yet (Boards, Displays-as-v2-resource, Session commands, etc.) and
for any endpoint that specifically needs a request ID / idempotency key /
audit trail that a plain Supabase client call doesn't give you. Existing
domain modules migrate to the v2 client individually, later, only when
there's a concrete reason (e.g. a mutation that needs idempotency) — not
as a blanket rewrite.

Error handling follows the same rule: one `ApiError` class
(`src/shared/errors.ts`, Deno twin `supabase/functions/_shared/errors.ts`)
serves both v1 and v2 code. `src/api/v2/errors.ts` re-exports it and adds
only the envelope-parsing glue the v2 client needs.

### 4. Physical schema: Option A (retain names)

Legacy physical table names (`organizations`, `organization_members`,
`display_layouts`, `display_layout_tiles`, `screens`, `display_sessions`,
`display_session_screens`, `presentation_assets`) are **retained**.
Canonical v2 language (Team, Team member, Board, Board Element, Display,
Session, Session Display assignment, Asset/PowerPoint Asset) is exposed
only at the API/UI layer. No coordinated rename was performed or is
currently justified: 29 live migrations, RLS policies, triggers, and
RPCs already reference these names; a rename would touch all of that for
zero functional gain at this stage, and would violate "MUST NOT create
duplicate old/new schemas" the moment it was partial.

| Legacy physical name | Canonical v2 term |
|---|---|
| `organizations` | Team |
| `organization_members` | Team member |
| `display_layouts` | Board |
| `display_layout_tiles` | Board Element |
| `screens` | Display |
| `display_sessions` | Session |
| `display_session_screens` | Session Display assignment |
| `presentation_assets` | Asset / PowerPoint Asset |

## Response envelopes

Success:
```json
{ "data": {}, "meta": { "api_version": "2", "request_id": "..." } }
```

Error:
```json
{ "error": { "code": "STABLE_MACHINE_CODE", "message": "Safe user-facing message", "details": {}, "request_id": "..." } }
```

Implemented in `src/api/v2/envelopes.ts` (client) and
`supabase/functions/_shared/v2/response.ts` (`jsonV2`, `errorResponseV2`,
`serveJsonV2`).

## Request IDs

Every v2 request carries an `x-request-id` header: the caller may supply
one (validated against a 100-char safe token pattern) or the client/server
generates a `crypto.randomUUID()`. It's echoed in the response header and
`meta.request_id` / `error.request_id`, and is meant for log/audit
correlation only — **never** treated as authentication.
Implemented in `src/api/v2/request.ts` / `supabase/functions/_shared/v2/request.ts`.

## Error codes: v1/v2 legacy mapping

`src/shared/errors.ts`'s `ERROR_CODES` now holds both the original v1
codes and the new v2 stable codes, additively — nothing was renamed.
Where a v2 code covers ground a v1 code already covered under
screen/organization-era naming, both codes exist side by side:

| v1 code (unchanged, still in use) | v2 code (new, Team/Board/Display/Session naming) |
|---|---|
| `RESOURCE_NOT_FOUND` | `NOT_FOUND` |
| `DEVICE_CREDENTIAL_INVALID` | `DISPLAY_CREDENTIAL_INVALID` |
| `SCREEN_REVOKED` | `DISPLAY_REVOKED` |
| `MEMBERSHIP_REQUIRED` / `ORGANIZATION_SUSPENDED` | `TEAM_REQUIRED` |

New v2-only codes added this phase (no v1 equivalent existed):
`TEAM_LIMIT_REACHED`, `TEAM_OVER_LIMIT`, `PLAN_REQUIRED`,
`PLAN_FEATURE_REQUIRED`, `SUBSCRIPTION_REQUIRED`, `SUBSCRIPTION_INACTIVE`,
`MEMBER_LIMIT_REACHED`, `BOARD_LIMIT_REACHED`, `DISPLAY_LIMIT_REACHED`,
`SESSION_LIMIT_REACHED`, `SESSION_DISPLAY_LIMIT_REACHED`,
`RESOURCE_CONFLICT`, `INVALID_INVITATION`, `INVITATION_EMAIL_MISMATCH`,
`PROCESSING_FAILED`, `IDEMPOTENCY_CONFLICT`.

## Idempotency — foundation only, not yet backed by a table

`src/api/v2/idempotency.ts` (client: generates an `x-idempotency-key`) and
`supabase/functions/_shared/v2/idempotency.ts` (server: `withIdempotency()`
shape) exist, but **no `idempotency_keys` table has been created live**.
This is deliberate: no v2 endpoint built so far performs a retryable
mutation, and this repo's rules forbid adding a migration "merely to make
the architecture look cleaner." The proposed schema for when the first
real idempotent v2 mutation is built (expected Phase 3, Team/billing
alignment):

```sql
-- PROPOSED, NOT APPLIED. Review before running via apply_migration.
create table public.idempotency_keys (
  key text primary key,
  user_id uuid not null references auth.users(id),
  request_hash text not null,        -- hash of (route + normalized body), to detect key reuse with a different payload
  response_status int not null,
  response_body jsonb not null,
  created_at timestamptz not null default now()
);
-- Short retention: an index + a scheduled cleanup (not a cron job yet)
-- should prune rows older than ~24h once this is wired to a real route.
alter table public.idempotency_keys enable row level security;
alter table public.idempotency_keys force row level security;
revoke all on table public.idempotency_keys from anon, authenticated;
-- service-role only: idempotency bookkeeping is never client-writable.
```

## Audit events — foundation only, not yet backed by a table

`supabase/functions/_shared/v2/audit.ts#recordAuditEvent()` exists but
currently only logs (no `audit_events` table live yet), for the same
reason as idempotency above — no v2 mutation exists yet to actually
produce a first real audit row. Proposed schema (matches the
`<audit_system>` field list from the migration plan):

```sql
-- PROPOSED, NOT APPLIED. Review before running via apply_migration.
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  org_id uuid references public.organizations(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  request_id text not null,
  source text not null check (source in ('user','system','webhook','worker')),
  before jsonb,
  after jsonb,
  ip_hint text,
  created_at timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events(org_id, created_at desc);
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;
-- members can read their own Team's audit log; only service-role writes.
create policy audit_events_team_select on public.audit_events
  for select to authenticated
  using (org_id in (select org_id from public.organization_members where user_id = auth.uid() and status = 'active'));
revoke insert, update, delete on table public.audit_events from anon, authenticated;
```

## Directory structure (as built this phase)

```
src/api/v2/
  envelopes.ts      success/error envelope types + helpers
  request.ts        request-ID generation/validation
  idempotency.ts     client-side idempotency-key helper
  errors.ts          re-exports ApiError; envelope-aware error parsing
  types.ts           shared v2 primitives (paging, etc.)
  client.ts          requestV2() — the fetch wrapper every future module calls
  modules/           empty — first module lands with the first real v2 resource
  index.ts           barrel

supabase/functions/_shared/v2/
  cors.ts            v2 CORS headers (adds x-request-id/x-idempotency-key)
  request.ts         Deno twin of src/api/v2/request.ts
  response.ts        jsonV2 / errorResponseV2 / serveJsonV2
  auth.ts             re-exports requireManager (no second identity resolver)
  validation.ts       pagination + JSON-body parsing helpers
  idempotency.ts      server-side shape, not wired (see above)
  audit.ts            server-side shape, not wired (see above)
  logging.ts          structured JSON log helper
```

## What is explicitly NOT in this phase

Assets, Boards, Displays, Display Groups, Sessions, Session Groups,
Automations, Integrations, resource-access grants — none
of these have a v2 module, table, or endpoint yet. `scena-api` itself is
not deployed. `billing-checkout`/`billing-portal`/`billing-webhook` are
untouched (still their own v1-shaped functions, not routed through
`scena-api`). No email provider was selected or integrated.
