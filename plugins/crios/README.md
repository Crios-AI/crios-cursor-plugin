# Crios

Cursor plugin that calls a Crios instance's HTTP API (`/api/v1`) for projects, build sessions, workflows, and connectors.

Set `CRIOS_BASE_URL` (API or app origin, such as `https://api.example.com`) and `CRIOS_TOKEN` (a `crios_pat_` personal access token from Settings → API tokens) in the plugin configuration. Workflow calls need a full-access token. The repository README has install steps and the command list.

The MCP server is `mcp/server.mjs`. It reads those two environment variables and does not mint tokens.
