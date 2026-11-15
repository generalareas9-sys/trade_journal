# Vercel deployment

## Deploy

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the detected Vite settings (`npm run build`, output directory `dist`).
3. In the Vercel project's **Settings → Environment Variables**, add these for Production (and Preview/Development if needed):
   - `VITE_SUPABASE_URL` — the Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY` — the project's anon/publishable key. Never use a service-role key in the browser app.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to the production domain and add the production domain and its `/reset-password` path to Redirect URLs. Add the Vercel preview URL patterns too if preview deployments need authentication.
5. Add the custom domain in Vercel **Settings → Domains** and apply the DNS records Vercel provides.
6. In Supabase **Authentication → Providers → Email**, enable email confirmation and configure the confirmation redirect URL to the production domain.
7. Deploy the account deletion Edge Function from the project root with the Supabase CLI:

   ```sh
   supabase functions deploy delete-account
   ```

   Configure any function secrets in Supabase; do not add service-role credentials to Vite environment variables.
8. Deploy from Vercel and wait for the build and deployment to finish.

## Admin email notifications

The registration webhook uses a shared secret instead of a user JWT. The
`supabase/config.toml` setting for `notify-registration` disables gateway JWT
verification; the function itself still validates
`x-registration-webhook-secret`. Keep that secret strong and private.

Before deploying the notification functions:

1. Configure these Edge Function secrets in the linked Supabase project:
   - `RESEND_API_KEY` — the Resend API key.
   - `RESEND_FROM_EMAIL` — a sender address on a verified Resend domain.
   - `ADMIN_NOTIFICATION_EMAIL` — `oseidebrahim@gmail.com`.
   - `REGISTRATION_WEBHOOK_SECRET` — a strong random secret.
2. Add the same registration secret to Supabase Vault as
   `tradejournal_registration_webhook_secret`, and add the project URL as
   `tradejournal_project_url`. The URL must be the Supabase project URL, not
   the frontend URL.
3. Apply `supabase/email_notifications_migration.sql` to the intended project.
4. Deploy `notify-registration` using the repository's Supabase configuration:

   ```powershell
   npx.cmd supabase functions deploy notify-registration
   ```

The migration and registration function expect the two Vault secret names
exactly as written above. Do not put Resend or registration webhook secrets in
frontend variables, source files, or Git.

## Before production

- Replace `https://your-domain.com` in `index.html`, `public/robots.txt`, and `public/sitemap.xml` with the chosen production domain.
- Verify Vercel's Content-Security-Policy Supabase host matches the project configured by `VITE_SUPABASE_URL`.
- Verify Supabase Site URL and Redirect URLs use the exact production domain and `/reset-password`.
- Confirm email confirmation is enabled and account deletion works against the deployed Edge Function.
- Open `/welcome`, `/login`, `/signup`, `/terms`, `/privacy`, and `/disclaimer` directly; refresh a protected deep link such as `/reports` and confirm it does not return a 404.
- Verify sign-up, email confirmation, sign-in, password reset, trade loading/import, reports, and account deletion.
- Check that production responses include the security headers and that the browser console has no deployment, CSP, or asset-loading errors.
- Confirm `.env.local` is not committed and Vercel has both required `VITE_` variables for the Production environment.
