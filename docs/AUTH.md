# Scena authentication contract

## Authority

KpnCompute MJCC is the central identity authority for manager accounts. Scena
does not create independent manager passwords or use email as the identity key.
The immutable key is the MJCC user ID (`external_user_id`). Email and display
name are profile attributes only.

The initial organization is `mjcc`. Every manager account must have both:

- a row in `public.organization_members`; and
- a matching `public.external_identities` row with `provider = 'mjcc'`.

## Browser flow

1. The Scena login screen presents **Continue with MJCC**.
2. The browser opens the KpnCompute MJCC sign-in surface.
3. KpnCompute authenticates the user and creates a single-use, 60-second code.
4. The browser returns to Scena with the code in the URL fragment, then
   immediately removes it from browser history.
5. The Scena Edge Function sends the code to the KpnCompute exchange endpoint
   over a server-to-server secret and receives the MJCC user ID and role.
6. The Edge Function creates or resolves the local Supabase Auth user by the
   immutable MJCC ID, upserts the organization membership/identity mapping,
   and returns a short-lived Supabase session to the browser.

The browser never receives the KpnCompute exchange secret, service-role key,
raw handoff record, or access-code hash.

## Authorization rules

- Manager authorization comes from `organization_members`, not editable user
  metadata or email matching.
- Kiosk access codes are separate from manager SSO. A kiosk never receives a
  manager session or organization credential.
- If KpnCompute marks an MJCC account inactive or removes its Scena scope,
  new handoffs fail closed. Existing local sessions must be revalidated on the
  server before sensitive manager actions.

## Required configuration

The Scena Edge Function will require:

- `MJCC_SSO_EXCHANGE_URL`
- `MJCC_SSO_SECRET`
- the standard Supabase function secrets (`SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`)

These values belong in the function secret store, never in `.env.example` or
browser JavaScript.
