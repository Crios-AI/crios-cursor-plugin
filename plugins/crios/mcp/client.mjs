/**
 * HTTP client for the Crios REST API (/api/v1).
 * The product home is https://crios.ai. The default API origin is https://api.crios.ai.
 * CRIOS_BASE_URL overrides that API origin.
 * This module never reads a signing key and never creates a token.
 */

export const PRODUCT_HOME = "https://crios.ai";
export const DEFAULT_ORIGIN = "https://api.crios.ai";

const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_RESPONSE_CHARS = 1_000_000;

const SECRET_KEY =
  /^(password|passwd|secret|token|access_token|refresh_token|id_token|api_key|apikey|api_token|authorization|private_key|client_secret|jwt|signing_key|jwt_signing_key|webhook_secret)$/i;

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

export class CriosError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "CriosError";
    this.status = details.status ?? 0;
    this.body = details.body ?? null;
    this.retryAfter = details.retryAfter ?? null;
  }
}

export function normalizeBaseUrl(raw) {
  const missing = typeof raw !== "string" || raw.trim() === "" || looksLikePlaceholder(raw);
  const input = missing ? DEFAULT_ORIGIN : raw.trim();

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new ConfigError("CRIOS_BASE_URL is not a valid URL.");
  }

  if (url.username || url.password) {
    throw new ConfigError(
      "CRIOS_BASE_URL must not include a username or password. Put the personal access token in CRIOS_TOKEN.",
    );
  }
  if (url.search || url.hash) {
    throw new ConfigError("CRIOS_BASE_URL must not include a query string or fragment.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ConfigError("CRIOS_BASE_URL must use http or https.");
  }

  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/api/v1")) {
    // already the API root
  } else if (path === "" || path === "/") {
    path = "/api/v1";
  } else if (path.endsWith("/api")) {
    path = `${path}/v1`;
  } else {
    path = `${path}/api/v1`;
  }

  return `${url.origin}${path}`;
}

export function assertToken(raw) {
  if (typeof raw !== "string" || raw.trim() === "" || looksLikePlaceholder(raw)) {
    throw new ConfigError(
      "CRIOS_TOKEN is not set. Open Plugins → Configure and set Crios personal access token. Create the token in Crios under Settings → API tokens. It starts with crios_pat_. Cursor passes that configured value into this server.",
    );
  }

  const token = raw.trim();
  if (/\s/.test(token)) {
    throw new ConfigError("CRIOS_TOKEN must be a single token with no spaces.");
  }
  if (token.startsWith("crios_oat_")) {
    throw new ConfigError(
      "This value is an OAuth token (crios_oat_). The Crios REST API rejects those. Create a personal access token (crios_pat_) under Settings → API tokens.",
    );
  }
  return token;
}

function looksLikePlaceholder(value) {
  const trimmed = value.trim();
  return trimmed.includes("${") || trimmed === "undefined" || trimmed === "null";
}

export function redactSecrets(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^/\s@]+@/gi, "$1")
    .replace(/crios_(?:pat|oat)_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export function redact(value) {
  if (Array.isArray(value)) return value.map((entry) => redact(entry));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? "[redacted]" : redact(entry);
    }
    return out;
  }
  if (typeof value === "string") return redactSecrets(value);
  return value;
}

function errorMessage(status, body) {
  if (body && typeof body === "object") {
    const parts = [];
    if (typeof body.error === "string" && body.error.trim() !== "") parts.push(body.error.trim());
    if (typeof body.code === "string" && body.code.trim() !== "") parts.push(`(${body.code})`);
    if (typeof body.details === "string" && body.details.trim() !== "") parts.push(body.details.trim());
    if (parts.length > 0) return `Crios returned ${status}: ${parts.join(" ")}`;
  }
  if (status === 401) {
    return "Crios returned 401. The personal access token was rejected. Create a new crios_pat_ token under Settings → API tokens.";
  }
  if (status === 403) {
    return "Crios returned 403. This token cannot perform that action. Workflow routes need a full-access token, and viewers are read-only.";
  }
  if (status === 429) return "Crios returned 429: rate limit exceeded.";
  return `Crios returned ${status}.`;
}

export class CriosClient {
  constructor({ baseUrl, token, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = assertToken(token);
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(method, path, { query, body, timeoutMs } = {}) {
    if (typeof path !== "string" || !path.startsWith("/") || path.includes("..") || path.includes("://")) {
      throw new CriosError("Refusing to call a Crios path that is not a relative API path.");
    }

    const url = new URL(this.baseUrl);
    url.pathname = `${url.pathname.replace(/\/$/, "")}${path}`;
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${this.token}`,
    };
    let payload;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const limit = timeoutMs ?? this.timeoutMs;
    let response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: payload,
        redirect: "manual",
        signal: AbortSignal.timeout(limit),
      });
    } catch (error) {
      const name = error && typeof error === "object" ? error.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new CriosError(`Crios did not respond within ${limit}ms (${method} ${path}).`);
      }
      throw new CriosError(`Could not reach Crios at ${this.baseUrl}.`);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new CriosError(
        `Crios redirected ${method} ${path} (${response.status}). The request was not followed, so the access token stayed on the original host.`,
      );
    }

    const ok = response.status >= 200 && response.status < 300;
    const { text, truncated } = await readLimited(response);
    if (truncated) {
      throw new CriosError(
        `Crios response for ${method} ${path} was larger than ${MAX_RESPONSE_CHARS} characters and was not used.`,
      );
    }

    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        if (ok) {
          throw new CriosError(
            `Crios returned ${response.status} for ${method} ${path}, but the body was not JSON. Check CRIOS_BASE_URL. The API root in use is ${this.baseUrl}.`,
          );
        }
        parsed = { error: redactSecrets(text.slice(0, 500)) };
      }
    }

    const safeBody = redact(parsed);
    if (!ok) {
      const retryHeader = response.headers?.get?.("x-ratelimit-retry-after");
      const retryAfter = retryHeader ?? (parsed && typeof parsed === "object" ? parsed.retry_after : null);
      let message = errorMessage(response.status, safeBody);
      if (response.status === 429 && retryAfter != null) {
        message += ` Retry after ${retryAfter}s.`;
      }
      throw new CriosError(redactSecrets(message), {
        status: response.status,
        body: safeBody,
        retryAfter: retryAfter == null ? null : Number(retryAfter),
      });
    }

    return safeBody;
  }
}

async function readLimited(response) {
  if (!response || typeof response.text !== "function") return { text: "", truncated: false };
  const text = await response.text();
  if (typeof text !== "string" || text.length <= MAX_RESPONSE_CHARS) {
    return { text: typeof text === "string" ? text : "", truncated: false };
  }
  return { text: "", truncated: true };
}
