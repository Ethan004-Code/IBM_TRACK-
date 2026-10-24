# Verification and remaining setup

## Completed

- Restored the user's supplied HTML/CSS/JavaScript and Flask source, retaining the visual identity and Supabase Auth.
- Ran 24 targeted backend regression tests successfully, covering reciprocal matching, quantity/unit constraints, explicit pickup overlap/deadlines, fixed server-derived offers, participant permissions, reservation rechecks, reservation ownership on cancellation, both-party exchange and giveaway confirmation, duplicate completion, directory exclusions, recommendation versus outcome, test-record exclusions, separate units, and Bob malformed-output/timeout handling.
- Full workspace TypeScript checks and JavaScript syntax checks pass.
- Installed official IBM Bob Shell 2.0.6 from IBM's documented distribution.
- Ran a real Bob interpretation through the restricted Python worker with a fresh description of onions and unopened rice. It returned two foods and retained missing details as unknown. No database action was taken.
- Flask and the website workflows start. The public website displays the real setup state instead of fake accounts, data, or success.

## Still blocked / not verified

- The corrected Supabase API configuration now connects to the existing project. Read-only checks confirmed that the existing app tables are present and empty, while the new revision table and snapshot function are missing. No keys or URL values were displayed.
- The supplied Postgres connection uses an IPv6-only direct endpoint. This workspace rejected the address family before authentication, so the database password has not yet been verified. Use the existing project's IPv4-compatible **Session pooler** connection from Supabase's Connect dialog for the migration.
- No schema changes were applied to the external Supabase project. Apply `backend/supabase_schema.sql` if needed, followed by the additive `backend/interview_migration.sql`. Review and back up existing data first. These scripts do not delete listings or replace the database.
- The first migration was applied by the user, and the live snapshot/public reads work. Real Supabase password sign-in and session resolution passed with three temporary accounts; all temporary users were removed.
- A live listing write exposed an unresolved PL/pgSQL variable qualifier in the first transaction function. The corrected migration now uses an unambiguous variable. Re-run the updated `interview_migration.sql`; it preserves tables/rows and also publishes the contract version checked by the app.
- The corrected original schema plus migration passed on a disposable, isolated local Postgres cluster: initial install and rerun, service-role listing insert/update, multirow rollback, competing revision commits (exactly one winner), anonymous/authenticated-role access denial, and consistent snapshot/revision. This cluster was not an app datastore and was removed.
- Live listing persistence, competing acceptance, and both-party completion checks remain pending until the corrected transaction function is installed. A two-account browser handoff walkthrough and the signed-in UI are not verified.
- Bob was verified at the live worker level, not through an authenticated website interaction (which depends on Supabase).
- Directory facts are manually maintained, sourced to the interview's official URLs and labeled with the interview's check date. They are not live organizational acceptance or appointments.

## Acceptance checks after correcting Supabase setup

1. Confirm `/api/health` reports storage `supabase`.
2. Verify Supabase email-confirmation settings and sign up/sign in with two real pilot accounts.
3. Submit a fresh surplus description through the website's Bob button. Review missing quantities, units and ambiguous dates; nothing should be saved until explicit publication.
4. Create reciprocal listings with matching units/quantities and overlapping pickup windows. Verify incompatible, expired and non-overlapping listings cannot match.
5. Propose two offers competing for the same listing; submit final acceptances concurrently. Only one transaction should reserve the food; the other must return 409.
6. Verify each account can accept and confirm only itself. Cancel one reservation and ensure unrelated reservations remain unchanged.
7. Confirm both accounts' pickup actions complete the handoff once. Repeat the calls and verify the impact ledger has no duplicate quantities.
8. Repeat for a giveaway: request, owner approval, both parties confirm.
9. Open fallback options; no impact is created. Report a real external drop-off with destination and required confirmations; verify user-reported labeling and compost totals stay separate.
