---
name: crios-workflows
description: List Crios workflows and run one when the user asks.
---

# Crios workflows

Call `workflow_list`. Pass the project when the user is talking about one project.

Show the name, id, and status the tool returns.

Run a workflow only when the user asks. Call `workflow_run` in test mode unless they explicitly want the active version, in which case use production. Then call `execution_status` with the returned execution id and report its status.

A 403 here usually means the personal access token is fine-grained. Workflow tools need a full-access token.
