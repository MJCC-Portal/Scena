# Marquee build plan

Status: governing implementation plan

This plan is shared by Codex and Claude Code. It is the default sequence and
operating contract for Marquee. A later user decision can change it, but no
agent should silently skip a gate, invent a new auth model, or broaden scope
without recording the change here or in the project changelog.

## 1. Product boundary

Marquee is one website with two protected surfaces:

1. **Manager portal** — MJCC-authenticated managers create scenes, start and
   stop display sessions, rotate kiosk codes, and monitor active displays.
2. **Kiosk display** — a display enters a temporary access code and receives
   only the short-lived credential needed to render the assigned active scene.

Kiosk access is not manager authentication. A kiosk must never receive a
manager session, organization membership, service key, or reusable tenant
credential.

The first organization is `mjcc`. The first identity authority is KpnCompute
MJCC. Marquee does not create independent manager passwords and never links
accounts by email.

## 2. Current baseline

Already established:

- Supabase project: `zglbgqeccebqnijcqfkb`.
- Core tenancy/session schema and RLS are applied.
- The `mjcc` organization exists.
- Immutable MJCC identity mappings exist for manager provisioning.
- The MJCC SSO API is live in KpnCompute.
- The Marquee SSO Edge Function is deployed.
- The Marquee sign-in screen and MJCC launch flow exist.
- Agy is the primary project CLI AI; Claude Code is the implementation and
  review partner; Codex supervises.

Known activation gate:

- Scena still needs a production website URL before `MARQUEE_SSO_URL` can be
  set and the real browser redirect can be tested end to end.

## 3. Governing engineering strategy

Build in vertical slices. Each slice includes the database contract, server
behavior, frontend behavior, and an end-to-end test. Do not build a large
mock-only frontend or a backend of unused endpoints.

The sequence for every feature is:

1. Define the user-visible behavior and state transitions.
2. Confirm or migrate the database shape and RLS.
3. Define the API request/response and error contract.
4. Implement the server path.
5. Implement the frontend path against the real contract.
6. Test happy path, authorization failure, expiry/revocation, and reload.
7. Verify production health without leaving test data behind.

## 4. Phase 0 — foundation and environment

### Deliverables

- Production hosting decision and URL for Scena.
- `MARQUEE_SSO_URL` configured in KpnCompute.
- Scena environment variables configured only in hosting/function secrets.
- A single documented local development command.
- Error handling, logging, and health-check conventions.
- A changelog entry for each deployed milestone.

### Gates

- No secret appears in Git, browser bundles, screenshots, or logs.
- `npm.cmd run build` and `npx.cmd tsc -b` pass from a mapped drive.
- Supabase MCP verifies tables, RLS, policies, and zero unintended rows.
- KpnCompute OpenAPI contains both Marquee SSO endpoints.
- The SSO callback works once with a real authorized MJCC account.

## 5. Phase 1 — manager shell and organization context

### Backend/data

- Add a server-side `current organization` read path.
- Add manager profile and membership reads keyed by `auth.uid()`.
- Add a reusable authorization helper for manager roles:
  `owner`, `admin`, `operator`; `viewer` is read-only.
- Confirm every manager mutation requires the organization membership check.

### Frontend

- Replace the temporary post-login screen with the manager shell.
- Add loading, session-expired, signed-out, and unauthorized states.
- Show the active organization (`MJCC`) and current manager role.
- Add navigation placeholders only for features that have an approved phase.

### Acceptance

- An MJCC manager can sign in, reload, sign out, and return through SSO.
- A user without a Marquee grant cannot obtain a Marquee session.
- A viewer cannot see mutation controls.

## 6. Phase 2 — scene management

### Backend/data

- CRUD for `scenes` scoped by `org_id`.
- Validate `scene_type` and JSON configuration server-side.
- Add updated timestamps and actor attribution.
- Keep scene configuration versionable and explicit; do not store arbitrary
  executable code or client-controlled permissions.

### Frontend

- Scene list with active/inactive state.
- Create/edit scene form with type-specific validation.
- Draft changes, save, cancel, delete, and clear error feedback.
- Start with one simple `menu` or `layout` scene type.

### Acceptance

- Managers can create and edit a scene only inside `mjcc`.
- Invalid configuration is rejected by the API and represented in the UI.
- RLS and API tests prove cross-organization reads/writes are blocked.

## 7. Phase 3 — session control

### Backend/data

- Implement session lifecycle:
  `draft → active → stopped` and expiry handling.
- Enforce one active session per organization.
- Add start, stop, refresh, and current-session reads.
- Only managers may start/stop sessions.
- Starting a session must select a valid scene in the same organization.
- Revoke or invalidate old display credentials when a session stops or is
  replaced.

