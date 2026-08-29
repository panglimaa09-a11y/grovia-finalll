import { createClient } from '@supabase/supabase-js';
import { apiError } from '../utils/response.js';

const url = process.env.SUPABASE_URL || 'https://ofisyujlpvnuxwiquafm.supabase.co';
const anon = process.env.SUPABASE_ANON_KEY || 'sb_publishable_24biTaIviWxGdoS4uzO1YA_KvxWxsaw';
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const adminClient = service ? createClient(url, service, { auth: { persistSession: false } }) : null;

export async function requireUser(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) return res.status(401).json(apiError('UNAUTHENTICATED', 'Session tidak valid.'));

    const verifier = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data?.user) {
      console.error('Supabase token verification failed:', error?.message || 'user not found');
      return res.status(401).json(apiError('UNAUTHENTICATED', 'Session tidak valid.'));
    }

    req.user = data.user;
    req.userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    // Local development may not have SUPABASE_SERVICE_ROLE_KEY configured.
    // Use the authenticated user client as a safe fallback; RLS still applies.
    req.serviceClient = adminClient || req.userClient;
    return next();
  } catch (e) {
    console.error('requireUser error:', e);
    return res.status(500).json(apiError('AUTH_ERROR', 'Gagal memvalidasi session.'));
  }
}

export async function requireAdmin(req, res, next) {
  return requireUser(req, res, async () => {
    if (!adminClient) return res.status(503).json(apiError('ADMIN_NOT_CONFIGURED', 'Admin backend belum dikonfigurasi.'));
    try {
      const { data, error } = await adminClient
        .from('grovia_admin_roles')
        .select('role,active')
        .eq('user_id', req.user.id)
        .eq('active', true)
        .maybeSingle();
      if (error) return res.status(500).json(apiError('ADMIN_CHECK_FAILED', 'Gagal memvalidasi role admin.'));
      if (!data) return res.status(403).json(apiError('FORBIDDEN', 'Akses admin ditolak.'));
      req.adminRole = data.role;
      return next();
    } catch (e) {
      console.error('requireAdmin error:', e);
      return res.status(500).json(apiError('ADMIN_CHECK_FAILED', 'Gagal memvalidasi role admin.'));
    }
  });
}
