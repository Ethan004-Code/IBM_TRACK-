# RePlate

Community surplus-food exchange and giveaway website, corrected against the user's interview requirements in `docs/interview_me.md`.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Python Flask API (managed workflow provides PORT)
- `pnpm --filter @workspace/echopantry run dev` — original HTML/CSS/JavaScript website served by Vite
- `cd artifacts/api-server/backend && python3 -m unittest -v test_rules test_listing_review` — isolated rule, required-review and photo regression tests
- `python3 artifacts/api-server/backend/check_migration.py` — tests the SQL in a disposable local Postgres cluster, never the app database
- `EP_VERIFY_EXTERNAL=1 EP_TEST_PHOTOS_DIR=/path/to/fixtures python3 artifacts/api-server/backend/check_supabase.py` — authorized live checks using actual onions.jpg, apples.jpg, pears.jpg and rice.jpg photos; creates/removes temporary users, rows and uploads, never bypasses Bob or prints credentials
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, BOB_API_KEY, OPENROUTESERVICE_API_KEY. Never print values.
- Supabase setup: apply `artifacts/api-server/backend/supabase_schema.sql` then `interview_migration.sql` in the existing Supabase project. Never run schema changes at app startup; administrative migrations require user authorization.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Python Flask; existing uploaded Supabase Auth routes retained.
- DB/auth: existing Supabase project. Do not replace it with Replit DB or another auth provider.
- Bob: official IBM Bob Shell 2.0.6 dependency, executed with tool groups disabled and a credential-minimized empty workspace.
- API codegen: Orval (from OpenAPI spec)
- Website build: Vite bundles the imported vanilla module script; no React migration.

## Where things live

- `artifacts/echopantry/` — original uploaded website, adapted forms and activity UI
- `artifacts/api-server/backend/app.py` — uploaded Flask app/auth and legacy endpoint names
- `backend/runtime.py` — installs request-local Supabase snapshots and atomic commit wrapper
- `backend/rules.py`, `destinations.py`, `bob.py` — corrected behavior replaces legacy matching/impact endpoints during app initialization
- `docs/verification.md` — verified checks and outstanding live integration blockers

## Architecture decisions

- Preserve the user's original website and Flask/Supabase stack; this is a correction, not a redesign.
- Use one consistent snapshot and optimistic revision-checked SQL transaction per action for a small pilot. Conflicting writes return 409 instead of partially saving or double-reserving food.
- No in-memory production fallback, fake community listings, inferred spoilage, fabricated directory destinations, or unsupported impact estimates.
- Legacy rows without explicit units/windows remain stored but are not eligible matches. Do not invent missing dates or quantities during migration.

## Product

Listings (up to five bundled items), live Bob surplus interpretation with manual review, reciprocal exchanges, owner-approved giveaways, two-person handoff confirmation, standalone requests, researched fallback directory, user-reported external outcomes, and impact quantities grouped by food/unit.

## User preferences

The uploaded interview is the acceptance source. The whole community is eligible; this is not a students-only product. IBM Bob must run during interaction, not merely generate code.

- Every listing requires Bob approval and a checked photo before posting. Required fields must be complete before asking Bob. Manual entry never bypasses approval.
- Provide a clearly visible photo-posting action for users who want to publish; do not rely on a buried image field.
- Edits, including switching to giveaway, require a fresh approval bound to the exact details, owner and sanitized photo. Approvals are single-use and expire after 15 minutes.
- Older unreviewed rows remain available to their owners for editing but are not publicly available until re-reviewed. Photo/content checks never certify food safety.

## Gotchas

- Startup must work even with invalid service configuration, but account/data operations fail clearly with 503 until the real Supabase setup works.
- Never execute unrestricted Bob tools or pass Supabase/session credentials to its subprocess.
- Managed API workflow now runs Flask; production uses Gunicorn. Do not revive the unused scaffold Express server.
- Table writes must use the request transaction wrapper, not ad hoc direct Supabase writes, for reservation/ledger correctness.
- Session cookies deliberately use Secure, HttpOnly, SameSite=None and Partitioned to work inside the cross-site preview iframe. Keep the same-origin write checks; changing back to Lax can lose iframe sessions.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
