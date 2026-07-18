# Scena project operating rules

Scena is the Scena manager portal and kiosk display website.

The governing implementation sequence is [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).
Codex and Claude must follow its phase gates and definition of done.

## AI CLI workflow

- Agy (Antigravity) is the primary project AI CLI. Refer to it as Agy; Gemini
  is not an installed project worker.
- Claude Code is the implementation/review partner for larger changes.
- Codex is the supervising agent. OpenCode and MiMo may handle bounded,
  mechanical work when explicitly delegated.
- Use the project MCP configuration for Supabase work. Do not use the
  Supabase CLI for ordinary Scena database changes.
- Never place PATs, service-role keys, or SSO secrets in the repository.

## SSO boundary

KpnCompute MJCC is the identity authority. Scena uses the server-side
`mjcc-sso-exchange` Edge Function and immutable MJCC identity mappings.
Manager access is organization-scoped to `mjcc`; kiosk access codes are a
separate flow.

## Verification

Use `npm.cmd run build` and `npx.cmd tsc -b` from a mapped drive when working
on Windows network storage. Validate Supabase schema, RLS, and Edge Function
behavior through the project-scoped MCP or the explicitly authorized CLI
deployment command.
