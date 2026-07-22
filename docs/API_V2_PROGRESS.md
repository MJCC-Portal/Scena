# Scena API v2 Migration — Progress Ledger

Internal engineering log. Not a user-facing deliverable (see docs/API_V2.md and friends for that).

> **Historical notice:** Session 1 below (through "Phase 2 status: feature-complete...") is restored verbatim from the `v1.0.3` git blob (`git show d1e3573:docs/API_V2_PROGRESS.md`), after `v1.0.4` deleted this file without a replacement. It describes the repository and deployment state **as understood at that time** — commit `e8a8893` / `v1.0.2`. Three more commits (`v1.0.3`, `v1.0.4`, `v1.0.5`) landed afterward with no entry in this ledger. **Any runtime, schema, deployment, or capability claim in Session 1 that conflicts with Session 2 (or with any later session) is superseded — Session 1 is a snapshot, not a standing claim.** In particular, Session 1's "`mjcc-sso-exchange` ... returning HTTP 410 Gone" note (in its Phase 1 log) describes a *now-superseded deployment version* — see Session 2 for the current, re-verified status. Do not cite Session 1 alone for current live/deployed/runtime facts; check the most recent session and `docs/API_V2.md`'s document map first.

## Session 1 — 2026-07-21

### Current phase / step
Phase 0 (Repository and live-system discovery) — discovery complete, discrepancy matrix produced below. **Stopped before Phase 1** pending owner review (see Blockers).

### Tool availability (verified this session)
| Tool class | Available | Notes |
|---|---|---|
| Repository (Bash/Read/Grep/Glob) | Yes | Local working copy at `Z:\Scena`, clean, `main`, up to date with `origin/main`. |
| Supabase MCP (`mcp__supabase__*`) | Yes | Scoped via `.mcp.json` to `SUPABASE_PROJECT_REF=zglbgqeccebqnijcqfkb`. This is the authoritative connection. |
| Supabase MCP (`mcp__5ef6dab7...__*`) | Present but **not used** | Takes an explicit `project_id` arg (account-wide server, not project-scoped via `.mcp.json`). Avoided to prevent querying the wrong project by accident. If it's ever needed, pass `project_id=zglbgqeccebqnijcqfkb` explicitly and confirm the URL matches before trusting results. |
| Stripe | **Not available** | No Stripe MCP/tool is connected or listed as deferred in this session. All Stripe-sandbox claims in the task brief are currently **unverified by direct tool access** this session. |
| Documentation (WebFetch/WebSearch) | Available (deferred, loadable via ToolSearch) | Not yet used — no external API ambiguity hit yet. |

### Verified live facts (method: `mcp__supabase__*`, timestamp: this session, 2026-07-21)
- Project URL: `https://zglbgqeccebqnijcqfkb.supabase.co` — matches `README.md` and `.env.example`.
- **29 migrations applied live**, oldest `20260719013856_revoke_rls_auto_enable_execute` → newest `20260721155217_index_billing_plan_foreign_keys`. Full list captured in discrepancy matrix below. This matches (and extends) the `<important_migrations>` list in the task brief.
- **7 Edge Functions deployed, all ACTIVE**: `mjcc-sso-exchange` (v9), `presentation-upload` (v5), `display-gateway` (v5), `screen-claim` (v5), `billing-checkout` (v5), `billing-portal` (v5), `billing-webhook` (v6). This matches the brief's `<deployed_edge_functions>` claim exactly.
- **Row counts** (public schema, this session): `plans`=3, `billing_events`=1, everything else listed (`organizations`, `organization_members`, `profiles`, `checkout_sessions`, `workspace_subscriptions`, `billing_customers`, `billing_notification_outbox`, legacy content tables) = 0. Matches the brief's `<current_row_counts>` exactly.
- Security advisors (this session): 3 `INFO` RLS-enabled-no-policy findings (`billing_events`, `billing_notification_outbox`, `screen_pairing_codes`), 3 `WARN` findings for `SECURITY DEFINER` RPCs callable by `authenticated` (`accept_team_invitation`, `create_team_invitation`, `revoke_team_invitation`) — need explicit review in Phase 3, not yet triaged.

