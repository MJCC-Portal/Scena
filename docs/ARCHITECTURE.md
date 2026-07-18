# Marquee MVP architecture

Marquee is one website with two surfaces:

- **Manager portal:** authenticated managers create and control display sessions.
- **Kiosk interface:** a display-only page where a kiosk enters a temporary access code to begin a session stream.

The manager portal is the control plane. A kiosk never receives manager permissions, a service key, or a permanent organization credential.

## MVP flow

1. A manager creates or activates a session for their organization.
2. Marquee creates a short-lived access code for that session.
3. The kiosk submits the code to an Edge Function.
4. The Edge Function verifies the code, applies expiry and attempt limits, and issues a short-lived display credential containing the session identity.
5. The kiosk reads only the active session and its assigned scene through RLS-protected APIs/Realtime.
6. The manager can stop or replace the session; the display credential is rejected when the session is inactive or revoked.

## Tenancy boundary

Every manager-owned record carries `org_id`. Manager policies resolve access through `organization_members` and `auth.uid()`. Kiosk policies resolve access through a server-issued display-session claim; the access-code hash and display credentials are never readable by kiosk clients.

The initial schema intentionally covers only tenancy, sessions, scenes, and a menu payload. Queue, slideshow conversion, YouTube, and layout-specific tables should arrive with the feature that needs them.

## Remote application rule

Schema changes are applied through the PAT-backed Supabase MCP session for
project `zglbgqeccebqnijcqfkb`. The Supabase CLI remains excluded from this
project workflow. The live database is treated as production: apply only
reviewed SQL, then verify tables, RLS, policies, and row counts through MCP.

## Manager-auth SSO (MJCC / KpnCompute)

Managers authenticate through KpnCompute/MJCC, the central identity source, via a short-lived one-time handoff -- the same shape as the existing Lunchvoice SSO. `0002_marquee_mjcc_sso.sql` adds an immutable `mjcc_identities` mapping (keyed by `mjcc_user_id`, never email), a `mjcc_org_links` table so org/role are resolved server-side rather than trusted from the client, and a `mjcc_sso_handoffs` table enforcing one-time-use. The server-only `mjcc-sso-exchange` Edge Function performs the exchange and issues a local Supabase Auth session compatible with the existing client. See `docs/MJCC_SSO.md` for the full design, the explicit (and only partially confirmed) KpnCompute interface contract, and remaining integration work.
