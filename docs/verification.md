# RePlate verification

## Required photo and Bob approval update

- **41 isolated tests pass**, including required fields, missing/foreign/expired/reused/changed approval rejection, giveaway-switch protection, malformed/uncertain/rejected Bob output, successful review without automatic posting, photo decoding, metadata removal, private/deleted-photo access controls and route-search ownership/input protection.
- The updated additive SQL passes its disposable PostgreSQL check, including reruns, atomic approval consumption with listing writes, private receipt permissions, duplicate receipt protection and existing reservation concurrency checks.
- Private App Storage upload/download/delete was checked with temporary images; all temporary objects were removed.
- Real Bob ACP image prompts inspected image contents, accepted a relevant three-onion photograph after deterministic server validation, and rejected an unrelated blue image during integration. The worker has no filesystem, terminal, MCP or other tool access. No production listing was created by these probes.
- OpenAPI generation, workspace type checks, production frontend build and JavaScript syntax checks pass.
- The publishing form uses a visible native image input. A frontend state check covers immediate local preview, keeping the selected image after an upload failure, retry, successful upload, preview URL cleanup and removing an image during an in-flight upload without restoring a stale result. A local preview never counts as an uploaded or approved photo.
- The homepage and desktop navigation expose photo-posting actions that open the image chooser and bring the uploader into view. The uploader comes before the longer listing fields. A frontend state check confirms guest selection/preview without opening sign-in, retaining the selected file when sign-in is requested, and keeping posting blocked after a failed authenticated upload.
- The user applied the latest additive SQL update. The connected website now reports healthy Supabase storage with no setup requirements; schema version 3 and both photo/approval tables are available.
- **17 live photo-posting API checks passed** against the real configured services: authenticated login, required approval, private upload and owner preview, unposted-photo privacy, required-detail checks, actual Bob image approval, no automatic publication after review, changed-detail rejection, approved posting, persisted photo/receipt linkage, public feed and JPEG serving, single-use approval enforcement, saved-photo deletion protection, withdrawal and withdrawn-photo privacy. The temporary account, listing, approval, photo registry entry and App Storage image were removed.
- The earlier broader API results below predate mandatory photo approval. The signed-in browser photo-upload/review/publish flow has not yet been exercised; frontend state checks cover selection, preview, retry and stale results.

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

- Earlier broad live checks exercised the HTTP API. The map-specific signed-in browser checks below verify one account's native login and reload persistence; a two-account handoff walkthrough and browser photo-review/publishing flow remain unverified.
- Verification accounts were created with Supabase Admin and email confirmation enabled, so no verification emails were sent. Signup email delivery and the project's confirmation-link configuration were not tested.
- Compost policy and unknown-destination rejection passed isolated rule tests; the live API pass covered external donation rather than a compost submission.
- Directory facts are manually maintained, sourced to the interview's official URLs and labeled with the interview's check date. They are not live organizational acceptance or appointments.
- Direct Postgres maintenance is still unavailable with the supplied IPv6-only endpoint. It is not needed for normal app operations. Future authorized schema changes can use the Supabase SQL Editor or a dashboard-supplied IPv4 Session pooler connection.

## New RePlate fallback map

- Production build and JavaScript syntax checks pass for the main page, alternate new page and legacy page.
- Authenticated desktop and 402px mobile browser checks passed using a temporary private, withdrawn packaged-food listing. The initial directory map, numbered markers, matching card selection, keyboard selection, repeated close/reopen and live city-based driving estimates work without requesting precise device location.
- Real San Jose searches returned three destinations within 30 and 60 minutes and two within 15 minutes. These are car estimates, not organization acceptance or opening-hours guarantees.
- Browser-intercepted simulated provider failure retained the directory and retry control; simulated empty success showed a distinct empty state and expandable unranked directory. Neither simulated state is presented as a live provider response.
- Nine focused frontend state checks passed, including late-response rejection after area edits, sheet replacement, sheet close and another sheet replacing a pending fallback fetch. These race checks used a Node VM, not browser timing.
- The temporary auth account, listing, profile, notifications and local session file were removed. No listing was published and no donation or compost outcome was recorded.

## Public donation-locations entry point

- Discover now offers Donation locations without signing in or creating a listing, including loading, empty and listing-error states. It reuses the existing map controller, directory cards and driving-time search renderer.
- The public directory and route endpoints reuse the existing directory and routing provider. They bypass account lookup and private database snapshots, do not write outcomes, and retain same-origin request protection. Listing-specific donation/reporting endpoints remain protected.
- All 54 targeted Python tests pass, including public access, stale-cookie browsing, provider errors, missing configuration, malformed search input, cross-origin rejection and protection of listing/outcome endpoints. OpenAPI code generation, generated-library type checks and the production build pass.
- A real anonymous preview request returned all three directory locations, and a real anonymous San Jose driving search returned three locations within 30 minutes. No database fixtures or public food posts were created.
- Eleven frontend VM checks passed for anonymous loading/search/results, public cards without reporting controls or item-match claims, error/empty states, stale response cancellation and retention of owner reporting controls.
- A 402px preview screenshot confirms that the signed-out Discover page displays the new button in the existing layout. The public panel's click-through flow was checked through frontend state tests rather than a new browser automation pass; the unchanged Leaflet controller was browser-verified in the earlier fallback-map pass.

## Pilot browser checks still recommended

1. Sign up through the website using two pilot email addresses; follow confirmation links if the Supabase project requires them.
2. Sign in within the embedded preview, reload, and check that the session remains active.
3. Use the Bob button with a fresh description, correct the extracted fields, and publish only after resolving missing quantities/names/dates.
4. Complete an exchange and giveaway using each account's own buttons; ensure the UI refreshes correctly and displays partner confirmation state.
5. Review fallback options and verify donation/compost reporting controls require actual completed drop-off confirmations.

## Count-only quantities and bounded dates

- Current and legacy forms use whole-number quantities 1–99, with units included in food names. Historical units retain their meaning on cards, details, editing and Impact; matching recognizes the explicit historical unit spelling without converting physical units.
- Server pickup validation requires now ≤ start < end ≤ deadline ≤ one calendar year ahead. Giveaway requests must be wholly inside both the listing's pickup window and deadline; partial overlaps are rejected rather than silently clipped.
- Printed dates accept two calendar years back through ten ahead in the listing timezone. Past Best by warns and remains discoverable; past Use by and Expiration are rejected. Leap-day calendar bounds clamp to February 28 consistently.
- Verification: 67 no-network Python rule/review/destination regressions, 10 Node quantity/date-helper tests, generated API library typechecks and the Vite production build passed.
- Browser checks at 390×844 passed for quantity errors, populated input bounds, simulated picker min/max bypass, change-only Clear events surviving a form rerender, printed-date warnings/errors, and no horizontal overflow.
- Request-sheet browser checks used isolated network fixtures, not real accounts or database writes. Invalid/out-of-window/cleared times made zero POSTs. One valid request used a mocked 201 and verified the exact UTC payload and visible confirmation.
- The initial browser run overlapped source edits, causing Vite page reloads and resetting the unsaved editor. With source frozen, a 17-second stability check preserved the manual draft through background polling. These were iPhone-size browser checks, not physical iPhone/Safari testing.
