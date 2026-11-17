import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DEFAULT_ORIGIN } from "./client.mjs";
import { TOOLS } from "./tools.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(pluginRoot, "../..");
const toolNames = new Set(TOOLS.map((tool) => tool.name));

const commandTools = {
  "crios-whoami": ["whoami"],
  "crios-projects": ["list_projects", "get_project", "create_project"],
  "crios-start-build": ["list_projects", "start_build", "send_message"],
  "crios-session": ["get_session", "list_sessions", "send_message"],
  "crios-workflows": ["list_workflows", "run_workflow", "get_execution"],
  "crios-connectors": ["list_connectors", "list_projects"],
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
  assert.equal(manifest.homepage, DEFAULT_ORIGIN);
  assert.equal(manifest.variables.properties.CRIOS_BASE_URL.default, DEFAULT_ORIGIN);
  assert.deepEqual(manifest.variables.required, ["CRIOS_TOKEN"]);
  await readFile(path.join(pluginRoot, manifest.logo));

  const server = mcp.mcpServers.crios;
  assert.deepEqual(server.args, ["${CURSOR_PLUGIN_ROOT}/mcp/server.mjs"]);
  assert.equal(server.env.CRIOS_BASE_URL, "${CRIOS_BASE_URL}");
  assert.equal(server.env.CRIOS_TOKEN, "${CRIOS_TOKEN}");
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
      assert.ok(toolNames.has(tool), tool);
      mentioned.add(tool);
    }
  }

  const skill = await readFile(path.join(pluginRoot, "skills/use-crios/SKILL.md"), "utf8");
  const skillFrontmatter = parseFrontmatter(skill);
  assert.equal(skillFrontmatter.name, "use-crios");
  assert.match(skillFrontmatter.description, /projects|sessions|workflows|connectors/);
  assert.match(skill, /https:\/\/crios\.ai/);
  for (const tool of toolNames) {
    assert.match(skill, new RegExp(`\\b${tool}\\b`), `skill should document ${tool}`);
  }

  const agent = await readFile(path.join(pluginRoot, "agents/crios-operator.md"), "utf8");
  const agentFrontmatter = parseFrontmatter(agent);
  assert.equal(agentFrontmatter.name, "crios-operator");
  assert.match(agent, /https:\/\/crios\.ai/);

  const rule = await readFile(path.join(pluginRoot, "rules/crios-credentials.mdc"), "utf8");
  assert.match(parseFrontmatter(rule).description, /token/i);
  assert.match(rule, /https:\/\/crios\.ai/);
  assert.match(rule, /jwt-signing-key/);

  assert.ok(mentioned.has("whoami"));
  assert.ok(mentioned.has("start_build"));
  assert.ok(mentioned.has("list_connectors"));
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
