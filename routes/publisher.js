import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { apiOk, apiError } from '../utils/response.js';

const r = Router();
const YT_TOKEN = 'https://oauth2.googleapis.com/token';
const YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos';

function requiredConfig() {
  return Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim() && String(process.env.GOOGLE_CLIENT_SECRET || '').trim());
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });
  const response = await fetch(YT_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = new Error(data.error_description || data.error || `Google refresh failed (${response.status})`);
    e.code = data.error || `HTTP_${response.status}`;
    throw e;
  }
  return data;
}

async function getYoutubeAccount(req) {
  const { data, error } = await req.serviceClient
    .from('grovia_social_accounts')
    .select('id,user_id,platform,token_expires_at,youtube_access_token,youtube_refresh_token,youtube_channel_id')
    .eq('user_id', req.user.id)
    .eq('platform', 'youtube')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.youtube_refresh_token) throw new Error('YouTube belum terhubung. Hubungkan ulang YouTube untuk mengaktifkan Publisher.');

  let accessToken = data.youtube_access_token;
  let expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  if (!accessToken || !expiresAt || expiresAt < Date.now() + 60_000) {
    const refreshed = await refreshAccessToken(data.youtube_refresh_token);
    accessToken = refreshed.access_token;
    expiresAt = Date.now() + Number(refreshed.expires_in || 3600) * 1000;
    await req.serviceClient
      .from('grovia_social_accounts')
      .update({ youtube_access_token: accessToken, token_expires_at: new Date(expiresAt).toISOString() })
      .eq('id', data.id)
      .eq('user_id', req.user.id);
  }
  return { ...data, accessToken };
}

function buildMetadata(content, body = {}) {
  const title = String(body.youtube_title || content.title || 'GROVIA Video').trim().slice(0, 100);
  const description = String(body.youtube_description || body.caption || '').trim().slice(0, 5000);
  const tags = Array.isArray(body.tags) ? body.tags.map(x => String(x).replace(/^#/, '').trim()).filter(Boolean).slice(0, 500) : [];
  const privacyStatus = ['private', 'unlisted', 'public'].includes(body.privacy_status) ? body.privacy_status : 'private';
  return {
    snippet: {
      title,
      description,
      tags,
      categoryId: String(body.category_id || '22')
    },
    status: {
      privacyStatus,
      selfDeclaredMadeForKids: Boolean(body.made_for_kids || false)
    }
  };
}

r.post('/youtube/init', requireUser, async (req, res) => {
  try {
    if (!requiredConfig()) return res.status(503).json(apiError('PROVIDER_NOT_CONFIGURED', 'Google OAuth belum lengkap di server.'));
    const contentId = String(req.body.content_id || '');
    const filename = String(req.body.filename || 'video.mp4').slice(0, 180);
    const mimeType = String(req.body.mime_type || 'video/mp4');
    const size = Number(req.body.size || 0);
    if (!contentId || !Number.isFinite(size) || size <= 0) return res.status(400).json(apiError('VALIDATION_ERROR', 'content_id dan ukuran video wajib valid.'));

    const [{ data: content, error: contentError }, account] = await Promise.all([
      req.serviceClient.from('grovia_content_items').select('*').eq('id', contentId).eq('user_id', req.user.id).maybeSingle(),
      getYoutubeAccount(req)
    ]);
    if (contentError) return res.status(400).json(apiError('CONTENT_READ_FAILED', contentError.message));
    if (!content) return res.status(404).json(apiError('CONTENT_NOT_FOUND', 'Konten tidak ditemukan.'));

    const metadata = buildMetadata(content, content.body || {});
    const response = await fetch(`${YT_UPLOAD}?part=snippet,status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(size)
      },
      body: JSON.stringify(metadata)
    });
    const text = await response.text();
    if (!response.ok) {
      let data = {};
      try { data = JSON.parse(text); } catch {}
      const e = new Error(data.error?.message || text || `YouTube upload init failed (${response.status})`);
      e.code = data.error?.errors?.[0]?.reason || `HTTP_${response.status}`;
      throw e;
    }
    const location = response.headers.get('location');
    if (!location) return res.status(502).json(apiError('UPLOAD_SESSION_MISSING', 'YouTube tidak mengembalikan upload session URL.'));
    res.json(apiOk({ upload_url: location, filename, mime_type: mimeType, size, content_id: contentId }));
  } catch (error) {
    res.status(400).json(apiError(error?.code || 'PUBLISH_INIT_FAILED', error?.message || 'Gagal memulai upload YouTube.'));
  }
});

r.post('/youtube/complete', requireUser, async (req, res) => {
  try {
    const contentId = String(req.body.content_id || '');
    const videoId = String(req.body.video_id || '');
    const title = String(req.body.title || '').trim();
    if (!contentId || !videoId) return res.status(400).json(apiError('VALIDATION_ERROR', 'content_id dan video_id wajib diisi.'));
    const { data: content, error: contentError } = await req.serviceClient
      .from('grovia_content_items')
      .select('*')
      .eq('id', contentId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (contentError) return res.status(400).json(apiError('CONTENT_READ_FAILED', contentError.message));
    if (!content) return res.status(404).json(apiError('CONTENT_NOT_FOUND', 'Konten tidak ditemukan.'));

    const nextBody = {
      ...(content.body || {}),
      youtube_video_id: videoId,
      youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
      published_at: new Date().toISOString(),
      ...(title ? { youtube_title: title } : {})
    };
    const { data: updated, error: updateError } = await req.serviceClient
      .from('grovia_content_items')
      .update({ body: nextBody, status: 'published', published_at: new Date().toISOString() })
      .eq('id', contentId)
      .eq('user_id', req.user.id)
      .select('*')
      .single();
    if (updateError) return res.status(400).json(apiError('CONTENT_UPDATE_FAILED', updateError.message));

    if (req.body.schedule_id) {
      await req.serviceClient.from('grovia_scheduled_posts').update({ status: 'published' }).eq('id', String(req.body.schedule_id)).eq('user_id', req.user.id);
    }
    res.json(apiOk({ published: true, video_id: videoId, youtube_url: nextBody.youtube_url, content: updated }));
  } catch (error) {
    res.status(400).json(apiError(error?.code || 'PUBLISH_COMPLETE_FAILED', error?.message || 'Gagal menyelesaikan publikasi.'));
  }
});

export default r;
