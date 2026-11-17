---
name: use-crios
description: Use when working with Crios from Cursor, including projects, build sessions, workflows, and connectors. Cursor connects to https://mcp.crios.ai/mcp. The product home is https://crios.ai.
---

# Use Crios

Crios is the product at https://crios.ai. Cursor connects to the hosted MCP server at `https://mcp.crios.ai/mcp`. That is the only MCP address this plugin declares.

## Before calling

1. Authentication is the **Crios personal access token** field (`CRIOS_TOKEN`) in Plugins → Configure. Create it under Settings → API tokens. It starts with `crios_pat_`. Cursor sends it as `Authorization: Bearer` to `https://mcp.crios.ai/mcp`. The hosted server also offers an OAuth sign-in that issues short-lived `crios_oat_` tokens; this plugin does not use that flow. Do not put an OAuth token in the Configure field.
2. Do not mint a token, and do not read `jwt-signing-key`. If the token is missing, tell the user to set Crios personal access token in Plugins → Configure. Do not tell them to set a shell variable, and do not invent a value.
3. The product home stays `https://crios.ai`. The bundled REST client, which Cursor does not start, defaults to `https://api.crios.ai` (`https://api.crios.ai/api/v1`). `CRIOS_BASE_URL` overrides that REST origin only. It does not change the MCP address.
4. Call the hosted tools. A fine-grained token with projects and sessions can list projects and start builds. Workflow, agent, and connector tools need a full-access token.

## Tools this plugin's commands use

| Tool | Use |
| --- | --- |
| `list_projects`, `create_project` | Projects visible to the token. Create one only when the user asks. |
| `start_build` | Start a build from the user's brief. |
| `get_session_status`, `wait_for_session` | Session state. Wait until the session rests or finishes. |
| `send_message` | Steer a session. |
| `workflow_list`, `workflow_run`, `execution_status` | List workflows, run one, then read the execution. |
| `credential_list` | Connector name, type, and status for one project. No secret values. |

The hosted server advertises more tools than this table. Use the tool the server lists when the user asks for it. Do not invent a second MCP URL.

## Build sessions

`start_build` plans with `plan_approval_mode: auto` unless the user asks to approve the plan first. Poll with `wait_for_session` or `get_session_status`. A round of work usually rests at `waiting_input` or `idle`. Report status, the pull request URL, cost, and any error when they are present.

## Workflows and connectors

`workflow_run` defaults to test mode (the draft). Use production only when the user explicitly asks to run the active version. Then read `execution_status`.

`credential_list` does not return secrets and this command does not create a connector. Connecting an account is done in the Crios UI.

## What not to do

- Do not delete projects, sessions, or workflows from these tools.
- Do not send the token anywhere except the Authorization header on `https://mcp.crios.ai/mcp`. The bundled REST client, if someone runs it, sends the token only to its API origin.
- Do not paste the token into the chat.
