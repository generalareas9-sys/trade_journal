# Project Review Report

**Stage 1 only — audit completed; no application code was changed.** Findings below are based on source/configuration review and the production build. Interactive browser checks requiring a running app, a signed-in account, email access, or a configured Supabase backend were not performed.

## Findings

| # | File | What is wrong | Severity | Proposed fix |
|---|---|---|---|---|
| 1 | `src/data/repo.js:423-427`; `src/context/DataContext.jsx:744-760` | `deleteAllTrades()` issues a delete across the `trades` table without a `user_id` constraint, and `clearAllTrades()` calls it. The schema appears to rely on RLS, but the client request itself is not scoped to the current user. A missing or misconfigured RLS policy could permit deletion of other users' trades. | High | Scope the operation explicitly to the authenticated user (or enforce ownership in a server-side/RLS-protected RPC) before issuing the delete. |
| 2 | `src/data/repo.js:363-378`, `src/data/repo.js:493-521`; `supabase/schema.sql:126-170` | Table-list queries do not include a `user_id` filter and depend entirely on RLS for isolation. That makes ownership less explicit in the client and unsafe if policies are disabled or misconfigured. | Medium | Add authenticated-user filters where supported, while retaining RLS as the authoritative access control; alternatively use user-bound RPCs. Verify policies on the deployed Supabase project. |
| 3 | `src/data/repo.js:224-235`; `src/data/mockData.js:31-34` | `tradeToRow()` omits `account_id` for values matching sentinel strings such as `main` and `funded`, while demo/default accounts use those IDs. Trades assigned to those accounts can therefore lose their account association when saved, affecting account attribution and analytics. | Medium | Resolve UI aliases to actual persisted account IDs before saving, rather than dropping a value based on its string. |
| 4 | `.gitignore:3` | `.env.local` is ignored, but the ignore check did not match `.env`. No root `.env` file was present during this review, but a future environment file using that name could be staged accidentally. | Medium | Ignore `.env` and other local environment files while explicitly allowing the documented `.env.example` template. |

## Checks and results

| Area | Result |
|---|---|
| Production build | `npm.cmd run build` passed: Vite transformed 2,617 modules and completed the production build. No build warnings or errors were reported. |
| Lint | `package.json` defines no lint script, so no project lint command is available to run. |
| Routes and navigation | Source review found the app route and navigation definitions, but every link and route was not opened in a browser. Unknown-URL handling, redirect behavior, and signed-out route blocking remain unverified at runtime. |
| Console diagnostics | Browser console output was not available in this review. Console errors/warnings across the requested pages remain unverified. |
| Authentication | Signup/8-digit verification, login, logout, password recovery/reset, and the Google button message were not exercised against a live auth project. |
| Data workflows | Add/edit/delete trade, CSV import/undo, journal autosave, notes, playbooks, goals, screenshots, profile photo, and demo-data workflows were not run against a live backend. Static review identified findings 1 and 3 above. |
| Database columns | Static inspection identified the account-link persistence issue in finding 3. Runtime writes against the deployed schema were not attempted. |
| User-data isolation | Static inspection found unfiltered reads and an unfiltered delete in findings 1 and 2. Deployed RLS policies and cross-user behavior were not tested. |
| Totals and zero-trade behavior | Dashboard, Daily Journal, Trade Log, Reports, and Weekly Review were not populated and compared in a running app; matching totals and zero-trade safety remain unverified. |
| Layout and responsive behavior | No viewport/browser session was available to test overlap, horizontal scrolling, minimum text size, sticky headers, dropdown layering, or modal layering at 375px, 768px, and 1366px in both themes. |
| Accessibility | Static review did not constitute a full keyboard, screen-reader, focus, label, alt-text, or contrast audit. Runtime accessibility remains unverified. |
| Secrets and environment files | `.env.local` is ignored; `.env` is not ignored by the current ignore rules (finding 4), and no root `.env` file was present. A complete secret scan and live configuration review were not performed. |
| Landing-page claims | Claim/feature-badge accuracy was not independently validated against live product behavior. |
| Deployment metadata | The production build succeeded. Deep-link behavior on Vercel and the deployed title, metadata, and favicon rendering were not tested in a deployed browser. |

## Stage 2

Approval received. High/medium findings were handled individually with a build after each code/configuration group:

| Finding | Outcome |
|---|---|
| 1 | Fixed: bulk trade deletion now requires a signed-in user ID and filters by `user_id`; the DataContext passes the active user's ID. |
| 2 | Fixed: all collection reads for trades, accounts, journal entries, notes, and playbooks now require the active user ID and filter on `user_id`. Existing RLS remains in place. |
| 3 | Not changed: further inspection found the reported write path does not reproduce. Demo loading replaces the sample account alias with the newly persisted account UUID, and local-data migration explicitly normalizes legacy trades with `account: null`. The schema requires `account_id` to reference a UUID account, so persisting the literal `main`/`funded` aliases would be invalid; inventing a mapping could misattribute trades. |
| 4 | Fixed: `.env` and `.env.*` are ignored, while `.env.example` remains explicitly allowed. Existing `.env.local` ignore entry was retained. |

Builds passed after the deletion-scope change, collection-read scoping, and environment-file ignore update. Runtime checks listed above still require a live browser/backend and were not performed.
