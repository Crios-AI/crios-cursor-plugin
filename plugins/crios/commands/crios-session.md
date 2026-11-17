---
name: crios-session
description: Show the status of a Crios build session.
---

# Crios session status

Call `get_session` with the session id. If the user did not give one, call `list_sessions` for the project they mean, or the organization list when they did not name a project, and use the session they pick.

Report status, progress (`current_step` of `total_steps`), cost, pull request URL, branch, and any error. A session at `waiting_input` or `idle` is resting; offer to send a follow-up with `send_message`.
