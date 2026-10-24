---
name: Allergen declarations
description: Required allergen chips, produce default, and legacy display compatibility
---

Allergen entry uses multi-select chips: None, Unknown, Wheat/Gluten, Milk, Eggs, Peanuts, Tree nuts, Soy, Fish, Shellfish, Sesame, Other. A selection is required. None and Unknown are mutually exclusive with every other choice. Other requires a description of at most 50 characters.

**Why:** The user requested standardized allergen entry while keeping existing listings working, with minimal unrelated changes.

**How to apply:** Whole produce defaults to None, but users can override it; do not reapply the default on unrelated edits or ordinary renders. Display new selections as a comma-separated declaration. Keep existing free-text listing declarations as written rather than silently translating or discarding them. Editing through the chip form requires a selection before saving.
