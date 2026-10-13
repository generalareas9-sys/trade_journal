# TradeJournal AI setup

TradeJournal AI calls Anthropic from the Supabase Edge Function. The Anthropic key is read only by the function; do not add it to frontend code, a `VITE_` variable, or a committed `.env` file.

## Deploy the function

1. Create an API key in the Anthropic Console: <https://console.anthropic.com/settings/keys>.
2. Install and authenticate the Supabase CLI if needed, then link this repository to your Supabase project:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Store the key and the exact origins allowed to call the function as Supabase secrets. `AI_ALLOWED_ORIGINS` must include the exact origin of the deployed web app (scheme and host, no path); otherwise browsers block the call. Replace the placeholders with your own values; do not commit the real key:

   ```powershell
   supabase secrets set AI_API_KEY=YOUR_ANTHROPIC_API_KEY AI_ALLOWED_ORIGINS=https://your-production-site.example
   ```

   Replace `YOUR_PROJECT_REF`, `YOUR_ANTHROPIC_API_KEY`, and the example production domain with your actual values before running the commands.    For multiple app origins, provide a comma-separated `AI_ALLOWED_ORIGINS` value. The function also permits `http://localhost:5173` and `http://127.0.0.1:5173` for local development. `AI_MODEL` is optional; if omitted, the function uses Anthropic's documented Claude Haiku 5.5 API ID, `claude-haiku-5-5`.

4. Deploy the function:

   ```powershell
   supabase functions deploy journal-ai
   ```

The function verifies the user's Supabase JWT, rejects anonymous users, and returns generic errors rather than provider details. It caps each request at 10 messages, 2,000 characters per message, and 600 generated tokens, and applies a 20-request daily limit per user. The daily counter is intentionally in memory because persistent rate-limit storage would require a schema change; it is best-effort per running function instance and resets when that instance restarts.

If `AI_API_KEY` is already configured, update the allowed origin without changing the key by setting `AI_ALLOWED_ORIGINS` separately:

```powershell
supabase secrets set AI_ALLOWED_ORIGINS=https://your-production-site.example
```

After changing function code or secrets, deploy with `supabase functions deploy journal-ai`. Check the function's Edge Function logs in the Supabase Dashboard for sanitized request categories and provider HTTP status; no API key, authorization header, or journal content is logged.

Until the function is deployed and successfully answers a request, the Home card remains marked **Coming soon**. The quick questions and chat show a friendly unavailable message with retry guidance if the function is not reachable. After a successful response, the badge changes to **Beta**.
