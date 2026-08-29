import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 3000);
const origin = process.env.APP_ORIGIN || `http://localhost:${port}`;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin, credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) console.warn('SUPABASE_URL is missing.');
if (!anonKey) console.warn('SUPABASE_ANON_KEY is missing.');

const adminClient = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

function apiOk(data) { return { ok: true, data }; }
function apiError(code, message) { return { ok: false, error: { code, message } }; }

async function requireUser(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token || !anonKey) return res.status(401).json(apiError('UNAUTHENTICATED', 'Session tidak valid.'));
    const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return res.status(401).json(apiError('UNAUTHENTICATED', 'Session tidak valid.'));
    req.user = data.user;
    req.userClient = createClient(supabaseUrl, token, { auth: { persistSession: false } });
    next();
  } catch (err) {
    console.error('auth middleware', err);
    res.status(500).json(apiError('AUTH_ERROR', 'Gagal memvalidasi session.'));
  }
}

async function requireAdmin(req, res, next) {
  return requireUser(req, res, async () => {
    if (!adminClient) return res.status(503).json(apiError('ADMIN_UNAVAILABLE', 'Admin backend belum dikonfigurasi.'));
    const { data, error } = await adminClient.from('grovia_profiles').select('id').eq('id', req.user.id).maybeSingle();
    if (error) return res.status(500).json(apiError('ADMIN_CHECK_FAILED', 'Gagal memvalidasi admin.'));
    // Role storage must be added to the actual production schema before enabling admin authorization.
    // This guard intentionally fails closed until a role claim/table is configured.
    if (!data) return res.status(403).json(apiError('FORBIDDEN', 'Akses admin ditolak.'));
    next();
  });
}

app.get('/api/health', (_req, res) => res.json(apiOk({ service: 'grovia', status: 'ok', time: new Date().toISOString() })));

app.get('/api/profile', requireUser, async (req, res) => {
  const { data, error } = await req.userClient.from('grovia_profiles').select('*').eq('id', req.user.id).maybeSingle();
  if (error) return res.status(500).json(apiError('PROFILE_READ_FAILED', error.message));
  res.json(apiOk({ auth: req.user, profile: data }));
});

app.patch('/api/profile', requireUser, async (req, res) => {
  const payload = {
    id: req.user.id,
    display_name: typeof req.body.display_name === 'string' ? req.body.display_name.trim().slice(0, 100) : undefined,
    avatar_url: typeof req.body.avatar_url === 'string' ? req.body.avatar_url.trim().slice(0, 500) : undefined,
    timezone: typeof req.body.timezone === 'string' ? req.body.timezone.trim().slice(0, 80) : undefined
  };
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  const { data, error } = await req.userClient.from('grovia_profiles').upsert(payload).select('*').single();
  if (error) return res.status(400).json(apiError('PROFILE_UPDATE_FAILED', error.message));
  res.json(apiOk(data));
});

const userRoutes = [
  ['GET', '/api/social/accounts', 'grovia_social_accounts'],
  ['GET', '/api/content', 'grovia_content_items'],
  ['GET', '/api/scheduler', 'grovia_scheduled_posts'],
  ['GET', '/api/analytics/daily', 'grovia_analytics_daily'],
  ['GET', '/api/billing/subscription', 'grovia_subscriptions'],
  ['GET', '/api/ai/usage', 'grovia_ai_usage']
];
for (const [method, path, table] of userRoutes) {
  app[method.toLowerCase()](path, requireUser, async (req, res) => {
    const query = req.userClient.from(table).select('*').eq('user_id', req.user.id);
    const { data, error } = await query;
    if (error) return res.status(500).json(apiError('DATA_READ_FAILED', error.message));
    res.json(apiOk(data || []));
  });
}

app.post('/api/content', requireUser, async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json(apiError('VALIDATION_ERROR', 'Title wajib diisi.'));
  const row = { user_id: req.user.id, title, format: req.body.format || null, status: 'draft', platforms: Array.isArray(req.body.platforms) ? req.body.platforms : [], body: req.body.body && typeof req.body.body === 'object' ? req.body.body : {} };
  const { data, error } = await req.userClient.from('grovia_content_items').insert(row).select('*').single();
  if (error) return res.status(400).json(apiError('CONTENT_CREATE_FAILED', error.message));
  res.status(201).json(apiOk(data));
});

app.post('/api/scheduler', requireUser, async (req, res) => {
  const platform = typeof req.body.platform === 'string' ? req.body.platform.trim() : '';
  const scheduledAt = req.body.scheduled_at;
  if (!platform || !scheduledAt) return res.status(400).json(apiError('VALIDATION_ERROR', 'Platform dan scheduled_at wajib diisi.'));
  const row = { user_id: req.user.id, content_id: req.body.content_id || null, platform, scheduled_at: new Date(scheduledAt).toISOString(), status: 'scheduled' };
  const { data, error } = await req.userClient.from('grovia_scheduled_posts').insert(row).select('*').single();
  if (error) return res.status(400).json(apiError('SCHEDULE_CREATE_FAILED', error.message));
  res.status(201).json(apiOk(data));
});

app.post('/api/ai/generate', requireUser, async (_req, res) => {
  if (!process.env.AI_API_KEY) return res.status(503).json(apiError('AI_NOT_CONFIGURED', 'AI service belum dikonfigurasi.'));
  return res.status(501).json(apiError('AI_PROVIDER_PENDING', 'Provider AI production belum diimplementasikan.'));
});

app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
  if (!adminClient) return res.status(503).json(apiError('ADMIN_UNAVAILABLE', 'Admin backend belum dikonfigurasi.'));
  res.status(501).json(apiError('ADMIN_MODULE_PENDING', 'Admin aggregation layer belum diaktifkan.'));
});

app.get('/api/admin/users', requireAdmin, (_req, res) => res.status(501).json(apiError('ADMIN_MODULE_PENDING', 'Admin user management belum diaktifkan.')));
app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => res.status(501).json(apiError('ADMIN_MODULE_PENDING', 'Audit log belum diaktifkan.')));

app.post('/api/webhooks/payment', express.raw({ type: 'application/json' }), (_req, res) => {
  if (!process.env.PAYMENT_WEBHOOK_SECRET) return res.status(503).json(apiError('WEBHOOK_NOT_CONFIGURED', 'Payment webhook belum dikonfigurasi.'));
  res.status(501).json(apiError('WEBHOOK_PENDING', 'Payment webhook production belum diimplementasikan.'));
});

app.use('/login', express.static('public/login'));
app.use('/user', express.static('public/user'));
app.use('/admin', express.static('public/admin'));
app.get('/', (_req, res) => res.sendFile('index.html', { root: 'public/login' }));

app.use((err, _req, res, _next) => {
  console.error('Unhandled error', err);
  res.status(500).json(apiError('INTERNAL_ERROR', 'Terjadi kesalahan internal.'));
});

app.listen(port, () => console.log(`GROVIA server listening on http://localhost:${port}`));
