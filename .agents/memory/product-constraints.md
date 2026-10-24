---
name: EchoPantry product constraints
description: User-provided acceptance source and constraints that must survive future implementation changes.
---

Treat the uploaded interview as the acceptance source for corrections to the existing EchoPantry website. Preserve its identity rather than treating the request as a new product.

**Why:** The user asked to fix their supplied website so it works according to the interview.

**How to apply:** Consult `docs/interview_me.md` when changing behavior. In particular, Supabase Auth/storage and Python Flask are explicit requirements, IBM Bob must run during an interaction (a different AI provider is not equivalent), and the service is for the whole community, not only students.
