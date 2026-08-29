(function(){
  async function getToken(){
    try{
      if(typeof sb!=='undefined'&&sb){const s=await sb.auth.getSession();return s?.data?.session?.access_token||null;}
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok||!window.supabase)return null;
      const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const s=await client.auth.getSession();return s?.data?.session?.access_token||null;
    }catch{return null}
  }
  function toast(message,error=false){const old=document.getElementById('ytToast');if(old)old.remove();const el=document.createElement('div');el.id='ytToast';el.textContent=message;el.style.cssText=`position:fixed;right:22px;bottom:22px;z-index:99999;padding:12px 15px;border-radius:12px;background:#0c1118;border:1px solid #2a3540;color:${error?'#ffb2b2':'#dfffc0'};font-weight:700;box-shadow:0 14px 35px rgba(0,0,0,.35)`;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)}
  async function renderConnectedAccount(){
    try{
      const token=await getToken(); if(!token)return;
      const response=await fetch('/api/social/accounts',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      const result=await response.json().catch(()=>({})); if(!response.ok||!result.ok)return;
      const accounts=Array.isArray(result.data)?result.data:[]; const box=document.getElementById('accountsBox'); if(!box)return;
      if(!accounts.length){box.innerHTML='<div class="empty">Belum ada akun sosial.</div>';return;}
      box.innerHTML=accounts.map(x=>`<div class="row"><div><b>${esc(x.platform)}</b><div class="muted">${esc(x.youtube_channel_title||x.handle||'Connected account')}</div><div class="muted">${esc(x.youtube_channel_id||'')}</div></div><div style="text-align:right"><span class="tag">${esc(x.status||'connected')}</span><div class="muted">${Number(x.followers||0).toLocaleString('id-ID')} subscribers/followers</div>${x.platform==='youtube'&&x.status==='connected'?`<button class="btn" style="margin-top:7px" onclick="disconnectYouTube('${esc(x.id)}')">Disconnect</button>`:''}</div></div>`).join('');
    }catch(e){console.warn('Render connected social account:',e?.message||e)}
  }
  async function connectYouTube(){
    try{
      const token=await getToken(); if(!token){alert('Sesi login tidak valid. Silakan login kembali.');location.href='/login/';return;}
      const response=await fetch('/api/social/connect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({platform:'youtube'})});
      const result=await response.json().catch(()=>({})); if(!response.ok||!result.ok)throw Error((result?.error?.code||('HTTP_'+response.status))+': '+(result?.error?.message||'Gagal memulai koneksi YouTube.'));
      if(!result.data?.authorization_url)throw Error('OAUTH_URL_MISSING: URL OAuth YouTube tidak tersedia.');
      window.location.href=result.data.authorization_url;
    }catch(error){alert(error?.message||'Gagal menghubungkan YouTube.');}
  }
  async function disconnectYouTube(id){
    const token=await getToken(); if(!token){alert('Sesi login tidak valid.');return;}
    if(!confirm('Putuskan koneksi YouTube ini?'))return;
    const buttons=[...document.querySelectorAll('#accountsBox button')];buttons.forEach(b=>b.disabled=true);
    try{
      const response=await fetch('/api/social/disconnect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({id}),cache:'no-store'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw Error(result?.error?.message||('HTTP '+response.status));
      toast('YouTube berhasil diputuskan.');
      await renderConnectedAccount();
      if(typeof window.groviaReload==='function')await window.groviaReload();
    }catch(e){toast('Gagal disconnect: '+(e.message||'Unknown error'),true);buttons.forEach(b=>b.disabled=false)}
  }
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  window.connect=connectYouTube;window.disconnectYouTube=disconnectYouTube;window.renderConnectedAccount=renderConnectedAccount;
  const params=new URLSearchParams(window.location.search);
  if(params.get('oauth')==='youtube'){
    const status=params.get('status');const stage=params.get('stage');const code=params.get('code');const reason=params.get('reason');
    const messages={connected:'YouTube berhasil terhubung.',denied:'Koneksi YouTube dibatalkan.',invalid_state:'Sesi koneksi YouTube tidak valid. Silakan coba lagi.',missing_code:'Kode OAuth YouTube tidak diterima.',no_channel:'Akun Google tidak memiliki channel YouTube yang dapat diakses.',error:`Koneksi YouTube gagal.\n${stage||'OAUTH_CALLBACK'} / ${code||'UNKNOWN'}\n${reason||'Periksa konfigurasi OAuth dan coba lagi.'}`};
    const message=messages[status];if(message)setTimeout(()=>alert(message),150);if(status==='connected')setTimeout(renderConnectedAccount,350);history.replaceState({},'',window.location.pathname);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderConnectedAccount,150));
})();
