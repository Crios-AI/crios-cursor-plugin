---
name: crios-workflows
description: List Crios workflows and run one when the user asks.
---

# Crios workflows

Call `list_workflows`. Pass `project_id` when the user is talking about one project.

Show name, id, active version, and whether setup is still required.

Run a workflow only when the user asks. Call `run_workflow` with `mode` `test` unless they explicitly want the active version, in which case use `production`. Then call `get_execution` with the returned execution id and report its status.

A 403 here usually means the personal access token is fine-grained. Workflow routes need a full-access token.
