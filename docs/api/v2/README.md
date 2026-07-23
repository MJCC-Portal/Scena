# Scena API v2 Contracts and Live Functions

This directory contains both production contracts and planned v2 contracts.
Check each file's verification block before treating it as deployed.

## Live production functions

| Function | Auth | Role |
|---|---|---|
| `workspace-context` | Supabase JWT | Account and multi-Workspace bootstrap/selection |
| `asset-upload` | Supabase JWT | Asset upload, finalization, list/detail/read/archive |
| `board-interaction` | Supabase JWT | Board draft CRUD, versions, revisions |
| `media-worker` | Dedicated worker token | Outbound Proxmox queue worker |
| `billing-checkout` | Supabase JWT | Stripe Checkout |
| `billing-portal` | Supabase JWT | Stripe portal |
| `billing-webhook` | Stripe signature | Billing provisioning/synchronization |
| `screen-register` | Custom device flow | Display registration and pairing code |
| `screen-claim` | Supabase JWT | Manager Display claim |
| `display-gateway` | Device token | Kiosk state polling |
| `presentation-upload` | Supabase JWT | Legacy presentation path only |
| `mjcc-sso-exchange` | Supabase JWT | Deprecated compatibility deployment |

New frontend work uses native Supabase Auth and the Workspace, Asset, and Board
functions. It must not use `mjcc-sso-exchange`, `presentation-upload`, or the
planned `scena-api/v2/*` router.

## Source present but not production capabilities

- `screen-credential-rotate`
- `presentation-callback`
- `automations-run`

Their source does not make them available to the UI.

## UI API

`ui-integration.openapi.json` is the production browser contract. It documents:

- Workspace context and selection
- Asset create/upload/finalize/list/get/signed-read/archive
- Board list/create/get/save/revision/archive
- stable error envelopes
- explicit absence of Board publication

`media-and-boards.openapi.json` retains the worker protocol and detailed media
foundation.

## Planned central router

`openapi.json` describes a future manager router under:

```text
/functions/v1/scena-api/v2/*
```

No production frontend module may call it until the router is deployed and
accepted.

## Security boundaries

- Manager functions require a valid Supabase access token.
- Resource actions require explicit Workspace authorization.
- The worker token is stored only on the media VM and is never browser-visible.
- Stripe webhook authentication remains separate from manager authentication.
- Internal trigger/helper functions are not browser RPC endpoints.
