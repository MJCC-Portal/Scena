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