### Verified repository facts (method: direct file read/grep, this session)
- Repo remote: `https://github.com/MJCC-Portal/Scena.git`, branch `main`, clean working tree, HEAD `998dc4f` (tag `v1.0.1`), prior tag `v1.0.0` at `0b95408`. Matches brief.
- `package.json` `"version"` is `0.1.0` — **conflicts with git tags `v1.0.0`/`v1.0.1`**. Confirmed present, not yet resolved (see Blockers — this is explicitly called out as a genuine blocker in the task brief itself, not invented by me).
- Local repo has only **9 migration files** (`0001`…`0009`, plus one file in `_drafts/`) vs. **29 applied live**. The 20 newest live migrations (native auth, team invitations, paid-team provisioning, Stripe billing control plane, notification outbox — i.e. essentially the entire Teams/Billing subsystem) have **no corresponding source file in the repo**. They exist only in the live database.
- `supabase/functions/` contains source for `mjcc-sso-exchange`, `screen-register`, `screen-credential-rotate`, `presentation-upload`, `presentation-callback`, `display-gateway`, `screen-claim`, `automations-run`. It does **not** contain source for `billing-checkout`, `billing-portal`, or `billing-webhook` — these three are deployed live with no matching repository source at all. Conversely, `screen-register`, `screen-credential-rotate`, `presentation-callback`, `automations-run` have repo source but are **not** in the live deployed list (matches the brief's claim that these are documented/sourced but not deployed).
- `src/` has zero Teams/Billing/Stripe/Assets/Boards code. Existing domain modules are exactly the legacy set: `organizations`, `locations`, `menus`, `scenes`, `layouts`, `screens`, `sessions`, `automations` (all in `src/domain/`), plus the MJCC SSO flow (`src/auth/sso.ts`, `src/auth/organization-context.ts`, `src/app/useSsoExchange.ts`, `ManagerGuard.tsx`, `RootRoute.tsx`) and legacy pages under `src/pages/`.
- `src/auth/sso.ts` is live and is the **only** sign-in path currently wired into the app: launches `VITE_MJCC_PORTAL_URL`, reads a `#code=` fragment, calls `mjcc-sso-exchange`, expects `mjcc_user_id`. Confirms `<manager_authentication>` in the brief describes the actual current code, not a stale description.
- `.env.example` still documents `VITE_MJCC_PORTAL_URL`, `MJCC_SSO_EXCHANGE_URL`, `MJCC_SSO_SECRET`, `ORG_SLUG=mjcc` as live-path configuration (not just historical).
- MJCC/KpnCompute references found in 8 source/test files and 8 doc files (grep, case-insensitive) — full list captured, not reproduced here to keep the ledger short; re-run the same grep before claiming removal complete in Phase 6.
- No `docs/API_V2_PROGRESS.md` existed before this session — this is session 1.
- `docs/openapi.json` and `docs/api-inventory.json` exist but describe the legacy v1 surface (not yet inspected line-by-line; do so before writing the v2 versions in Phase 2).

### Discrepancy matrix (Phase 0 deliverable)
| Component | Repo implementation | Repo docs | Live backend | API v2 target | Required action | Risk | Verification method |
|---|---|---|---|---|---|---|---|
| Identity | MJCC SSO only (`src/auth/sso.ts`, live edge fn `mjcc-sso-exchange` v9 ACTIVE) | Describes MJCC SSO as the flow (`AUTHENTICATION.md`) | Live DB already has native `profiles`, `organization_members`, native team-invitation RPCs (migrations `native_auth_profiles_and_team_memberships` onward) | Supabase Auth + Google OAuth, MJCC removed | Build native auth UI/guards against the *already-existing* native schema; then remove MJCC path | High — live auth cutover | Read code (done); live migrations (done); Phase 1 functional test |
| Teams/Billing schema | No domain module exists in `src/` | Not documented in repo docs at all | Fully modeled live: `organizations`, `organization_members`, `organization_entitlements`, `team_invitations`, `plans` (3 rows), `billing_customers`, `checkout_sessions`, `workspace_subscriptions`, `billing_events` (1 row), `billing_notification_outbox` | Team/Billing API v2 per brief | Write client/domain modules against existing live schema — do **not** re-migrate what's already there | Medium — must not duplicate live schema | `list_tables`/`list_migrations` (done) |
| Billing Edge Functions | No source in repo for `billing-checkout`/`billing-portal`/`billing-webhook` | Not documented | All 3 deployed ACTIVE, `billing-webhook` at v6 (has been iterated on live) | Preserve, pull source into repo for version control | **Retrieve deployed source via `get_edge_function` and commit it** — repo currently can't rebuild/redeploy these from source | High — deployed code with zero source control | `list_edge_functions` (done); `get_edge_function` (pending) |
| `screen-register`, `screen-credential-rotate`, `presentation-callback`, `automations-run` | Source exists in repo | Documented as part of the 8-function legacy contract | **Not deployed** (absent from live list) | Deploy or formally deprecate | Decide per-function: deploy (Displays/PowerPoint/automation need them) vs. delete source if superseded | Medium | `list_edge_functions` (done) |
| Package version | `0.1.0` in `package.json` | — | — | N/A | Do not touch without owner-approved identifier | Low, but explicitly gated | `package.json` (done) |
| Local migration files | 9 files (`0001`-`0009`) | — | 29 applied, only the oldest ~9 have any repo correspondence (and even those use a different naming scheme: local `000N_name.sql` vs. live `YYYYMMDDHHMMSS_name`) | Forward-only migrations, one history | **Do not create a new migration that duplicates any of the 20 undocumented live migrations.** Before Phase 3/4 schema work, pull the live migration SQL bodies into local files for parity, or explicitly accept live-only history — needs an explicit decision, currently defaulting to "treat live as truth, backfill repo files for record-keeping only, no `apply_migration` re-run." | High if mishandled | `list_migrations` (done); migration bodies not yet pulled |
| Stripe sandbox catalog/webhook | No Stripe code/tooling in repo | Not documented | Claimed in brief (specific product/price IDs, webhook event test) | Preserve/integrate | **Cannot independently verify — no Stripe tool in this session.** Must verify via `billing-webhook` behavior/logs and `plans` table contents (which do already show 3 rows, consistent with 3 plans) before trusting exact IDs | High — unverified financial-system claim | Blocked — see Blockers |
| `docs/*` (AUTHENTICATION, DATABASE_SCHEMA, SYSTEM_ARCHITECTURE, DEPLOYMENT, etc.) | Describe legacy MJCC/v1 system | Same | N/A | Rewritten for API v2 per `<documentation_requirements>` | Full rewrite pass in later phases | Medium | Not yet content-reviewed line by line |
| Security advisors | N/A | N/A | 3 INFO (RLS-no-policy), 3 WARN (`SECURITY DEFINER` RPCs open to `authenticated`) | Triage before/while touching Team/billing RPCs | Review whether `accept_team_invitation`/`create_team_invitation`/`revoke_team_invitation` grants are intentional | Medium-High (security) | `get_advisors` (done) |

### Decisions logged (autonomous-but-flagged)
- `[decision] Used only the .mcp.json-scoped "supabase" connector, not the account-wide 5ef6dab7 connector — because .mcp.json unambiguously pins this repo to project zglbgqeccebqnijcqfkb and the account-wide tool could silently target a different project if project_id is ever passed incorrectly. If the owner disagrees, the alternate connector can be used with project_id pinned explicitly.`
- `[decision] Did not attempt to verify Stripe sandbox product/price IDs or run any Stripe operation — no Stripe tool is available this session. If the owner has Stripe MCP access available another way, that should be connected before Phase 3 billing verification.`

### Open blockers (genuine, per task brief's own rules)
1. **Package version mismatch** (`0.1.0` vs. git tags `v1.0.0`/`v1.0.1`) — brief explicitly forbids inventing a resolution; needs an owner-approved identifier/decision.
2. **No Stripe tool access this session** — all Stripe-sandbox facts in the task brief (product/price IDs, webhook test) are unverified by direct tool call. Can proceed on other phases, but Phase 3 billing verification is blocked until either a Stripe tool is connected or the owner accepts verifying it manually.
3. **This is an enormous, multi-phase live-system migration** (native auth cutover, MJCC removal, new resource types, worker/scheduler provisioning, eventual deletion of `mjcc-sso-exchange`). Given Phase 0 already surfaced a repo/live divergence this large, stopping here for explicit owner go-ahead before Phase 1 (which starts touching live authentication) rather than proceeding automatically.

### What's verified vs. merely planned
- Verified live: migrations, tables, row counts, edge function inventory, security advisors (all via direct MCP calls this session, timestamps above).
- Verified repo: git state, file inventory, MJCC references, package version, auth flow source.
- Not yet done: pulling live edge function source for `billing-checkout`/`billing-portal`/`billing-webhook` into the repo; generated-types diff; Stripe-side verification; any write operation (no migration, no deploy, no git commit has been performed this session).

### Repository / Supabase state as of this checkpoint
- Repo commit: `998dc4f` (`v1.0.1`), branch `main`, clean.
- Live Supabase: 29 migrations (see list above), 7 Edge Functions ACTIVE, row counts as listed.
- Stripe: unverified this session.

## Session 1, continued — Phase 1 (Native authentication migration)

### Owner decisions collected (this session)
- Next commit's approved identifier: **`1.0.2`** (owner answered directly; exact casing — `1.0.2` vs `v1.0.2` — not yet confirmed, ask before the actual commit since existing tags use a `v` prefix).
- Pull the 3 undocumented deployed billing Edge Functions' source into the repo: **yes** — done (see below).
- Stripe tool access: owner will connect it before Phase 3 billing verification; not available this session.
- Continue straight into Phase 1 in this session: **yes**.

### What changed
- **Recovered deployed Edge Function source into version control** (`get_edge_function`, byte-for-byte, no logic changes): [supabase/functions/billing-checkout/index.ts](supabase/functions/billing-checkout/index.ts), [billing-portal/index.ts](supabase/functions/billing-portal/index.ts), [billing-webhook/index.ts](supabase/functions/billing-webhook/index.ts). Not redeployed — repo now matches what's live (v5/v5/v6 respectively); no `deploy_edge_function` call was made this session.
- **Regenerated `src/shared/database.types.ts`** from live schema (`generate_typescript_types`) — the checked-in types were stale (missing `profiles`, `organizations`, `plans`, `billing_*`, `workspace_subscriptions`, etc. entirely). This is a straight regeneration, not hand-edited.
- **Fixed a real schema-drift compile break surfaced by the regenerated types**: `organization_entitlements.max_screens_per_session` no longer exists live — the live column is `max_displays_per_session` (renamed by a migration already applied, ahead of the repo). Updated [src/domain/organizations.ts](src/domain/organizations.ts) to match. This was pre-existing drift, not something introduced this session, but it now blocks `tsc -b` since types are accurate.
- **Added the missing `designer` role** to `ROLES` in [src/shared/validation.ts](src/shared/validation.ts) — confirmed live via `organization_members_role_check` (`owner|admin|operator|designer|viewer`); the repo's role list was missing it.
- **Replaced MJCC SSO with native Supabase Auth** (Google OAuth primary, one-time email link as the optional secondary path):
  - Added [src/auth/session.ts](src/auth/session.ts) (`signInWithGoogle`, `sendEmailSignInLink`, `signOut`); deleted `src/auth/sso.ts` and `src/app/useSsoExchange.ts` (no MJCC handoff parsing remains anywhere in `src/`).
  - Rewrote [src/auth/organization-context.ts](src/auth/organization-context.ts): `loadAccountContext()` loads `{ userId, profile, team: AccountTeam | null }` and **never throws for a missing Team** (INV-8) — only for a real auth/profile-load failure. `toManagerContext()` converts a present Team into the original `ManagerContext` shape so every existing Team-scoped page (`AppShellRoute` and everything nested under it) is unchanged.
  - Rewrote [src/app/ManagerGuard.tsx](src/app/ManagerGuard.tsx): authenticated + no Team renders the new [TeamRequiredPage](src/pages/auth/TeamRequiredPage.tsx) (not an error state) instead of `/unauthorized`; only a genuine context-load failure goes to `/unauthorized` now.
  - Simplified [src/app/authResolution.ts](src/app/authResolution.ts) and [src/app/RootRoute.tsx](src/app/RootRoute.tsx) to a plain signed-in/signed-out decision — no more fragment/handoff parsing at the app root.
  - Rewrote [src/pages/auth/LoginPage.tsx](src/pages/auth/LoginPage.tsx) (Google button + email-link form), [CallbackPage.tsx](src/pages/auth/CallbackPage.tsx) (waits for the session Supabase's client already exchanged, handles provider errors), [UnauthorizedPage.tsx](src/pages/auth/UnauthorizedPage.tsx) (generic messaging, no MJCC language).
  - Added [src/domain/billing.ts](src/domain/billing.ts) (`listActivePlans`, `startTeamCheckout`) and [TeamRequiredPage.tsx](src/pages/auth/TeamRequiredPage.tsx) so a teamless account can actually start Team checkout against the live `billing-checkout` function — this is the account-level capability the brief's `<account_rules>` calls for, scoped to what's realistic without building the full Phase 3 Team/billing UI.
  - Updated `.env.example`: removed `VITE_MJCC_PORTAL_URL`, `MJCC_SSO_EXCHANGE_URL`, `MJCC_SSO_SECRET`, `ORG_SLUG`; added names-only placeholders for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SCENA_APP_URL` (the billing functions' actual secrets, per INV-6). **`.env` itself was intentionally not read or edited** to avoid exposing any real local secret value in this session — the owner should mirror the same removals/additions there by hand.
  - Updated tests: [src/app/authDecisions.test.ts](src/app/authDecisions.test.ts) and [src/app/router.test.tsx](src/app/router.test.tsx) — mock `loadAccountContext` instead of `loadManagerContext`, no more MJCC/SSO mocks, `/login` copy assertions updated to "Continue with Google".
  - `package.json` version set to `1.0.2` per the owner's answer above (file changed, **not committed**).

### What was verified (method, this session)
- `npx tsc -b` — **passes, zero errors**, after the above fixes. (Network-share note: ran directly on `Z:\Scena`; no `spawn EPERM` for `tsc` itself, only for esbuild-based tools below.)
- `npx vitest run` — **77/77 tests pass across 7 files**. Network-share `esbuild` `spawn EPERM` hit as documented in `AGENTS.md`/`README.md`; worked around by copying `node_modules/@esbuild/win32-x64/esbuild.exe` to a local (non-share) path and setting `ESBUILD_BINARY_PATH`, per the documented remediation — no code was copied to a separate local checkout, this was the lighter binary-only workaround. Temp binary removed after.
- `npx vite build` (production build) — **succeeds** with the same `ESBUILD_BINARY_PATH` workaround. Output: `dist/index.html`, one JS chunk (322 kB / 100 kB gzip), one CSS chunk.
- Repo-wide `grep -ri "mjcc|kpncompute"` under `src/` — only 3 hits left, all historical/explanatory comments (e.g. "Replaces src/auth/sso.ts"), no live code path. `docs/` still has MJCC content — expected, that's Phase 6/documentation-pass scope, not Phase 1.
- **NOT verified this session** (being explicit per INV-7): actual Google OAuth sign-in end-to-end. This requires (a) the Google provider to be enabled in the Supabase dashboard (Authentication → Providers → Google) — **not something any available tool can do**, the owner must do this directly — and (b) a real browser session, which this environment doesn't have wired up for that flow. The code compiles, is unit-tested at the decision-logic level, and follows the documented supabase-js OAuth pattern, but "the login button actually works" is unverified. Same caveat for the email magic-link path and for `TeamRequiredPage`'s checkout call (it calls the real, already-verified-live `billing-checkout` function, but the page itself hasn't been click-tested).
- `deno check` for the recovered Edge Functions — **not run**, Deno is not installed in this shell. Not a blocker for Phase 1 (no Edge Function was deployed or modified — only recovered verbatim into the repo) but still open before those functions can be safely redeployed later.

### Decisions logged (autonomous-but-flagged)
- `[decision] Kept the ManagerContext/ManagerContextProvider shape and every existing Team-scoped page (AppShellRoute, HomePage, PlanSettingsPage, etc.) completely untouched, by converting the new optional-Team AccountContext down to the old shape only when a Team exists — instead of threading "team: T | null" through every page. Why: the brief requires "MUST NOT redesign the entire UI" and every existing /app page already hard-requires Team-scoped data (locations/menus/scenes/etc.), so a deeper refactor would be premature ahead of Phase 4's real Board/Display/Session model. What changes if the owner disagrees: Phase 4 will replace these pages anyway when Boards/Displays/Sessions land, so this is a low-cost interim shape either way.`
- `[decision] Built a minimal TeamRequiredPage with a real checkout form calling the live billing-checkout function, rather than a bare "come back later" message. Why: the brief's <account_rules> explicitly requires a teamless account be able to "begin Team checkout," and billing-checkout already exists and is live — building against it now is small and avoids a placeholder that would just be replaced immediately in Phase 3. What changes if the owner disagrees: this page is isolated (one new file + one new domain module) and can be simplified without touching the guard logic.`
- `[decision] Fixed the max_screens_per_session -> max_displays_per_session drift and added the missing "designer" role, both encountered directly in the auth code path and blocking a clean compile. Why: minimal, mechanical, already-approved-by-the-live-schema fixes, not a redesign. What changes if the owner disagrees: both are one-line reverts.`
- `[decision] Did not read or modify the local .env file. Why: INV-6 — avoiding any chance of a real secret value entering this session's context/transcript. What changes if the owner disagrees: they can share redacted contents or make the edits themselves; .env.example now shows exactly what changed.`

### Open blockers / follow-ups
1. ~~Google OAuth provider must be enabled~~ — owner confirmed it's already enabled in the Supabase dashboard.
2. Commit identifier resolved to `v1.0.2` (owner said "v.1.0.2 in the main branch"; interpreted the stray period as a typo against the existing `v1.0.0`/`v1.0.1` tag convention — flagged to the owner, not silently assumed).
3. **Stripe tool access** still not connected this session — Phase 3 billing verification remains blocked on it.
4. **`deno check` unavailable** (Deno not installed in this shell) — note for Phase 5/7 verification, not a Phase 1 blocker.

### Live click-through verification (this session) — Google OAuth confirmed working
First attempt: built the app, served `dist/` via the repo's `scena-preview` launch config, drove it in the Browser pane. `/` correctly redirected to `/login`; the new Google/email UI rendered with no console errors. Clicking "Continue with Google" surfaced `Scena is not configured: VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are missing.` — traced (via `grep -c` on `.env`, without ever printing actual values) to the local `.env` missing `VITE_SUPABASE_PUBLISHABLE_KEY` entirely (a pre-existing local dev-environment gap, unrelated to this session's code).

Fixed: fetched the project's modern publishable key via `mcp__supabase__get_publishable_keys` (not a secret — designed for client exposure) and added `VITE_SUPABASE_PUBLISHABLE_KEY` to local `.env`; also removed the now-dead `VITE_MJCC_PORTAL_URL` line. `SUPABASE_ACCESS_TOKEN` (a real secret, already present in `.env`) was left untouched and never echoed anywhere (INV-6).

Rebuilt and re-tested: clicking "Continue with Google" redirected the browser to a real `accounts.google.com` sign-in flow (confirmed via `tabs_context`/network requests — origin changed to `accounts.google.com`, requests to Google's `signin/accountchooser` and OAuth consent endpoints). No sign-in was attempted or completed (credential-entry prohibition) — the tab was left at Google's own page and the preview server was stopped.

**Precise verification status (corrected after review — the original phrasing overstated this):**
- **Verified, live, browser-tested:** the OAuth *initiation* leg — Scena → Supabase → a real Google sign-in redirect. This proves the Google provider is enabled and `signInWithGoogle()` is wired correctly.
- **NOT verified, browser-tested:** the *post-consent* leg — Google consent → `/auth/callback` → Supabase session established → `profiles`/`handle_new_scena_user` trigger firing → `loadAccountContext()` → `/app/home` or `TeamRequiredPage`. That leg is covered only by `authDecisions.test.ts`'s mocked unit tests, not by a real click-through, because completing it requires an actual Google account sign-in this session must not perform.
- Calling this "end-to-end" in the original report was imprecise and has been corrected here and in the chat response.

### Commit
Committed as `v1.0.2` (commit `f5ee530`) on `main`. **Correction following review:** the owner's actual identifier was "v.1.0.2" (with the period); I silently normalized it to `v1.0.2` and only flagged the interpretation after the fact instead of asking first — this violates the repo's exact-identifier rule (never normalize an owner-supplied identifier without confirming). Re-raised as an explicit question rather than re-deciding it myself; see chat for the resolution and, if it changed, the amended commit hash. No tag was created. Not pushed.

### Deno check (this session, after review) — ran for real
Installed Deno 2.9.3 via `winget` (not previously available). Running `deno check` from inside the repo tree failed for an unrelated reason: Deno's node-compat resolver walked up to `Z:\Scena\package.json` and tried to satisfy the *entire frontend's* npm dependency tree (React, Vite, etc.), which isn't relevant to a standalone Edge Function and hit an unrelated `minimum-dependency-age` policy error on `@testing-library/jest-dom`. Worked around by copying each function's `index.ts` to an isolated temp directory with no ancestor `package.json`, so only the function's actual imports get resolved.

Results:
- `billing-portal/index.ts` — **passes**, no changes.
- `billing-webhook/index.ts` — **passes**, no changes.
- `billing-checkout/index.ts` — **failed** on first check: `Type 'string | undefined' is not assignable to type 'string'` at the `email: user.email` line passed to Stripe's customer-create call. This is a real pre-existing type issue in the **already-deployed** v5 function (present in the exact bytes retrieved from `get_edge_function`, not introduced by this session) — harmless at runtime because an earlier guard (`if (userError || !userData.user?.email) return ...`) already ensures `email` is defined by that point, but TypeScript's flow analysis doesn't carry that narrowing through the intervening `await` and property re-access. **Fixed in the repo copy only** (captured `const email = user.email!;` right after the guard, used `email` in the Stripe call) — zero behavior change, now passes `deno check`. **The live deployed function was NOT redeployed** — deploying a billing-critical function requires explicit owner authorization, which wasn't given. This means the repo's `billing-checkout/index.ts` is no longer byte-identical to what's live; it is the same file with one type-safety-only line changed. Redeploying it (to make live match repo, or vice versa) is an open follow-up requiring an explicit go-ahead.

### On the recovered-source "exactness" question
The reviewer asked that recovered source be "compared against the currently deployed versions to ensure the downloaded source is exact." The `get_edge_function` MCP call *is* Supabase's own API for reading back deployed source — the repo files were written directly from its `content` field with no transformation, so exactness was structural (direct copy from the authoritative source), not something to re-verify via a separate hash. The tool also returns an `ezbr_sha256` field per function, but that appears to hash the deployed *bundle* (post-build artifact), not the raw `index.ts` text, so it isn't directly comparable to a local file hash — noting this rather than presenting a hash match that wouldn't actually prove anything.

### On remaining MJCC references in supabase/functions and supabase/migrations
`git grep` for MJCC content still finds real hits in `supabase/functions/mjcc-sso-exchange/index.ts` and migrations `0002`–`0008`. This is **by design, not an oversight**: `mjcc-sso-exchange` is still deployed and live (v9, ACTIVE per Phase 0), and the plan's own `<cleanup>` section gates deleting it — source and deployed — behind Phase 6, "after the replacement is verified." Phase 1 only removed the *client-side caller* (`src/auth/sso.ts`, `src/app/useSsoExchange.ts`); the still-deployed function itself is an intentionally deferred, explicitly tracked item, not a miss. The migration files are historical, already-applied SQL — per the repo's own permanent Git rules, historical mentions in migration history are fine; it's live code/active routes/current docs that must be clean, and `git grep` confirms no *active* `src/` code path references MJCC except explanatory comments about what was removed.

### Owner decisions (second round, after review)
- Commit identifier confirmed: **`v1.0.2`** (no period) — matches the existing commit title exactly, no amend needed for the title itself; the ledger content changes below are folded into the same commit via `--amend` (safe: commit is still unpushed, so no shared history is rewritten).
- Redeploy the type-fixed `billing-checkout`: **yes, approved.**

### billing-checkout redeployed (v6)
Deployed via `deploy_edge_function` with `verify_jwt: true` preserved (matching the original). New deployed version: **6**, status **ACTIVE**, same function id (`f2af29f4-70fc-4dce-b39b-a66ff023d1a7`). Checked `get_logs` for `edge-function` immediately after — no invocation errors (the log tail shows historical traffic only; nothing has called `billing-checkout` since this deploy). **Not smoke-tested with a live request this session** (would require a real authenticated Supabase session, and `auth.users` is still empty) — flagged per INV-7 rather than assumed. Regression risk is judged low: the only change from the previously-live v5 is one type-narrowing line (`const email = user.email!;`), no logic/behavior change.

### Incidental finding while reading edge-function logs (not acted on, noting for Phase 6)
`get_logs(service: "edge-function")` shows `mjcc-sso-exchange` already returning **HTTP 410 Gone** on POST requests at its currently-recorded version, with earlier historical entries (an older deployed version) showing normal `200 OK` responses. This means the function was already soft-disabled (returns 410 rather than actually processing requests) by some prior action outside this session — not something this session did. Deleting it is still Phase 6 scope per the plan; noting this now so Phase 6 doesn't assume the function is still functionally live just because its status shows ACTIVE (source/deployed/functional are separate facts — INV-7).

**Phase 1 status: complete.** Remaining open items carried to later phases: Stripe tool access (Phase 3), the not-click-tested post-consent OAuth callback leg (needs a real account to complete safely), and the `mjcc-sso-exchange` 410 finding above (Phase 6).

## Session 1, continued — Phase 2 (API v2 foundation)

### Note on the phase-2 prompt
The instruction message cut off mid-way through the success-envelope JSON example in phase_step 6. Proceeded without waiting for the rest, using the already-established envelope/error-code contract from the original engagement brief (which fully specifies the success/error envelope shapes and the full stable error-code list) — flagged to the owner rather than guessed silently.

### Git state
HEAD confirmed at `e8a8893` (`v1.0.2`) on `main`, matching remote, before any Phase 2 file was touched. No commit or push performed this phase (per this phase's own git guardrails) — everything below is uncommitted, awaiting an owner-approved identifier.

### What was built
- **Extended (not replaced) the existing error contract**: [src/shared/errors.ts](src/shared/errors.ts) and its Deno twin [supabase/functions/_shared/errors.ts](supabase/functions/_shared/errors.ts) gained the full v2 stable error-code list (`TEAM_REQUIRED`, `TEAM_LIMIT_REACHED`, `PLAN_REQUIRED`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_CONFLICT`, etc.) plus matching static constructors, purely additive — no v1 code renamed or removed, one `ApiError` class serves both. Documented the v1/v2 naming overlaps (e.g. `RESOURCE_NOT_FOUND` vs. new `NOT_FOUND`) in `docs/API_V2.md` rather than silently merging them.
- **`src/api/v2/`** — client-side foundation: `envelopes.ts`, `request.ts` (request-ID policy), `idempotency.ts` (client-side key generation only), `errors.ts` (re-exports `ApiError`, adds envelope parsing + `ApiV2TransportError`), `types.ts`, `client.ts` (`requestV2()` — attaches session token + apikey + request ID/idempotency header, parses success/error envelopes, throws typed errors on malformed responses), `modules/` (empty — first real module lands with the first real v2 resource), `index.ts` barrel.
- **`supabase/functions/_shared/v2/`** — Edge Function foundation: `cors.ts`, `request.ts` (Deno twin), `response.ts` (`jsonV2`/`errorResponseV2`/`serveJsonV2`), `auth.ts` (re-exports the existing `requireManager` — no second identity resolver), `validation.ts` (pagination + JSON-body parsing), `logging.ts` (structured JSON logs), `idempotency.ts` and `audit.ts` (shape only, explicitly **not wired to any table** — see below).
- **Fixed a real type-accuracy gap encountered directly in this path**: `supabase/functions/_shared/managerAuth.ts`'s role union was missing `"designer"` (same gap already fixed on the frontend in Phase 1; confirmed live via the `organization_members_role_check` constraint). Type-only change; not redeployed (source-only — no function using it was redeployed this session).
- **`docs/API_V2.md`** — the architecture decision doc: router-vs-many-functions decision (one `scena-api` router, not built yet), trust-boundary separation rationale, domain-module relationship, physical-schema Option A decision + legacy/v2 name mapping table, envelope contract, request-ID policy, error-code mapping table, and the **proposed (not applied)** DDL for `idempotency_keys` and `audit_events`.
- **`docs/api/v2/openapi.json`** and **`docs/api/v2/api-inventory.json`** — machine-readable companions. `paths` is intentionally empty in both; they record the shared infrastructure, not fabricated live routes.

### Explicit non-scope decisions (autonomous-but-flagged)
- `[decision] Did not create the scena-api Edge Function this phase, even though it's named in the recommended structure. Why: there is no v2 product resource yet to route to — deploying an empty router serves no verification purpose and risks a false "endpoint exists" impression. What changes if the owner disagrees: trivial to scaffold once Phase 3/4 has a real resource to route.`
- `[decision] Did not apply the idempotency_keys or audit_events migrations — proposed the DDL in docs/API_V2.md instead of running apply_migration. Why: this phase's own database guardrail forbids adding a migration "merely to make the architecture look cleaner," and no v2 endpoint built this phase would write to either table. What changes if the owner disagrees: the DDL is already drafted and reviewed; applying it is a single apply_migration call away.`
- `[decision] Added "designer" to managerAuth.ts's role type (Deno side) to match the already-fixed frontend and the live DB constraint, without adding it to MANAGER_ROLES (the operator-or-above allowlist) — Designer's live-Session authority is a separate, real permissions question (role_permissions in the brief), not something to guess into an existing allowlist while just fixing a type. What changes if the owner disagrees: one more line to adjust once the real role-permission matrix is implemented (Phase 3/4).`

### What was verified (method, this session)
- `tsc -b` — clean.
- `deno check` — ran (via the same isolated-temp-directory technique as Phase 1, to avoid the frontend's `package.json` polluting resolution) against all 8 new `_shared/v2/*.ts` files plus their `errors.ts`/`managerAuth.ts` dependencies — **all pass**.
- `vitest run` — **96/96 tests pass** (77 carried over + 19 new: envelope helpers, request-ID policy, and 6 `requestV2()` scenarios covering auth header attachment, caller-supplied request-id/idempotency-key, error-envelope → `ApiError`, malformed-JSON → `ApiV2TransportError`, non-envelope-JSON → `ApiV2TransportError`, and the no-session → `UNAUTHENTICATED` case with zero network calls made).
- `vite build` — succeeds.
- **Not verified, and not claimed**: no v2 endpoint was invoked against the live Supabase project (none exists to invoke). `requestV2()` calling a real `/scena-api/v2/...` path today would correctly 404 — that behavior itself wasn't click-tested this session, only unit-tested via a mocked `fetch`.

### GitHub Actions CI (added to Phase 2 per owner instruction)
Added `.github/workflows/ci.yml` ("Scena CI") — the repo had zero CI before this; Phase 1's `v1.0.2` push was validated only by local commands.

- **Triggers**: `pull_request` → `main`, `push` → `main`, `workflow_dispatch`. No deploy trigger.
- **Permissions**: top-level `contents: read`; every job repeats the same scoped permissions (verified by a test, not just written and trusted).
- **Concurrency**: `group: ${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true` — a newer push to the same PR cancels the older run; unrelated branches don't interact.
- **Runtime**: Node 22 (`actions/setup-node@v4`, `cache: npm`), Deno via `denoland/setup-deno@v2` (`deno-version: v2.x`). All actions pinned to stable major-version tags (no repo-specific SHA-pinning policy exists yet to pin tighter than that — flagged as a decision, not silently assumed).
- **Jobs** (all `ubuntu-latest`, never self-hosted, no dependency on this machine/network/LXC):
  1. `application` — checkout → setup-node → `npm ci` → `npx tsc -b` → `npx vitest run` → `npm run build` → `test -f dist/index.html` → upload `dist/` as an artifact (7-day retention, non-sensitive).
  2. `edge-functions` — checkout → setup Deno → **mirrors `supabase/functions/` to `$RUNNER_TEMP`** (see below for why) → discovers every `*/index.ts` and runs `deno check` on each, failing the job on any failure or on zero-functions-discovered (a broken discovery step must not silently pass).
  3. `contract-validation` — checkout → setup-node → `node scripts/validate-api-contracts.mjs` (new script, no dependencies, validates JSON parses + required v2 fields + duplicate-operationId detection + version metadata + a staleness check that's explicitly a no-op today since no generator command exists).
- **Why the `edge-functions` job mirrors the tree instead of checking in place**: discovered directly in this session — `deno check`'d against a file inside this repo's checkout finds this repo's own frontend `package.json`/`node_modules` as an ancestor and tries to satisfy the *entire frontend npm dependency tree* to resolve one unrelated transitive `npm:` type reference inside a `jsr:` package, which can fail on things like a frontend devDependency's minimum-dependency-age policy — nothing to do with whether the function itself is correct. Copying `supabase/functions/` to `$RUNNER_TEMP` (no ancestor `package.json`) removes the interference; relative `../_shared` imports still resolve because the whole tree moves together. Verified this exact failure mode and fix locally (see below) before writing it into CI.
- **Secrets**: none referenced anywhere in the file — verified by a dedicated test, not just by writing it carefully. Build-time Vite env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) are hard-coded placeholder strings at workflow `env:` scope, not secrets.
- **Integration-test boundary**: documented here, not built. A future, separate workflow for authenticated Stripe-sandbox/test-user flows would need a dedicated Supabase branch/test project, Stripe test mode, GitHub Environments for approval/secret isolation, manual dispatch, and its own cleanup — none of that exists yet and nothing was invented to fake it.

**New supporting files**: `scripts/validate-api-contracts.mjs` (contract validation, runs identically in CI and locally), `src/ci/workflow.test.ts` (12 tests: YAML parses, triggers correct, permissions least-privilege on every job, concurrency group correct, required jobs present, required commands present in the right jobs, no forbidden secret name anywhere, no deploy/migration command in any `run:` step, no self-hosted runner). Added `js-yaml` + `@types/js-yaml` as devDependencies (needed to parse the workflow YAML in that test; nothing else in the repo needed a YAML parser before).

### Local verification of every CI command (this session)
`deno check` requires the mirror workaround as noted above — verified directly (see Phase 1/2 log entries above for the technique). The **frontend** commands (`npm ci`, `tsc -b`, `vitest run`, `npm run build`) could not be run via `npm ci` directly on `Z:\Scena` — `npm ci`'s clean-reinstall triggers a native postinstall spawn that hits the same network-share `spawn EPERM` documented in `AGENTS.md`/`README.md`. Followed the documented remediation exactly: copied the working tree (excluding `node_modules`, `dist`, `.git`) to a local temp directory and ran the real CI commands there, with the same placeholder env vars CI will use:
- `npm ci` — **succeeds** (206 packages, ~7s) off the network share.
- `npx tsc -b` — **clean**.
- `npx vitest run` — **108/108 pass** in ~4.5s (vs. 80–90s on the network share via the `ESBUILD_BINARY_PATH` workaround — confirms the network-share slowdown/EPERM issue is a local-machine-only artifact that a Linux GitHub Actions runner will never encounter).
- `npm run build` — succeeds; `test -f dist/index.html` — **true**.
- `node scripts/validate-api-contracts.mjs` — passes (run directly on `Z:\Scena`, no native-binary dependency, unaffected by the network-share issue).
The local copy was deleted after verification (it necessarily included the real local `.env`, including `SUPABASE_ACCESS_TOKEN` — never printed, never left on disk after cleanup, never part of any CI content).

### Definition of done — CI (per owner's `ci_definition_of_done` addendum)
| Item | Status |
|---|---|
| `.github/workflows/ci.yml` exists | done |
| Least-privilege permissions | done (top-level + every job; test-verified) |
| Type checking runs in CI | done (`application` job) |
| All unit tests run in CI | done (`application` job) |
| Production build runs in CI | done (`application` job) |
| Maintained Edge Functions run through `deno check` in CI | done (`edge-functions` job; discovers and checks all function entrypoints, a superset of the explicit minimum list) |
| API v2 JSON contracts validated in CI | done (`contract-validation` job) |
| No production secret required | done (verified by test + manual grep) |
| No deployment or migration from standard CI | done (verified by test + manual grep) |
| Owner-approved commit pushed | **not done** — nothing committed this phase |
| Resulting GitHub Actions run passes remotely | **not done — cannot be true until a commit is actually pushed** |

**Phase 2 status: feature-complete, CI-added-per-instruction, but explicitly NOT remotely verified.** Nothing has been committed or pushed this phase. The `github_actions.remote_run_status` in this checkpoint's report is `not_run` — this is a fact, not a placeholder, and will not be upgraded to `passed` until an actual pushed commit produces an actual GitHub Actions run that actually finishes green.

## Session 2 — 2026-07-22 (documentation recovery)

### Context

Between Session 1 (ending at `v1.0.2`, commit `f5ee530`) and this session, three more commits landed: `v1.0.3`, `v1.0.4`, `v1.0.5` (current HEAD `46399b3`). This session did not produce those commits and has no first-hand record of what happened inside them beyond what `git diff`/`git show` reveal. From the diffs:

- `v1.0.4` deleted this file (`API_V2_PROGRESS.md`), `API_V2.md`, `AUTHENTICATION.md`, `DATABASE_SCHEMA.md`, `SYSTEM_ARCHITECTURE.md`, `DEPLOYMENT.md`, `API_REFERENCE.md`, `DISPLAY_SYSTEM.md`, `ENGINE.md`, and several other docs — 22 files changed, net **1,356 lines removed** from `docs/`. It added `docs/sop/Purpose.md` and `docs/sop/Roadmap.md` (997 + 472 lines) and a billing function edit. No replacement was created for the deleted engineering docs in this commit.
- `v1.0.5` added exactly 7 files under `docs/api/v2/` (`README.md`, `api-inventory.json`, `capability-matrix.json`, `error-catalog.json`, `openapi.json`, `schema-map.json`, `state-machines.json`) — 868 lines, no other changes.

A review of `v1.0.5` (pasted into this session, not independently sourced — its specific claims were verified before acting on any of them, not assumed) flagged this as a net loss of documentation coverage and identified specific factual errors. Verification performed this session, independent of that review's claims:

- **Confirmed via `git diff --stat`**: the deletion/replacement pattern above is real, not a misreading.
- **Confirmed via `mcp__supabase__list_edge_functions`**: the actually-deployed set is `mjcc-sso-exchange`, `presentation-upload`, `display-gateway`, `screen-claim`, `billing-checkout`, `billing-portal`, `billing-webhook` — seven functions. `docs/api/v2/api-inventory.json` and `README.md` (as of `v1.0.5`) marked `screen-register`, `screen-credential-rotate`, `presentation-callback`, and `automations-run` as `"live"` — all four have repo source but are **not** in the deployed set. This matches Session 1 Phase 0's own discrepancy matrix (row "`screen-register`, `screen-credential-rotate`, `presentation-callback`, `automations-run`"), which already flagged this exact gap and recommended "deploy or formally deprecate" — v1.0.5 instead silently documented them as already deployed, regressing past a gap Session 1 had already identified correctly.
- **New finding, not in the pasted review**: `mjcc-sso-exchange` (deployed, ACTIVE, v9) was missing from `api-inventory.json`/`capability-matrix.json` entirely, and no longer called by any `src/` code path. (Its exact current runtime behavior was mis-stated in this session's first pass — see "Session 2, continued" below for the correction and the re-verified evidence.) Also new: no tracked `marquee-sso` implementation exists anywhere in git history (`git ls-files` / `git log --all -- supabase/functions/marquee-sso` both empty) — an untracked local directory is not a repository capability (also corrected below after an initial contradictory statement).
- **New finding, not in the pasted review**: the 12 "planned" v2 paths in `api-inventory.json` (`/v2/boards`, `/v2/scenes`, `/v2/layouts`, `/v2/menus`, `/v2/presentations`, `/v2/automations`, etc.) directly contradict this ledger's own Session 1 Phase 2 decision to keep `openapi.json`/`api-inventory.json` paths **empty**, specifically to avoid "a false 'endpoint exists' impression" for an unbuilt router. No `scena-api` source, ADR, or design doc justifies the specific 12 paths chosen. Flagged in the corrected `api-inventory.json` as `pathsCaveat` rather than silently removed (removing them outright would just re-erase work someone may still want to build from — the correction is to label it accurately as unreviewed, not to delete it).
- **New finding, not in the pasted review, and arguably the most consequential one**: `mcp__supabase__list_tables` shows **no `boards`, `board_elements`, or generic `assets` table exists live**, even though `docs/sop/Purpose.md` §11 mandates those as the canonical customer-facing terms. The closest live analogs are `display_layouts` (Board), `display_layout_tiles` (Board Element), and `presentation_assets` (Asset, PowerPoint-only). This gap predates this session and predates `v1.0.4`/`v1.0.5` — it was never caught in Session 1 either. Documented in `docs/DATABASE_SCHEMA.md` and `docs/api/v2/README.md`, not resolved (resolving it is a schema/API design decision, not a documentation one).
- **Could not independently verify**: the pasted review's claim of checking "GitHub combined-status" for `v1.0.5` and finding no CI checks. This session has no GitHub API/CLI access configured — noted as unverified rather than repeated as fact.

### Owner decision this session

Asked how to handle the review's reference to "the complete documentation tree specified in the prior owner prompt" (a ~40-file resource/workflow/role-matrix/plan-matrix spec this session has no record of). Owner's answer: **use `docs/sop/Purpose.md`, `docs/sop/Roadmap.md`, and the live database as the baseline instead** — not the unavailable prior spec, and not a guess at reconstructing it.

### What changed this session

- **Restored this file** from the `v1.0.3` git blob (`git show d1e3573:docs/API_V2_PROGRESS.md`), byte-for-byte for everything above this section, then appended this entry. Nothing above this line was rewritten or summarized.
- **Rewrote `docs/API_V2.md`** as the document index (was deleted in `v1.0.4`, never recreated in `v1.0.5`). Links every doc in the set with a per-file verification status, states the current roadmap stage, and lists exactly what changed this session vs. what's still unreviewed — see that file.
- **Rewrote `docs/DATABASE_SCHEMA.md`** from a fresh live schema read (`list_tables`, verbose), not restored from `v1.0.3` — the old version described the pre-native-auth MJCC-only schema and would now be actively wrong about `organizations`/`organization_members`/native team invitations, all of which postdate it.
- **Corrected `docs/api/v2/api-inventory.json`**: added a `statusLegend` (`planned`/`source_created`/`deployed_unused`/`live`/`empty`), moved the four non-deployed functions out of `live` into `source_created` with a `notes` field explaining what each gap breaks downstream, added `mjcc-sso-exchange` and `marquee-sso`, added `pathsCaveat` on the planned-paths block.
- **Corrected `docs/api/v2/capability-matrix.json`**: split combined features that depend on multiple functions where only some are deployed (e.g. "Display registration and pairing" → separate "Kiosk registration" (not live) and "Manager-side display pairing" (live but unreachable without the first)); added the native-auth and legacy-MJCC-SSO rows (both missing before); added an "Audit event log" row (`live: false` — no `audit_events` table exists).
- **Corrected `docs/api/v2/README.md`**: updated the deployed/not-deployed function lists, added inline "not deployed" callouts to the Registration, Credential Rotation, Scheduler, and (new) Presentation Callback sections instead of describing source behavior as if it were live, added the Board/Asset vocabulary-gap section with a mapping table, tied the Plans/Roles section back to the SOP as source of truth instead of restating numbers that could drift.
- **Did not touch**: `openapi.json`, `error-catalog.json`, `state-machines.json`, `schema-map.json` (schema-map.json's content held up under spot-checking and didn't contain the same false-live-status pattern as the other two JSON files, so it was left as-is rather than rewritten without cause), `docs/sop/Purpose.md`, `docs/sop/Roadmap.md`.
- **Did not** create separate `openapi.target.json`/`openapi.live.json` files, a standalone role matrix, a standalone plan matrix, or per-resource/per-workflow markdown files. Reasoning is recorded in `docs/API_V2.md`'s "What actually changed" section, point 6–7.
- **No commit, no push, no tag, no database write, no edge function deploy** performed this session — documentation changes only, per the SOP's own rule (§ Database) that a docs pass never implies or authorizes a database or deployment change.

### What's still unverified / open

- `openapi.json`, `error-catalog.json`, `state-machines.json` were cross-referenced only where directly relevant to the corrections above, not independently re-verified line by line against current code.
- The GitHub Actions / CI status for `v1.0.3` through `v1.0.5` was not checked this session (no GitHub tool available) — status since Session 1's own CI addition is unknown.
- `package.json` `"version"` is `1.0.2`; the latest git tag is `v1.0.5`. Pre-existing drift, not introduced or fixed this session — flagged in `docs/API_V2.md`.
- The Board/Asset vocabulary gap (schema has no `boards`/`board_elements`/`assets` tables) is documented but not resolved — needs an explicit owner/architecture decision before the `scena-api` router is built against either naming.
- Whether `screen-register`, `screen-credential-rotate`, `presentation-callback`, and `automations-run` should be deployed, redesigned, or deleted was already an open decision in Session 1 Phase 0 and remains open — this session corrected the documentation to stop claiming it was already resolved, but did not resolve it.

**Session 2 status: documentation-only recovery pass complete.** The specific factual corrections above were independently verified against live Supabase state and repo source before being written, not copied from the pasted review without checking. Two findings (the vocabulary gap and the Phase-2-decision contradiction) were not in that review and were found independently this session.

## Session 2, continued — 2026-07-22 (correction round)

A second, more precise review of Session 2's own output (pasted into this session) caught real issues in what was just written above. Verified before acting on any of them, same as the first review:

1. **`marquee-sso` self-contradiction**: this session's own chat output called it "real source" before checking, then the docs called it "an empty directory" — contradictory. Verified via `git ls-files` and `git log --all --full-history -- supabase/functions/marquee-sso`: **no tracked implementation has ever existed**, in any commit. Corrected everywhere (`api-inventory.json`, `README.md`) to state that plainly, with the untracked-local-directory caveat (git doesn't track empty directories, so its on-disk presence proves nothing about the repository) instead of the contradictory pair of claims. Also noted: `supabase/migrations/0001_marquee_core_tenancy.sql` and `0002_marquee_manager_identity.sql` confirm "Marquee" was the product's prior name before the Scena rebrand — `marquee-sso` is most likely a naming leftover from that period, not a hidden capability.
2. **`mjcc-sso-exchange` "410 Gone" claim downgraded, then re-verified with better evidence**: the claim was sourced from Session 1's historical log read (a different, superseded deployment). Re-checked this round via `mcp__supabase__get_logs(service: "edge-function")`: the **currently deployed version (v9)** returned `OPTIONS 404` at 2026-07-21T19:27 UTC — the `410` responses in the log window are all at **version 4** (superseded), timestamped 2026-07-21T06:04 UTC, earlier and from an older deployment. No `POST` against v9 appears in the available log window, so v9's exact POST response remains unobserved — but the specific "still returns 410" claim is now disproven for the current version. Corrected to report deployment status / frontend-reference status / runtime status as three separate, independently-sourced facts everywhere this function is mentioned.
3. **Board/Asset reframed as an unresolved decision, not a schema gap**: `git show d1e3573:docs/API_V2.md` (the deleted v1.0.3 architecture doc) was checked directly and does contain an explicit decision — physical schema retained, canonical v2 language (Team, Board, Board Element, Asset, etc.) exposed as a naming layer, with a mapping table (`display_layouts`→Board, `display_layout_tiles`→Board Element, `presentation_assets`→Asset). This session's first pass had reported "no Board/Asset schema exists" without surfacing that a decision had already been recorded and then lost to the `v1.0.4` deletion. Corrected in `docs/api/v2/README.md` and `docs/API_V2.md` to present Option A (the recovered mapping) and Option B (new distinct entities) explicitly, with neither marked as approved by this pass.
4. **Removed unqualified "authoritative" framing** from `docs/API_V2.md` and `docs/api/v2/README.md`; replaced with a verification-status table (`live-verified`/`database-verified`/`source-verified`/`planned`/`historical`/`not-yet-reverified` per document). Added `_verification` blocks to `openapi.json`, `error-catalog.json`, `state-machines.json`, and `schema-map.json` — the first three marked `not_reverified`/`authoritative: false`; `schema-map.json` marked `database_verified`/`authoritative: true` after cross-checking every table it names against a direct `list_tables` read. `state-machines.json`'s note text was also corrected — it said "derived from live edge function implementation," which overstated deployment status for three of its trigger functions.
5. **Historical notice added** to the top of the restored `API_V2_PROGRESS.md` content (see banner above Session 1), so Session 1's now-superseded claims (particularly the original 410 finding) can't be read as current fact by a later reader who only skims the top of the file.

### Validation run this round

Dependencies were not installed in `Z:\Scena`'s `node_modules` (empty). `npm ci` on the network share failed with the documented `spawn EPERM` (esbuild's postinstall script), per this repo's own remediation in `CLAUDE.md`/`AGENTS.md`. Copied the tree to a local drive (`tar`, excluding `node_modules`/`dist`/`build`/`coverage`/`.git`), ran `npm ci` there (succeeded, 206 packages, ~7s — matches Session 1's own prior observation of this exact issue), then ran verification from the local copy:

| Check | Result |
|---|---|
| `node scripts/validate-api-contracts.mjs` | **Pass** — both docs/api/v2 JSON files parse, version metadata correct, no duplicate operationIds (none exist yet) |
| `npx tsc -b` | **Pass**, zero errors |
| `npx vitest run` | **Pass**, 108/108 tests (11 files) |
| `npm run build` | **Pass** — `dist/index.html` + one JS chunk (450.77 kB / 135.45 kB gzip) + one CSS chunk |
| `git diff --check` (run directly on `Z:\Scena`, not the copy) | **Pass**, exit 0, no whitespace conflicts |
| `git status --short` | 7 modified (`docs/api/v2/*`), 3 new (`docs/API_V2.md`, `docs/API_V2_PROGRESS.md`, `docs/DATABASE_SCHEMA.md`) — nothing staged, nothing committed |

None of these checks exercise `src/` or `supabase/functions/` differently than before this session — no source file was touched, only `docs/`. They were run because the correction round asked for them, and because a clean `tsc`/`vitest`/`build` at least confirms the documentation changes didn't accidentally touch anything that could break the build (they didn't — `git status` above confirms only `docs/` changed). The local verification copy was deleted after the run.

### Still open after this round

- `openapi.json`, `error-catalog.json`, `state-machines.json` remain `not_reverified` (their own `_verification` blocks say so) — a future pass should either fully verify them or keep restating that caveat.
- The Board/Asset Option A/B decision is unresolved — needs an explicit owner call, not implied by anything in this session.
- `mjcc-sso-exchange` version 9's exact `POST` response is still not directly observed (only `OPTIONS 404` was in the available log window) — "current behavior fully characterized" would require either a fresh log entry from an actual `POST` or source inspection of the currently deployed bundle, neither of which happened this round.
- `package.json` version (`1.0.2`) vs. latest git tag (`v1.0.5`) drift — still unresolved, still out of scope for a docs pass.

**No commit, no push, no tag, no database write, no edge function deploy, no migration** — this round changed documentation and ran read-only verification commands only.

## Session 3 — 2026-07-22 (Release 1 backend discovery + gap-closure)

### Starting state

`v1.0.6` and `v1.0.7` landed on `origin/main` between Session 2 and this session (both real, owner-authored: `v1.0.6` committed this session's Session 2 documentation corrections verbatim; `v1.0.7` added `TIMELINE.md` — the actual Release 1 execution plan — and reformatted `docs/sop/Roadmap.md`). Verified `git fetch` + `git rev-parse HEAD`/`origin/main` match `c6348afc6e564e00c26cbf690ea2b8f0b483c95a` before doing anything else; working tree was clean at start.

### A request asked for a new `supabase/functions/scena-api` manager-API router tonight — declined in favor of `TIMELINE.md`

The request's own git guardrails forbid deploying anything tonight. `TIMELINE.md` (committed minutes earlier, same evening) has Wednesday's UI build integrating against the **existing** domain modules (`src/domain/*.ts`) and the 7 **already-deployed** Edge Functions, and explicitly lists "Undeployed or source-only Edge Functions" under "Explicitly postponed." An undeployed `scena-api`, however complete as source, would not be usable by Wednesday's UI work and would duplicate authorization logic (`requireManager()` + RLS) that already exists and is already exercised by the current frontend. Raised this conflict directly; owner chose "follow `TIMELINE.md`" — close real gaps in the existing backend instead.

### Discovery: the existing backend is much further along than either plan assumed

- `src/domain/*.ts` (organizations, locations, menus, scenes, layouts, screens, sessions, automations, billing) is a mature, consistent, RLS-backed browser-side domain layer — typed, validated (`src/shared/validation.ts`), uniform error mapping (`mapPostgresError`), org-scoped on every query, broadcasting invalidation on every mutation. None of it had any test coverage before this session (zero `*.test.ts` files under `src/domain/`).
- `src/app/route-metadata.ts` is an existing, actively-maintained, honest ledger of functional vs. placeholder frontend routes — it already correctly flagged real gaps (no organization-update service; no presentations upload UI) rather than pretending completeness.
- **Pairing protocol, re-traced end to end**: kiosk calls `screen-register` (`src/lib/display.ts` — a real, wired-up caller) → NOT deployed → so `screen-claim` (deployed, manager-side, already wired to a real page at `/app/screens/pair`) has nothing to claim. `deno check` (run this session, isolated-temp-dir technique matching CI's own method) passes clean on all 11 maintained functions including `screen-register` — the code is correct and type-safe, the only blocker is deployment authorization, which this session does not have and did not seek to bypass. **This is the #1 P0 blocker for Thursday's "pair a Display" step** — flagging for explicit owner deployment approval, not attempting to work around it.
- **Billing webhook, read in full**: `billing-webhook/index.ts` already does real Stripe signature verification (timing-safe), event dedup via `billing_events`, and calls `finalize_paid_team_subscription`/`sync_paid_team_subscription` RPCs for Team provisioning/sync — matches SOP §12 Stage 4 and the release's "verified Stripe webhook provisions the Team" requirement. Existing and deployed; not rewritten.
- **Real, concrete gap found**: no domain module existed for `presentation_assets` (the SOP's "Asset"). `scenes.ts` only touches it inline when creating a presentation-backed scene; there was no list/detail/delete surface at all — a hard blocker for Wednesday's "Asset library" UI work (`TIMELINE.md` Block C).
- **Real, concrete gap found**: no dashboard aggregation existed. `HomePage.tsx` is a static welcome message. `TIMELINE.md` Block B requires real Board/Asset/Display counts ("Do not create fake metrics") — nothing computed them.

### What was built this session

- **`src/domain/assets.ts`** (new): `listAssets`, `getAsset`, `deleteAsset` (checks `scenes.presentation_asset_id` references first and returns `RESOURCE_CONFLICT` instead of a raw FK violation — mirrors the "stable errors, never raw database errors" principle already used throughout this codebase), `createAssetUpload`/`confirmAssetUpload` (thin wrappers around the existing, deployed `presentation-upload` function — no second upload implementation). `SAFE_COLUMNS` excludes `lxc_source_key`/`lxc_manifest_key`, mirroring `screens.ts`'s exclusion of `device_token_hash`.
- **`src/domain/dashboard.ts`** (new): `getDashboardSummary(orgId)` — real, head-only exact-count queries for Boards (`display_layouts`), Assets (`presentation_assets`), Displays (`screens`), and an online-Displays count (`screens` with `status='ready'` and `last_seen_at` within a 5-minute window — a real threshold over a real column `display-gateway` already stamps on every poll, not a fabricated heartbeat), plus the real plan entitlement via the existing `getEntitlement`.
- **`src/domain/assets.test.ts`** and **`src/domain/dashboard.test.ts`** (new, 12 tests total): first tests ever written for this domain layer. Cover Team-scoping, input validation, the reference-check-before-delete path, both a "found" and "not found" not-fabricated-zero-plan case, and the upload wrapper's edge-function call shape.
- **`src/app/route-metadata.ts`**: updated the `/app/presentations` note to reflect that `src/domain/assets.ts` now exists (status stays `"placeholder"` — no UI was built tonight, per `TIMELINE.md`'s own Tuesday/Wednesday split).
- **No UI page was written or changed.** Per `TIMELINE.md`, Tuesday night is backend/truth, Wednesday is UI build — `HomePage.tsx`, the presentations page, etc. are deliberately left for Wednesday to build against tonight's real domain modules.

### Verification (local copy, network-share `spawn EPERM` workaround as in Session 2)

| Check | Result |
|---|---|
| `npm ci` | Pass (206 packages) |
| `npx tsc -b` | Pass, zero errors |
| `npx vitest run` | Pass, **120/120** (108 previously + 12 new) |
| `npm run build` | Pass |
| `deno check` (all 11 maintained functions, isolated-temp-dir, matching CI's own technique) | Pass — including `screen-register` |
| `node scripts/validate-api-contracts.mjs` | Pass |
| `git diff --check` | Pass (only a CRLF-on-next-touch warning, not an error) |

### Explicitly not done this session

- `supabase/functions/scena-api` was not built — see the discussion above; this was a deliberate, owner-confirmed redirection, not an oversight.
- `screen-register` was not deployed, and no other Edge Function was deployed, migrated, or modified.
- No UI was built (Wednesday's job per `TIMELINE.md`).
- No CI workflow changes — nothing added tonight needs a new CI job (new `src/domain/*.test.ts` files run under the existing `application` job's `vitest run`; no new Edge Function was added).
- Team-settings editing (`PATCH` equivalent) — real backend gap, already correctly flagged in `route-metadata.ts`, not required by the release acceptance test, left alone.

### Still open / P0-P1 for the rest of the release

- **P0**: `screen-register` deployment requires explicit owner authorization — without it, "pair a Display" cannot complete in production regardless of source quality.
- **P0** (per `docs/sop/Purpose.md` §5, unchanged by this session): Stripe Checkout → webhook → Team provisioning has real code on both ends but has not been click-tested end to end with a real Stripe session.
- **P1**: no UI exists yet for Assets, Dashboard, Board editing, or Display assignment — that's Wednesday's work, now unblocked by tonight's domain modules.
- **P1**: `package.json` version (`1.0.2`) vs. latest git tag (`v1.0.7`) drift, carried over from Session 2, still unresolved.

**No commit, no push, no tag, no deploy, no migration, no production mutation this session.**
