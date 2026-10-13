# TradeJournal AI setup

TradeJournal AI calls Anthropic from the Supabase Edge Function. The Anthropic key is read only by the function; do not add it to frontend code, a `VITE_` variable, or a committed `.env` file.

## Deploy the function

1. Create an API key in the Anthropic Console: <https://console.anthropic.com/settings/keys>.
2. Install and authenticate the Supabase CLI if needed, then link this repository to your Supabase project:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Store the key and the exact origins allowed to call the function as Supabase secrets. Replace the placeholders with your own values; do not commit the real key:

   ```powershell
   supabase secrets set AI_API_KEY=YOUR_ANTHROPIC_API_KEY AI_ALLOWED_ORIGINS=https://your-production-site.example
   ```

   Replace `YOUR_PROJECT_REF`, `YOUR_ANTHROPIC_API_KEY`, and the example production domain with your actual values before running the commands. For multiple app origins, provide a comma-separated `AI_ALLOWED_ORIGINS` value. The function also permits `http://localhost:5173` and `http://127.0.0.1:5173` for local development. `AI_MODEL` is optional; if omitted, the function uses `claude-haiku-4-5-20251001`.

4. Deploy the function:

   ```powershell
   supabase functions deploy journal-ai
   ```

The function verifies the user's Supabase JWT, rejects anonymous users, and returns generic errors rather than provider details. It caps each request at 10 messages, 2,000 characters per message, and 600 generated tokens, and applies a 20-request daily limit per user. The daily counter is intentionally in memory because persistent rate-limit storage would require a schema change; it is best-effort per running function instance and resets when that instance restarts.

Until the function is deployed and successfully answers a request, the Home card remains marked **Coming soon**. The quick questions and chat show a friendly unavailable message with retry guidance if the function is not reachable. After a successful response, the badge changes to **Beta**.
