# Crios

Cursor plugin that calls the Crios HTTP API (`/api/v1`) for projects, build sessions, workflows, and connectors.

The default origin is [https://crios.ai](https://crios.ai). Requests go to `https://crios.ai/api/v1` unless `CRIOS_BASE_URL` is set to another app or API origin. `CRIOS_TOKEN` is a `crios_pat_` personal access token from Settings → API tokens. Workflow calls need a full-access token.

The MCP server is `mcp/server.mjs`. It reads those environment variables and does not mint tokens. The repository README has install steps and the command list.
