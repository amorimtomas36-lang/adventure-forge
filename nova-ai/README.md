# Nova AI V1
Online assistant starter with per-account private history and public API directory.

## Deploy
This folder is a Docker web service. Configure these Render environment variables:
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY
- AI_API_KEY (server secret)
- AI_BASE_URL (default https://api.openai.com/v1)
- AI_MODEL

Run supabase.sql in Supabase SQL Editor before enabling accounts. Enable email sign-up and configure allowed redirect URLs.

Never put AI_API_KEY or Supabase secret/service_role keys in browser code.

## API directory
Reads public-apis/public-apis README, caches for 12h, and displays links and declared auth fields. This is a directory, not a universal free API key. Entries may require registration, keys, payment, or have usage limits.

## Privacy
Supabase Auth identifies users. RLS policies scope each conversation and message to auth.uid(). The backend verifies the bearer token before allowing AI requests.
