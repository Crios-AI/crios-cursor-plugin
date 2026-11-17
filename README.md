# Crios Cursor plugin

Cursor plugin for [Crios](https://github.com/Crios-AI/crios). From the editor you can see who the token is, list and create projects, start a build session and check it, list workflows and run one, and list a project's connectors.

The plugin is a [Cursor plugin](https://cursor.com/docs/reference/plugins) in `plugins/crios`. A small Node MCP server calls the Crios HTTP API. It does not ship a token, and it does not mint one.

## What you need

- Node.js 18 or newer on `PATH` (`node`). Cursor starts the MCP server with `node`.
- The origin of your Crios API or web app.
- A personal access token from that instance: **Settings → API tokens → Generate new token**. The value starts with `crios_pat_` and is shown once.

Use a token that is not limited to a single project if you want to list every project. Workflow calls (`/api/v1/workflows`) need a **full-access** token. A fine-grained token with the **Projects** and **Sessions** scopes can list projects, start builds, and list project connectors. `GET /users/me` works with any token.

OAuth tokens (`crios_oat_`) are for the Crios MCP server only. This plugin calls the REST API and will refuse them. Do not mint a token from the deployment `jwt-signing-key`.

## Configure the base URL and token

Install the plugin, then set the two plugin variables. Cursor stores the values in plugin configuration. They are not written into this repository.

| Variable | Example | Meaning |
| --- | --- | --- |
| `CRIOS_BASE_URL` | `https://api.example.com` | API or app origin. `https://app.example.com` works too. A path ending in `/api/v1` is kept; otherwise `/api/v1` is added. No username, password, query, or fragment. |
| `CRIOS_TOKEN` | `crios_pat_…` | Personal access token. |

Hosted Crios uses `https://api.crios.ai`. A self-hosted app origin is the same host you open in the browser. `http://127.0.0.1:8080` is accepted for an instance on your machine.

In Cursor, open the installed plugin and choose **Configure** (Plugins → Configure). Fill in **Crios base URL** and **Crios personal access token**.

To run the server yourself:

```bash
export CRIOS_BASE_URL="https://api.example.com"
export CRIOS_TOKEN="crios_pat_..."
node plugins/crios/mcp/server.mjs
```

## Install

This repository is a one-plugin marketplace. The plugin directory is `plugins/crios` (manifest at `plugins/crios/.cursor-plugin/plugin.json`).

**Team marketplace.** An admin imports the Git repository from Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo. Teammates install **Crios** from Customize, then set the two variables.

**Local check.** Copy `plugins/crios` to `~/.cursor/plugins/local/crios` (the folder that contains `.cursor-plugin/plugin.json`). Restart Cursor or run Developer: Reload Window, then open Customize and confirm the Crios commands and the `crios` MCP server. A symlink to a checkout outside that folder is ignored. On Enterprise, local imports must be allowed.

The MCP server is `node ${CURSOR_PLUGIN_ROOT}/mcp/server.mjs`. Cursor substitutes the plugin root and the two variables.

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
