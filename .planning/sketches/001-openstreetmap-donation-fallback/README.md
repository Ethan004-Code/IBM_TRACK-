---
sketch: 001
name: openstreetmap-donation-fallback
question: "How should a verified donation fallback work without changing RePlate's existing behavior?"
winner: "A · Gentle fallback"
tags: [map, fallback, donation, trust, live-routing]
---

# RePlate live donation fallback prototype

This isolated prototype demonstrates the smallest proposed production change: the existing **Next steps** area expands into a verified donation finder. It does not connect to RePlate accounts, listings, Supabase, impact records, or production APIs.

## What is real

- Organization names, addresses, published hours, acceptance summaries, and source links are based on the organizations' official pages and were checked on October 23, 2026.
- OpenStreetMap tiles load live.
- ZIP/neighborhood geocoding and drive times come from openrouteservice when a key is configured.

Only the rice-and-beans listing is fictional. OpenStreetMap is used for geography, never as proof that an organization accepts donations.

## Run locally

1. Create a free openrouteservice Standard API key.
2. Install the prototype's local Leaflet dependency:

   ```bash
   npm install
   ```

3. Start the preview with the key in the process environment:

   ```bash
   OPENROUTESERVICE_API_KEY="your-key" npm run preview
   ```

4. Open <http://127.0.0.1:8765>.

The key is read only by `preview_server.py`; it is never written to a file or returned to the browser. Searches are held only in a short-lived in-memory cache, and the server suppresses request logs.

Without a key, the page still opens and displays a clear setup message, but it will not invent driving times.

## Verification

Run the local checks without calling external services:

```bash
npm run check
```

The tests mock geocoding and routing responses and cover live sorting, drive-time filtering, empty distant results, invalid limits, and the in-memory geocode cache.

## Production boundary

This prototype is an approval artifact only. Production implementation remains blocked until the user reviews and explicitly approves this interaction.
