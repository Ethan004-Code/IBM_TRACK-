---
name: Count-only listings
description: Why quantity-only forms retain internal unit compatibility and preserve historical meanings
---

Use count-only listing forms: the user wants units in the food name (for example, "bags of rice"), not a separate selector.

**Why:** The user explicitly requested removing Unit everywhere while keeping Quantity as a whole number from 1 to 99.

**How to apply:** Keep the existing storage compatible rather than migrating old records. New count-only submissions use the existing internal "each" value. Preserve the meaning of historical units by folding them into names when displaying or editing; do not silently turn three kilograms into three individual items.

Matching must also recognize that an old "rice" + "bag" record and a new "bags of rice" count describe the same countable food. Recognize only explicit legacy-unit spellings; do not infer package sizes or convert weights.

**Why:** Changing presentation alone would make equivalent old and new listings stop matching.

**How to apply:** Normalize the unit-in-name representation for identity comparison without implicit physical-unit conversions. Keep quantity requirements for offered food and standalone food requests, not for what a swap listing wants in return.

Swaps do not require a return quantity or filter matches by it, including old rows with a stored return quantity. Both parties exchange the full listed amounts, and entire bundles stay together.

**Why:** The user explicitly chose full listed amounts rather than choosing partial amounts when proposing; they do not want to specify how many units they want in return.

**How to apply:** Show the desired food without a requested count, but show both actual full offers before acceptance. Keep offered quantities at whole numbers from 1 to 99. Do not silently relax standalone food-request quantities.

Past Best by dates are warnings, not automatic rejection or evidence of spoilage. Past Use by and Expiration dates must be rejected.

**Why:** The user explicitly distinguished quality-label warnings from the stricter date-label blocks. Bob/photo review must not become a food-safety certification.

**How to apply:** Keep the availability filter consistent with submission validation, or accepted Best by listings disappear from discovery.
