/**
 * The small set of Crios operations a Cursor user runs from the editor.
 * Paths and bodies follow the Crios OpenAPI document for /api/v1.
 */

import { CriosError } from "./client.mjs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SESSION_TYPES = ["coding", "planning", "review", "testing", "research", "publishing"];
const PLAN_MODES = ["auto", "required"];
const STACKS = ["web", "mobile", "desktop"];
const SESSION_STATUSES = [
  "pending",
  "queued",
  "starting",
  "planning",
  "working",
  "running",
  "recovering",
  "waiting_input",
  "paused",
  "idle",
  "completed",
  "failed",
  "cancelled",
];

const SESSION_FIELDS = [
  "id",
  "project_id",
  "title",
  "status",
  "session_type",
  "current_step",
  "total_steps",
  "cost_usd",
  "pr_url",
  "branch_name",
  "pr_number",
  "error_message",
  "final_status_reason",
  "updated_at",
  "created_at",
];

const PROJECT_FIELDS = [
  "id",
  "name",
  "description",
  "visibility",
  "access",
  "repository_url",
  "repository_kind",
  "default_branch",
  "updated_at",
  "created_at",
];

const WORKFLOW_FIELDS = [
  "id",
  "project_id",
  "name",
  "description",
  "tags",
  "version",
  "active_version",
  "needs_setup",
  "setup_count",
  "updated_at",
];

const EXECUTION_FIELDS = [
  "id",
  "execution_id",
  "workflow_id",
  "project_id",
  "version",
  "status",
  "mode",
  "error",
  "stats",
  "created_at",
  "started_at",
  "finished_at",
];

const emptyObject = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const TOOLS = [
  {
    name: "whoami",
    description:
      "Show the Crios user, role, and organization for the configured personal access token. Call this first when a Crios command fails, to confirm the base URL and token.",
    inputSchema: emptyObject,
  },
  {
    name: "list_projects",
    description: "List Crios projects visible to the token, newest first. Returns id, name, access, and repository fields.",
    inputSchema: emptyObject,
  },
  {
    name: "get_project",
    description: "Get one Crios project by id.",
    inputSchema: objectSchema({
      project_id: { type: "string", description: "Project UUID." },
    }, ["project_id"]),
  },
  {
    name: "create_project",
    description:
      "Create a Crios project. Omit repository_url to let Crios create the built-in Git repository. Requires a token that can write projects.",
    inputSchema: objectSchema({
      name: { type: "string", description: "Project name." },
      description: { type: "string", description: "Optional project description." },
    }, ["name"]),
  },
  {
    name: "list_sessions",
    description:
      "List build sessions. Pass project_id to list that project's sessions. Without it, lists sessions in the active organization.",
    inputSchema: objectSchema({
      project_id: { type: "string", description: "Optional project UUID." },
      status: { type: "string", description: "Optional session status filter. Only applied when project_id is set." },
      limit: { type: "integer", description: "Page size from 1 to 100. Defaults to 20." },
    }),
  },
  {
    name: "get_session",
    description:
      "Get one build session: status, progress, cost, pull request URL, and error text. A finished build often rests at waiting_input or idle rather than completed.",
    inputSchema: objectSchema({
      session_id: { type: "string", description: "Session UUID." },
    }, ["session_id"]),
  },
  {
    name: "start_build",
    description:
      "Start a Crios build session in a project from a plain-language request. Calls POST /api/v1/projects/{id}/sessions and waits for planning (up to 120 seconds). plan_approval_mode defaults to auto so the build can start; pass required to wait for plan approval in Crios.",
    inputSchema: objectSchema({
      project_id: { type: "string", description: "Project UUID." },
      natural_language: { type: "string", description: "What the build should do." },
      title: { type: "string", description: "Optional session title, up to 500 characters." },
      session_type: {
        type: "string",
        enum: SESSION_TYPES,
        description: "coding (default), planning, review, testing, research, or publishing.",
      },
      plan_approval_mode: {
        type: "string",
        enum: PLAN_MODES,
        description: "auto (default) or required.",
      },
      target_stack: {
        type: "string",
        enum: STACKS,
        description: "Optional platform when rebuilding a design: web, mobile, or desktop.",
      },
    }, ["project_id", "natural_language"]),
  },
  {
    name: "send_message",
    description:
      "Send a steering message to a Crios session. A paused, idle, or waiting session resumes to process it. Use this to answer a planner clarification.",
    inputSchema: objectSchema({
      session_id: { type: "string", description: "Session UUID." },
      message: { type: "string", description: "Message to send." },
    }, ["session_id", "message"]),
  },
  {
    name: "list_workflows",
    description:
      "List Crios workflows the token can read. Needs a full-access personal access token; a fine-grained token is refused on /workflows.",
    inputSchema: objectSchema({
      project_id: { type: "string", description: "Optional project UUID." },
      query: { type: "string", description: "Optional case-insensitive name substring." },
      active: { type: "boolean", description: "When set, keep only active (true) or inactive (false) workflows." },
      limit: { type: "integer", description: "Page size from 1 to 50. Defaults to 20." },
    }),
  },
  {
    name: "run_workflow",
    description:
      "Run a Crios workflow. mode defaults to test (the draft). Production runs the active version and only starts when mode is production. Returns the execution id. Needs a full-access token and editor access.",
    inputSchema: objectSchema({
      workflow_id: { type: "string", description: "Workflow UUID." },
      mode: { type: "string", enum: ["test", "production"], description: "test (default) or production." },
      input: { type: "object", description: "Optional trigger payload object. Crios wraps it as one item." },
      wait: { type: "boolean", description: "When true, Crios waits up to 30 seconds for a terminal status." },
    }, ["workflow_id"]),
  },
  {
    name: "get_execution",
    description: "Get one workflow execution's status, mode, and error. Needs a full-access token.",
    inputSchema: objectSchema({
      execution_id: { type: "string", description: "Execution UUID." },
    }, ["execution_id"]),
  },
  {
    name: "list_connectors",
    description:
      "List connector instances on a Crios project (name, kind, status). Secret values are not returned by Crios and are stripped if one appears.",
    inputSchema: objectSchema({
      project_id: { type: "string", description: "Project UUID." },
    }, ["project_id"]),
  },
];

