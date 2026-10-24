# EchoPantry verification

## Required photo and Bob approval update

- **39 isolated tests pass**, including required fields, missing/foreign/expired/reused/changed approval rejection, giveaway-switch protection, malformed/uncertain/rejected Bob output, successful review without automatic posting, photo decoding, metadata removal and private/deleted-photo access controls.
- The updated additive SQL passes its disposable PostgreSQL check, including reruns, atomic approval consumption with listing writes, private receipt permissions, duplicate receipt protection and existing reservation concurrency checks.
- Private App Storage upload/download/delete was checked with temporary images; all temporary objects were removed.
- Real Bob ACP image prompts inspected image contents, accepted a relevant three-onion photograph after deterministic server validation, and rejected an unrelated blue image during integration. The worker has no filesystem, terminal, MCP or other tool access. No production listing was created by these probes.
- OpenAPI generation, workspace type checks, production frontend build and JavaScript syntax checks pass.
- The publishing form uses a visible native image input. A frontend state check covers immediate local preview, keeping the selected image after an upload failure, retry, successful upload, preview URL cleanup and removing an image during an in-flight upload without restoring a stale result. A local preview never counts as an uploaded or approved photo.
- The homepage and desktop navigation expose photo-posting actions that open the image chooser and bring the uploader into view. The uploader comes before the longer listing fields. A frontend state check confirms guest selection/preview without opening sign-in, retaining the selected file when sign-in is requested, and keeping posting blocked after a failed authenticated upload.
- **Pending:** the user must apply the latest `artifacts/api-server/backend/interview_migration.sql` to the existing Supabase project. The old database schema is intentionally blocked from new writes until this update; existing rows are preserved.
- The earlier live API results below predate mandatory photo approval. The updated live checker now requires real food-photo fixtures and the latest schema. The signed-in browser photo-upload/review/publish flow has not yet been exercised.

## Completed

- Restored the user's supplied HTML/CSS/JavaScript and Flask source, retaining the visual identity and Supabase Auth.
- Ran 24 targeted backend regression tests successfully, covering reciprocal matching, quantity/unit constraints, explicit pickup overlap/deadlines, fixed server-derived offers, participant permissions, reservation rechecks, reservation ownership on cancellation, both-party exchange and giveaway confirmation, duplicate completion, directory exclusions, recommendation versus outcome, test-record exclusions, separate units, and Bob malformed-output/timeout handling.
- Full workspace TypeScript checks and JavaScript syntax checks pass.
- Installed official IBM Bob Shell 2.0.6 from IBM's documented distribution.
- Ran a real Bob interpretation through the restricted Python worker with a fresh description of onions and unopened rice. It returned two foods and retained missing details as unknown. No database action was taken.
- Flask and the website workflows start. The public website displays the real setup state instead of fake accounts, data, or success.
- The user applied the corrected Supabase migration. `/api/health` now reports `status: ok`, `storage: supabase`, and no setup requirements.
- All **38 live API checks** in `backend/check_supabase.py` passed against the configured Supabase project: three real password logins/session resolutions, persistent listings, reciprocal matching, fixed offer contents, participant permissions, simultaneous competing acceptances with one winner and one 409, reservation ownership on cancellation, both-party exchange and giveaway completion, replay/idempotency, recommendation versus reported donation, test-impact exclusions, authenticated Bob interpretation, and logout.
- The live check created only its own temporary users and rows. Test listings were flagged before handoffs so test outcomes did not alter real community impact. Temporary profiles, Auth accounts, listings, offers, requests, notifications, and ledger records were removed afterward.
- The corrected SQL also passed on a disposable local Postgres cluster: install and rerun, service-role listing insert/update, all-or-nothing rollback, concurrent revision conflicts, browser-role function denial, and consistent snapshots. The temporary cluster was removed and was never used as the app's datastore.
- Public-page screenshots were checked at desktop and mobile sizes. The final desktop capture shows no setup warning and reads the real empty database, not sample listings.

## Remaining verification limits

- The live checks exercised the website's HTTP API, not browser clicks. A two-account signed-in browser walkthrough, browser cookie persistence, and field editing in the Bob form have not been independently verified. Server cookie flags were checked separately.
- Verification accounts were created with Supabase Admin and email confirmation enabled, so no verification emails were sent. Signup email delivery and the project's confirmation-link configuration were not tested.
- Compost policy and unknown-destination rejection passed isolated rule tests; the live API pass covered external donation rather than a compost submission.
- Directory facts are manually maintained, sourced to the interview's official URLs and labeled with the interview's check date. They are not live organizational acceptance or appointments.
- Direct Postgres maintenance is still unavailable with the supplied IPv6-only endpoint. It is not needed for normal app operations. Future authorized schema changes can use the Supabase SQL Editor or a dashboard-supplied IPv4 Session pooler connection.

## Pilot browser checks still recommended

1. Sign up through the website using two pilot email addresses; follow confirmation links if the Supabase project requires them.
2. Sign in within the embedded preview, reload, and check that the session remains active.
3. Use the Bob button with a fresh description, correct the extracted fields, and publish only after resolving missing quantities/units/dates.
4. Complete an exchange and giveaway using each account's own buttons; ensure the UI refreshes correctly and displays partner confirmation state.
5. Review fallback options and verify donation/compost reporting controls require actual completed drop-off confirmations.
