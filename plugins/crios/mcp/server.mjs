#!/usr/bin/env node
/**
 * Local stdio server for tests and for running this client directly.
 * Cursor does not start this process. The installed plugin connects to
 * https://mcp.crios.ai/mcp and sends the configured token in the Authorization header.
 * When this process is started, it reads CRIOS_BASE_URL and CRIOS_TOKEN from the environment.
 * Nothing in this process mints a token.
 */

import { ConfigError, CriosClient, redactSecrets } from "./client.mjs";
import { TOOLS, callTool } from "./tools.mjs";

const SERVER_VERSION = "0.1.0";
const SUPPORTED_PROTOCOLS = ["2024-11-05", "2025-03-26", "2025-06-18"];

let framing = "newline";
let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drain();
});

process.stdin.on("end", () => {
  process.exit(0);
});

process.stdin.on("error", () => {
  process.exit(1);
});

function drain() {
  while (buffer.length > 0) {
    const first = buffer[0];
    if (first === 0x20 || first === 0x09 || first === 0x0d || first === 0x0a) {
      buffer = buffer.subarray(1);
      continue;
    }

    const prefix = buffer.subarray(0, Math.min(buffer.length, 15)).toString("utf8").toLowerCase();
    if (prefix.startsWith("content-length") || "content-length".startsWith(prefix)) {
      if (!prefix.startsWith("content-length")) return;
      framing = "lsp";
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.subarray(start, start + length).toString("utf8");
      buffer = buffer.subarray(start + length);
      accept(body);
      continue;
    }

    const newline = buffer.indexOf(0x0a);
    if (newline === -1) return;
    const line = buffer.subarray(0, newline).toString("utf8").replace(/\r$/, "");
    buffer = buffer.subarray(newline + 1);
    if (line.trim() === "") continue;
    framing = "newline";
    accept(line);
  }
}

function accept(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  void handle(message);
}

async function handle(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) return;
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined;
  const method = message.method;
  if (typeof method !== "string") return;
  if (id === undefined || id === null) return;

  try {
    if (method === "initialize") {
      const requested = message.params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : "2024-11-05";
      reply(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "crios", version: SERVER_VERSION },
      });
      return;
    }
    if (method === "ping") {
      reply(id, {});
      return;
    }
    if (method === "tools/list") {
      reply(id, { tools: TOOLS });
      return;
    }
    if (method === "tools/call") {
      const name = message.params?.name;
      const args = message.params?.arguments ?? {};
      if (typeof name !== "string") {
        fail(id, -32602, "tools/call requires a tool name.");
        return;
      }
      let client;
      try {
        client = new CriosClient({
          baseUrl: process.env.CRIOS_BASE_URL,
          token: process.env.CRIOS_TOKEN,
        });
      } catch (error) {
        const text = error instanceof ConfigError ? error.message : "Crios is not configured.";
        reply(id, { content: [{ type: "text", text }], isError: true });
        return;
      }
      reply(id, await callTool(client, name, args));
      return;
    }
    fail(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    fail(id, -32603, safeMessage(error));
  }
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message: redactSecrets(String(message)) } });
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : "Crios request failed.";
  return redactSecrets(message);
}

function send(message) {
  const json = JSON.stringify(message);
  if (framing === "lsp") {
    const body = Buffer.from(json, "utf8");
    process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
    process.stdout.write(body);
    return;
  }
  process.stdout.write(`${json}\n`);
}
