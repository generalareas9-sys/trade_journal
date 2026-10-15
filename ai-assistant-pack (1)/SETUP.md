# TradeJournal AI assistant - setup (FREE version, Google Gemini)

## 1. Copy the files into your project (same folders)
- src/components/AiAssistant.jsx      (new)
- src/components/ai-assistant.css     (new)
- src/pages/Home.jsx                  (replace; only 2 lines added: the import and <AiAssistant />)
- supabase/functions/ai-assistant/index.ts   (new)

## 2. Get a FREE Gemini API key (no card needed)
Open https://aistudio.google.com/apikey  ->  sign in with Google  ->  "Create API key".
Limits change over time; you can see yours in AI Studio. If you hit them, the assistant says "wait a minute and try again".

## 3. Deploy the function (in your project folder)
    npm i -g supabase            (or use: npx supabase ...)
    supabase login
    supabase link --project-ref YOUR_PROJECT_REF
    supabase secrets set GEMINI_API_KEY=your_key_here
    supabase functions deploy ai-assistant

If it says the model is not found, set another free model:
    supabase secrets set AI_MODEL=gemini-2.5-flash
(default is gemini-2.5-flash-lite)

## 4. Run
    npm run dev   ->  open /home  ->  the assistant card is under "Explore your workspace".

## Notes
- The key lives only in Supabase secrets. Never put it in .env.local or any VITE_ variable.
- Only a short numeric summary of the journal is sent (stats, top symbols/sessions/tags, last 8 trades). Notes and screenshots are not sent.
- Google may use free-tier requests to improve its products. If that matters to you, use a paid tier or the Anthropic option:
    supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-...
