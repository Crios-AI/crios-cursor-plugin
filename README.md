# Crios Cursor plugin

Cursor plugin for [Crios](https://github.com/Crios-AI/crios). From the editor you can see who the token is, list and create projects, start a build session and check it, list workflows and run one, and list a project's connectors.

The plugin is a [Cursor plugin](https://cursor.com/docs/reference/plugins) in `plugins/crios`. A small Node MCP server calls the Crios HTTP API. It does not ship a token, and it does not mint one.

## What you need

- Node.js 18 or newer on `PATH` (`node`). Cursor starts the MCP server with `node`.
- A personal access token from that instance: **Settings → API tokens → Generate new token**. The value starts with `crios_pat_` and is shown once.

Use a token that is not limited to a single project if you want to list every project. Workflow calls (`/api/v1/workflows`) need a **full-access** token. A fine-grained token with the **Projects** and **Sessions** scopes can list projects, start builds, and list project connectors. `GET /users/me` works with any token.

OAuth tokens (`crios_oat_`) are for the Crios MCP server only. This plugin calls the REST API and will refuse them. Do not mint a token from the deployment `jwt-signing-key`.

## Configure the base URL and token

Install the plugin, then set the token. The base URL is optional. Cursor stores the values in plugin configuration. They are not written into this repository.

| Variable | Example | Meaning |
| --- | --- | --- |
| `CRIOS_BASE_URL` | `https://crios.ai` | App home, or another instance's origin. This is the default. The plugin derives the API root by adding `/api/v1` when the path does not already end there. No username, password, query, or fragment. |
| `CRIOS_TOKEN` | `crios_pat_…` | Personal access token. Required. |

The Crios home page is `https://crios.ai`. With no override, requests go to `https://crios.ai/api/v1`. Set `CRIOS_BASE_URL` for a self-hosted app, including `http://127.0.0.1:8080`.

In Cursor, open the installed plugin and choose **Configure** (Plugins → Configure). The field to fill is **Crios personal access token** (`CRIOS_TOKEN`). The base URL field is **Crios base URL** (`CRIOS_BASE_URL`); it is already `https://crios.ai`. Replace that only to use another instance.

Cursor does not put those values in your shell. `mcp.json` passes `${CRIOS_TOKEN}` and `${CRIOS_BASE_URL}` into the MCP server environment. Set them in Plugins → Configure.

## Install

This repository is a one-plugin marketplace. The plugin directory is `plugins/crios` (manifest at `plugins/crios/.cursor-plugin/plugin.json`).

**Team marketplace.** An admin imports the Git repository from Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo. Teammates install **Crios** from Customize, then set the token. The base URL stays `https://crios.ai` unless they change it.

**Local check.** Copy `plugins/crios` to `~/.cursor/plugins/local/crios` (the folder that contains `.cursor-plugin/plugin.json`). Restart Cursor or run Developer: Reload Window, then open Customize and confirm the Crios commands and the `crios` MCP server. A symlink to a checkout outside that folder is ignored. On Enterprise, local imports must be allowed.

The MCP server is `node ${CURSOR_PLUGIN_ROOT}/mcp/server.mjs`. Cursor substitutes the plugin root, the token, and the base URL when one is configured.

## Commands

| Command | What it does |
| --- | --- |
| `crios-whoami` | User, role, and organization for the token |
| `crios-projects` | List projects (create one only if you ask) |
| `crios-start-build` | Start a build session from a plain-language request |
| `crios-session` | Status, progress, cost, and pull request URL |
| `crios-workflows` | List workflows; run a test or, if you ask, a production execution |
| `crios-connectors` | Connector name, kind, and status for one project |

The agent can also get one project, send a steering message, and read a workflow execution. Build planning uses `plan_approval_mode: auto` unless you ask to approve the plan in Crios first. Workflow runs default to test mode.

## Check the plugin

```bash
npm test
npm run validate
```

`npm test` talks to a local mock of `/api/v1`. It does not need a live Crios instance. `npm run validate` checks the marketplace manifest, plugin manifest, and component frontmatter.

## Scope

The plugin does not delete projects or sessions, does not connect a new third-party account, and does not call the instance admin API. Connecting an account stays in the Crios UI. Secrets are not printed; fields that look like tokens are redacted, and redirects are not followed.
