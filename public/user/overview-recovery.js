(async()=>{
  try {
    // Recover the Overview independently when one non-critical API fails.
    // This prevents the whole dashboard from staying on "Loading…".
    const currentSession = (typeof session !== 'undefined' && session) || null;
    const token = currentSession?.access_token;
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const r = await fetch('/api/profile', { headers });
    if (!r.ok) return;
    const j = await r.json();
    const auth = j?.data?.auth || currentSession.user;
    const profile = j?.data?.profile;
    const name = profile?.display_name || auth?.user_metadata?.full_name || auth?.user_metadata?.name || auth?.email?.split('@')[0] || 'Creator';

    const hello = document.getElementById('hello');
    const email = document.getElementById('email');
    const display = document.getElementById('display');
    const ws = document.getElementById('ws');
    const avatar = document.getElementById('avatar');

    if (hello) hello.textContent = 'Selamat datang, ' + name;
    if (email) email.textContent = auth?.email || '—';
    if (display && document.activeElement !== display) display.value = profile?.display_name || name;
    if (ws) ws.textContent = profile?.display_name || name;
    if (avatar) avatar.textContent = name[0]?.toUpperCase() || '?';
  } catch (e) {
    console.warn('Overview recovery:', e?.message || e);
  }
})();
