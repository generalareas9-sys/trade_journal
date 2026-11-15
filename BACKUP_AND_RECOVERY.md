# TradeJournal backup and recovery

## What the in-app export contains

In Settings → Data, **Download all my data** exports the current TradeJournal data model as JSON: trades, journal entries, notes, playbooks, accounts, profile, settings (including the existing trading goals), import settings, playbook checklists, saved view preferences, the AI assistant's current conversation (up to 30 messages), saved backtest analysis snapshots, and saved risk-calculator inputs/results. The file can be imported from the same screen.

Backtest snapshots store metrics derived from saved trades; they are not historical market-data replays. The risk calculator still keeps its editable form draft locally as well as supporting saved cloud calculations. The JSON includes paths/references to trade screenshots, not the image files themselves. Supabase Storage objects and authentication accounts are not included in the database dump commands below.

Before using the new saved records, run `supabase/user_records_migration.sql` in the Supabase SQL Editor. It creates three additive tables with per-user Row Level Security; it does not delete existing records.

## Windows: create a database backup

Supabase Free projects do not have automatic database backups; Pro projects have daily backups retained for seven days. This command-line backup procedure is a separate manual backup and works independently of the project plan.

Prerequisites:

1. Install the Supabase CLI and PostgreSQL client tools (`psql` is needed for restore).
2. In PowerShell, sign in to the CLI and link this repository to the intended project. The CLI will prompt for the project reference and database password; do not paste credentials into source files:

   ```powershell
   supabase login
   supabase link --project-ref <project-ref>
   ```

3. Make a private backup folder. Keep its contents off GitHub and store a second encrypted copy somewhere separate from this computer.

Run this in PowerShell from the repository root. It creates separate plain-SQL schema and data dumps for the `public` schema, and stops if either dump fails:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$schemaFile = Join-Path (Resolve-Path .\backups) "tradejournal-$timestamp-schema.sql"
$dataFile = Join-Path (Resolve-Path .\backups) "tradejournal-$timestamp-data.sql"

supabase db dump --linked --schema public --file $schemaFile
if ($LASTEXITCODE -ne 0) { throw 'Schema backup failed.' }

supabase db dump --linked --schema public --data-only --file $dataFile
if ($LASTEXITCODE -ne 0) { throw 'Data backup failed.' }

Get-Item $schemaFile, $dataFile | Select-Object FullName, Length, LastWriteTime
```

The dump contains database objects and rows in `public`, including the saved AI, backtest, and risk-calculator records; it does not include Supabase Auth users, Storage object contents, or a full project configuration backup. The CLI uses the linked database credentials. Do not put database passwords, access tokens, or service-role keys in this repository.

## Recovery

### Restore a paused project

Use the Supabase Dashboard's project restore/resume flow. A project that is still within its restore window may be resumed there. The Free-plan restore window is limited; verify the current Dashboard prompt and available options rather than assuming an old project can still be restored. Keep independent backups because resuming a project is not the same as restoring a chosen point-in-time backup.

### Restore the SQL dump into a new project

Use a newly created, otherwise empty Supabase project. Do not run these commands against a project containing data you need: the schema dump creates objects and the data dump inserts rows. These commands do not drop or truncate tables.

1. Install PostgreSQL client tools and set the new project's database host/reference and password. Supabase Dashboard → Project Settings → Database shows the connection details.
2. In PowerShell, securely load the password into this process, then run `psql` first on the schema file and only then on the data file. Replace `<new-project-ref>` and enter the timestamp from the paired backup filenames:

   ```powershell
   $timestamp = Read-Host 'Backup timestamp (YYYYMMDD-HHmmss)'
   $schemaFile = Join-Path (Resolve-Path .\backups) "tradejournal-$timestamp-schema.sql"
   $dataFile = Join-Path (Resolve-Path .\backups) "tradejournal-$timestamp-data.sql"
   $securePassword = Read-Host 'New project database password' -AsSecureString
   $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
   try {
     $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
   } finally {
     [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
   }

   try {
     $connection = 'host=db.<new-project-ref>.supabase.co port=5432 dbname=postgres user=postgres sslmode=require'
     psql $connection --set=ON_ERROR_STOP=1 --file $schemaFile
     if ($LASTEXITCODE -ne 0) { throw 'Schema restore failed; data was not restored.' }

     psql $connection --set=ON_ERROR_STOP=1 --file $dataFile
     if ($LASTEXITCODE -ne 0) { throw 'Data restore failed.' }
   } finally {
     Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
   }
   ```

3. Verify table row counts and sign in before pointing the app at the new project.

The exported application rows refer to Supabase Auth user IDs. The `public` dump does not create those Auth accounts. Before restoring user rows, arrange for the new project to have the corresponding users/IDs through a supported Supabase Auth migration process; do not copy password hashes or authentication secrets into application tables. Storage screenshots and avatars must also be backed up and restored separately. If either identity or Storage recovery is required, test the procedure on a disposable project first.

## Temporary Free-plan keep-alive

The project owner confirmed this project is on the Free plan. The temporary workflow at `.github/workflows/supabase-free-keepalive.yml` sends a daily read-only request to the `profiles` REST endpoint. With no signed-in user's JWT, RLS returns no profile rows. The request is not a backup and does not guarantee the project will never pause.

Before it can run, add these GitHub Actions repository secrets under Settings → Secrets and variables → Actions:

- `SUPABASE_URL`: the project's URL.
- `SUPABASE_ANON_KEY`: its anon/publishable key only. Never use a service-role key.

The schedule runs at 06:15 UTC and can also be started manually with `workflow_dispatch`. Scheduled workflows run only after this file is on the repository's default branch. Disable or remove this temporary workflow if the project moves to Pro.
