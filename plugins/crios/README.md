# Crios

Cursor plugin that connects to the hosted Crios MCP server at [https://mcp.crios.ai/mcp](https://mcp.crios.ai/mcp).

The product home is [https://crios.ai](https://crios.ai). Set **Crios personal access token** (`CRIOS_TOKEN`) in Plugins → Configure. It is a `crios_pat_` token from Settings → API tokens. Cursor sends that value as the Authorization bearer header. Workflow tools need a full-access token.

The bundled REST client in `mcp/` defaults to `https://api.crios.ai` (`https://api.crios.ai/api/v1`). `CRIOS_BASE_URL` overrides that origin when the client is run directly. Cursor does not start that process, and the base URL does not change the MCP address. The repository README has install steps and the command list.
