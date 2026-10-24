---
name: Donation map reuse
description: User expectation for integrating the existing donation map into the new frontend
---

Reuse the existing donation-center map implementation when connecting it to the newer RePlate interface. Keep this integration consistent with the current frontend layout and style.

**Why:** The user pointed to the existing prototype and integration work and asked why that implementation could not be reused. They want an accessible donation-locations entry point, not a replacement mapping feature, and explicitly asked to "follow the current frontend layout and style to keep constant."

**How to apply:** Start from the existing map, directory and routing implementation. Distinguish making those capabilities accessible from creating a new capability. Explain any necessary adaptation of listing-scoped access separately; do not assume permission to replace the existing implementation.
