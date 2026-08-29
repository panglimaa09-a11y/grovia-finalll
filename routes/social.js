import { Router } from 'express';
import crypto from 'node:crypto';
import { requireUser } from '../middleware/auth.js';
import { apiOk, apiError } from '../utils/response.js';

const r = Router();
const YT_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const YT_TOKEN = 'https://oauth2.googleapis.com/token';
const YT_API = 'https://www.googleapis.com/youtube/v3';
const YT_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const appOrigin = () => (process.env.APP_ORIGIN || '').replace(/\/$/, '');
const callbackUrl = () => `${appOrigin()}/api/social/youtube/callback`;

function requiredConfig(){
  return process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && appOrigin();
}

function signState(userId){
  const nonce = crypto.randomBytes(24).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId, nonce, exp: Date.now()+10*60*1000 })).toString('base64url');
  const secret = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'grovia-oauth-state-fallback';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyState(value){
  try{
    const [payload, sig] = String(value||'').split('.');
    if(!payload || !sig) return null;
    const secret = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'grovia-oauth-state-fallback';
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if(!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const obj = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return obj.exp > Date.now() ? obj : null;
  }catch{return null;}
}

async function tokenExchange(code){
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: callbackUrl(),
    grant_type: 'authorization_code'
  });
  const response = await fetch(YT_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data = await response.json();
  if(!response.ok) throw new Error(data.error_description || data.error || 'Google token exchange failed');
  return data;
}

async function getChannel(accessToken){
  const url = `${YT_API}/channels?part=snippet,statistics&mine=true`;
  const response = await fetch(url,{headers:{Authorization:`Bearer ${accessToken}`}});
  const data = await response.json();
  if(!response.ok) throw new Error(data.error?.message || 'YouTube channel request failed');
  return data.items?.[0] || null;
}

r.get('/accounts',requireUser,async(req,res)=>{
  const{data,error}=await req.userClient.from('grovia_social_accounts')
    .select('id,platform,handle,followers,engagement_rate,status,token_expires_at,created_at')
    .eq('user_id',req.user.id).order('created_at',{ascending:false});
  if(error)return res.status(500).json(apiError('SOCIAL_READ_FAILED',error.message));
  res.json(apiOk(data||[]));
});

r.post('/connect',requireUser,(req,res)=>{
  const p=String(req.body.platform||'').toLowerCase();
  if(p!=='youtube') return res.status(400).json(apiError('VALIDATION_ERROR','Untuk saat ini baru YouTube yang tersedia.'));
  if(!requiredConfig()) return res.status(503).json(apiError('PROVIDER_NOT_CONFIGURED','Google/YouTube OAuth belum dikonfigurasi di server.'));
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: YT_SCOPE,
    state: signState(req.user.id)
  });
  res.json(apiOk({provider:'youtube',authorization_url:`${YT_AUTH}?${params.toString()}`}));
});

r.get('/youtube/callback',async(req,res)=>{
  const base = appOrigin() || '';
  try{
    if(req.query.error) return res.redirect(`${base}/user/?oauth=youtube&status=denied`);
    const state = verifyState(req.query.state);
    if(!state) return res.redirect(`${base}/user/?oauth=youtube&status=invalid_state`);
    const code = String(req.query.code||'');
    if(!code) return res.redirect(`${base}/user/?oauth=youtube&status=missing_code`);

    const tokens = await tokenExchange(code);
    const channel = await getChannel(tokens.access_token);
    if(!channel) return res.redirect(`${base}/user/?oauth=youtube&status=no_channel`);

    const expiresAt = tokens.expires_in ? new Date(Date.now()+Number(tokens.expires_in)*1000).toISOString() : null;
    const row = {
      user_id: state.userId,
      platform: 'youtube',
      handle: channel.snippet?.customUrl || channel.snippet?.title || channel.id,
      followers: Number(channel.statistics?.subscriberCount || 0),
      engagement_rate: 0,
      status: 'connected',
      token_expires_at: expiresAt,
      youtube_channel_id: channel.id,
      youtube_channel_title: channel.snippet?.title || null,
      youtube_access_token: tokens.access_token || null,
      youtube_refresh_token: tokens.refresh_token || null
    };

    const admin = requiredConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY ? null : null;
    const { createClient } = await import('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL || 'https://ofisyujlpvnuxwiquafm.supabase.co';
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!service) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi');
    const client = createClient(url,service,{auth:{persistSession:false}});

    const { error } = await client.from('grovia_social_accounts').upsert(row,{onConflict:'user_id,platform'});
    if(error) throw new Error(error.message);
    return res.redirect(`${base}/user/?oauth=youtube&status=connected`);
  }catch(error){
    console.error('YouTube OAuth callback:',error);
    return res.redirect(`${base}/user/?oauth=youtube&status=error`);
  }
});

r.post('/disconnect',requireUser,async(req,res)=>{
  const{error}=await req.userClient.from('grovia_social_accounts').delete().eq('id',String(req.body.id||'')).eq('user_id',req.user.id);
  if(error)return res.status(400).json(apiError('SOCIAL_DELETE_FAILED',error.message));
  res.json(apiOk({deleted:true}));
});

export default r;
