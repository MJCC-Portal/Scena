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

## Local development on Windows network storage

The repository lives on an SMB share (mapped as `S:\Scena`). Windows refuses
to load native binaries from network paths, so the toolchain is configured to
avoid them:

- `package.json` overrides `rollup` with `@rollup/wasm-node` (pure-JS/WASM
  build, no `.node` DLL). Keep this override; removing it breaks
  `npm.cmd run build` on the share.
- esbuild still ships a native `esbuild.exe` that cannot spawn from the
  share. Copy it to a local path once and point `ESBUILD_BINARY_PATH` at it:

```powershell
Copy-Item S:\Scena\node_modules\@esbuild\win32-x64\esbuild.exe $env:LOCALAPPDATA\scena-esbuild.exe -Force
$env:ESBUILD_BINARY_PATH = "$env:LOCALAPPDATA\scena-esbuild.exe"
```

Then the standard commands work from the mapped drive:

```powershell
npm.cmd run dev     # local development server
npm.cmd run build   # tsc -b && vite build
npx.cmd tsc -b      # type check only
```

## Project AI worker

Agy (Antigravity) is the primary CLI AI for this project. Claude Code is the
implementation/review partner, with Codex supervising and OpenCode/MiMo used
for bounded delegated work. Supabase database work uses the project-scoped
MCP connection; the Supabase CLI is not part of the normal Scena workflow.

The live SSO API is deployed, but the final browser redirect remains gated on
assigning Scena a production website URL and setting `Scena_SSO_URL` in the
KpnCompute production service.

The implementation sequence is maintained in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).
