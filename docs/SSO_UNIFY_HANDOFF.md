# Unified SSO System — Session Handoff for Claude Code

## Context

MJCC SSO had two parallel code paths in KpnCompute:
1. **Legacy LunchVoice** — hardcoded `/lunchvoice-sso/*` endpoints, `lunchvoice_sso_handoffs` table, `X-Lunchvoice-Sso-Secret` header
2. **Generic Marquee** — config-driven `/sso/{app}/*` endpoints, `sso_handoffs` table, `X-Sso-Secret` header

The goal was to unify everything onto the generic path. Only the app slug, scope key, callback URL, and bridge secret differ per app.

## Issues Found and Fixed

### 1. Table name mismatch (Scena — runtime broken)
- Migration `0002_marquee_manager_identity.sql` creates `public.mjcc_identities`
- Edge Function `mjcc-sso-exchange/index.ts` queries `public.external_identities`
- **Fix:** Created migration `0003_external_identities.sql` (correct table) and `0004_drop_mjcc_identities.sql` (drops unused table)

### 2. `MARQUEE_SSO_URL` not configured (KpnCompute)
- `_generic_sso_callback()` returns 503 if the env var is empty
- **Fix:** Updated `.env.example` with correct values; needs to be set in Render dashboard

### 3. Two parallel SSO paths (KpnCompute)
- LunchVoice used hardcoded `lunchvoice-sso/*` endpoints, Marquee used generic `sso/{app}/*`
- **Fix:** Added `"lunchvoice"` to `SSO_APPS` allowlist, created migration `045` to expand `target_app` check constraint

### 4. Wrong SSO redirect domain (LunchVoice)
- `MJCC_STAFF_SSO_URL` pointed to `mjcc.kpnsolute.com` instead of `mjcc-managements.onrender.com`
- **Fix:** Updated `src/lib/supabase.ts:20`

### 5. `startSso` type-locked to `'marquee'` (KpnCompute frontend)
- **Fix:** Changed `api.startSso(app: 'marquee')` to `api.startSso(app: string)`, removed `startLunchvoiceSso()`

## Files Changed

### KpnCompute (`\\192.168.1.126\projects\KpnCompute`)
- `backend/routes/auth.py` — Added `"lunchvoice"` to `SSO_APPS` dict (line ~86)
- `backend/migrations/045_unify_sso_target_app.sql` — **NEW** — expands check constraint
- `supabase/migrations/20260718120000_unify_sso_target_app.sql` — **NEW** — mirror for Supabase CLI
- `frontend/src/lib/api.ts` — Removed `startLunchvoiceSso()`, generalized `startSso(app: string)`
- `frontend/src/App.tsx` — Maps `lioncafe` → `lunchvoice` slug, uses single `api.startSso()`
- `.env.example` — Added `LUNCHVOICE_SSO_SECRET` + `LUNCHVOICE_SSO_URL`
- `backend/tests/test_generic_sso.py` — Added `lioncafe` to FakeDb, added 2 lunchvoice tests

### LunchVoice (`\\192.168.1.126\projects\Lunchvoice`)
- `supabase/functions/staff-sso/index.ts` — Switched to `/api/auth/sso/lunchvoice/exchange` + `X-Sso-Secret`
- `supabase/functions/_shared/staffAccess.ts` — `tenant_slug` → `target_app` in type, `provisionLunchvoiceStaff()` now takes `orgSlug` param
- `src/lib/supabase.ts` — Fixed SSO URL domain

### Scena (`\\192.168.1.126\projects\Scena`)
- `supabase/migrations/0003_external_identities.sql` — **NEW** — creates correct identity table
- `supabase/migrations/0004_drop_mjcc_identities.sql` — **NEW** — drops unused table
- `.env.example` — Cleaned up, clarified SSO env vars

## Verification

- KpnCompute: `pytest backend/tests/test_generic_sso.py` — 12/12 pass (including 2 new lunchvoice tests)
- KpnCompute: `pytest backend/tests/test_lunchvoice_sso.py` — 3/3 pass (legacy tests still work)
- KpnCompute frontend: `tsc -b --noEmit` — clean
- LunchVoice: `tsc -b --noEmit` — clean
- Scena: `tsc -b` — clean

## Remaining Manual Steps

1. **KpnCompute Render** — Set `MARQUEE_SSO_URL` and `LUNCHVOICE_SSO_URL` env vars
2. **Scena Supabase MCP** — Apply migrations `0003` and `0004`
3. **Scena Edge Function secrets** — Set `MJCC_SSO_EXCHANGE_URL` and `MJCC_SSO_SECRET`
4. **KpnCompute production DB** — Run migration `045`

## Unified Flow (Post-Fix)

```
App → KpnCompute/?launch={app_slug}
  → KpnCompute authenticates user
  → POST /api/auth/sso/{app}/start (generic)
  → Redirect to {callback_url}#code={one_time_code}
  → App Edge Function POST /api/auth/sso/{app}/exchange (generic)
  → KpnCompute returns identity with target_app
  → App provisions user, creates session
```

## To Add a New App

1. Add entry to `SSO_APPS` in `auth.py`
2. Add `permission_scopes` + `role_permissions` rows
3. Set callback env var on KpnCompute
4. Build app's Edge Function calling `/sso/{app}/exchange` with `X-Sso-Secret`
