# Final Project Review

## Scope and verification

- **Build:** `npm.cmd run build` completed successfully.
- **Lint:** `package.json` does not define a lint script, so a project lint command could not be run.
- **Browser smoke check:** Visited public landing, authentication, resource, legal, and unknown routes, and attempted protected routes while signed out. The tested protected routes redirected to `/welcome`; an unknown URL showed the 404 page. No browser console errors or uncaught page errors were captured in the smoke check.
- **Responsive spot check:** Measured horizontal overflow at 375px, 768px, and 1366px in light and dark class states on `/welcome`, `/login`, and an unknown URL. Those sampled routes had no horizontal overflow. This does not establish responsive behavior for authenticated pages.
- **Static review:** Inspected route definitions, data access and ownership policies, relevant page styles, deployment configuration, metadata, and project ignore rules.

## Findings

| # | Page or file | What is wrong | Severity | Proposed fix |
|---|---|---|---|---|
| 1 | `index.html`; `vercel.json` | The pre-paint theme initializer is an inline script, while the deployed Content Security Policy sets `script-src 'self'` and does not allow inline scripts. Browsers enforcing the Vercel policy will block the initializer, so the saved theme can flash or fail to apply before first paint. The local development smoke check does not apply this deployed header. | Medium | Move the initializer to a same-origin external script, or authorize its exact content with a CSP hash/nonce while keeping the policy restrictive. Verify the deployed response headers and first-paint behavior. |
| 2 | `src/App.jsx`; `src/hooks/useShortcuts.js` | The keyboard-shortcuts help surface declares `role="dialog"` and `aria-modal="true"` but does not provide Escape-to-close or keep keyboard focus inside the dialog. The shortcut handler also ignores keys while the help dialog is open, so Escape currently cannot close it through that handler. | Medium | Add Escape handling, move focus into the dialog when it opens, trap Tab/Shift+Tab within it, and restore focus to the opener when it closes. |
| 3 | `src/pages/dailyJournal.css`; `src/weekly-review.css`; `src/risk-calculator.css`; `src/styles.css` | Several visible labels and supporting text are styled below 12px; examples include Daily Journal field labels at 11px, Weekly Review eyebrow/metric text at 10–11px, Risk Calculator labels at 10–11px, and the marquee at 9px. This reduces readability, particularly on mobile. Some smaller values are decorative chart annotations. | Medium | Raise essential labels, instructions, and controls to at least 12px and re-check mobile layouts. Keep smaller decorative chart text only where it remains legible and is not the sole source of information. |
| 4 | `index.html`; `public/` | Canonical and Open Graph URLs still use `https://your-domain.com/`. The Open Graph and Twitter image URLs point to `/og-image.png`, which is not present in `public/`. This can produce incorrect search and link-preview metadata after deployment. | Low | Replace the placeholder domain with the production domain and point social metadata to an existing suitable image or add the intended image asset. |
| 5 | `src/data/repo.js`; `supabase/schema.sql` | Several updates and deletes filter by row ID, import-batch ID, or demo flag without adding an explicit `user_id` predicate in the query. The inspected schema does define per-user RLS policies for these tables, so this is not evidence of cross-user access in the current configuration; however, those mutation calls rely on RLS as the ownership boundary rather than making ownership explicit in the query. | Low | Where the signed-in user ID is available, add explicit ownership predicates to mutation queries as defense in depth, and retain the RLS policies. Exercise the changes with two separate test accounts before release. |

## Requested audit areas

1. **Build, lint, and console:** Build passed. No lint script is configured. No browser console/page errors were captured in the routes exercised; this is not a full signed-in session across every page.
2. **Routes and links:** The inspected route configuration includes a last-position catch-all. Smoke checks reached the landing, auth, resource, and legal pages; the unknown URL showed the 404 screen. The tested protected routes redirected signed-out navigation to `/welcome`. Every sidebar and in-app link was not clicked end-to-end.
3. **Authentication:** Login, signup, forgot-password, and reset-password screens were visited, but registration codes, credential submission, logout, password reset completion, and Google authentication were not exercised against a live account/provider.
4. **Data and ownership:** Data access and schema/RLS definitions were inspected statically. No live trade edits/deletes, CSV import/undo, journal autosave, notes, playbooks, goals, uploads, profile-photo changes, or demo-data operations were performed. The inspected RLS policies constrain rows to `auth.uid()`. No schema mismatch was confirmed in the inspected mappings; the mutation-query scoping note is finding 5.
5. **Numbers:** No live account dataset was available for cross-page totals comparison or zero-trade runtime testing. Build/source inspection did not establish a reproducible NaN/Infinity defect.
6. **Responsive layout:** The sampled public routes had no horizontal overflow at the three requested widths in both theme class states. Authenticated pages, all breakpoints, overlaps, clipping, sticky behavior, and modal fit were not fully visually tested. The sub-12px typography finding is recorded above.
7. **Interactive behavior:** Public route rendering and signed-out redirects were smoke-checked. Data workflows, all menu/modal dismissal paths, loading states, and form validation were not exhaustively exercised. The shortcuts-dialog keyboard-accessibility issue is finding 2.
8. **Animation:** Source inspection found reduced-motion handling on recently added animated UI, but animation behavior across every component was not exhaustively tested in a browser. No separate confirmed animation defect was identified.
9. **Clarity and contrast:** The confirmed readability concern is the visible sub-12px text in finding 3. A complete contrast audit of every state and theme was not performed.
10. **Security:** No service-role key was found during source review. `.env.local` is ignored by Git; its contents were not opened. RLS ownership policies are present in the inspected schema. This review did not include a penetration test or live authorization tests.
11. **Landing-page claims:** The reviewed copy describes backtesting filters on recorded trades and explicitly says candle-by-candle replay is still on the way. No clearly unsupported feature claim was confirmed in the inspected landing content.
12. **Deployment:** `vercel.json` contains a deep-link rewrite to `/index.html`; favicon and web-manifest links are present. The theme-script/CSP conflict and placeholder/missing social metadata are findings 1 and 4.

## Limits

This is a static review plus a limited local browser smoke check, not a full QA sign-off. In particular, live authentication and data flows require a test account and backend, and authenticated-page responsiveness and visual details require an authorized signed-in browser session. No application source or configuration was changed during this audit.
