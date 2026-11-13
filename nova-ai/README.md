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

FreeLLMAPI is integrated as the default free-model router. It runs as a separate Render service; the Nova AI backend authenticates to it server-side and never sends the router's administrative or unified API key to the browser. The preconfigured no-key upstreams are Kilo Gateway, OVHcloud AI Endpoints, and AI Horde. The Nova backend limits this shared free pool to 20 requests/hour per signed-in account and 150 requests/hour globally. Upstream limits still apply; queues and availability vary.

FreeLLMAPI supports additional provider integrations, but most require a separate account/API key. Those providers are not automatically enabled just because they appear in the catalog. Add credentials only through server-side configuration. Kilo may log prompts and outputs for training, and AI Horde uses volunteer workers; do not send personal or confidential information through these free routes.

Both services use Render's free plan. Free instances can sleep and have ephemeral filesystems, so FreeLLMAPI recreates its administrator and keyless-provider setup from protected environment configuration after a restart. Local analytics and cooldown history can reset, and the first request after sleep may take longer. Do not treat the repository's advertised provider/model count as a guarantee that every upstream is currently available without a key.

Run `supabase.sql` in Supabase SQL Editor before enabling accounts. Enable email sign-up and configure the allowed redirect URL as `https://nova-ai-3cm8.onrender.com`.

## Social sign-in

The site includes Google, Discord, GitHub, and Apple OAuth buttons. Each provider must be registered by the project owner and configured in Supabase Auth Providers with its Client ID and Client Secret. The Supabase callback URL is:

`https://nvcuoalwtbyniqeerqpk.supabase.co/auth/v1/callback`

OAuth client secrets must never be committed to GitHub or placed in browser code. The social buttons are only operational after the provider credentials have been configured in Supabase.

## AI providers

The selector supports FreeLLMAPI, OpenAI, Google Gemini, Groq, OpenRouter, Mistral AI, Cloudflare Workers AI, and the direct Kilo Gateway option. FreeLLMAPI supplies the default automatically routed free pool; the other providers still require their own server-side credentials and may have quotas or costs. The FreeLLMAPI router is single-user internally, so only the Nova backend can access it; Supabase remains responsible for per-account identity and history isolation.

## API directory

Reads the public-apis/public-apis README, caches it for 12 hours, and displays links and declared authentication fields. This is a directory, not a universal free API key. Entries may require registration, keys, payment, or have usage limits.

## Privacy

Supabase Auth identifies users. RLS policies scope each conversation and message to `auth.uid()`. The backend verifies the bearer token before allowing AI requests. Provider requests are sent to the selected provider under that provider's privacy and retention terms.

Never put provider API keys or Supabase secret/service_role keys in browser code.
