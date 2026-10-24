---
name: Form event regression testing
description: Missing-field errors can reflect stale draft state rather than missing user input
---

Do not treat a missing-field checklist as proof the user left a field blank. Compare visible input values with the draft state when users say correcting the fields does not resolve it.

**Why:** A real browser reproduction showed a food name visibly filled in while validation still reported it missing. Tests calling the binding helper directly had passed but missed the delegated listener filtering out text-field change events.

**How to apply:** Test through the registered event listeners, including change-only updates, not only direct helper calls. Cover both input and change events and assert that duplicate unchanged events do not cancel an in-flight Bob check or invalidate an existing approval. Keep required-field, date-window, photo and Bob-approval checks intact.
