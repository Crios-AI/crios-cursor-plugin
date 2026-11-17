import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_ORIGIN, PRODUCT_HOME } from "./client.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pluginRoot, "../..");
const MCP_URL = "https://mcp.crios.ai/mcp";

const commandTools = {
  "crios-whoami": ["list_projects"],
  "crios-projects": ["list_projects", "create_project"],
  "crios-start-build": ["list_projects", "start_build", "send_message"],
  "crios-session": ["get_session_status", "wait_for_session", "send_message"],
  "crios-workflows": ["workflow_list", "workflow_run", "execution_status"],
  "crios-connectors": ["credential_list", "list_projects"],
};

test("marketplace and plugin manifests follow the template", async () => {
  const marketplace = JSON.parse(await readFile(path.join(repoRoot, ".cursor-plugin/marketplace.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(pluginRoot, ".cursor-plugin/plugin.json"), "utf8"));
  const mcp = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const cursorIgnore = await readFile(path.join(repoRoot, ".cursor/.gitignore"), "utf8");

  assert.equal(marketplace.name, "crios");
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, manifest.name);
  assert.equal(marketplace.plugins[0].source, "./plugins/crios");
  assert.equal(manifest.name, "crios");
  assert.equal(manifest.displayName, "Crios");
  assert.equal(manifest.logo, "assets/logo.svg");
  assert.equal(PRODUCT_HOME, "https://crios.ai");
  assert.equal(DEFAULT_ORIGIN, "https://api.crios.ai");
  assert.equal(manifest.homepage, PRODUCT_HOME);
  assert.notEqual(manifest.homepage, DEFAULT_ORIGIN);
  assert.equal(manifest.mcpServers, "./mcp.json");
  assert.equal(manifest.variables.properties.CRIOS_BASE_URL.default, DEFAULT_ORIGIN);
  assert.equal(manifest.variables.properties.CRIOS_TOKEN.title, "Crios personal access token");
  assert.deepEqual(manifest.variables.required, ["CRIOS_TOKEN"]);
  await readFile(path.join(pluginRoot, manifest.logo));

  const server = mcp.mcpServers.crios;
  assert.equal(server.url, MCP_URL);
  assert.equal(server.command, undefined);
  assert.equal(server.args, undefined);
  assert.equal(server.headers.Authorization, "Bearer ${CRIOS_TOKEN}");
  assert.equal(JSON.stringify(mcp).includes("server.mjs"), false);
  assert.equal(JSON.stringify(mcp).includes("crios_oat_"), false);
  assert.match(cursorIgnore, /^plans\//);
});

test("commands, the skill, and the agent name real tools", async () => {
  const commandDir = path.join(pluginRoot, "commands");
  const files = (await readdir(commandDir)).filter((name) => name.endsWith(".md")).sort();
  assert.deepEqual(files, Object.keys(commandTools).map((name) => `${name}.md`).sort());

  const mentioned = new Set();
  for (const file of files) {
    const content = await readFile(path.join(commandDir, file), "utf8");
    const frontmatter = parseFrontmatter(content);
    const stem = file.replace(/\.md$/, "");
    assert.equal(frontmatter.name, stem, file);
    assert.ok(frontmatter.description.length > 10, file);
    for (const tool of commandTools[stem]) {
      assert.match(content, new RegExp(`\\b${tool}\\b`), `${file} should name ${tool}`);
      mentioned.add(tool);
    }
  }

  const skill = await readFile(path.join(pluginRoot, "skills/use-crios/SKILL.md"), "utf8");
  const skillFrontmatter = parseFrontmatter(skill);
  assert.equal(skillFrontmatter.name, "use-crios");
  assert.match(skillFrontmatter.description, /projects|sessions|workflows|connectors/);
  assert.match(skill, /https:\/\/crios\.ai/);
  assert.match(skill, /https:\/\/api\.crios\.ai/);
  assert.match(skill, /https:\/\/mcp\.crios\.ai\/mcp/);
  for (const tool of mentioned) {
    assert.match(skill, new RegExp(`\\b${tool}\\b`), `skill should document ${tool}`);
  }

  const agent = await readFile(path.join(pluginRoot, "agents/crios-operator.md"), "utf8");
  const agentFrontmatter = parseFrontmatter(agent);
  assert.equal(agentFrontmatter.name, "crios-operator");
  assert.match(agent, /https:\/\/crios\.ai/);

  const rule = await readFile(path.join(pluginRoot, "rules/crios-credentials.mdc"), "utf8");
  assert.match(parseFrontmatter(rule).description, /token/i);
  assert.match(rule, /https:\/\/crios\.ai/);
  assert.match(rule, /https:\/\/api\.crios\.ai/);
  assert.match(rule, /https:\/\/mcp\.crios\.ai\/mcp/);
  assert.match(rule, /jwt-signing-key/);
  assert.match(rule, /Plugins → Configure/);
  assert.match(skill, /Plugins → Configure/);
  const whoami = await readFile(path.join(commandDir, "crios-whoami.md"), "utf8");
  assert.match(whoami, /Crios personal access token/);

  assert.ok(mentioned.has("list_projects"));
  assert.ok(mentioned.has("start_build"));
  assert.ok(mentioned.has("credential_list"));
});

function parseFrontmatter(content) {
  assert.match(content, /^---\n/);
  const end = content.indexOf("\n---\n", 4);
  assert.notEqual(end, -1);
  const fields = {};
  for (const line of content.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return fields;
}
