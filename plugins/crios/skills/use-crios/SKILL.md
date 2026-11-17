---
name: use-crios
description: Use when working with a Crios instance from Cursor, including projects, build sessions, workflows, and connectors. The default origin is https://crios.ai. Override it with CRIOS_BASE_URL, then call the Crios MCP tools.
---

# Use Crios

Crios is the product at https://crios.ai. This plugin talks to that origin's HTTP API at `/api/v1` unless another origin is configured.

## Before calling

1. The default origin is `https://crios.ai`, so the API root is `https://crios.ai/api/v1`. Set `CRIOS_BASE_URL` to use another app or API origin. The plugin adds `/api/v1` when that path is missing.
2. Authentication is the **Crios personal access token** field (`CRIOS_TOKEN`) in Plugins → Configure. The token is created under Settings → API tokens and starts with `crios_pat_`. Cursor passes that configured value into the MCP server.
3. Do not mint a token, and do not read `jwt-signing-key`. If the token is missing, tell the user to set Crios personal access token in Plugins → Configure. Do not tell them to set a shell variable, and do not invent a value.
4. Call `whoami` when a later call returns 401 or 403, and report the user, role, and organization from that result.

A fine-grained token with `projects` and `sessions` can list projects, start builds, and list project connectors. Workflow tools call `/workflows`, which needs a full-access token.

## Tools

| Tool | API |
| --- | --- |
| `whoami` | `GET /users/me` |
| `list_projects`, `get_project`, `create_project` | `GET/POST /projects` and `GET /projects/{id}` |
| `list_sessions`, `get_session` | `GET /sessions` or `GET /projects/{id}/sessions`, and `GET /sessions/{id}` |
| `start_build` | `POST /projects/{id}/sessions` |
| `send_message` | `POST /sessions/{id}/steer` |
| `list_workflows` | `GET /workflows` |
| `run_workflow` | `POST /workflows/{id}/executions` |
| `get_execution` | `GET /workflows/executions/{id}` |
| `list_connectors` | `GET /projects/{id}/connectors` |

## Build sessions

`start_build` sends `plan_approval_mode: auto` unless the user asks to approve the plan first. Planning can take up to two minutes. The response is the session, or a clarification (`requires_clarification`, `questions`) to answer with `send_message`.

Poll `get_session` every few seconds. Back off if Crios returns 429. A round of work usually ends at `waiting_input` or `idle`, not `completed`. Report `status`, `pr_url`, `branch_name`, `cost_usd`, and `error_message` when they are present.

## Workflows and connectors

`run_workflow` defaults to `mode: test` (the draft). Use `production` only when the user explicitly asks to run the active version. Then poll `get_execution`.

`list_connectors` returns names and status for one project. It does not return secrets and it does not connect a new account. Connecting an account is done in the Crios UI.

## What not to do

- Do not delete projects, sessions, or workflows from these tools. This plugin does not expose those calls.
- Do not send the token to any host other than `CRIOS_BASE_URL`.
- Do not paste the token into the chat.
