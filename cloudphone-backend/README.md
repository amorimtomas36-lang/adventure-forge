# Cloud Phone backend scaffold

Minimal Node.js HTTP API for Render.

## Endpoints
- `GET /` or `GET /health`: health check
- `GET /api/config`: reports which integrations are configured (does not expose keys)

## Required Render environment variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CLOUD_ANDROID_PROVIDER_URL` (only when a real cloud Android provider has been selected)

This service is only an API scaffold. Render and Supabase alone do not provide a bootable Android device. A real cloud Android provider or Android virtualization host must be connected before the app can create and stream phone sessions.
