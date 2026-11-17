---
name: crios-whoami
description: Show the Crios user and organization for the configured personal access token.
---

# Who am I in Crios

Call the `whoami` tool.

Report the name, email, role, and active organization. The default origin is `https://crios.ai`. If the tool says the token is missing, tell the user to open Plugins → Configure and set Crios personal access token. Mention Crios base URL only when the user wants a different instance. Do not tell them to set a shell variable, and do not ask them to paste the token into chat.
