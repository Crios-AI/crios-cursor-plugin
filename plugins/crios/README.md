# Crios

Cursor plugin that calls the Crios HTTP API (`/api/v1`) for projects, build sessions, workflows, and connectors.

The default origin is [https://crios.ai](https://crios.ai). Requests go to `https://crios.ai/api/v1` unless `CRIOS_BASE_URL` is set to another app or API origin. Set **Crios personal access token** (`CRIOS_TOKEN`) in Plugins → Configure. It is a `crios_pat_` token from Settings → API tokens. Workflow calls need a full-access token. Cursor passes the configured values into the MCP server; they are not shell variables.

The MCP server is `mcp/server.mjs`. It reads those environment variables and does not mint tokens. The repository README has install steps and the command list.
