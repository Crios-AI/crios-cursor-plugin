import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TOKEN = "crios_pat_test";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const WORKFLOW_ID = "55555555-5555-4555-8555-555555555555";
const EXECUTION_ID = "66666666-6666-4666-8666-666666666666";
const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "server.mjs");

test("stdio server lists tools and calls the Crios API", async () => {
  const seen = [];
  const http = await listen((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      seen.push({
        method: request.method,
        path: request.url,
        authorization: request.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(route(request.method, request.url)));
    });
  });

  const mcp = startMcp(`http://127.0.0.1:${http.address().port}`);
  try {
    const init = await mcp.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    });
    assert.equal(init.result.serverInfo.name, "crios");
    mcp.notify("notifications/initialized");

    const listed = await mcp.request("tools/list");
    const names = listed.result.tools.map((tool) => tool.name);
    assert.ok(names.includes("whoami"));
    assert.ok(names.includes("start_build"));
    assert.ok(names.includes("list_connectors"));
    assert.ok(names.includes("run_workflow"));

    const me = await mcp.request("tools/call", { name: "whoami", arguments: {} });
    assert.equal(me.result.isError, false);
    assert.match(me.result.content[0].text, /ada@example.com/);

    const build = await mcp.request("tools/call", {
      name: "start_build",
      arguments: { project_id: PROJECT_ID, natural_language: "Add CSV export" },
    });
    assert.equal(build.result.isError, false);
    assert.match(build.result.content[0].text, new RegExp(SESSION_ID));

    const connectors = await mcp.request("tools/call", {
      name: "list_connectors",
      arguments: { project_id: PROJECT_ID },
    });
    assert.match(connectors.result.content[0].text, /github/);
    assert.match(connectors.result.content[0].text, /\[redacted\]/);
    assert.equal(connectors.result.content[0].text.includes("super-secret"), false);
    assert.equal(connectors.result.content[0].text.includes("shouldnotleak"), false);

    assert.equal(seen[0].path, "/api/v1/users/me");
    assert.equal(seen[0].authorization, `Bearer ${TOKEN}`);
    const start = seen.find((call) => call.method === "POST");
    assert.equal(start.path, `/api/v1/projects/${PROJECT_ID}/sessions`);
    assert.equal(start.body.natural_language, "Add CSV export");
    assert.equal(start.body.session_type, "coding");
    assert.equal(start.body.plan_approval_mode, "auto");

    const output = `${mcp.stderr()}\n${JSON.stringify(me)}`;
    assert.equal(output.includes(TOKEN), false);
  } finally {
    await mcp.close();
    await close(http);
  }
});

test("session, workflow, and execution calls use the documented routes", async () => {
  const seen = [];
  const http = await listen((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      seen.push({ method: request.method, path: request.url, body: raw ? JSON.parse(raw) : null });
      response.writeHead(request.method === "POST" ? 202 : 200, { "content-type": "application/json" });
      if (request.method === "POST") {
        response.end(JSON.stringify({ execution_id: EXECUTION_ID, status: "pending" }));
        return;
      }
      if (request.url.startsWith("/api/v1/workflows/executions/")) {
        response.end(JSON.stringify({ execution: { id: EXECUTION_ID, status: "succeeded", mode: "test" } }));
        return;
      }
      if (request.url.startsWith("/api/v1/sessions/")) {
        response.end(
          JSON.stringify({
            id: SESSION_ID,
            project_id: PROJECT_ID,
            status: "waiting_input",
            pr_url: "https://git.example.com/acme/app/pull/7",
            result: "done",
          }),
        );
        return;
      }
      if (request.url.startsWith("/api/v1/projects/")) {
        response.end(JSON.stringify({ sessions: [{ id: SESSION_ID, project_id: PROJECT_ID, status: "working", title: "Export" }] }));
        return;
      }
      response.end(
        JSON.stringify({
          workflows: [{ id: WORKFLOW_ID, project_id: PROJECT_ID, name: "Ship", active_version: 2, needs_setup: false }],
          total: 1,
        }),
      );
    });
  });

  const mcp = startMcp(`http://127.0.0.1:${http.address().port}`);
  try {
    await mcp.request("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
    const sessions = await mcp.request("tools/call", {
      name: "list_sessions",
      arguments: { project_id: PROJECT_ID, status: "working", limit: 20 },
    });
    assert.equal(sessions.result.isError, false);
    assert.match(sessions.result.content[0].text, /Export/);

    const session = await mcp.request("tools/call", {
      name: "get_session",
      arguments: { session_id: SESSION_ID },
    });
    assert.match(session.result.content[0].text, /waiting_input/);
    assert.match(session.result.content[0].text, /pull\/7/);

    const workflows = await mcp.request("tools/call", {
      name: "list_workflows",
      arguments: { project_id: PROJECT_ID, active: true, limit: 20 },
    });
    assert.match(workflows.result.content[0].text, /Ship/);

    const run = await mcp.request("tools/call", {
      name: "run_workflow",
      arguments: { workflow_id: WORKFLOW_ID },
    });
    assert.match(run.result.content[0].text, new RegExp(EXECUTION_ID));

    const execution = await mcp.request("tools/call", {
      name: "get_execution",
      arguments: { execution_id: EXECUTION_ID },
    });
    assert.match(execution.result.content[0].text, /succeeded/);

    assert.equal(seen[0].path, `/api/v1/projects/${PROJECT_ID}/sessions?limit=20&status=working`);
    assert.equal(seen[1].path, `/api/v1/sessions/${SESSION_ID}`);
    assert.equal(seen[2].path, `/api/v1/workflows?limit=20&project_id=${PROJECT_ID}&active=true`);
    assert.equal(seen[3].method, "POST");
    assert.equal(seen[3].path, `/api/v1/workflows/${WORKFLOW_ID}/executions`);
    assert.deepEqual(seen[3].body, { mode: "test" });
    assert.equal(seen[4].path, `/api/v1/workflows/executions/${EXECUTION_ID}`);
  } finally {
    await mcp.close();
    await close(http);
  }
});

