---
name: crios-connectors
description: List connector instances configured on a Crios project.
---

# Crios connectors

Resolve the project id with `list_projects` when the user did not give one, then call `list_connectors`.

Show each connector slug and its instances: name, kind, and status. Say that secret values are not included. Do not offer to create credentials from this command; accounts are connected in the Crios UI.
