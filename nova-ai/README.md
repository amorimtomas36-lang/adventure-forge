# Nova AI V1

Online AI workspace with per-account private history, a multi-provider model selector, and a public API directory.

## Deploy

This folder is a Docker web service. Configure the following in Render Environment as needed:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `MISTRAL_API_KEY`
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`

Kilo Gateway is included as an anonymous free-model option and does not need a server API key. Kilo documents a 200 requests/hour/IP anonymous limit for free models; the quota is shared by requests leaving the Render service. Some free upstream models may log prompts/outputs, so users should not send personal or confidential information through those models.

Run `supabase.sql` in Supabase SQL Editor before enabling accounts. Enable email sign-up and configure the allowed redirect URL as `https://nova-ai-3cm8.onrender.com`.

## Social sign-in

The site includes Google, Discord, GitHub, and Apple OAuth buttons. Each provider must be registered by the project owner and configured in Supabase Auth Providers with its Client ID and Client Secret. The Supabase callback URL is:

`https://nvcuoalwtbyniqeerqpk.supabase.co/auth/v1/callback`

OAuth client secrets must never be committed to GitHub or placed in browser code. The social buttons are only operational after the provider credentials have been configured in Supabase.

## AI providers

The selector supports OpenAI, Google Gemini, Groq, OpenRouter, Mistral AI, Cloudflare Workers AI, and Kilo Gateway. Provider model catalogs are fetched from each service. Except for Kilo's documented anonymous free models, each integration needs its own server-side credentials and may have quotas or costs.

## API directory

Reads the public-apis/public-apis README, caches it for 12 hours, and displays links and declared authentication fields. This is a directory, not a universal free API key. Entries may require registration, keys, payment, or have usage limits.

## Privacy

Supabase Auth identifies users. RLS policies scope each conversation and message to `auth.uid()`. The backend verifies the bearer token before allowing AI requests. Provider requests are sent to the selected provider under that provider's privacy and retention terms.

Never put provider API keys or Supabase secret/service_role keys in browser code.
