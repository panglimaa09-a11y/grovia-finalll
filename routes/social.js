import { Router } from 'express';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '../middleware/auth.js';
import { apiOk, apiError } from '../utils/response.js';

const r = Router();
const YT_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const YT_TOKEN = 'https://oauth2.googleapis.com/token';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2/reports';
const YT_SCOPE = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/youtube.upload'
].join(' ');

function appOrigin() {
  const explicit = String(process.env.APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const vercelUrl = String(process.env.VERCEL_URL || '').trim().replace(/\/$/, '');
  if (vercelUrl) return `https://${vercelUrl}`;
  return 'https://grovia-finalll.vercel.app';
}
function callbackUrl() { return `${appOrigin()}/api/social/youtube/callback`; }
function requiredConfig() { return Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim() && String(process.env.GOOGLE_CLIENT_SECRET || '').trim()); }
function oauthSecret() { return process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'grovia-oauth-state-fallback'; }
function signState(userId) {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId, nonce, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', oauthSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function verifyState(value) {
  try {
    const [payload, sig] = String(value || '').split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', oauthSecret()).update(payload).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const obj = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return obj.exp > Date.now() ? obj : null;
  } catch { return null; }
}
async function tokenExchange(code) {
  const body = new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: callbackUrl(), grant_type: 'authorization_code' });
  const response = await fetch(YT_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error_description || data.error || `Google token exchange failed (${response.status})`); error.code = data.error || `HTTP_${response.status}`; error.stage = 'TOKEN_EXCHANGE'; throw error; }
  return data;
}
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, grant_type: 'refresh_token' });
  const response = await fetch(YT_TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error_description || data.error || `Google refresh failed (${response.status})`); error.code = data.error || `HTTP_${response.status}`; error.stage = 'TOKEN_REFRESH'; throw error; }
  return data;
}
async function getChannel(accessToken) {
  const response = await fetch(`${YT_API}/channels?part=snippet,statistics&mine=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error?.message || `YouTube channel request failed (${response.status})`); error.code = data.error?.errors?.[0]?.reason || `HTTP_${response.status}`; error.stage = 'YOUTUBE_API'; throw error; }
  return data.items?.[0] || null;
}
async function queryAnalytics(accessToken, startDate, endDate) {
  const params = new URLSearchParams({ ids: 'channel==MINE', startDate, endDate, dimensions: 'day', metrics: 'views,likes,comments,shares,subscribersGained,subscribersLost,estimatedMinutesWatched', sort: 'day' });
  const response = await fetch(`${YT_ANALYTICS_API}?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error?.message || `YouTube Analytics request failed (${response.status})`); error.code = data.error?.errors?.[0]?.reason || data.error?.status || `HTTP_${response.status}`; error.stage = 'YOUTUBE_ANALYTICS'; throw error; }
  return data;
}
function isoDateDaysAgo(days) { const d = new Date(Date.now() - days * 86400000); return d.toISOString().slice(0, 10); }

r.get('/accounts', requireUser, async (req, res) => {
  const { data, error } = await req.userClient.from('grovia_social_accounts').select('id,platform,handle,followers,engagement_rate,status,token_expires_at,created_at,youtube_channel_id,youtube_channel_title').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json(apiError('SOCIAL_READ_FAILED', error.message));
  res.json(apiOk(data || []));
});

r.post('/connect', requireUser, (req, res) => {
  const p = String(req.body.platform || '').toLowerCase();
  if (p !== 'youtube') return res.status(400).json(apiError('VALIDATION_ERROR', 'Untuk saat ini baru YouTube yang tersedia.'));
  if (!requiredConfig()) return res.status(503).json(apiError('PROVIDER_NOT_CONFIGURED', 'GOOGLE_CLIENT_ID atau GOOGLE_CLIENT_SECRET belum tersedia di server Vercel.'));
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl(), response_type: 'code', access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: YT_SCOPE, state: signState(req.user.id) });
  res.json(apiOk({ provider: 'youtube', authorization_url: `${YT_AUTH}?${params.toString()}` }));
});

