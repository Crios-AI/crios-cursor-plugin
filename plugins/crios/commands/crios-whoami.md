---
name: crios-whoami
description: Show the Crios user and organization for the configured personal access token.
---

# Who am I in Crios

Call the `whoami` tool.

Report the name, email, role, and active organization. The default origin is `https://crios.ai`. If the tool says the token is missing, explain how to set `CRIOS_TOKEN` in the plugin configuration, and mention `CRIOS_BASE_URL` only when the user wants a different instance. Do not ask the user to paste the token into chat.
