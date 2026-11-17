---
name: crios-whoami
description: Show that the configured Crios personal access token can reach the hosted MCP server.
---

# Who am I in Crios

The hosted server has no separate whoami tool. Call `list_projects`.

If it succeeds, the personal access token was accepted. Report the projects it returns. If it fails because the token is missing, tell the user to open Plugins → Configure and set Crios personal access token. Do not tell them to set a shell variable, and do not ask them to paste the token into chat. Mention Crios base URL only when they are running the bundled REST client against another API origin. The product home is `https://crios.ai`. The MCP server is `https://mcp.crios.ai/mcp`.
