# TradeJournal

TradeJournal is a responsive trading journal for recording trades, reviewing performance, and building consistent trading habits. Signed-in account data is stored in Supabase, with private screenshot storage and a one-time option to migrate legacy browser data.

## Features

- Dashboard metrics, trade P&L, risk summaries, equity and daily performance charts, calendar, and goals.
- Trade log with search, filters, import, editing, CSV export, and trade screenshots.
- Daily journal with pre-market plans, post-trade review, mood, discipline, mistakes, tags, and image attachments.
- Reports, notes, playbooks, and backtesting workspace.
- Profile and account settings, password/email management, backup import/export, and account deletion.
- Responsive light and dark themes.

## Tech stack

- React 18 and Vite
- React Router
- Supabase Auth, Postgres, Row Level Security, Storage, and Edge Functions
- Recharts, date-fns, Papa Parse, and lucide-react

## Requirements

- Node.js 18 or later with npm
- A Supabase project
- Windows PowerShell users can run npm scripts through `npm.cmd`.

## Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Save the project URL and publishable/anon key from **Project Settings → API**.
2. In the Supabase **SQL Editor**, open and run [`supabase/schema.sql`](./supabase/schema.sql). The script is designed to be safely re-run; it creates the app tables, indexes, RLS policies, and private screenshot bucket.
3. In **Authentication → URL Configuration**, set the **Site URL** to the deployed app URL. For local development, use `http://localhost:5173`.
4. Add each app origin and recovery callback to **Redirect URLs**, including:
   - `http://localhost:5173/**`
   - `http://localhost:5173/reset-password`
   - Your production origin, for example `https://your-domain.example/**`
   - Your production recovery callback, for example `https://your-domain.example/reset-password`
5. In **Authentication → Providers → Email**, configure email confirmation as desired. The app's password-recovery flow requires email delivery to be configured. Password recovery redirects to `/reset-password`.
6. Google sign-in is optional. To enable it, configure Google OAuth credentials in the Supabase Google provider and add the Supabase callback URL shown by the provider settings to the Google OAuth client. If the Google provider is disabled, the app reports that it is unavailable and email/password authentication remains usable.

## Environment variables

Copy `.env.example` to `.env.local`, then enter the URL and anon/publishable key for your Supabase project:

```powershell
Copy-Item .env.example .env.local
```

`.env.local` is ignored by Git. The frontend uses only these variables:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

Never put a `service_role` key in a `VITE_` variable, `.env.local`, or any frontend file. The service-role key is privileged and belongs only in the server-side Edge Function environment.

## Install and run locally

From the repository root in Windows PowerShell:

```powershell
npm.cmd install
Copy-Item .env.example .env.local
# Edit .env.local with your Supabase project URL and anon/publishable key.
npm.cmd run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The landing page is at `/welcome`; sign-in and signup are at `/login` and `/signup`.

If script execution policy prevents using `npm`, use `npm.cmd` as above. The `.cmd` executable avoids invoking the PowerShell `npm.ps1` script.

## Production build

```powershell
npm.cmd run build
npm.cmd run preview
```

## Deploy account deletion

The Settings danger zone calls the `delete-account` Supabase Edge Function. It validates the caller's JWT, deletes the caller's rows and screenshot files, and removes the Auth user through the server-side admin API.

Install or invoke the Supabase CLI, authenticate, link the project, and deploy from the repository root:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase functions deploy delete-account
```

The function uses the Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets. Do not add or expose the service-role key in frontend environment variables or source control. If the function is not deployed, Settings can attempt client-authorized cleanup of data and files but cannot delete the Auth user.

## Project structure

- `src/App.jsx` — route configuration and application shell.
- `src/context/AuthContext.jsx` — Supabase session and profile state.
- `src/context/DataContext.jsx` — authenticated data loading and app state.
- `src/data/repo.js` — database row mapping and Supabase CRUD operations.
- `src/data/profile.js` — profile creation and retrieval.
- `src/data/storage.js` — private screenshot upload, signed URL, and deletion helpers.
- `src/data/migrateLocal.js` — legacy localStorage discovery and migration.
- `src/data/mockData.js` — demo data generator.
- `src/pages/` — routed screens, including Settings and the journal.
- `src/utils/trading.js` — trade normalization, calculations, and metrics.
- `supabase/schema.sql` — repeatable database, policy, index, and Storage setup.
- `supabase/functions/delete-account/index.ts` — server-side account deletion function.

## Schema mapping notes

The SQL schema matches the columns used by the current repository layer. Additional application fields are stored in existing JSONB columns rather than sent as unknown database columns:

- Trade metadata without dedicated columns (including `date`, `mistakes`, `outcome`, `pointValue`, `pnlOverride`, `resultOverride`, `status`, `rMultiple`, `tag`, and `quantity`) is stored in `trades.extra`. User tags alone use `trades.tags`.
- Daily journal extras (such as energy, sleep, mistakes, tags, rating, images, and weekly-review data) are stored in `journal_entries.rules`.
- Playbook-specific checklist and presentation metadata is stored in `playbooks.checklist`.
- Profile preferences and optional country are stored in `profiles.settings`; the display name uses `profiles.display_name`.
- `entryTime`/`exitTime` and `entryPrice`/`exitPrice` are UI aliases mapped to `entry_time`/`exit_time` and `entry_price`/`exit_price`.
- Account `balance` is currently supplied as a client-side fallback by the row mapper and is not persisted as an accounts column.

## Troubleshooting

### PowerShell reports that running scripts is disabled

Run npm commands using `npm.cmd` (`npm.cmd install`, `npm.cmd run dev`, or `npm.cmd run build`) rather than `npm`.

### Password recovery says the redirect URL is not allowed

Add the exact local or production `/reset-password` URL under **Authentication → URL Configuration → Redirect URLs**. Check the protocol, hostname, port, and path, and ensure Site URL is configured for the current deployment.

### Supabase returns an RLS or permission error

Run `supabase/schema.sql` in the correct project's SQL Editor. Confirm the caller is signed in, RLS is enabled, and each table policy and the `screenshots` bucket policies are present. Do not disable RLS to work around a policy error.

### Supabase reports “column does not exist”

The app and schema may be out of sync, or the API schema cache may be stale. Re-run the safe schema script against the intended project, then refresh the Supabase API schema cache (Dashboard → **Project Settings → API**, or use the SQL Editor to notify PostgREST with `NOTIFY pgrst, 'reload schema';`). Confirm that unmapped trade metadata is in `trades.extra`, journal extras are in `journal_entries.rules`, playbook metadata is in `playbooks.checklist`, and profile preferences are in `profiles.settings`; do not add guessed columns to silence the error.

### Screenshot upload or signed URL fails

Confirm the private `screenshots` bucket exists and that its Storage policies allow authenticated users to access objects only beneath their own user-id prefix. A screenshot path should begin with the signed-in user's UUID.