r.post('/youtube/sync', requireUser, async (req, res) => {
  try {
    if (!requiredConfig()) { const e = new Error('Google OAuth belum dikonfigurasi di server.'); e.code = 'PROVIDER_NOT_CONFIGURED'; e.stage = 'CONFIG'; throw e; }
    const { data: account, error: accountError } = await req.serviceClient.from('grovia_social_accounts').select('id,user_id,platform,followers,token_expires_at,youtube_channel_id,youtube_access_token,youtube_refresh_token').eq('user_id', req.user.id).eq('platform', 'youtube').maybeSingle();
    if (accountError) { const e = new Error(accountError.message); e.code = 'ACCOUNT_READ_FAILED'; e.stage = 'DATABASE_READ'; throw e; }
    if (!account?.youtube_refresh_token) { const e = new Error('YouTube belum terhubung ulang untuk izin Analytics. Klik Connect YouTube lagi.'); e.code = 'ANALYTICS_SCOPE_MISSING'; e.stage = 'TOKEN_REFRESH'; throw e; }
    let accessToken = account.youtube_access_token; let expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    if (!accessToken || !expiresAt || expiresAt < Date.now() + 60_000) {
      const refreshed = await refreshAccessToken(account.youtube_refresh_token); accessToken = refreshed.access_token; expiresAt = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
      const { error: updateError } = await req.serviceClient.from('grovia_social_accounts').update({ youtube_access_token: accessToken, token_expires_at: new Date(expiresAt).toISOString() }).eq('id', account.id).eq('user_id', req.user.id);
      if (updateError) { const e = new Error(updateError.message); e.code = 'TOKEN_SAVE_FAILED'; e.stage = 'DATABASE_SAVE'; throw e; }
    }
    const startDate = isoDateDaysAgo(30); const endDate = isoDateDaysAgo(1); const report = await queryAnalytics(accessToken, startDate, endDate); const rows = Array.isArray(report.rows) ? report.rows : [];
    const upserts = rows.map(row => { const [metricDate, views, likes, comments, shares, gained, lost, watch] = row; const v=Number(views||0); const engagementRate=v>0?((Number(likes||0)+Number(comments||0)+Number(shares||0))/v)*100:0; return { user_id:req.user.id,metric_date:metricDate,followers:Math.max(0,Number(account.followers||0)),reach:0,views:v,watch_time_minutes:Number(watch||0),engagement_rate:engagementRate,subscribers_gained:Number(gained||0) }; });
    if(upserts.length){const{error:upsertError}=await req.serviceClient.from('grovia_analytics_daily').upsert(upserts,{onConflict:'user_id,metric_date'});if(upsertError){const e=new Error(upsertError.message);e.code='ANALYTICS_SAVE_FAILED';e.stage='DATABASE_SAVE';throw e;}}
    const channel=await getChannel(accessToken);if(channel){await req.serviceClient.from('grovia_social_accounts').update({followers:Number(channel.statistics?.subscriberCount||0),handle:channel.snippet?.customUrl||channel.snippet?.title||channel.id,youtube_channel_title:channel.snippet?.title||null}).eq('id',account.id).eq('user_id',req.user.id);}
    return res.json(apiOk({synced:true,startDate,endDate,rows:upserts.length}));
  } catch(error){const stage=error?.stage||'YOUTUBE_SYNC';const code=error?.code||'UNKNOWN';const reason=String(error?.message||'Sinkronisasi YouTube gagal').slice(0,220);console.error('YouTube analytics sync:',{stage,code,message:reason});return res.status(400).json(apiError(code,`${stage}: ${reason}`));}
});

r.get('/youtube/callback', async (req, res) => {
  const base = appOrigin();
  try {
    if (req.query.error) { const reason = String(req.query.error_description || req.query.error).slice(0, 180); return res.redirect(`${base}/user/?oauth=youtube&status=denied&reason=${encodeURIComponent(reason)}`); }
    const state = verifyState(req.query.state);
    if (!state) return res.redirect(`${base}/user/?oauth=youtube&status=invalid_state&reason=${encodeURIComponent('OAuth state tidak valid atau sudah kedaluwarsa')}`);
    const code = String(req.query.code || '');
    if (!code) return res.redirect(`${base}/user/?oauth=youtube&status=missing_code&reason=${encodeURIComponent('Authorization code tidak diterima dari Google')}`);
    const tokens = await tokenExchange(code);
    if (!tokens.access_token) { const e = new Error('Google tidak mengembalikan access token'); e.code = 'MISSING_ACCESS_TOKEN'; e.stage = 'TOKEN_EXCHANGE'; throw e; }
    const channel = await getChannel(tokens.access_token);
    if (!channel) { const e = new Error('Akun Google tidak memiliki channel YouTube yang dapat diakses'); e.code = 'NO_CHANNEL'; e.stage = 'YOUTUBE_API'; throw e; }
    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null;
    const row = { user_id: state.userId, platform: 'youtube', handle: channel.snippet?.customUrl || channel.snippet?.title || channel.id, followers: Number(channel.statistics?.subscriberCount || 0), engagement_rate: 0, status: 'connected', token_expires_at: expiresAt, youtube_channel_id: channel.id, youtube_channel_title: channel.snippet?.title || null, youtube_access_token: tokens.access_token || null, youtube_refresh_token: tokens.refresh_token || null };
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) { const e = new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server'); e.code = 'SERVICE_ROLE_MISSING'; e.stage = 'DATABASE_SAVE'; throw e; }
    const url = process.env.SUPABASE_URL || 'https://ofisyujlpvnuxwiquafm.supabase.co'; const client = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error } = await client.from('grovia_social_accounts').upsert(row, { onConflict: 'user_id,platform' });
    if (error) { const dbError = new Error(error.message); dbError.code = 'SUPABASE_SAVE_FAILED'; dbError.stage = 'DATABASE_SAVE'; throw dbError; }
    return res.redirect(`${base}/user/?oauth=youtube&status=connected`);
  } catch (error) { const stage=error?.stage||'OAUTH_CALLBACK';const code=error?.code||'UNKNOWN';const reason=String(error?.message||'Koneksi YouTube gagal').slice(0,180);console.error('YouTube OAuth callback:',{stage,code,message:reason});return res.redirect(`${base}/user/?oauth=youtube&status=error&stage=${encodeURIComponent(stage)}&code=${encodeURIComponent(code)}&reason=${encodeURIComponent(reason)}`); }
});

r.post('/disconnect', requireUser, async (req, res) => { const { error } = await req.userClient.from('grovia_social_accounts').delete().eq('id', String(req.body.id || '')).eq('user_id', req.user.id); if (error) return res.status(400).json(apiError('SOCIAL_DELETE_FAILED', error.message)); res.json(apiOk({ deleted: true })); });

export default r;
