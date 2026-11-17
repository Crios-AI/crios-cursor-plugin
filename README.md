# Crios Cursor plugin

Cursor plugin for [Crios](https://github.com/Crios-AI/crios). From the editor you can list and create projects, start a build session and check it, list workflows and run one, and list a project's connectors.

The plugin is a [Cursor plugin](https://cursor.com/docs/reference/plugins) in `plugins/crios`. Cursor connects to the hosted MCP server. The plugin does not ship a token, and it does not mint one.

## What you need

- A personal access token: **Settings → API tokens → Generate new token**. The value starts with `crios_pat_` and is shown once.

Use a token that is not limited to a single project if you want to list every project. Workflow and connector tools need a **full-access** token. A fine-grained token with the **Projects** and **Sessions** scopes can list projects and start builds.

The hosted server can also sign a client in with OAuth and issue a short-lived `crios_oat_` token. Cursor plugins that take a static header use the personal access token instead. This plugin sends `Authorization: Bearer ${CRIOS_TOKEN}`. Do not paste an OAuth token into Configure, and do not mint a token from the deployment `jwt-signing-key`.

## Configure the token

Install the plugin, then set the token. Cursor stores the value in plugin configuration. It is not written into this repository.

| Variable | Example | Meaning |
| --- | --- | --- |
| `CRIOS_TOKEN` | `crios_pat_…` | Personal access token. Required. Cursor sends it as the bearer token to the hosted MCP server. |
| `CRIOS_BASE_URL` | `https://api.crios.ai` | Optional REST origin for the bundled client in `plugins/crios/mcp`. Defaults to `https://api.crios.ai`, and that client calls `/api/v1` on the origin. It does not change the MCP address. No username, password, query, or fragment. |

The Crios home page is `https://crios.ai`. The MCP server is `https://mcp.crios.ai/mcp`. The REST API root is `https://api.crios.ai/api/v1`.

In Cursor, open the installed plugin and choose **Configure** (Plugins → Configure). The field to fill is **Crios personal access token** (`CRIOS_TOKEN`). **Crios base URL** (`CRIOS_BASE_URL`) is optional and already `https://api.crios.ai`. Replace that only when running the bundled REST client against another API origin.

Cursor does not put those values in your shell. `mcp.json` puts `${CRIOS_TOKEN}` in the Authorization header. Set the token in Plugins → Configure.

## Install

This repository is a one-plugin marketplace. The plugin directory is `plugins/crios` (manifest at `plugins/crios/.cursor-plugin/plugin.json`).

**Team marketplace.** An admin imports the Git repository from Dashboard → Plugins & MCPs → Add Marketplace → Import from Repo. Teammates install **Crios** from Customize, then set the token.

**Local check.** Copy `plugins/crios` to `~/.cursor/plugins/local/crios` (the folder that contains `.cursor-plugin/plugin.json`). Restart Cursor or run Developer: Reload Window, then open Customize and confirm the Crios commands and the `crios` MCP server. A symlink to a checkout outside that folder is ignored. On Enterprise, local imports must be allowed.

The MCP entry in `plugins/crios/mcp.json` is:

```json
{
  "mcpServers": {
    "crios": {
      "url": "https://mcp.crios.ai/mcp",
      "headers": {
        "Authorization": "Bearer ${CRIOS_TOKEN}"
      }
    }
  }
}
```

## Commands

| Command | What it does |
| --- | --- |
| `crios-whoami` | Confirm the token by listing projects |
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

`npm test` talks to a local mock of `/api/v1` for the bundled REST client. It does not need a live Crios instance or a token. `npm run validate` checks the marketplace manifest, plugin manifest, and component frontmatter. Node.js 18 or newer is needed to run those checks. Cursor does not need Node to connect to the hosted MCP server.

## Scope

The plugin does not delete projects or sessions, does not connect a new third-party account, and does not call the instance admin API. Connecting an account stays in the Crios UI. Secrets are not printed; fields that look like tokens are redacted, and redirects are not followed.
