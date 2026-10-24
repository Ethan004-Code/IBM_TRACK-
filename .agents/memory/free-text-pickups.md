---
name: Free-text pickup spots
description: Location text, owner-controlled request spots, and requester-specific presentation
---

Pickup spots are free text up to 100 characters, not preset zones. Keep existing listings' location text; never discard a location because it is not in a preset list. Discover must not have the former All areas filter.

**Why:** The user explicitly requested free-text pickup spots everywhere while preserving existing locations.

**How to apply:** Keep the character limit and public-meeting safety note on editable inputs and enforce the limit on the server, including Bob drafts. Render the same text in cards, details, Activity and notifications.

Requests use the listing's pickup spot; the requester chooses their own time within its availability window, not an alternative meeting place. Exact normalized text matching remains intentional; do not infer coordinates or merge different locations automatically.

**Why:** Using an independently chosen spot would invalidate the owner's meeting agreement and existing matching rules.

**How to apply:** Derive the request's location from the listing on the server and reject conflicting submitted locations. Activity must show the actual requested time, not just the owner's whole window. Giveaway notifications use the saved requester name, not a generic neighbor label.