test("a missing token is reported without leaving stdio", async () => {
  const mcp = startMcp("https://api.example.com", "");
  try {
    await mcp.request("initialize", { protocolVersion: "2025-03-26", capabilities: {} });
    const result = await mcp.request("tools/call", { name: "whoami", arguments: {} });
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, /CRIOS_TOKEN is not set/);
  } finally {
    await mcp.close();
  }
});

test("an unset base URL defaults instead of failing, and a bad override does not call the network", async () => {
  const env = { ...process.env, CRIOS_TOKEN: "" };
  delete env.CRIOS_BASE_URL;
  const missing = startMcpWithEnv(env);
  try {
    await missing.request("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
    const result = await missing.request("tools/call", { name: "whoami", arguments: {} });
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, /CRIOS_TOKEN is not set/);
    assert.equal(/CRIOS_BASE_URL is not set/.test(result.result.content[0].text), false);
  } finally {
    await missing.close();
  }

  const bad = startMcpWithEnv({ ...process.env, CRIOS_BASE_URL: "ftp://crios.ai", CRIOS_TOKEN: TOKEN });
  try {
    await bad.request("initialize", { protocolVersion: "2024-11-05", capabilities: {} });
    const result = await bad.request("tools/call", { name: "list_projects", arguments: {} });
    assert.equal(result.result.isError, true);
    assert.match(result.result.content[0].text, /http or https/);
    assert.equal(result.result.content[0].text.includes(TOKEN), false);
  } finally {
    await bad.close();
  }
});

test("Content-Length frames are accepted and answered in the same framing", async () => {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, CRIOS_BASE_URL: "https://api.example.com", CRIOS_TOKEN: TOKEN },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 7,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {} },
  });
  const body = Buffer.from(payload, "utf8");
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);

  const chunks = [];
  const response = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for LSP response")), 3000);
    child.stdout.on("data", (chunk) => {
      chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buf.subarray(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) return;
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + length) return;
      clearTimeout(timer);
      resolve(JSON.parse(buf.subarray(start, start + length).toString("utf8")));
    });
  });

  assert.equal(response.id, 7);
  assert.equal(response.result.serverInfo.name, "crios");
  child.kill();
  await once(child, "exit");
});

function route(method, urlPath) {
  if (urlPath === "/api/v1/users/me") {
    return {
      id: "33333333-3333-4333-8333-333333333333",
      email: "ada@example.com",
      name: "Ada",
      organization_id: "44444444-4444-4444-8444-444444444444",
      role: "member",
      memberships: [],
    };
  }
  if (method === "POST" && urlPath === `/api/v1/projects/${PROJECT_ID}/sessions`) {
    return {
      id: SESSION_ID,
      project_id: PROJECT_ID,
      title: "Add CSV export",
      status: "pending",
      session_type: "coding",
    };
  }
  if (urlPath === `/api/v1/projects/${PROJECT_ID}/connectors`) {
    return {
      connectors: [
        {
          slug: "github",
          instances: [
            {
              kind: "hub_account",
              id: SESSION_ID,
              name: "octo crios_pat_shouldnotleak",
              status: "connected",
              api_key: "super-secret",
            },
          ],
        },
      ],
    };
  }
  return { error: "not found" };
}

function startMcp(baseUrl, token = TOKEN) {
  return startMcpWithEnv({ ...process.env, CRIOS_BASE_URL: baseUrl, CRIOS_TOKEN: token });
}

function startMcpWithEnv(env) {
  const child = spawn(process.execPath, [serverPath], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buf = "";
  const pending = new Map();
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let newline = buf.indexOf("\n");
    while (newline !== -1) {
      const line = buf.slice(0, newline).trim();
      buf = buf.slice(newline + 1);
      newline = buf.indexOf("\n");
      if (!line) continue;
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  let nextId = 1;
  return {
    stderr: () => stderr,
    request(method, params) {
      const id = nextId++;
      const response = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), 3000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      return response;
    },
    notify(method) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
    },
    async close() {
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), 1000);
      await once(child, "exit");
      clearTimeout(timer);
    },
  };
}

function listen(handler) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
