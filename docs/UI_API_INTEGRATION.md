# Scena UI API Integration Contract

Status: **production-backend verified for Workspace context, Asset ingestion, and Board drafts**.

This document is the frontend integration boundary for the first Scena UI. It
describes what the production APIs support now, what the browser client must
call, and which controls must remain hidden.

## Production endpoints

All manager endpoints use the signed-in Supabase JWT and JSON `POST` requests.

| Function | Purpose | JWT |
|---|---|---|
| `workspace-context` | Load all authorized Workspaces and persist the selected Workspace | Required |
| `asset-upload` | Create, finalize, list, inspect, sign, and archive Assets | Required |
| `board-interaction` | Create, list, load, save, revise, and archive Board drafts | Required |
| `media-worker` | Outbound-only Proxmox worker queue | Dedicated worker token, never browser-callable |

The browser must use the typed modules under `src/services/scena-api`. It must
not call the legacy `presentation-upload` path for new Asset work and must not
call the undeployed planned `scena-api/v2/*` router.

## Workspace bootstrap

`workspace-context` actions:

```json
{ "action": "get" }
```

```json
{ "action": "select", "workspace_id": "uuid" }
```

`get` returns the profile, every active Personal or Team Workspace membership,
entitlements for each Workspace, and the selected Workspace. When an
authenticated account has no Workspace because initial provisioning did not
complete, the endpoint safely invokes the idempotent Personal Workspace
provisioner and reloads the context.

`select` requires an active membership and persists
`user_preferences.last_org_id`. Resource APIs still require an explicit
`workspace_id`; the selected Workspace is a UI preference, not an authorization
shortcut.

## Asset flow

The supported UI upload types are:

- Images
- PDF
- PowerPoint (`.ppt` and `.pptx`)

Maximum source size is 250 MB. Video, audio, and font upload controls remain
hidden until their worker job types are implemented.

Canonical browser flow:

```text
create
→ PUT source to signed private Storage URL
→ finalize
→ poll get
→ ready or failed
→ signed_read thumbnail/source_render
```

A failed upload before `finalize` does not consume monthly source-upload quota.
A finalized source upload does consume quota, and deleting or archiving it does
not refund quota.

## Board flow

The first UI may expose:

- List Boards
- Create Board
- Load snapshot
- Save snapshot using `base_version`
- Handle `BOARD_VERSION_CONFLICT`
- Create and list revisions
- Archive Board

Supported draft elements include static text/image/shape/Asset Page and the
existing live element types. The editor must preserve the Element
`render_mode`, geometry, visibility, lock state, Asset references, and `config`.

There is no manager publication endpoint in this release. **Publish controls
must remain hidden.** `board_publications` existing in the schema does not make
publication a browser capability.

## Stable errors

`src/services/scena-api/client.ts` preserves:

```text
error.code
error.message
error.request_id
error.details
HTTP status
```

The UI should branch on error codes, not message text. In particular:

- `UNAUTHENTICATED`
- `WORKSPACE_ACCESS_DENIED`
- `WORKSPACE_SUSPENDED`
- `EDITOR_ROLE_REQUIRED`
- `ASSET_UPLOAD_LIMIT_REACHED`
- `ASSET_TOO_LARGE`
- `UPLOAD_INCOMPLETE`
- `ASSET_NOT_FOUND`
- `VARIANT_NOT_FOUND`
- `BOARD_LIMIT_REACHED`
- `BOARD_VERSION_CONFLICT`
- `BOARD_VALIDATION_FAILED`

## Acceptance evidence

The production acceptance path completed from the public Scena website,
including an upload from outside the home network:

```text
authenticated production browser
→ private Supabase Storage
→ queued processing job
→ outbound-only Proxmox worker
→ three processed variants
→ Asset ready
→ signed processed-object read
```

The pre-UI API acceptance also passed unauthenticated rejection, cross-Workspace
isolation, Asset listing/detail/preview, Board create/load/save/reload,
optimistic conflict, revision creation/listing, archive, and cleanup.

## UI capability switches

Use `SCENA_UI_API_CAPABILITIES` instead of duplicating backend assumptions in
components. The current required values are:

```text
image/PDF/PowerPoint upload: enabled
Board draft CRUD and revisions: enabled
Board publishing: disabled
video/audio/font ingestion: disabled
scene rendering: disabled
```
