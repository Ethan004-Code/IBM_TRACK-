---
name: Preview session testing
description: Avoid false authentication failures from manually seeded browser cookies
---

Use a clean testing-browser cookie jar and the normal sign-in form when verifying protected preview flows. Do not mix manually injected authentication cookies with cookies issued by native login.

**Why:** A temporary account authenticated successfully over HTTP, but a browser with a manually injected cookie remained unauthorized even after native login. After clearing that testing context's cookies and signing in normally, authentication survived reload and the protected flow passed. The app issues partitioned cookies, so manually seeded cookies of the same name can interfere, especially after rotating a temporary account's password.

**How to apply:** Clear cookies only in the isolated testing browser, never the user's actual browser. Sign in using a scoped temporary account, verify the current-user response after reload, and inspect cookie metadata rather than token values if diagnosing failures. Do not change application authentication on the basis of a mixed testing-cookie jar alone.
