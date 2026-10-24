---
name: External Supabase maintenance
description: Network constraint for reaching the existing external database during authorized schema maintenance.
---

Use the existing project's dashboard-supplied IPv4 **Session pooler** connection for authorized schema maintenance in this workspace. Do not guess its regional hostname, replace the database, or confuse its database password with API keys.

**Why:** The project's direct database hostname resolved only to IPv6, and the workspace rejected that address family before authentication. Retrying that endpoint cannot validate a password or apply a migration.

**How to apply:** Obtain connection details through the secure Secrets flow, verify that they identify the same project as the app's Supabase API, and require TLS. Product requirements and stack constraints are documented in `replit.md`.
