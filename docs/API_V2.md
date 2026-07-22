# Scena API v2 — Index

Entry point and document map for Scena's engineering documentation. Restored 2026-07-22 after being deleted without replacement in v1.0.4 and not recreated in v1.0.5 (see [API_V2_PROGRESS.md](API_V2_PROGRESS.md) for the full history of that gap).

This index does not claim to be authoritative on its own — each linked document carries its own verification status (table below), and only the entries marked `live-verified` or `database-verified` should be treated as current fact without independently re-checking. Everything else is a documented claim with a known confidence level, not a ratified truth.

**Baseline for this document set:** [docs/sop/Purpose.md](sop/Purpose.md) and [docs/sop/Roadmap.md](sop/Roadmap.md) (business/product truth — service definition, roles, plans, customer-facing terminology, current roadmap stage) cross-checked directly against the live Supabase project (`mcp__supabase__list_tables`, `list_migrations`, `list_edge_functions`, `get_logs`) and the repo source (technical truth, including `git ls-files` where "does source exist at all" was in question). Where the SOP and the live system disagree, that disagreement is documented explicitly rather than silently resolved in either direction.

## Current stage

Per [Roadmap.md](sop/Roadmap.md) §17: **Stage 0, Foundation and First External Delivery.** No unrelated paying Team has completed onboarding yet. Full kiosk registration-and-pairing and scheduled-automation execution are not currently reachable in production — see the gaps below. Do not represent Scena as generally available until Stage 0's exit conditions (Roadmap.md §7) are met.

## Document map — verification status

