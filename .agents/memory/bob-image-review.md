---
name: Bob image review boundaries
description: Why image review uses restricted ACP and deterministic completeness checks happen before Bob
---

Send actual image content through Bob's ACP image prompts, not descriptions passed to the text-only run command. Keep the review session tool-free and isolated; image moderation must fail closed on uncertain, malformed or unavailable results.

**Why:** The installed runtime supports inline ACP images, while its run command has no image-attachment option. Asking Bob to repeat deterministic completeness validation produced a false missing-details judgment for a fully validated listing. A focused image-appropriateness/matching review received the full normalized listing context and approved the relevant photograph.

**How to apply:** Validate every required field on the server first, then give Bob the full normalized listing plus sanitized image. Do not use a model judgment as a replacement for required-field validation, and do not claim that photo review certifies food safety.
