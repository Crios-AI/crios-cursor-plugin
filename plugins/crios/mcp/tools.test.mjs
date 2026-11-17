import assert from "node:assert/strict";
import test from "node:test";

import { CriosClient, CriosError } from "./client.mjs";
import { TOOLS, callTool } from "./tools.mjs";

const TOKEN = "crios_pat_test";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const WORKFLOW_ID = "55555555-5555-4555-8555-555555555555";
const EXECUTION_ID = "66666666-6666-4666-8666-666666666666";

test("each tool calls the documented Crios route", async () => {
  const cases = [
    ["whoami", {}, "GET", "/users/me", undefined],
    ["list_projects", {}, "GET", "/projects", undefined],
    ["get_project", { project_id: PROJECT_ID }, "GET", `/projects/${PROJECT_ID}`, undefined],
    ["create_project", { name: "Notes", description: "A notebook" }, "POST", "/projects", { name: "Notes", description: "A notebook" }],
    [
      "list_sessions",
      { project_id: PROJECT_ID, status: "working", limit: 5 },
      "GET",
      `/projects/${PROJECT_ID}/sessions`,
      undefined,
    ],
    ["get_session", { session_id: SESSION_ID }, "GET", `/sessions/${SESSION_ID}`, undefined],
    ["send_message", { session_id: SESSION_ID, message: "Ship it" }, "POST", `/sessions/${SESSION_ID}/steer`, { message: "Ship it" }],
    ["list_workflows", { project_id: PROJECT_ID, query: "ship", active: false, limit: 10 }, "GET", "/workflows", undefined],
    ["get_execution", { execution_id: EXECUTION_ID }, "GET", `/workflows/executions/${EXECUTION_ID}`, undefined],
    ["list_connectors", { project_id: PROJECT_ID }, "GET", `/projects/${PROJECT_ID}/connectors`, undefined],
  ];

  for (const [name, args, method, path, body] of cases) {
    const client = recorder({});
    const result = await callTool(client, name, args);
    assert.equal(result.isError, false, result.content[0].text);
    assert.equal(client.calls.length, 1, name);
    assert.equal(client.calls[0].method, method, name);
    assert.equal(client.calls[0].path, path, name);
    assert.deepEqual(client.calls[0].body, body, name);
  }
});

test("start_build and run_workflow use the safe defaults", async () => {
  const build = recorder({
    id: SESSION_ID,
    project_id: PROJECT_ID,
    status: "pending",
    session_type: "coding",
    requires_clarification: true,
    questions: ["Which page?"],
    message: "Need a page",
  });
  const started = await callTool(build, "start_build", {
    project_id: PROJECT_ID,
    natural_language: "Add CSV export",
  });
  assert.equal(started.isError, false);
  assert.equal(build.calls[0].path, `/projects/${PROJECT_ID}/sessions`);
  assert.deepEqual(build.calls[0].body, {
    natural_language: "Add CSV export",
    session_type: "coding",
    plan_approval_mode: "auto",
  });
  assert.equal(build.calls[0].timeoutMs, 120_000);
  assert.match(started.content[0].text, /Which page\?/);

  const workflow = recorder({ execution_id: EXECUTION_ID, status: "pending" });
  const ran = await callTool(workflow, "run_workflow", { workflow_id: WORKFLOW_ID });
  assert.equal(ran.isError, false);
  assert.deepEqual(workflow.calls[0].body, { mode: "test" });
  assert.equal(workflow.calls[0].timeoutMs, 30_000);

  const production = recorder({ execution_id: EXECUTION_ID, status: "running" });
  await callTool(production, "run_workflow", {
    workflow_id: WORKFLOW_ID,
    mode: "production",
    input: { ticket: "1" },
    wait: true,
  });
  assert.deepEqual(production.calls[0].body, { mode: "production", input: { ticket: "1" }, wait: true });
  assert.equal(production.calls[0].timeoutMs, 45_000);
});