Categories used below: **live-verified** (checked against a live deployed service this pass, e.g. `list_edge_functions`/`get_logs`), **database-verified** (checked against the live Supabase schema this pass), **source-verified** (checked against repo source this pass), **planned** (describes an unbuilt target, not a claim about current reality), **historical** (describes a past session's state, superseded by anything more recent — see its own notice), **not-yet-reverified** (introduced in v1.0.5, not independently re-checked this pass; treat with the same skepticism this pass applied to the files that were checked).

| Document | Covers | Verification status |
|---|---|---|
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | All 26 live `public` tables | database-verified (2026-07-22) |
| [API_V2_PROGRESS.md](API_V2_PROGRESS.md) | Engineering ledger, session by session | historical (Session 1) + source/live-verified (Session 2) — see the file's own historical notice |
| [api/v2/README.md](api/v2/README.md) | Edge function surface, protocols, schema mapping | live-verified + database-verified (2026-07-22), Board/Asset section marked as an open decision, not a finding |
| [api/v2/api-inventory.json](api/v2/api-inventory.json) | Per-function deployment status, planned v2 paths | live-verified (`list_edge_functions`, `get_logs`) for the `liveEdgeFunctions` block; `paths` block is planned, not verified |
| [api/v2/capability-matrix.json](api/v2/capability-matrix.json) | Per-feature live/planned status | live-verified (2026-07-22) |
| [api/v2/openapi.json](api/v2/openapi.json) | Planned v2 request/response contract | planned; not-yet-reverified; carries its own `_verification` block |
| [api/v2/error-catalog.json](api/v2/error-catalog.json) | Stable shared error codes | not-yet-reverified (spot-checked, no false claims found); carries its own `_verification` block |
| [api/v2/state-machines.json](api/v2/state-machines.json) | State transitions | source-verified for trigger names; not-yet-reverified for completeness; carries its own `_verification` block |
| [api/v2/schema-map.json](api/v2/schema-map.json) | Domain concept → table mapping | database-verified (2026-07-22); carries its own `_verification` block |
| [sop/Purpose.md](sop/Purpose.md) | Service definition, terminology, roles, plans | owner-maintained, not touched |
| [sop/Roadmap.md](sop/Roadmap.md) | Stage gates, expansion decision procedure | owner-maintained, not touched |

## What changed in this pass (2026-07-22, two rounds)

**Round 1:**
1. Corrected false `"live"` claims for `screen-register`, `screen-credential-rotate`, `presentation-callback`, `automations-run` (none are deployed, per `list_edge_functions`) — moved to `source_created` with the specific downstream capability each gap breaks documented.
2. Added `mjcc-sso-exchange` and `marquee-sso`, which were absent from the inventory entirely.
3. Restored `API_V2_PROGRESS.md` from the v1.0.3 git blob and appended a session entry.
4. Wrote a fresh, live-verified `DATABASE_SCHEMA.md`.
5. Flagged the Board/Asset naming question (new finding, not in the review that triggered this work).

**Round 2 — corrections to round 1 itself, after further review:**
6. **`marquee-sso`**: round 1 called it both "real source" (in chat) and "an empty directory" (in docs) — contradictory. Verified via `git ls-files`: no tracked implementation exists at all, in any commit. Corrected everywhere to "no tracked implementation source found," with the untracked-local-directory caveat stated precisely (git does not track empty directories, so its local presence or absence proves nothing about the repository).
7. **`mjcc-sso-exchange` "410 Gone"**: round 1 stated this as a current fact, sourced from a different session's historical log read. Re-verified this pass via `mcp__supabase__get_logs`: the currently deployed version (v9) returned `OPTIONS 404` at 2026-07-21T19:27 UTC; the `410` behavior was observed only at a superseded version (v4) at 2026-07-21T06:04 UTC. Corrected to report deployment/frontend-reference/runtime status as three separate facts, per docs/sop/Purpose.md §16.
8. **Board/Asset**: round 1 framed this as an unresolved "gap" implying new tables might be needed. The deleted v1.0.3 `docs/API_V2.md` had actually already recorded an explicit decision (Option A below) with a mapping table — that record was lost when the file was deleted, not superseded by a real Option-B decision. Reframed as two explicit options with no option approved during this pass — see [api/v2/README.md](api/v2/README.md#board--asset-naming-unresolved-architecture-decision-not-a-schema-gap) for the full mapping and the recovered v1.0.3 text.
9. Removed unqualified "authoritative" framing from this file and `api/v2/README.md`; added the verification-status table above instead.
10. Re-verified or explicitly labeled `openapi.json`, `error-catalog.json`, `state-machines.json`, `schema-map.json` — see the table above and each file's own `_verification` block.
11. Added a historical/supersession notice to the top of the restored `API_V2_PROGRESS.md` content.

**Neither round:** created `resources/*.md`/`workflows/*.md` files, a standalone role matrix, a standalone plan matrix (already fully specified in `sop/Purpose.md` §6–7 and verified to match the database — see DATABASE_SCHEMA.md §1), or split `openapi.json` into target/live variants. A prior review referenced a "prior owner prompt" specifying a ~40-file tree that this session has no access to; per the owner's direction, this work used the SOPs and live database as the baseline instead.

## Board / Asset naming

Full detail, the recovered v1.0.3 mapping table, and the two-option framing: [api/v2/README.md § Board / Asset naming](api/v2/README.md#board--asset-naming-unresolved-architecture-decision-not-a-schema-gap). Summary: **no schema option has been approved.** Option A (canonical terms as an alias layer over `display_layouts`/`display_layout_tiles`/`presentation_assets`) has prior-recorded precedent from v1.0.3 but was never re-ratified after that document was deleted. Option B (new, distinct tables) has not been chosen either. This document set must not be read as having picked one.

## Live-vs-planned-vs-source status vocabulary

Per [sop/Purpose.md](sop/Purpose.md) §16 ("claim an endpoint is live because source code exists" and "claim a deployment works merely because deployment succeeded" are both listed as prohibited workarounds), this document set uses distinct states, defined once in `api/v2/api-inventory.json`'s `statusLegend`: `planned`, `source_created`, `deployed_unused`, `live`, `not_in_repository`. None of these are synonyms for "functionally verified end to end" — see API_V2_PROGRESS.md for what has and hasn't been click-tested. Deployment, frontend-reference, and runtime-behavior status are tracked as three separate facts for functions where they diverge (see `mjcc-sso-exchange`'s entry in `api-inventory.json`), not collapsed into one label.

## Open follow-ups (not done in this pass)

- `openapi.json`, `error-catalog.json`, `state-machines.json` carry `_verification` blocks marking them `not_reverified` — a future pass should either verify them fully or keep re-stating that caveat; it must not silently drop it.
- No `audit_events` or `idempotency_keys` table exists live; DDL was drafted in an earlier session (see API_V2_PROGRESS.md Session 1 Phase 2) but never applied. Applying it is a separate, explicit decision — not implied by any documentation pass.
- The Board/Asset naming decision (Option A vs. B, above) is unresolved and needs an explicit owner call before the `scena-api` router is built against either `/v2/boards` or `/v2/layouts` as canonical.
- `package.json` `"version"` currently reads `1.0.2`, while the latest git tag is `v1.0.5` — a real, pre-existing drift, not something this pass caused or corrected (out of scope for a docs pass; flagged here so it isn't lost).
- Repository validation (contract-validation script, `vitest`, `tsc`, `build`) was run after these corrections — see the session report for results.