### Frontend

- Session dashboard showing current scene, status, started time, and expiry.
- Start-session flow with scene selection and confirmation.
- Stop-session flow with confirmation and clear success/failure states.
- Current session survives reload and recovers after transient network loss.

### Acceptance

- Two managers cannot create two active sessions for `mjcc`.
- A stopped session no longer renders on a kiosk.
- A session started for one organization cannot reference another
  organization’s scene.

## 8. Phase 4 — kiosk access-code flow

### Backend/data

- Server-only code generation and hashing.
- Short expiry, attempt limits, lockout/backoff, and cleanup.
- Constant-time comparison where applicable.
- Never expose `code_hash`, connection token hashes, or service credentials.
- Issue a short-lived display credential containing only the session identity.
- Re-check session status on display reads and connection refresh.

### Frontend

- Public kiosk entry screen with accessible code input.
- Clear invalid, expired, locked, stopped, and network-error states.
- No manager navigation or organization selector on the kiosk surface.
- Full-screen display mode with reconnect behavior.

### Acceptance

- A valid code starts the assigned display.
- An expired, replayed, or locked code fails.
- A kiosk cannot query arbitrary scenes or sessions.
- Refreshing a kiosk does not create a manager session.

## 9. Phase 5 — live display synchronization

### Backend/data

- Use Realtime or a controlled polling fallback only after measuring the
  required update frequency.
- Define event types for scene changes, session stop, and credential expiry.
- Ensure event payloads contain no sensitive code or identity material.

### Frontend

- Apply scene changes without a full-page reload.
- Show a safe offline/reconnecting state.
- Return to code entry when the display credential is revoked or expires.
- Keep the display rendering deterministic and bounded.

### Acceptance

- A manager scene change reaches an active kiosk.
- Stopping a session removes the display content promptly.
- Reconnects do not duplicate subscriptions or leak stale sessions.

## 10. Phase 6 — operational hardening

- Rate-limit SSO exchange, kiosk code attempts, and session mutations.
- Add audit events for sign-in, provisioning, session start/stop, code issue,
  code failure, and revocation.
- Add admin-safe revocation and account deactivation behavior.
- Review CORS, CSP, cookie/session storage, cache headers, and referrer
  leakage from callback URLs.
- Run Supabase security and performance advisors after schema changes.
- Add backup/rollback notes for every production migration.

## 11. Phase 7 — feature expansion

Only after the core manager-to-kiosk loop is stable:

- menu scene editor;
- queue scene editor;
- slideshow/media scenes;
- reusable layouts and preview mode;
- display connection inventory;
- scheduling;
- analytics and operational history.

Each feature must reuse the session, scene, organization, and kiosk security
contracts. Feature-specific tables must not bypass the established RLS model.

## 12. Agent responsibilities

### Codex

- Owns the overall plan, scope, sequencing, risk decisions, and final review.
- Verifies live state and reports exact evidence.
- Does not claim deployment or test success without checking it.

### Claude Code

- Owns primary implementation of the application UI and connected API work.
- Implements a complete vertical slice after the contract is approved.
- Runs focused tests and records blockers instead of inventing substitutes.

### Agy

- Primary local CLI AI for bounded project work, investigation, refactors, and
  implementation assistance.
- Must follow `AGENTS.md`, `CLAUDE.md`, this plan, and the MCP boundary.

### OpenCode and MiMo

- May perform bounded mechanical work when delegated.
- Their changes require review and the same verification gates.

## 13. Non-negotiable security rules

- MJCC user ID, not email, is the external identity key.
- Authorization comes from database membership and server-verified claims, not
  editable user metadata.
- Service-role keys and SSO secrets are server-only.
- Kiosk credentials are short-lived and session-scoped.
- Every exposed table has intentional RLS.
- Every update policy has both `USING` and `WITH CHECK` where applicable.
- No production test may leave synthetic users, sessions, codes, or content.

## 14. Definition of done for every slice

A slice is complete only when:

- the behavior is implemented in backend and frontend;
- the API contract is documented or represented by typed code;
- RLS and authorization tests pass;
- happy path and failure path tests pass;
- the UI works after reload and session expiry;
- production verification is complete or the exact blocker is recorded;
- no secrets or temporary test data remain;
- the change is committed and pushed only when explicitly in scope.

## 15. Immediate next slice

The next implementation slice is **Phase 0 completion plus Phase 1 manager
shell**. After the production URL is assigned, wire the final SSO callback,
replace the temporary authenticated screen, add organization/role context,
and then begin scene management. Do not start queue, slideshow, scheduling,
or kiosk polish before the session-control contract is working.
