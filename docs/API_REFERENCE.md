# API reference

Two layers. **Edge Functions** (below, full detail) handle every privileged,
multi-step, or non-Supabase-JWT-authenticated operation. **Domain modules**
(`src/domain/*.ts`) handle ordinary CRUD directly against RLS-protected
tables via the Supabase client — authorization for those is the database's
RLS policies, identical no matter which caller invokes them (see
`SYSTEM_ARCHITECTURE.md`).

`docs/api-inventory.json` is the exhaustive, machine-readable enumeration of
every operation (both layers) with its table/test/invalidation metadata,
kept in sync with this document. This file is the narrative companion.
`docs/openapi.json` covers the Edge Function transport (the part that maps
cleanly onto HTTP/OpenAPI); domain-module calls go through the Supabase
client library, not raw HTTP routes, so they aren't represented there.

All Edge Functions return `{ error: { code, message, details? } }` on
failure (`supabase/functions/_shared/errors.ts`) — the full stable error-code
list is in `ENGINE.md`.

---

## MJCC SSO exchange

- **Name / route**: `mjcc-sso-exchange`
- **Method**: `POST`
- **Purpose**: exchange a KpnCompute one-time handoff code for a Scena manager session.
- **Auth type**: none (public — the code itself is the credential).
- **Required role**: none.
- **Validator**: inline (`code` string, 32–200 chars).
- **Request fields**: `{ code: string }`
- **Response shape**: `{ access_token, refresh_token, expires_in, user: { id, mjcc_user_id, org_id, role, display_name } }`
- **Error codes**: `invalid_request`, `invalid_or_expired_handoff`, `invalid_handoff`, `organization_not_configured`, `organization_suspended`, `role_not_allowed`, `internal_error`
- **Side effects**: provisions/resolves `auth.users`, upserts `external_identities` and `organization_members`.
- **Tables accessed**: `organizations`, `external_identities`, `organization_members`, `auth.users`.
- **Related service**: `src/auth/sso.ts#exchangeMjccCode`
- **Example request**: `{ "code": "a1b2c3...64charhandoffcode" }`
- **Example response**: `{ "access_token": "eyJ...", "refresh_token": "...", "expires_in": 3600, "user": { "id": "640a88d6-...", "mjcc_user_id": "d3d7cf98-...", "org_id": "6ed538e7-...", "role": "owner", "display_name": "Jane" } }`
- **Test coverage**: none automated (requires a live KpnCompute handoff — not mockable without KpnCompute fixtures outside this repo's scope).

## Manager context (direct RLS read, not an Edge Function)

- **Name**: `loadManagerContext`
- **Route/function**: `src/auth/organization-context.ts#loadManagerContext`
- **Purpose**: resolve the signed-in manager's organization + role after sign-in.
- **Auth type**: Supabase session (manager JWT).
- **Required role**: any (the result *is* the role).
- **Request fields**: none (reads the current session).
- **Response shape**: `{ userId, organization: { id, name, slug, status }, role }`
- **Error codes**: `UNAUTHENTICATED`, `MEMBERSHIP_REQUIRED`, `ORGANIZATION_SUSPENDED`
- **Tables accessed**: `organization_members` (joined to `organizations`).
- **Test coverage**: none automated; the suspended-org branch shares logic already exercised by `mjcc-sso-exchange`'s live-transaction checks.

## Organizations & memberships

| Op | Route/function | Auth | Role | Tables | Errors |
|---|---|---|---|---|---|
| List members | `src/domain/organizations.ts#listMembers` | RLS | member | `organization_members` | mapped Postgres errors |
| Add/promote member | `#upsertMember` | RLS | owner/admin (`organization_members_manage_admin`) | `organization_members` | `VALIDATION_FAILED`, mapped |
| Remove member | `#removeMember` | RLS | owner/admin | `organization_members` | mapped |
| Get entitlement | `#getEntitlement` | RLS | member | `organization_entitlements` | `RESOURCE_NOT_FOUND` |
| Session screen capacity | `#getSessionScreenCapacity` | RLS | member | `organization_entitlements`, `display_session_screens` | mapped |

Membership writes are enforced **owner+admin**, not owner-only, by the live
RLS policy `organization_members_manage_admin` — a documented deviation from
an earlier draft assumption; see `DATABASE_SCHEMA.md` §4.

## Locations, menus, sections, items

RLS-protected CRUD in `src/domain/locations.ts` and `src/domain/menus.ts` —
full function/table/invalidation list in `docs/api-inventory.json`.
Locations have no delete path (`setLocationActive` toggles `status` instead,
preserving history for menus/scenes/sessions that reference the location).
`getRenderableMenu` returns the complete visible-sections → visible-items
tree a scene needs in one call.

## Presentation assets

- **Upload — create**: `presentation-upload` (`action:"create"`), manager JWT, role ≥ operator. Request: `{ action:"create", filename }`. Response: `{ asset_id, upload_url, upload_method, source_key }`. The browser uploads bytes directly to `upload_url` (the LXC service), not through Scena.
- **Upload — complete**: `presentation-upload` (`action:"complete"`). Request: `{ action:"complete", asset_id }`. Response: `{ asset_id, status:"uploaded" }` after Scena confirms with the LXC service that the object landed.
- **Callback**: `presentation-callback`, shared-secret authenticated (`X-Scena-Callback-Secret`), not a manager JWT — the LXC service is a backend peer. Request: `{ presentation_asset_id, outcome:"complete"|"fail", lxc_manifest_key?, slide_count?, error_message? }`. Response: `{ asset_id, status }` (idempotent — returns `{..., idempotent:true}` on an already-terminal asset). This is the *only* path that can set `presentation_assets.status` to `ready` or `failed`.
- **Tables**: `presentation_assets`.
- **Test coverage**: `deno check` only for both functions; no mocked-LXC integration test exists yet (documented gap — see `docs/api-inventory.json`).

## Scenes, layouts, tiles

RLS-protected CRUD in `src/domain/scenes.ts` and `src/domain/layouts.ts`.
`addTile`/`updateTile` validate percentage geometry client-side
(`validateTileGeometry`) before the database's own `display_layout_tiles_check`
constraints run. `resolveSceneContent` (browser) and its Deno twin inside
`display-gateway` are what actually turn a scene reference into rendered
content (menu payload or presentation manifest pointer) — see `ENGINE.md`.

## Screens, pairing, credentials

- **Register**: `screen-register`, no auth (kiosk has none yet). Request: `{}`. Response: `{ screen_id, device_token, code, expires_in }` — `device_token` returned exactly once.
- **Claim**: `screen-claim`, manager JWT, role ≥ operator. Request: `{ code, name, location_id }`. Response: `{ screen: {...} }`. Errors: `PAIRING_CODE_INVALID`, `PAIRING_CODE_LOCKED`, `PAIRING_CODE_CONSUMED`, `PAIRING_CODE_EXPIRED`, `CROSS_ORG_ACCESS`.
- **Credential rotate**: `screen-credential-rotate`, manager JWT, role ≥ operator. Request: `{ screen_id }`. Response: `{ screen_id, device_token }`.
- **Heartbeat**: implicit — every `display-gateway` poll stamps `screens.last_seen_at`; there is no separate heartbeat endpoint.
- **Manager CRUD** (rename, reassign location, revoke): `src/domain/screens.ts`, RLS-protected. `device_token_hash` is never selected by any client-facing query.
- **Tables**: `screens`, `screen_pairing_codes`.
- **Test coverage**: full register→claim→ready→heartbeat→rotate→old-credential-rejected→code-reuse-blocked lifecycle verified against the live database in a rolled-back transaction.

## Sessions, session-screen assignments, display modes

RLS-protected CRUD in `src/domain/sessions.ts` — `createDraftSession`,
`renameSession`, `deleteDraftSession`, `setDisplayMode`, `startSession`,
`stopSession`, `addScreenToSession`, `updateSessionScreen`,
`removeScreenFromSession`, `setPrimaryScreen`. The database enforces almost
all of the actual business rules here (entitlement limits, mode/layout
validity, single-live-session-per-screen) via triggers — see `ENGINE.md` and
`DATABASE_SCHEMA.md` §2 for the full trigger inventory; the service layer's
job is translating their raised errors into the stable contract
(`SESSION_NOT_DRAFT`, `SESSION_NOT_ACTIVE`, `SCREEN_LIMIT_REACHED`,
`LAYOUT_INVALID`, `SCREEN_ALREADY_ACTIVE`).

## Display-state gateway

- **Route/function**: `display-gateway`
- **Auth**: kiosk device token (never a Supabase session).
- **Request**: `{ device_token }`
- **Response**: `{status:"pending"}` | `{status:"standby", reason}` | full "showing" payload (`session`, `display_mode`, `viewport`, `rotation_degrees`, `layout` with resolved tiles/content, `content_version`, `server_time`, `org_id`).
- **Errors**: `DEVICE_CREDENTIAL_INVALID`, `SCREEN_REVOKED`.
- **Side effects**: stamps `screens.last_seen_at` on every call.
- **Tables**: `screens`, `display_session_screens`, `display_sessions`, `display_layouts`, `display_layout_tiles`, `scenes`, `menus`, `menu_sections`, `menu_items`, `presentation_assets`.
- **Test coverage**: `vitest:src/display/resolveDisplayState.test.ts` (9 tests, all four display modes + standby reasons + content-version stability) covers the pure resolution logic; `deno check` covers the DB-fetch wrapper.

## Realtime invalidation

Not a request/response operation — see `SYSTEM_ARCHITECTURE.md` § Realtime
Broadcast invalidation and `ENGINE.md`. Manager mutations and
`screen-claim`/`presentation-callback`/`automations-run` call
`broadcastOrgInvalidation(orgId)` after a successful write; the kiosk
subscribes via `src/lib/display.ts#subscribeToOrgInvalidation`. 6 automated
routing tests: `vitest:src/lib/display.invalidation.test.ts`.

## Automations

- **CRUD**: `src/domain/automations.ts` — `listAutomations`, `createAutomation` (validates action-type/target-field shape and schedule via `requireCronOrOnce`), `updateAutomation`, `disableAutomation`. RLS-protected, role ≥ operator for writes.
- **Execution**: `automations-run`, shared-secret authenticated (`X-Scena-Callback-Secret` == `SCENA_AUTOMATIONS_RUN_SECRET`), invoked by an external scheduler (`SCHEDULER.md`). Request: `{}`. Response: `{ processed, results: [{ id, outcome, error? }] }`.
- **Tables**: `display_automations`, plus `display_sessions`/`display_session_screens` for the actions themselves.
- **Test coverage**: exactly-once concurrent-claim behavior verified against the live database in a rolled-back transaction; `requireCronOrOnce` covered by `vitest:src/shared/validation.test.ts`; `deno check` on the function itself.

---

Full per-function table/invalidation/test detail for every domain CRUD
operation not given a dedicated example above lives in
`docs/api-inventory.json`.
