# GROVIA Production Rebuild

This rebuild follows the agreed separation:
- User V2 = creator workspace
- Admin V5 = platform control center
- server.js = backend/API entry point
- Supabase = shared backend data layer

## Important
The supplied V2 UI is preserved under `public/user/index.html` and cleaned of the embedded admin UI/demo counters in the supplied file.

This package is an implementation scaffold, not a claim that third-party OAuth, payment, AI provider, or admin-role infrastructure is fully live. Those require provider credentials and a secure production backend configuration.

## Run
1. Copy `.env.example` to `.env`.
2. Fill required environment variables.
3. `npm install`
4. `npm start`
5. Open `/user/` or `/admin/`.

## Supabase
Use the previously executed `supabase/grovia_user_v2_production.sql` schema. Do not disable RLS.
