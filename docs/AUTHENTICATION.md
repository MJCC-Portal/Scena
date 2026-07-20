# Authentication

```
KpnCompute / MJCC
  -> short-lived SSO handoff code
  -> mjcc-sso-exchange (Edge Function)
  -> external_identities
  -> auth.users
  -> organization_members
  -> Supabase RLS
```

KpnCompute/MJCC is the upstream identity authority. Scena never creates an
independent manager password and never uses email as an identity key — the
immutable key is the MJCC user ID (`external_identities.external_user_id`).

## Browser flow

1. The Scena login screen presents **Continue with MJCC**
   (`src/auth/sso.ts#startMjccSignIn`).
2. The browser opens the KpnCompute MJCC sign-in surface
   (`VITE_MJCC_PORTAL_URL`).
3. KpnCompute authenticates the user and creates a single-use, ~60-second
   code, redirecting back with it in the URL fragment.
4. `src/auth/sso.ts#consumeSsoHandoffCode` reads and immediately strips the
   fragment from browser history.
5. `exchangeMjccCode` POSTs the code to `mjcc-sso-exchange`
   (`supabase/functions/mjcc-sso-exchange/index.ts`), which sends it to
   KpnCompute's exchange endpoint over a server-to-server secret
   (`MJCC_SSO_EXCHANGE_URL` + `MJCC_SSO_SECRET`) and receives the MJCC user ID
   and role back.

The browser never receives the KpnCompute exchange secret, the Supabase
service-role key, the raw handoff record, or any access-code hash.

## Identity provisioning / existing-user resolution

`mjcc-sso-exchange` looks up `external_identities` by
`(provider='mjcc', external_user_id)`:

- **Existing identity found** → resolves the linked `auth.users` row by ID,
  refreshes `role_snapshot`/`last_login_at` (an `UPDATE`, not a re-link — see
  immutability below), and mints a session for that same user.
- **No identity found** → provisions a new `auth.users` row
  (`email = mjcc-{external_user_id}@sso.invalid`, `email_confirm: true`,
  `app_metadata` carries the MJCC user ID for audit/backfill), inserts the
  `external_identities` row, and upserts `organization_members`.

Session minting uses `admin.auth.admin.generateLink` (magiclink) +
`verifyOtp` server-side — the manager never sees or handles that link
directly; the Edge Function exchanges it internally and returns a normal
`access_token`/`refresh_token` pair.

## Immutable external identity mapping

`external_identities` has a `unique(provider, external_user_id)` constraint
and a `BEFORE UPDATE` trigger
(`forbid_external_identity_relink`, `supabase/migrations/0008_manager_sso_identity_bridge.sql`)
that raises if `provider`, `external_user_id`, `user_id`, or `org_id` change
on an existing row. Relinking an MJCC identity to a different local user
requires an explicit delete + insert — a deliberate, auditable action, not a
silent update. `role_snapshot` and `last_login_at` remain mutable (they
mirror MJCC's live profile on every sign-in).

## Membership provisioning / role mapping

`mjcc-sso-exchange` maps KpnCompute's role claim to Scena's role enum before
any database write — the browser never supplies a role:

| KpnCompute role | Scena role |
|---|---|
| `sudo` | `owner` |
| `admin` | `admin` |
| `manager` | `operator` |
| anything else | rejected (`role_not_allowed`, 403) |

`organization_members` is upserted (`onConflict: "org_id,user_id"`) on every
sign-in, so a role change on the KpnCompute side takes effect on the
manager's next login. Between logins, the database row is the sole source of
truth for authorization — Scena does not re-check KpnCompute per request.

## Suspended organizations

`mjcc-sso-exchange` checks `organizations.status` before minting a session
and fails closed (`organization_suspended`, 403) if the org isn't `active`.
`src/auth/organization-context.ts#loadManagerContext` performs the same check
client-side for UX (to render the right message), but the Edge Function's
check is the one that matters — the client-side check cannot be bypassed to
regain server access, since RLS itself doesn't gate on org status; the
Edge Function does.

## Expired and reused handoffs

The one-time code is validated by KpnCompute itself (server-to-server,
`X-Sso-Secret` header) — an expired or already-consumed code causes
KpnCompute's exchange endpoint to reject the request, and
`mjcc-sso-exchange` surfaces that as `invalid_or_expired_handoff` (401)
without ever touching `external_identities` or `organization_members`.

## Manager logout

`src/auth/sso.ts#signOut` calls `supabase.auth.signOut()`, invalidating the
local session. No server-side revocation call to KpnCompute is part of this
flow — logging out ends the local Supabase session only.

## Why kiosk devices never receive manager JWTs

A kiosk is a public, unattended, physically-accessible device. A manager JWT
carries organization-wide read/write authorization gated only by RLS role
checks — if a kiosk held one, a compromised or stolen kiosk would grant
full manager access to whoever powers it on. Kiosks instead authenticate with
`screens.device_token_hash`, a credential scoped to exactly one screen row,
checked entirely inside `display-gateway` (service-role), never through RLS,
and revocable independently of any manager's session. See
`DISPLAY_SYSTEM.md`.

## Why device credentials are separate from manager auth

Device credentials and manager sessions are different systems end to end:
different tables (`screens.device_token_hash` vs. `auth.users`/Supabase
sessions), different issuance paths (`screen-register`/`screen-claim` vs.
`mjcc-sso-exchange`), different lifetimes (a device token persists until
rotated or revoked; a manager session expires/refreshes on Supabase's normal
schedule), and different authorization models (a device token identifies one
screen with no role; a manager session carries an organization role checked
by RLS on every table). This separation is what lets a screen be revoked
without touching any manager's access, and vice versa.

## Environment variables (names only)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — browser Supabase client.
- `VITE_MJCC_PORTAL_URL` — KpnCompute sign-in surface the browser redirects to.
- `MJCC_SSO_EXCHANGE_URL`, `MJCC_SSO_SECRET` — server-to-server KpnCompute exchange (Edge Function secret store only).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — used by `mjcc-sso-exchange` to provision users and mint sessions.
- `ORG_SLUG` — slug of the single organization managers are provisioned into (defaults to `mjcc`).

No secret values appear in this document or anywhere else in the repository
— see `DEPLOYMENT.md` for where each of these is actually configured.
