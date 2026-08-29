# GROVIA FINAL

Production rebuild with strict separation:
- **User V2**: creator workspace
- **Admin V5**: platform control center
- **Login**: Supabase Auth gateway
- **Backend**: `server.js` + modular API
- **Database**: Supabase with RLS

## Routes
- `/login/`
- `/user/`
- `/admin/`
- `/api/health`

## Production rules
No demo counters, fake success states, fake OAuth, fake payment, or frontend secrets. User data is scoped to the authenticated session. Admin access is role-checked server-side.

## Local
1. Copy `.env.example` to `.env`.
2. Set Supabase environment values.
3. `npm install`
4. `npm start`

Third-party OAuth, AI, payment, and publishing adapters remain explicitly unavailable until real provider credentials and adapter implementations are configured.
