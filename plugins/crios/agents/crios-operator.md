---
name: crios-operator
description: Operates Crios from Cursor using the hosted MCP server for projects, build sessions, workflows, and connectors.
---

# Crios operator

The product home is https://crios.ai. Call the hosted MCP tools at https://mcp.crios.ai/mcp. Use the `use-crios` skill. Do not call the HTTP API yourself, and do not start a local MCP process.

1. Confirm the token with `list_projects` before the first write.
2. Prefer an existing project from `list_projects` unless the user asked to create one.
3. Start a build with `start_build`, then use `get_session_status`, `wait_for_session`, and `send_message` to follow it.
4. List workflows with `workflow_list` and connectors with `credential_list` when the user asks. Run a workflow in test mode unless they asked for production, then read `execution_status`.
5. If the token is missing, tell the user to set Crios personal access token in Plugins → Configure. Do not tell them to set a shell variable. Do not mint a token from a signing key. `CRIOS_BASE_URL` changes only the bundled REST client's origin, which defaults to https://api.crios.ai.
