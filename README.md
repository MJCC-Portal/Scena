# Scena

Repository: https://github.com/MJCC-Portal/Scena

## Supabase MCP

This project is configured for the Supabase MCP server, scoped to project
`zglbgqeccebqnijcqfkb`. It does not configure, link, or invoke the Supabase
CLI.

Set these variables in the environment used by your MCP client:

```text
SUPABASE_PROJECT_REF=zglbgqeccebqnijcqfkb
SUPABASE_ACCESS_TOKEN=<your Supabase PAT>
```

Claude Code can load the project configuration from `.mcp.json`; authenticate
or reload the MCP connection after setting the variables. Other MCP-capable
clients should use the same project `.mcp.json` configuration.

## Project AI worker

Agy (Antigravity) is the primary CLI AI for this project. Claude Code is the
implementation/review partner, with Codex supervising and OpenCode/MiMo used
for bounded delegated work. Supabase database work uses the project-scoped
MCP connection; the Supabase CLI is not part of the normal Scena workflow.

The live SSO API is deployed, but the final browser redirect remains gated on
assigning Scena a production website URL and setting `MARQUEE_SSO_URL` in the
KpnCompute production service.
