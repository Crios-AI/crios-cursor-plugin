import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { ConfigError, CriosClient, CriosError, normalizeBaseUrl, redact } from "./client.mjs";

const TOKEN = "crios_pat_test";

test("normalizeBaseUrl appends /api/v1 and keeps an existing API root", () => {
  assert.equal(normalizeBaseUrl("https://api.example.com"), "https://api.example.com/api/v1");
  assert.equal(normalizeBaseUrl("https://api.example.com/"), "https://api.example.com/api/v1");
  assert.equal(normalizeBaseUrl("https://app.example.com/api/v1/"), "https://app.example.com/api/v1");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:8080/api"), "http://127.0.0.1:8080/api/v1");
});

test("normalizeBaseUrl rejects credentials, queries, and empty values", () => {
  assert.throws(() => normalizeBaseUrl("https://user:secret@api.example.com"), ConfigError);
  assert.throws(() => normalizeBaseUrl("https://api.example.com/api/v1?token=1"), ConfigError);
  assert.throws(() => normalizeBaseUrl("https://api.example.com#frag"), ConfigError);
  assert.throws(() => normalizeBaseUrl(""), ConfigError);
  assert.throws(() => normalizeBaseUrl("${CRIOS_BASE_URL}"), ConfigError);
});

test("personal access tokens are sent as Bearer and OAuth tokens are refused", async () => {
  const seen = [];
  const server = await listen((request, response) => {
    seen.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: "user-1", email: "a@example.com" }));
  });

  try {
    const client = new CriosClient({
      baseUrl: baseUrl(server),
      token: TOKEN,
    });
    const body = await client.request("GET", "/users/me");
    assert.equal(body.email, "a@example.com");
    assert.deepEqual(seen, [
      { method: "GET", path: "/api/v1/users/me", authorization: `Bearer ${TOKEN}` },
    ]);

    assert.throws(() => new CriosClient({ baseUrl: baseUrl(server), token: "crios_oat_example" }), /personal access token/);
  } finally {
    await close(server);
  }
});

test("error bodies and redirects do not expose the token", async () => {
  const server = await listen((request, response) => {
    if (request.url.endsWith("/redirect")) {
      response.writeHead(302, { location: "https://attacker.example/collect" });
      response.end();
      return;
    }
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: `bad ${TOKEN}`, token: TOKEN }));
  });

  try {
    const client = new CriosClient({ baseUrl: baseUrl(server), token: TOKEN });
    await assert.rejects(client.request("GET", "/users/me"), (error) => {
      assert.ok(error instanceof CriosError);
      assert.equal(error.status, 401);
      assert.equal(error.message.includes(TOKEN), false);
      assert.equal(JSON.stringify(error.body).includes(TOKEN), false);
      assert.equal(error.body.token, "[redacted]");
      return true;
    });

    await assert.rejects(client.request("GET", "/redirect"), /not followed/);
  } finally {
    await close(server);
  }
});

test("redact removes secret fields and userinfo without touching ordinary text", () => {
  const value = redact({
    name: "token factory",
    api_key: "super-secret",
    repository_url: "https://pat:hunter2@git.example.com/a/b",
    note: "use crios_pat_livevalueplease",
  });
  assert.equal(value.name, "token factory");
  assert.equal(value.api_key, "[redacted]");
  assert.equal(value.repository_url, "https://git.example.com/a/b");
  assert.equal(value.note.includes("crios_pat_"), false);
});

function baseUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
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