export async function callTool(client, name, args) {
  const input = args && typeof args === "object" && !Array.isArray(args) ? args : {};
  try {
    const data = await dispatch(client, name, input);
    return { content: [{ type: "text", text: format(data) }], isError: false };
  } catch (error) {
    if (error instanceof ToolInputError || error instanceof CriosError) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    throw error;
  }
}

async function dispatch(client, name, args) {
  switch (name) {
    case "whoami":
      return summarizeUser(await client.request("GET", "/users/me"));
    case "list_projects":
      return summarizeProjects(await client.request("GET", "/projects"));
    case "get_project":
      return pick(await client.request("GET", `/projects/${uuid(args.project_id, "project_id")}`), PROJECT_FIELDS);
    case "create_project":
      return pick(await client.request("POST", "/projects", { body: projectBody(args) }), PROJECT_FIELDS);
    case "list_sessions":
      return listSessions(client, args);
    case "get_session":
      return summarizeSession(await client.request("GET", `/sessions/${uuid(args.session_id, "session_id")}`), true);
    case "start_build":
      return startBuild(client, args);
    case "send_message":
      return sendMessage(client, args);
    case "list_workflows":
      return listWorkflows(client, args);
    case "run_workflow":
      return runWorkflow(client, args);
    case "get_execution":
      return summarizeExecution(
        await client.request("GET", `/workflows/executions/${uuid(args.execution_id, "execution_id")}`),
      );
    case "list_connectors":
      return summarizeConnectors(
        await client.request("GET", `/projects/${uuid(args.project_id, "project_id")}/connectors`),
      );
    default:
      throw new ToolInputError(`Unknown Crios tool "${name}".`);
  }
}

function summarizeUser(user) {
  const memberships = Array.isArray(user?.memberships)
    ? user.memberships.map((item) => pick(item, ["organization_id", "organization_name", "organization_slug", "role"]))
    : [];
  return {
    ...pick(user, ["id", "email", "name", "organization_id", "role"]),
    memberships,
  };
}

function summarizeProjects(payload) {
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const shown = projects.slice(0, 100).map((project) => pick(project, PROJECT_FIELDS));
  return {
    projects: shown,
    count: projects.length,
    omitted: Math.max(0, projects.length - shown.length),
  };
}

async function listSessions(client, args) {
  const limit = clampInt(args.limit, 1, 100, 20);
  if (args.project_id) {
    const query = { limit };
    if (args.status !== undefined) query.status = oneOf(args.status, SESSION_STATUSES, "status");
    const payload = await client.request("GET", `/projects/${uuid(args.project_id, "project_id")}/sessions`, { query });
    const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
    return { sessions: sessions.map((session) => summarizeSession(session, false)) };
  }
  if (args.status !== undefined) {
    throw new ToolInputError("status is only applied when project_id is set. Organization session list has no status filter.");
  }
  const payload = await client.request("GET", "/sessions", { query: { limit } });
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];
  return {
    sessions: sessions.map((session) => summarizeSession(session, false)),
    has_more: Boolean(payload?.has_more),
    limit: payload?.limit ?? limit,
    offset: payload?.offset ?? 0,
  };
}

async function startBuild(client, args) {
  const projectId = uuid(args.project_id, "project_id");
  const naturalLanguage = requiredText(args.natural_language, "natural_language", 100_000);
  const body = {
    natural_language: naturalLanguage,
    session_type: args.session_type === undefined ? "coding" : oneOf(args.session_type, SESSION_TYPES, "session_type"),
    plan_approval_mode:
      args.plan_approval_mode === undefined ? "auto" : oneOf(args.plan_approval_mode, PLAN_MODES, "plan_approval_mode"),
  };
  if (args.title !== undefined) body.title = requiredText(args.title, "title", 500);
  if (args.target_stack !== undefined) body.target_stack = oneOf(args.target_stack, STACKS, "target_stack");

  const payload = await client.request("POST", `/projects/${projectId}/sessions`, {
    body,
    timeoutMs: 120_000,
  });
  return {
    ...summarizeSession(payload, true),
    ...pick(payload, ["session_id", "requires_clarification", "plan_only", "chat_response", "message"]),
    questions: Array.isArray(payload?.questions) ? payload.questions.slice(0, 20).map((item) => clip(String(item), 500)) : undefined,
  };
}

