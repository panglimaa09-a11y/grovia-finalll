import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { requireRole } from '../middleware/adminAuth.js';
import { apiOk, apiError } from '../utils/response.js';

const r = Router();
const ROLE_PERMISSIONS = {
  super_admin: ['users.read','users.write','billing.read','billing.write','publishing.read','publishing.write','social.read','social.write','ai.read','analytics.read','system.read','errors.read','audit.read','support.read','notifications.write','settings.write','roles.write'],
  admin: ['users.read','users.write','billing.read','billing.write','publishing.read','publishing.write','social.read','social.write','ai.read','analytics.read','system.read','errors.read','audit.read','support.read','notifications.write'],
  operator: ['users.read','publishing.read','publishing.write','social.read','ai.read','analytics.read','system.read','errors.read','audit.read','support.read']
};

async function audit(db, actor, action, result, metadata = {}) {
  try {
    await db.from('grovia_audit_logs').insert({ actor_user_id: actor, action, result, metadata });
  } catch (e) {
    console.warn('ADMIN_AUDIT_WRITE_FAILED', e?.message || e);
  }
}

r.get('/dashboard', requireAdmin, async (req, res) => {
  const db = req.serviceClient;
  try {
    const [{ count: adminCount, error: roleError }, subs, jobs] = await Promise.all([
      db.from('grovia_admin_roles').select('user_id', { count: 'exact', head: true }),
      db.from('grovia_subscriptions').select('plan,status,monthly_price'),
      db.from('grovia_scheduled_posts').select('id,status,platform,scheduled_at')
    ]);
    if (roleError) return res.status(500).json(apiError('ADMIN_DASHBOARD_FAILED', roleError.message));
    res.json(apiOk({
      role: req.adminRole,
      totalUsers: adminCount || 0,
      subscriptions: subs.data || [],
      publishing: jobs.data || [],
      permissions: ROLE_PERMISSIONS[req.adminRole] || []
    }));
  } catch (e) {
    res.status(500).json(apiError('ADMIN_DASHBOARD_FAILED', e?.message || 'Gagal memuat dashboard admin.'));
  }
});

r.get('/users', requireAdmin, async (req, res) => {
  try {
    const db = req.serviceClient;
    const { data: roles, error } = await db
      .from('grovia_admin_roles')
      .select('user_id,role,active,created_at')
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json(apiError('ADMIN_USERS_FAILED', error.message));

    const users = [];
    for (const row of roles || []) {
      const [{ data: sub }, { data: social }, { data: content }] = await Promise.all([
        db.from('grovia_subscriptions').select('plan,status,monthly_price').eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('grovia_social_accounts').select('id,platform,handle,status,followers').eq('user_id', row.user_id),
        db.from('grovia_content_items').select('id,status').eq('user_id', row.user_id)
      ]);
      users.push({ ...row, subscription: sub || null, social_accounts: social || [], content_count: (content || []).length });
    }
    res.json(apiOk(users));
  } catch (e) {
    res.status(500).json(apiError('ADMIN_USERS_FAILED', e?.message || 'Gagal memuat users.'));
  }
});

r.get('/roles', requireAdmin, async (req, res) => {
  const { data, error } = await req.serviceClient.from('grovia_admin_roles').select('user_id,role,active,created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json(apiError('ADMIN_ROLES_FAILED', error.message));
  res.json(apiOk({ roles: data || [], permissions: ROLE_PERMISSIONS }));
});

r.patch('/users/:id/status', requireAdmin, requireRole('super_admin','admin'), async (req, res) => {
  const active = Boolean(req.body.active);
  const { data, error } = await req.serviceClient
    .from('grovia_admin_roles')
    .update({ active })
    .eq('user_id', req.params.id)
    .select('*')
    .maybeSingle();
  if (error) return res.status(400).json(apiError('ADMIN_USER_UPDATE_FAILED', error.message));
  await audit(req.serviceClient, req.user.id, active ? 'admin.user.activate' : 'admin.user.deactivate', 'success', { user_id: req.params.id });
  res.json(apiOk(data));
});

r.patch('/users/:id/role', requireAdmin, requireRole('super_admin'), async (req, res) => {
  const role = String(req.body.role || '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) return res.status(400).json(apiError('INVALID_ROLE', 'Role harus super_admin, admin, atau operator.'));
  if (req.params.id === req.user.id && role !== 'super_admin') return res.status(400).json(apiError('SELF_DEMOTION_BLOCKED', 'Super Admin tidak boleh menurunkan role akun sendiri.'));
  const { data, error } = await req.serviceClient.from('grovia_admin_roles').update({ role }).eq('user_id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(400).json(apiError('ADMIN_ROLE_UPDATE_FAILED', error.message));
  await audit(req.serviceClient, req.user.id, 'admin.user.role_change', 'success', { user_id: req.params.id, role });
  res.json(apiOk(data));
});

r.get('/audit-logs', requireAdmin, async (req, res) => {
  const { data, error } = await req.serviceClient.from('grovia_audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json(apiError('AUDIT_READ_FAILED', error.message));
  res.json(apiOk(data || []));
});

export default r;
