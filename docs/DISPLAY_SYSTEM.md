# Display system

## Persistent physical screens

A `screens` row is a durable, reusable device identity, not a temporary
browser connection — the model this rebuild replaced (`display_connections`)
conflated the two. A screen survives across sessions: claim it once, use it
in any number of future sessions until revoked.

## Pairing codes (30 minutes)

`screen-register` mints a 6-digit code and stores only its SHA-256 hash
(`screen_pairing_codes.code_hash`, globally unique). Expiry is both
application-set (`expires_at = now() + 30m`) and database-enforced
(`screen_pairing_codes_check1: expires_at <= created_at + 30m`) — an Edge
Function bug couldn't accidentally issue a longer-lived code.

## Pairing attempt tracking / code lockout

`attempt_count`/`locked_until` live on the pairing-code row itself, keyed by
the row a manager's submitted code hashes to. Because the code is looked up
by its unique hash (not enumerated), an attacker can't attribute failed
guesses to a specific row without already having guessed correctly — so
these fields protect against a manager hammering retries on one stale/
expired code, not against brute-forcing the 6-digit space. That space's real
defense is the 30-minute expiry plus single-use consumption. `screen-claim`
increments `attempt_count` and sets a 15-minute `locked_until` after
`MAX_ATTEMPTS = 5` on a found-but-expired code.

## Device-token hashing

`screens.device_token_hash` stores SHA-256 of the raw token; the raw value
is returned to the kiosk exactly once (at registration or rotation) and
never again. `display-gateway` hashes the token it receives and does an
exact-match lookup — no raw token is ever compared or logged in plaintext.

## Device-token rotation

`screen-credential-rotate` (manager-triggered) generates a new token,
updates `device_token_hash` in a single statement. Because that column is
`unique`, the update is atomic from the old kiosk's perspective: the instant
the new hash commits, the old token can no longer match any row — verified
against the live database (rolled-back transaction) as part of this pass.

## Screen revocation

One-way: `status='revoked'`, `revoked_at` stamped. `display-gateway` checks
`status === 'revoked'` on every request and returns `SCREEN_REVOKED`
regardless of what the (now-orphaned) device token would otherwise resolve
to.

## Reusable screens

A `ready` screen can be added to any number of sessions over its lifetime
(`display_session_screens` rows reference it, each session's assignment
independently transitions through `configured`→`active`→`removed`). Stopping
a session releases the screen (`assignment_status='removed'`) without
touching the screen row itself — it's immediately eligible for the next
session.

## Session assignment / plan limits

Adding a screen to a session is validated by
`prepare_session_screen_assignment()`: screen must be `ready`, session must
not be `stopped`, and the count of non-removed screens **already in that
session** must be under `organization_entitlements.max_screens_per_session`
— personal plan = 1, plus = 5, pro ≥ 10 (the trigger reads the stored value,
never hardcodes it).

## The four display modes

- **`independent`** — each enabled screen has its own `layout_id`; no shared layout allowed (`display_sessions_check`).
- **`single`** — same layout resolution as `independent`, but exactly one screen may be enabled at a time.
- **`duplicate`** — every enabled screen shows the session's `shared_layout_id` in full; per-screen `layout_id` is ignored for rendering purposes.
- **`extend`** — every enabled screen shows the *same* `shared_layout_id`, but cropped to that screen's own `viewport_x/y/width/height_percent` — one canvas spread across multiple screens.

`resolveDisplayState` (`supabase/functions/_shared/displayState.ts`) is the
single function that implements all four — unit-tested for each mode plus
every standby reason (`no_active_session`, `screen_disabled`, `no_layout`)
in `src/display/resolveDisplayState.test.ts`.

## Layouts and tiles

A layout is a canvas (`canvas_width`/`canvas_height`/`background_color`); a
tile positions one scene within it (`x/y/width/height_percent`, `z_index`,
`is_visible`). Geometry is bounded twice — client-side
(`src/domain/layouts.ts#validateTileGeometry`, for a fast error) and
database-side (`display_layout_tiles_check`/`check1` and the individual
percent-range checks, the actual authority).

## Menu scenes / presentation scenes

`scenes.scene_type` is `menu` or `powerpoint`, each requiring exactly the
matching foreign key (`menu_id` xor `presentation_asset_id`) —
`scenes_check`. A menu scene resolves to the full rendered menu tree
(`getRenderableMenu`); a presentation scene resolves to a manifest reference
only once `presentation_assets.status = 'ready'`.

## Display-state resolution

See `ENGINE.md` § Layout / tile / scene / menu / presentation-manifest
resolution for the full walk-through.

## Broadcast invalidation / polling fallback / offline cache / reconnection / content refresh

See `SYSTEM_ARCHITECTURE.md` and `ENGINE.md` — summarized: every
display-affecting mutation broadcasts a hint on the org's Realtime Broadcast
channel; the kiosk re-fetches full authoritative state on any hint, on
(re)connect, and unconditionally every 4 seconds regardless. A fetch failure
serves the last cached "showing" payload instead of erroring; a fresh
response always replaces the cache atomically, never merges into it.

## LXC presentation manifests

`presentation_assets` stores `lxc_source_key`/`lxc_manifest_key` — pointers
into a private LXC presentation-processing service, not a Supabase Storage
path. `display-gateway` (via `resolveSceneContent`) hands the kiosk the
manifest key and slide count only; the kiosk is expected to fetch the actual
rendered assets from the LXC service directly using that manifest reference
(the manifest-consumption contract on the kiosk side is not yet built — see
`api-inventory.json` known limitations).
