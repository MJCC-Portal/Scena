# Deployment

## Required environment variables (names only — never values)

**Existing:**
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MJCC_PORTAL_URL`,
`MJCC_SSO_EXCHANGE_URL`, `MJCC_SSO_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ORG_SLUG`.

**New, required by this release's Edge Functions:**
`LXC_PRESENTATIONS_URL`, `LXC_PRESENTATIONS_API_KEY`,
`SCENA_LXC_CALLBACK_SECRET`, `SCENA_AUTOMATIONS_RUN_SECRET`.

Set Edge Function secrets via the Supabase CLI, never committed to the repo
or `.env.example`:
```
supabase secrets set MJCC_SSO_SECRET=<value>
supabase secrets set LXC_PRESENTATIONS_API_KEY=<value>
supabase secrets set SCENA_LXC_CALLBACK_SECRET=<value>
supabase secrets set SCENA_AUTOMATIONS_RUN_SECRET=<value>
```

## Edge Function deployment order

No hard ordering dependency between functions — each is independently
deployable. Recommended order groups by JWT-verification mode so both
`--no-verify-jwt` calls happen together:

**No manager/user JWT ever reaches these — deploy with `--no-verify-jwt`:**
```
supabase functions deploy mjcc-sso-exchange --no-verify-jwt
supabase functions deploy screen-register --no-verify-jwt
supabase functions deploy display-gateway --no-verify-jwt
supabase functions deploy presentation-callback --no-verify-jwt
supabase functions deploy automations-run --no-verify-jwt
```

**Manager-authenticated — default JWT verification:**
```
supabase functions deploy screen-claim
supabase functions deploy screen-credential-rotate
supabase functions deploy presentation-upload
```

**Status at time of this release: none of these 8 functions have been
deployed with this session's code.** `mjcc-sso-exchange` and `display-gateway`
have older, previously-deployed versions live (pre-dating the pairing/
credential/invalidation rework); the other 6 have never been deployed.
Deploying is out of scope for this release — see `SYSTEM_ARCHITECTURE.md` §
Deployment boundaries.

## Scheduler setup

Full configuration in `SCHEDULER.md`: external caller (not `pg_cron`),
60-second interval, `X-Scena-Callback-Secret` header set to
`SCENA_AUTOMATIONS_RUN_SECRET`, a ready-to-use GitHub Actions workflow
included there.

## LXC integration settings

`LXC_PRESENTATIONS_URL` (base URL of the private presentation-processing
service) and `LXC_PRESENTATIONS_API_KEY` (bearer credential Scena uses to
call it) configure `presentation-upload`'s outbound calls;
`SCENA_LXC_CALLBACK_SECRET` authenticates the LXC service's inbound calls to
`presentation-callback`. No IP address, hostname, or credential value is
hardcoded anywhere in the codebase — all three are read by name via
`requiredEnv()`.

## Smoke-test sequence (after deploying)

1. `curl -X POST "$SUPABASE_URL/functions/v1/screen-register" -d '{}'` → expect `200` with `{screen_id, device_token, code, expires_in}`.
2. Sign in as a manager (MJCC flow), call `screen-claim` with that code → expect `200` with the claimed screen.
3. `curl -X POST "$SUPABASE_URL/functions/v1/display-gateway" -H 'content-type: application/json' -d "{\"device_token\":\"<token from step 1>\"}"` → expect `200` with `{status:"standby",...}` (no active session yet).
4. `curl -X POST "$SUPABASE_URL/functions/v1/automations-run" -H "x-scena-callback-secret: $SCENA_AUTOMATIONS_RUN_SECRET" -d '{}'` → expect `200` with `{processed, results}`.
5. Missing/wrong `x-scena-callback-secret` on `automations-run` or `presentation-callback` → expect `401 UNAUTHENTICATED`.

## Rollback sequence

Edge Functions are versioned independently by Supabase — `supabase
functions deploy <name>` from a prior commit's working tree redeploys that
version; there is no destructive step to reverse (no schema or data changes
ship with Edge Function deploys). If a specific function misbehaves,
redeploy only that function rather than the whole set. No database rollback
is applicable — this release makes no schema changes (see § Database
changes below).

## Health checks

See `SCHEDULER.md` § Health-check procedure for `automations-run`
specifically. General: any Edge Function returning a non-2xx with a
malformed body (not the `{error:{code,message}}` shape) indicates a
deployment or config problem, not an application error — check
`supabase functions logs <name>` for a missing-env-var exception first
(`requiredEnv` throws a descriptive message naming the missing variable).

## Proposed migrations awaiting approval

Full exact-SQL/rollback/risk/recommendation review in `DATABASE_SCHEMA.md`
§5. Neither is applied; neither is required for this release's application
code to function:
- **§5a** (security-priority, recommended before production): revoke stray
  `anon`/`authenticated` grants on `screens`/`screen_pairing_codes`.
- **§5b** (optional): add failure-tracking columns to `display_automations`.

## Release deployment status

| Layer | Status |
|---|---|
| Application code (this repo, `main`) | Committed, not deployed |
| Edge Functions (all 8) | Source ready; not deployed with this release's code |
| Database schema | Unchanged — live schema remains authoritative, no migration applied this release |
| Scheduler | Configuration documented, not provisioned |
| Manager UI | Not started (by design — this is the pre-UI foundation release) |

## Database changes requiring explicit approval

None were made or are required by this release. The two items in §
"Proposed migrations awaiting approval" require separate, explicit approval
before being applied — this release does not authorize or imply either.
