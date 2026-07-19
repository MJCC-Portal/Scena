# Scena full-project handoff summary

This is the full-project continuation handoff, not merely a storage handoff. Claude should use it with `AGENTS.md`, `CLAUDE.md`, and `docs/BUILD_PLAN.md`.

## Current project state

Scena is a website with two surfaces: an MJCC manager portal and a kiosk display interface. Sessions originate in the manager portal and are managed there. Kiosks use a separate access-code flow to begin a display stream.

The repository is at `\\192.168.1.126\\projects\\Scena`.

The agreed product is a website named Scena with two connected surfaces:

- A manager portal where MJCC staff sign in, create/manage scenes, start sessions, configure displays, and upload presentation assets.
- A kiosk/display interface where a display operator enters an access code to begin the authorized display stream.

PowerPoint import is part of the planned storage and presentation pipeline. It is not complete merely because the manager shell or scene editor exists.

## Work completed so far

- Scena repository and project operating rules are established.
- User-facing branding was corrected from the earlier working name to Scena.
- The manager portal shell and initial scene editor/CRUD slice were implemented.
- MJCC/KpnCompute was selected as the centralized identity authority.
- Scena's server-side `mjcc-sso-exchange` Edge Function and the MJCC launch flow exist.
- Organization scope is `mjcc`; kiosk access codes remain a separate flow.
- RLS is required for user-facing Scena data, and Supabase work uses the project MCP rather than the Supabase CLI.
- KpnCompute's current generic SSO bridge is app-scoped and uses the internal compatibility slug `marquee`; this must not be renamed casually while the product is branded Scena.
- The next major implementation area is session lifecycle, display access, PowerPoint asset import/storage, processing, and deployment verification.

## Plan position

The governing `docs/BUILD_PLAN.md` is authoritative. Its immediate next slice is **Phase 0 completion plus Phase 1 manager shell and organization context**: assign the production URL, finish the final SSO callback configuration, replace the temporary authenticated screen, and add organization/role context. The first scene CRUD/editor slice exists at commit `5a10ce3`, but that does not close the Phase 0/Phase 1 gates.

After those gates, continue Phase 2 scene hardening, then Phase 3 session control (start/stop/lifecycle), Phase 4 kiosk access codes, Phase 5 live display synchronization, Phase 6 operational hardening, and finally Phase 7 feature expansion such as PowerPoint processing.

Do not skip directly to PowerPoint processing while the Phase 0/Phase 1 gates, session ownership, kiosk authorization, and RLS verification remain incomplete.

Project operating rules are in `AGENTS.md` and `CLAUDE.md`; they are intentionally identical. The build sequence is `docs/BUILD_PLAN.md`.

## Existing KpnCompute/MJCC implementation to reuse

The live KpnCompute implementation uses an app-scoped generic SSO bridge:

- `backend/routes/auth.py` contains the generic `/api/auth/sso/{app}/start` and `/api/auth/sso/{app}/exchange` flow.
- The app allowlist currently uses the internal compatibility app key `marquee`.
- The app configuration maps a scope key, server-only secret environment variable, callback URL environment variable, and HMAC context.
- SSO start checks the authenticated MJCC user's role/scope before creating a one-time handoff.
- Handoffs are stored server-side, expire quickly, and are exchanged once.
- Exchange checks the app secret, expiry, target app, and the user's current scope again.
- KpnCompute's frontend starts the app-scoped handoff from the authenticated portal.
- Existing tests are in `backend/tests/test_generic_sso.py`.

Scena consumes this bridge through the server-only `mjcc-sso-exchange` Supabase Edge Function. The browser must never receive the KpnCompute exchange secret, Supabase service-role key, or storage root credentials.

Do not rename the internal `marquee` compatibility slug casually. User-facing copy and product branding must say Scena; any slug migration requires coordinated KpnCompute, Edge Function, database, test, and deployment changes.

## Current Scena implementation

- Login UI presents “Continue with MJCC.”
- Manager identity is organization-scoped to `mjcc`.
- Kiosk access codes are a separate boundary.
- Scene CRUD/editor work exists in `src/lib/scenes.ts` and the manager shell.
- Supabase work must use the project-scoped MCP; do not use the Supabase CLI for normal database changes.
- RLS is required for all user-facing Scena data.

## Storage product contract

Authenticated MJCC users with Scena access must be able to push PowerPoint files from the manager portal. The intended flow is:

1. User signs in through MJCC/KpnCompute SSO.
2. Scena backend verifies the organization and Scena scope.
3. Backend creates a short-lived signed upload URL for the private storage bucket.
4. Browser uploads directly to storage using that URL.
5. Backend records the object, owner, organization, scene relationship, MIME type, size, checksum, and processing status.
6. A worker can later convert the PowerPoint into display-ready assets.
7. Kiosks receive only authorized short-lived display URLs.

No public write bucket, public storage root, browser-held admin key, or LAN-IP-only authorization is acceptable.

## Live KpnCompute scope proof

Verified with the Supabase CLI against the linked production project `MJCCv1` (`mgvyylvmkxhhataavqjz`) on 2026-07-18. The read-only query returned:

```text
permission_scopes:
  lioncafe  active=true  min_role=manager
  marquee   active=true  min_role=manager

role_permissions:
  lioncafe  admin    allowed=true
  lioncafe  manager  allowed=true
  lioncafe  sudo     allowed=true
  marquee   admin    allowed=true
  marquee   manager  allowed=true
  marquee  sudo      allowed=true
```

Production also contains `public.sso_handoffs` with RLS enabled and forced. Migration history records `generic_sso_handoffs` as applied remotely under version `20260718225349`. This is live database evidence, not a claim based on Markdown or source files.

## Proxmox execution state

The operator supplied a pre-approved execution brief for new VM 110, but `scena-storage-proposal.md` is currently missing from the Scena workspace and was not found under `\\192.168.1.126\\projects`. Infrastructure work is therefore paused before pre-flight. This handoff does not authorize Codex to execute the infrastructure. Once the proposal is placed in the same folder, Claude should prepare the gated execution for the operator:

- Read it completely.
- Verify SSH to `root@192.168.1.200`.
- Check VMID 110 does not exist.
- Check `192.168.1.130` and the AdGuard lease state.
- Read LXC 106's LAN IP.
- Confirm storage pools `local` and `drive2`.
- Ask the operator for `ADMIN_IP_1`, `ADMIN_IP_2`, and `CONNECTOR_IP` if not safely discoverable.
- Print exact commands and wait before every §8 section.

The known controller/admin IPs are:

- `ADMIN_IP_1=192.168.1.65` — this Codex workstation
- `ADMIN_IP_2=192.168.1.64` — operator laptop
- `CONNECTOR_IP` — still required from LXC 106's LAN address

Never change port 8006, host networking, existing guests, existing disks, bridges, or host firewall rules.

## Handoff instructions to Claude

First report whether the proposal is present. If absent, do not execute infrastructure commands. If present, perform only the gated proposal workflow. Keep secrets out of all output and report paths only. At completion, return evidence for all six §7 tests and list any remaining Scena code integration work separately from completed infrastructure work.
