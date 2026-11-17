---
name: crios-session
description: Show the status of a Crios build session.
---

# Crios session status

Call `get_session_status` with the session id. If the user did not give one, ask for it. To wait until the session rests or finishes, call `wait_for_session`.

Report status, progress, cost, pull request URL, and any error the tool returns. A session at `waiting_input` or `idle` is resting; offer to send a follow-up with `send_message`.
