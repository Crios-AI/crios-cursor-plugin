import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  ConfigError,
  CriosClient,
  CriosError,
  DEFAULT_ORIGIN,
  MAX_RESPONSE_CHARS,
  normalizeBaseUrl,
  redact,
} from "./client.mjs";

const TOKEN = "crios_pat_test";

test("normalizeBaseUrl appends /api/v1 and keeps an existing API root", () => {
  assert.equal(normalizeBaseUrl("https://api.example.com"), "https://api.example.com/api/v1");
  assert.equal(normalizeBaseUrl("https://api.example.com/"), "https://api.example.com/api/v1");
  assert.equal(normalizeBaseUrl("https://app.example.com/api/v1/"), "https://app.example.com/api/v1");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:8080/api"), "http://127.0.0.1:8080/api/v1");
});

test("the default API origin is https://api.crios.ai and an override replaces it", () => {
  assert.equal(DEFAULT_ORIGIN, "https://api.crios.ai");
  assert.equal(normalizeBaseUrl(undefined), "https://api.crios.ai/api/v1");
  assert.equal(normalizeBaseUrl(""), "https://api.crios.ai/api/v1");
  assert.equal(normalizeBaseUrl("   "), "https://api.crios.ai/api/v1");
  assert.equal(normalizeBaseUrl("${CRIOS_BASE_URL}"), "https://api.crios.ai/api/v1");
  assert.equal(normalizeBaseUrl("https://api.crios.ai"), "https://api.crios.ai/api/v1");
  assert.equal(normalizeBaseUrl("https://api.crios.ai/api/v1/"), "https://api.crios.ai/api/v1");
  assert.equal(normalizeBaseUrl("https://crios.ai"), "https://crios.ai/api/v1");
  assert.equal(normalizeBaseUrl("https://api.example.com"), "https://api.example.com/api/v1");
  assert.equal(normalizeBaseUrl("http://127.0.0.1:8080"), "http://127.0.0.1:8080/api/v1");
});

test("normalizeBaseUrl rejects credentials, queries, and malformed overrides", () => {
  assert.throws(() => normalizeBaseUrl("https://user:secret@crios.ai"), ConfigError);
  assert.throws(() => normalizeBaseUrl("https://api.example.com/api/v1?token=1"), ConfigError);
  assert.throws(() => normalizeBaseUrl("https://api.example.com#frag"), ConfigError);
  assert.throws(() => normalizeBaseUrl("not a url"), ConfigError);
  assert.throws(() => normalizeBaseUrl("ftp://crios.ai"), ConfigError);
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

test("an omitted base URL calls https://api.crios.ai/api/v1 and an override does not", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url: String(url), authorization: init.headers.Authorization, body: init.body ?? null });
    return jsonResponse(200, { id: "user-1", email: "a@example.com" });
  };

  const client = new CriosClient({ token: TOKEN, fetchImpl });
  assert.equal(client.baseUrl, `${DEFAULT_ORIGIN}/api/v1`);
  await client.request("GET", "/users/me");

  const override = new CriosClient({ baseUrl: "http://127.0.0.1:8080", token: TOKEN, fetchImpl });
  await override.request("POST", "/projects", { body: { name: "Notes" } });

  assert.equal(seen[0].url, "https://api.crios.ai/api/v1/users/me");
  assert.equal(seen[0].authorization, `Bearer ${TOKEN}`);
  assert.equal(seen[0].url.includes(TOKEN), false);
  assert.equal(seen[1].url, "http://127.0.0.1:8080/api/v1/projects");
  assert.equal(seen[1].body, JSON.stringify({ name: "Notes" }));
});

test("HTML, oversized bodies, refusal, and rate limits are errors", async () => {
  const htmlClient = new CriosClient({
    token: TOKEN,
    fetchImpl: async () => ({
      status: 200,
      headers: { get: () => null },
      text: async () => "<!doctype html><title>Crios</title>",
    }),
  });
  await assert.rejects(htmlClient.request("GET", "/users/me"), (error) => {
    assert.ok(error instanceof CriosError);
    assert.match(error.message, /not JSON/);
    assert.match(error.message, /https:\/\/api\.crios\.ai\/api\/v1/);
    assert.equal(error.message.includes(TOKEN), false);
    return true;
  });

  const huge = "x".repeat(MAX_RESPONSE_CHARS + 1);
  const hugeClient = new CriosClient({
    baseUrl: "https://api.example.com",
    token: TOKEN,
    fetchImpl: async () => ({ status: 200, headers: { get: () => null }, text: async () => huge }),
  });
  await assert.rejects(hugeClient.request("GET", "/projects"), /larger than/);

  const server = await listen((request, response) => {
    if (request.url.endsWith("/forbidden")) {
      response.writeHead(403, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "viewers have read-only access" }));
      return;
    }
    response.writeHead(429, {
      "content-type": "application/json",
      "x-ratelimit-retry-after": "2",
    });
    response.end(JSON.stringify({ error: "rate limit exceeded", retry_after: 2, token: TOKEN }));
  });
  try {
    const client = new CriosClient({ baseUrl: baseUrl(server), token: TOKEN });
    await assert.rejects(client.request("GET", "/forbidden"), (error) => {
      assert.equal(error.status, 403);
      assert.match(error.message, /viewers have read-only access/);
      return true;
    });
    await assert.rejects(client.request("GET", "/limited"), (error) => {
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, 2);
      assert.match(error.message, /Retry after 2s/);
      assert.equal(error.message.includes(TOKEN), false);
      assert.equal(JSON.stringify(error.body).includes(TOKEN), false);
      return true;
    });
  } finally {
    await close(server);
  }
});

test("a hanging server times out and a bad path is refused before any request", async () => {
  const server = await listen((request, response) => {
    request.on("close", () => {
      response.destroy();
    });
  });
  try {
    const client = new CriosClient({ baseUrl: baseUrl(server), token: TOKEN, timeoutMs: 200 });
    await assert.rejects(client.request("GET", "/users/me"), (error) => {
      assert.ok(error instanceof CriosError);
      assert.match(error.message, /did not respond within 200ms/);
      assert.equal(error.message.includes(TOKEN), false);
      return true;
    });
    await assert.rejects(client.request("GET", "/users/../admin"), /relative API path/);
  } finally {
    await close(server);
  }
});

test("a network failure names the API root and not the token", async () => {
  const client = new CriosClient({
    token: TOKEN,
    fetchImpl: async () => {
      throw new TypeError("connect ECONNREFUSED");
    },
  });
  await assert.rejects(client.request("GET", "/users/me"), (error) => {
    assert.match(error.message, /Could not reach Crios at https:\/\/api\.crios\.ai\/api\/v1/);
    assert.equal(error.message.includes(TOKEN), false);
    return true;
  });
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

function jsonResponse(status, body) {
  return {
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  };
}

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