async function sendMessage(client, args) {
  const sessionId = uuid(args.session_id, "session_id");
  const message = requiredText(args.message, "message", 100_000);
  const payload = await client.request("POST", `/sessions/${sessionId}/steer`, { body: { message } });
  if (payload && typeof payload === "object" && payload.id && payload.status && !payload.event_id) {
    return summarizeSession(payload, true);
  }
  return pick(payload, ["status", "event_id", "message", "session_id"]);
}

async function listWorkflows(client, args) {
  const query = { limit: clampInt(args.limit, 1, 50, 20) };
  if (args.project_id) query.project_id = uuid(args.project_id, "project_id");
  if (args.query !== undefined) query.q = requiredText(args.query, "query", 200);
  if (args.active !== undefined) {
    if (typeof args.active !== "boolean") throw new ToolInputError("active must be a boolean.");
    query.active = args.active ? "true" : "false";
  }
  const payload = await client.request("GET", "/workflows", { query });
  const workflows = Array.isArray(payload?.workflows) ? payload.workflows : [];
  return {
    workflows: workflows.map((workflow) => pick(workflow, WORKFLOW_FIELDS)),
    total: payload?.total ?? workflows.length,
  };
}

async function runWorkflow(client, args) {
  const workflowId = uuid(args.workflow_id, "workflow_id");
  const mode = args.mode === undefined ? "test" : oneOf(args.mode, ["test", "production"], "mode");
  const body = { mode };
  if (args.input !== undefined) {
    if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
      throw new ToolInputError("input must be an object.");
    }
    body.input = args.input;
  }
  if (args.wait !== undefined) {
    if (typeof args.wait !== "boolean") throw new ToolInputError("wait must be a boolean.");
    body.wait = args.wait;
  }
  const payload = await client.request("POST", `/workflows/${workflowId}/executions`, {
    body,
    timeoutMs: args.wait ? 45_000 : 30_000,
  });
  if (payload?.execution) return summarizeExecution(payload);
  return pick(payload, ["execution_id", "status"]);
}

function summarizeSession(session, withResult) {
  const summary = pick(session, SESSION_FIELDS);
  if (withResult && typeof session?.result === "string" && session.result.trim() !== "") {
    summary.result = clip(session.result, 4000);
  }
  return summary;
}

function summarizeExecution(payload) {
  const execution = payload?.execution && typeof payload.execution === "object" ? payload.execution : payload;
  const summary = pick(execution, EXECUTION_FIELDS);
  if (typeof summary.error === "string") summary.error = clip(summary.error, 2000);
  return summary;
}

function summarizeConnectors(payload) {
  const groups = Array.isArray(payload?.connectors) ? payload.connectors : [];
  return {
    connectors: groups.map((group) => ({
      slug: group?.slug,
      instances: Array.isArray(group?.instances)
        ? group.instances.map((instance) =>
            pick(instance, [
              "kind",
              "id",
              "name",
              "credential_type",
              "integration_id",
              "status",
              "expired",
              "alias",
              "is_default",
              "chat_enabled",
              "access_level",
              "grant_enabled",
            ]),
          )
        : [],
    })),
  };
}

function projectBody(args) {
  const body = { name: requiredText(args.name, "name", 200) };
  if (args.description !== undefined) body.description = requiredText(args.description, "description", 4000);
  return body;
}

function objectSchema(properties, required) {
  const schema = {
    type: "object",
    properties,
    additionalProperties: false,
  };
  if (required) schema.required = required;
  return schema;
}

function uuid(value, label) {
  if (typeof value !== "string" || !UUID.test(value.trim())) {
    throw new ToolInputError(`${label} must be a UUID.`);
  }
  return value.trim();
}

function requiredText(value, label, max) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ToolInputError(`${label} must be a non-empty string.`);
  }
  const text = value.trim();
  if (text.length > max) throw new ToolInputError(`${label} is longer than ${max} characters.`);
  return text;
}

function oneOf(value, allowed, label) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ToolInputError(`${label} must be one of: ${allowed.join(", ")}.`);
  }
  return value;
}

function clampInt(value, min, max, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ToolInputError(`limit must be an integer from ${min} to ${max}.`);
  }
  if (value < min || value > max) throw new ToolInputError(`limit must be from ${min} to ${max}.`);
  return value;
}

function pick(source, keys) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

function clip(text, max) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function format(data) {
  return JSON.stringify(data, null, 2);
}

class ToolInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ToolInputError";
  }
}
