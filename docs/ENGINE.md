# Behavioral engine

What actually decides "is this allowed" and "what does this screen show" —
split between application code (fast feedback, shape validation) and the
database (the real authority for business rules). This document is the
map between the two.

## Domain modules

`src/domain/*.ts` (`organizations`, `locations`, `menus`, `scenes`,
`layouts`, `screens`, `sessions`, `automations`) are thin: validate shape,
call the Supabase client, translate errors. They do **not** duplicate
authorization or business-rule logic the database already enforces — see
§ Database-enforced rules below for why that would be actively wrong (a
client-side-only check can drift from the database's actual behavior).

## Validation

`src/shared/validation.ts` — dependency-free runtime checks
(`requireUuid`, `requireString`, `requireSlug`, `requireRole`,
`requireDisplayMode`, `requirePrice`, `requireSortOrder`, `requirePercent`,
`requireRotation`, `requirePairingCode`, `requireHex64`, `requireFilename`,
`requireCronOrOnce`, `parsePagination`). Every external input (form submit,
Edge Function body) passes through here before touching the database —
TypeScript types alone don't validate anything at a network boundary.

## Shared error handling / Postgres error mapping

`src/shared/errors.ts#ApiError` is the stable contract:
```
UNAUTHENTICATED, FORBIDDEN, MEMBERSHIP_REQUIRED, ORGANIZATION_SUSPENDED,
RESOURCE_NOT_FOUND, VALIDATION_FAILED, PAIRING_CODE_INVALID,
PAIRING_CODE_EXPIRED, PAIRING_CODE_CONSUMED, PAIRING_CODE_LOCKED,
SCREEN_DISABLED, SCREEN_REVOKED, DEVICE_CREDENTIAL_INVALID,
SCREEN_LIMIT_REACHED, SCREEN_ALREADY_ACTIVE, SESSION_NOT_DRAFT,
SESSION_NOT_ACTIVE, LAYOUT_INVALID, PRESENTATION_NOT_READY,
AUTOMATION_EXECUTION_FAILED, CROSS_ORG_ACCESS, INTERNAL_ERROR
```
`mapPostgresError` translates raised Postgres errors (constraint names,
trigger `RAISE EXCEPTION` messages) into these codes by pattern-matching —
e.g. a `screen_pairing_codes_code_hash_key` unique-violation becomes
`PAIRING_CODE_INVALID`; the message `"This plan allows at most N screen(s)
per session"` becomes `SCREEN_LIMIT_REACHED`. Three of these mappings were
verified against **real** trigger output in rolled-back transactions against
the live database, not just pattern-matched against assumed text. A bug in
this exact function (checking `err instanceof Error` instead of a generic
`.message` property, silently swallowing every real PostgREST error) was
found and fixed by running the test suite — see `CHANGELOG.md`.

## Organization / role authorization

`is_org_member(target_org_id)` and `has_org_role(target_org_id,
allowed_roles)` — both `SECURITY DEFINER` SQL functions reading
`organization_members` — are what every RLS policy on every content table
calls. Application code never re-implements this check; it relies on the
database rejecting the write/read outright.

## Entitlement enforcement

Enforced by `prepare_session_screen_assignment()` (trigger on
`display_session_screens`), which counts non-removed rows **within the same
session** against `organization_entitlements.max_screens_per_session` —
personal=1, plus=5, pro≥10 (whatever the row actually stores, not
hardcoded). `src/domain/organizations.ts#getSessionScreenCapacity` mirrors
this exact scoping (per-session, not per-org) for UI preview purposes; the
trigger is what actually blocks an over-limit insert.

## Screen lifecycle

`pairing` → `ready` → `revoked`, enforced by the `screens_check` constraint
(each status requires/forbids a matching set of `org_id`/`location_id`/
`claimed_at`/`revoked_at`). Revocation is one-way — no reverse transition
exists at either the database or application layer.

## Pairing lifecycle

`screen-register` creates a `screens` row (`status='pairing'`) with its
permanent device credential already set, plus a `screen_pairing_codes` row
(30-minute expiry, enforced by `screen_pairing_codes_check1`). `screen-claim`
looks up the code by its hash (unique index), checks `locked_until` →
`consumed_at` → `expires_at` in that order, then atomically consumes the
code and flips the screen to `ready`. Attempt/lockout tracking
(`attempt_count`/`locked_until`) is scoped to the pairing-code row found by
hash — see `DISPLAY_SYSTEM.md` for the reasoning on why that's the correct
scope given the code space.

## Device-token lifecycle

Issued once at registration (`screens.device_token_hash`), rotatable
(`screen-credential-rotate`, atomic — the unique-column update makes the old
token stop working the instant the new one is committed), revocable
(`screens.status='revoked'`, checked on every `display-gateway` call). Never
converted into or from a manager credential.

## Session lifecycle

`draft` → `active` → `stopped`, enforced by three triggers:
`validate_new_display_session()` (must be created as `draft`),
`validate_display_session_activation()` (activating needs ≥1 enabled screen,
`single` mode needs exactly one, `independent`/`single` need every enabled
screen to already have a layout), `handle_display_session_status()` (stopping
marks every non-removed session-screen row `removed`, preserving history).

## Display-mode rules

`independent`/`single` forbid `shared_layout_id`; `duplicate`/`extend`
require it (`display_sessions_check`). `single` mode requires exactly one
enabled screen. These are constraint- and trigger-enforced, not
service-layer logic — `src/domain/sessions.ts#setDisplayMode` only
pre-validates the same shape before the round-trip for a faster error.

## Layout / tile / scene / menu / presentation-manifest resolution

`resolveDisplayState` (`supabase/functions/_shared/displayState.ts`, mirrored
pure in `src/display/resolveDisplayState.ts`) picks the layout: the
session-screen's own `layout_id` for `independent`/`single`, the session's
`shared_layout_id` for `duplicate`/`extend`. For `extend`, the session-
screen's own viewport percentages crop into the shared canvas. Each visible
tile's `scene_id` is resolved to actual content by `resolveSceneContent`
(two copies — browser `src/domain/scenes.ts`, Deno `display-gateway`'s
`resolveSceneContent`): a `menu`-type scene resolves to
`getRenderableMenu`'s full visible-sections→visible-items tree; a
`powerpoint`-type scene resolves to `{ manifest_key, slide_count }` only
when the underlying `presentation_assets.status = 'ready'` — a not-yet-ready
or failed presentation resolves to `null` content (the tile renders empty
rather than broken).

## Realtime invalidation

See `SYSTEM_ARCHITECTURE.md` § Realtime Broadcast invalidation. Routing
logic (channel naming, hint-triggers-refetch, reconnect-triggers-refetch) is
unit-tested in `src/lib/display.invalidation.test.ts` with a mocked
Supabase channel — the real Realtime socket delivery itself is a platform
guarantee, not application logic to test here.

## Polling reconciliation

`src/Display.tsx` polls `display-gateway` every 4 seconds unconditionally —
the guaranteed backstop independent of broadcast delivery.

## Offline-state replacement

`src/lib/display.ts#pollState` caches the last successful "showing" payload;
on fetch failure it returns the cache with `fromCache: true` instead of
throwing. Replacement is always atomic (the whole state object swaps), never
a partial merge — consistent with `content_version` existing specifically so
the caller can detect a real change rather than diffing fields.

## Automation claiming, idempotency, retry

`automations-run` claims a due automation with a single conditional
`UPDATE ... SET next_run_at = null WHERE id = X AND is_enabled AND
next_run_at <= now()`. Verified against the live database (rolled-back
transaction): two concurrent identical claims on the same row resolve to
exactly one winner — the second returns zero rows, so overlapping scheduler
invocations can never double-execute the same automation. On success, cron
automations reschedule to their next occurrence; one-shot automations
disable (`is_enabled=false`). On failure, cron automations still reschedule
normally; one-shot automations get a fixed 5-minute retry backoff instead of
being left permanently stuck (`next_run_at=null` can never again satisfy
`<= now()` — a real bug found and fixed this pass, see `CHANGELOG.md`).
There is no failure-count column yet to circuit-break a permanently broken
one-shot automation — it retries every 5 minutes until fixed or disabled;
see `DATABASE_SCHEMA.md` §5b for the proposed (unapplied) fix.

## Database-enforced vs. application-enforced rules

| Enforced by the database (triggers/constraints — cannot be bypassed by any client) | Enforced by application code (fast feedback / shape only) |
|---|---|
| Entitlement screen-per-session limit | Percent/UUID/enum shape validation |
| Display-mode ↔ shared-layout requirement | Pairing-code format (6 digits) |
| Single-live-session-per-screen | Cron-expression 5-field parsing |
| Session draft→active→stopped lifecycle | Automation action-type/target-field shape |
| Tile geometry bounds (0–100%, non-overlapping edges) | — |
| Screen status ↔ org/location/claimed/revoked consistency | — |
| Scene content-type ↔ referenced-table consistency | — |
| External-identity mapping immutability | — |
| Organization/role membership (RLS) | — |

The right-hand column exists for UX speed (fail fast, in the browser, before
a round-trip) — it is never the actual security boundary. The left-hand
column is.
