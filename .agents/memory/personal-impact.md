---
name: Personal impact scope
description: Product policy for private giver/receiver impact rather than community totals
---

Impact is the signed-in user's own impact, not community totals. Count completed swaps/giveaways where they were either giver or receiver, and only donation/compost reports they made. Filter on the server using the authenticated account, never a client-supplied user ID.

**Why:** The user explicitly requested "Your impact" and server-side user filtering.

**How to apply:** Giver-owned ledger entries alone cannot determine recipient impact; correlate them with completed, mutually confirmed handoffs. Do not count pending handoffs or treat a recommendation as a reported outcome. Do not expose totals when signed out, and clear user-scoped results on account changes.
