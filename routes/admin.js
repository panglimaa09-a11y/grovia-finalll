import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '../middleware/auth.js';
import { requireRole } from '../middleware/adminAuth.js';
import { apiOk, apiError } from '../utils/response.js';

const r = Router();
const ROLE_PERMISSIONS = {
  super_admin: ['users.read','users.write','billing.read','billing.write','publishing.read','publishing.write','social.read','social.write','ai.read','analytics.read','system.read','errors.read','audit.read','support.read','notifications.write','settings.write','roles.write'],
  admin: ['users.read','users.write','billing.read','billing.write','publishing.read','publishing.write','social.read','social.write','ai.read','analytics.read','system.read','errors.read','audit.read','support.read','notifications.write'],
  operator: ['users.read','publishing.read','publishing.write','social.read','ai.read','analytics.read','system.read','errors.read','audit.read','support.read']
};

const supabaseUrl = process.env.SUPABASE_URL || 'https://ofisyujlpvnuxwiquafm.supabase.co';
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const authAdmin = serviceRole ? createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

async function audit(db, actor, action, result, metadata = {}) {
  try {
    await db.from('grovia_audit_logs').insert({ actor_user_id: actor, action, result, metadata });
  } catch (e) {
    console.warn('ADMIN_AUDIT_WRITE_FAILED', e?.message || e);
  }
}

async function listAllAuthUsers() {
  if (!authAdmin) return [];
  const all = [];
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await authAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.warn('ADMIN_AUTH_USERS_READ_FAILED', error.message);
      break;
    }
    const batch = data?.users || [];
    all.push(...batch);
    if (batch.length < 1000) break;
  }
  return all;
}

r.get('/dashboard', requireAdmin, async (req, res) => {
  const db = req.serviceClient;
  try {
    const [{ count: userCount, error: userError }, subs, jobs, { count: adminCount, error: roleError }] = await Promise.all([
      db.from('grovia_profiles').select('id', { count: 'exact', head: true }),
      db.from('grovia_subscriptions').select('plan,status,monthly_price'),
      db.from('grovia_scheduled_posts').select('id,status,platform,scheduled_at'),
      db.from('grovia_admin_roles').select('user_id', { count: 'exact', head: true })
    ]);
    if (userError && roleError) return res.status(500).json(apiError('ADMIN_DASHBOARD_FAILED', userError.message || roleError.message));
    const authUsers = await listAllAuthUsers();
    const totalUsers = Math.max(userCount || 0, authUsers.length);
    res.json(apiOk({ role: req.adminRole, totalUsers, totalAuthUsers: authUsers.length, totalProfileUsers: userCount || 0, totalAdminRoles: adminCount || 0, subscriptions: subs.data || [], publishing: jobs.data || [], permissions: ROLE_PERMISSIONS[req.adminRole] || [] }));
  } catch (e) {
    res.status(500).json(apiError('ADMIN_DASHBOARD_FAILED', e?.message || 'Gagal memuat dashboard admin.'));
  }
});

r.get('/users', requireAdmin, async (req, res) => {
  try {
    const db = req.serviceClient;
    const [{ data: roles, error: roleError }, authUsers] = await Promise.all([
      db.from('grovia_admin_roles').select('user_id,role,active,created_at').order('created_at', { ascending: false }),
      listAllAuthUsers()
    ]);
    if (roleError) return res.status(500).json(apiError('ADMIN_USERS_FAILED', roleError.message));

    const ids = new Set([...(roles || []).map(x => x.user_id), ...authUsers.map(x => x.id), req.user.id]);
    const users = [];
    for (const userId of ids) {
      const auth = authUsers.find(x => x.id === userId) || (userId === req.user.id ? req.user : null);
      const role = (roles || []).find(x => x.user_id === userId) || { user_id: userId, role: 'user', active: true, created_at: auth?.created_at || null };
      const [{ data: profile }, { data: sub }, { data: social }, { data: content }] = await Promise.all([
        db.from('grovia_profiles').select('id,display_name,avatar_url,timezone,created_at').eq('id', userId).maybeSingle(),
        db.from('grovia_subscriptions').select('plan,status,monthly_price,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        db.from('grovia_social_accounts').select('id,platform,handle,status,followers,provider_username,provider_display_name').eq('user_id', userId),
        db.from('grovia_content_items').select('id,status').eq('user_id', userId)
      ]);
      users.push({ user_id: userId, email: auth?.email || '—', last_sign_in_at: auth?.last_sign_in_at || null, created_at: auth?.created_at || profile?.created_at || role.created_at, display_name: profile?.display_name || auth?.user_metadata?.full_name || auth?.user_metadata?.name || auth?.email || '—', role: role.role, active: role.active !== false, subscription: sub || null, social_accounts: social || [], content_count: (content || []).length });
    }
    users.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    res.json(apiOk(users));
  } catch (e) {
    res.status(500).json(apiError('ADMIN_USERS_FAILED', e?.message || 'Gagal memuat users.'));
  }
});

r.get('/users/:id/notes', requireAdmin, async (req, res) => {
  const { data, error } = await req.serviceClient.from('grovia_audit_logs').select('*').eq('action','admin.user.note').contains('metadata', { target_user_id: req.params.id }).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json(apiError('ADMIN_NOTES_FAILED', error.message));
  res.json(apiOk(data || []));
});

r.post('/users/:id/notes', requireAdmin, requireRole('super_admin','admin','operator'), async (req, res) => {
  const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0,2000) : '';
  if (!note) return res.status(400).json(apiError('INVALID_NOTE', 'Catatan tidak boleh kosong.'));
  const payload = { actor_user_id: req.user.id, action: 'admin.user.note', result: 'success', metadata: { target_user_id: req.params.id, note, target_email: typeof req.body.email === 'string' ? req.body.email.slice(0,254) : null } };
  const { data, error } = await req.serviceClient.from('grovia_audit_logs').insert(payload).select('*').single();
  if (error) return res.status(400).json(apiError('ADMIN_NOTE_CREATE_FAILED', error.message));
  res.json(apiOk(data));
});

r.get('/roles', requireAdmin, async (req, res) => {
  const { data, error } = await req.serviceClient.from('grovia_admin_roles').select('user_id,role,active,created_at').order('created_at', { ascending: false });
  if (error) return res.status(500).json(apiError('ADMIN_ROLES_FAILED', error.message));
  res.json(apiOk({ roles: data || [], permissions: ROLE_PERMISSIONS }));
});

r.patch('/users/:id/status', requireAdmin, requireRole('super_admin','admin'), async (req, res) => {
  const active = Boolean(req.body.active);
  const { data, error } = await req.serviceClient.from('grovia_admin_roles').update({ active }).eq('user_id', req.params.id).select('*').maybeSingle();
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
