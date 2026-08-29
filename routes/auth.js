import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { apiOk, apiError } from '../utils/response.js';

const r = Router();

r.get('/session', requireUser, (req, res) => {
  res.json(apiOk({ user: req.user }));
});

r.get('/admin-check', requireUser, async (req, res) => {
  try {
    // Preferred path: SECURITY DEFINER function executed with the caller's JWT.
    // This keeps grovia_admin_roles locked by RLS while allowing a safe role check.
    const { data: rpcData, error: rpcError } = await req.userClient.rpc('grovia_check_admin');

    if (!rpcError) {
      const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      return res.json(apiOk({
        isAdmin: row?.is_admin === true,
        role: row?.role || null
      }));
    }

    // Backward-compatible server-side fallback when SERVICE_ROLE is configured.
    if (req.serviceClient) {
      const { data, error } = await req.serviceClient
        .from('grovia_admin_roles')
        .select('role,active')
        .eq('user_id', req.user.id)
        .eq('active', true)
        .maybeSingle();

      if (error) {
        console.error('admin role fallback failed:', error);
        return res.status(500).json(apiError('ADMIN_CHECK_FAILED', 'Gagal memeriksa role admin.'));
      }

      return res.json(apiOk({
        isAdmin: !!data,
        role: data?.role || null
      }));
    }

    console.error('admin role RPC failed:', rpcError);
    return res.status(503).json(apiError(
      'ADMIN_ROLE_CHECK_UNAVAILABLE',
      'Pemeriksaan role admin belum tersedia. Pastikan fungsi grovia_check_admin sudah dibuat di Supabase.'
    ));
  } catch (error) {
    console.error('admin-check error:', error);
    return res.status(500).json(apiError('ADMIN_CHECK_FAILED', 'Gagal memeriksa role admin.'));
  }
});

export default r;
