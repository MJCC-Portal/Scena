# UI integration guide

This is the stable boundary Claude Design (or any future manager UI work)
builds against. Nothing in this document describes UI that has been built —
`src/App.tsx` today is a minimal functional test harness (raw forms, JSON
dumps), explicitly not a designed interface. See `docs/README.md` for the
overall v1.0.0 scope.

## The required call chain

```
Visual component
  -> Feature hook or controller
  -> Typed API client
  -> Existing backend operation
```

Concretely: a component calls a hook/controller in `src/ui/features/*`
(not yet built), which calls a function in `src/domain/*.ts` or
`src/services/supabase/client.ts#callEdgeFunction`, which is the existing,
tested, RLS/error-contract-backed operation documented in
`API_REFERENCE.md`. No layer may be skipped.

## What the future UI may freely change

Page structure, navigation, component composition, visual hierarchy,
styling, motion, responsive behavior, accessibility presentation,
layout-editor interaction design, dashboard presentation — anything that is
purely how the existing operations are presented and sequenced for a human.

## What the future UI must not do

- Issue service-role requests directly, or store a service-role secret anywhere client-reachable.
- Issue screen credentials itself — that's `screen-register`/`screen-claim`/`screen-credential-rotate` only.
- Reimplement plan enforcement, session lifecycle rules, or display-mode rules — these are database-enforced (`ENGINE.md`); a UI-side copy would drift and, worse, would suggest the UI is the authority when it never can be.
- Trust a hidden/disabled button as an authorization boundary — the database and Edge Functions are the boundary; UI-only gating is a UX nicety, not security.
- Write directly to a protected table (`screens.device_token_hash`, `screen_pairing_codes`, anything a domain module or Edge Function already wraps) when an existing application operation covers it.
- Put database mutations directly inside visual components — always through a feature hook/controller calling a domain module or Edge Function, never `supabase.from(...)` inline in a `.tsx` file's render logic.
- Modify the database for presentation convenience (no new columns, no denormalization, no schema changes to make a component simpler — see the safety boundary in `DEPLOYMENT.md`).
- Treat a Realtime Broadcast hint as authoritative state — always re-fetch via the documented operation; the hint carries no trusted data (`ENGINE.md` § Realtime invalidation).
- Mix manager and kiosk authentication in one client context — `src/services/supabase/client.ts` (manager, Supabase session) and `src/lib/display.ts` (kiosk, opaque device token) are deliberately separate modules with no shared session state.
- Bypass `src/shared/validation.ts` — always validate before calling a service function, even though the service function re-validates too (defense in depth, not redundant).
- Invent new API behavior without updating `API_REFERENCE.md` and `docs/api-inventory.json` first — the contract is documented before it's built, not reverse-engineered from UI needs.

## Recommended UI module layout

```
src/ui/
├── app/            — providers, top-level layout shell, routing setup
├── routes/         — route definitions (adapt to whatever router is chosen)
├── features/
│   ├── dashboard/
│   ├── menus/
│   ├── scenes/
│   ├── layouts/
│   ├── screens/
│   ├── sessions/
│   └── automations/
├── components/     — presentational, no direct backend calls
├── hooks/          — feature-agnostic hooks (e.g. useManagerContext)
├── api/            — thin re-exports/adapters over src/domain + src/auth, if a UI-specific shape is genuinely needed
└── state/          — client-side UI state only (never a cache of authorization decisions)
```

None of this is built in v1.0.0. `src/domain/*.ts`, `src/auth/*.ts`, and
`src/services/supabase/*.ts` already exist and are what `src/ui/features/*`
would call into.

## What already exists as a stable foundation (Phase 8 boundary check)

- **Central typed API client** — `src/services/supabase/client.ts` (manager, `requireSupabase`/`callEdgeFunction`) and `src/lib/display.ts` (kiosk) are separate, already isolated.
- **Generated database types** — `src/shared/database.types.ts`, regenerate via the Supabase MCP `generate_typescript_types` tool, never hand-edit.
- **Runtime validators** — `src/shared/validation.ts`.
- **Stable API error contract** — `src/shared/errors.ts`.
- **Feature-level service functions** — `src/domain/*.ts`, one file per domain area, already the thing a future `src/ui/features/*/hooks.ts` would call.
- **Manager-context loader** — `src/auth/organization-context.ts#loadManagerContext`.
- **Permission helpers** — `canManage`/`isAdmin`/`isOwner` in the same file.
- **Manager client separated from kiosk client** — confirmed above; no shared module holds both a Supabase session and a device token.
- **Device client isolated from manager authentication** — `src/lib/display.ts` never imports anything from `src/auth/*`.
- **Mockable service boundaries** — every domain function takes plain arguments and returns plain data; `src/lib/display.invalidation.test.ts` demonstrates mocking `src/services/supabase/client.ts`'s exported `supabase` object successfully.
- **No protected business logic inside visual components** — `src/App.tsx`'s harness panels call domain functions directly; they contain no authorization or business-rule logic themselves (that's the database's job — see `ENGINE.md`).
- **No scattered direct mutations from placeholder frontend code** — the only `supabase.from(...)` calls in the entire `src/` tree are inside `src/domain/*.ts`; `src/App.tsx` never calls the Supabase client directly.

No refactor was needed to establish these boundaries this release — they
were already the shape of the backend rebuild that preceded it.