test("invalid tool input is rejected before a request", async () => {
  const client = recorder({});
  const cases = [
    ["get_project", { project_id: "not-a-uuid" }, /UUID/],
    ["create_project", { name: "  " }, /name/],
    ["list_sessions", { status: "working" }, /project_id/],
    ["list_sessions", { limit: 0 }, /limit/],
    ["list_sessions", { limit: 1.5 }, /limit/],
    ["start_build", { project_id: PROJECT_ID, natural_language: "" }, /natural_language/],
    ["start_build", { project_id: PROJECT_ID, natural_language: "Go", session_type: "deploy" }, /session_type/],
    ["start_build", { project_id: PROJECT_ID, natural_language: "Go", plan_approval_mode: "never" }, /plan_approval_mode/],
    ["send_message", { session_id: SESSION_ID, message: "" }, /message/],
    ["list_workflows", { active: "yes" }, /boolean/],
    ["run_workflow", { workflow_id: WORKFLOW_ID, mode: "partial" }, /mode/],
    ["run_workflow", { workflow_id: WORKFLOW_ID, input: ["nope"] }, /object/],
    ["missing_tool", {}, /Unknown Crios tool/],
  ];

  for (const [name, args, pattern] of cases) {
    const result = await callTool(client, name, args);
    assert.equal(result.isError, true, name);
    assert.match(result.content[0].text, pattern, name);
  }
  assert.equal(client.calls.length, 0);
});

test("organization session list and workflow filters keep the API query", async () => {
  const sessions = recorder({ sessions: [{ id: SESSION_ID, title: "Export", status: "idle" }], has_more: true, limit: 20, offset: 0 });
  const listed = await callTool(sessions, "list_sessions", {});
  assert.equal(listed.isError, false);
  assert.equal(sessions.calls[0].path, "/sessions");
  assert.deepEqual(sessions.calls[0].query, { limit: 20 });
  assert.match(listed.content[0].text, /Export/);

  const workflows = recorder({ workflows: [], total: 0 });
  await callTool(workflows, "list_workflows", { project_id: PROJECT_ID, query: "ship", active: false, limit: 10 });
  assert.deepEqual(workflows.calls[0].query, {
    limit: 10,
    project_id: PROJECT_ID,
    q: "ship",
    active: "false",
  });
});

test("API failures stay errors and a non-JSON home page is not an empty success", async () => {
  const denied = recorder(new CriosError("Crios returned 403. This token cannot perform that action.", { status: 403 }));
  const result = await callTool(denied, "list_workflows", {});
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /403/);

  const html = new CriosClient({
    baseUrl: "https://crios.ai",
    token: TOKEN,
    fetchImpl: async () => ({
      status: 200,
      headers: { get: () => null },
      text: async () => "<html>crios home</html>",
    }),
  });
  const who = await callTool(html, "whoami", {});
  assert.equal(who.isError, true);
  assert.match(who.content[0].text, /not JSON/);
  assert.equal(who.content[0].text.includes(TOKEN), false);
});

test("the tool list names every operation the commands can call", () => {
  const names = TOOLS.map((tool) => tool.name);
  for (const name of [
    "whoami",
    "list_projects",
    "get_project",
    "create_project",
    "list_sessions",
    "get_session",
    "start_build",
    "send_message",
    "list_workflows",
    "run_workflow",
    "get_execution",
    "list_connectors",
  ]) {
    assert.ok(names.includes(name), name);
  }
  for (const tool of TOOLS) {
    assert.equal(typeof tool.description, "string");
    assert.ok(tool.description.length > 20, tool.name);
    assert.equal(tool.inputSchema.type, "object");
  }
});

function recorder(response) {
  const calls = [];
  return {
    calls,
    async request(method, path, options = {}) {
      calls.push({ method, path, body: options.body, query: options.query, timeoutMs: options.timeoutMs });
      if (response instanceof Error) throw response;
      return response;
    },
  };
}
