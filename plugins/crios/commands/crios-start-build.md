---
name: crios-start-build
description: Start a Crios build session from the user's request in a project.
---

# Start a Crios build

1. If the user did not give a project id, call `list_projects` and use the project they name. Ask which project when more than one matches.
2. Call `start_build` with that project and their request as the brief.
3. If the result asks for clarification, show the questions and wait. Send the answer later with `send_message`.
4. Otherwise report the session id and status, and tell the user they can check it with the session command.
