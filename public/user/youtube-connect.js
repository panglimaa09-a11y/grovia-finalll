(function(){
  async function renderConnectedAccount(){
    try{
      if(typeof sb==='undefined'||!sb) return;
      const s=await sb.auth.getSession();
      const token=s?.data?.session?.access_token;
      if(!token) return;
      const response=await fetch('/api/social/accounts',{headers:{Authorization:'Bearer '+token}});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok) return;
      const accounts=Array.isArray(result.data)?result.data:[];
      const box=document.getElementById('accountsBox');
      if(!box) return;
      if(!accounts.length){
        box.innerHTML='<div class="empty">Belum ada akun sosial.</div>';
        return;
      }
      box.innerHTML=accounts.map(x=>`<div class="row"><div><b>${x.platform}</b><div class="muted">${x.youtube_channel_title||x.handle||'Connected account'}</div></div><div style="text-align:right"><span class="tag">${x.status||'connected'}</span><div class="muted">${Number(x.followers||0).toLocaleString('id-ID')} subscribers/followers</div></div></div>`).join('');
    }catch(e){console.warn('Render connected social account:',e?.message||e)}
  }

  async function connectYouTube(){
    try{
      if(typeof session==='undefined'||!session?.access_token){
        alert('Sesi login tidak valid. Silakan login kembali.');
        location.href='/login/';
        return;
      }
      const response=await fetch('/api/social/connect',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({platform:'youtube'})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok){
        const code=result?.error?.code||('HTTP_'+response.status);
        const reason=result?.error?.message||'Gagal memulai koneksi YouTube.';
        throw Error(code+': '+reason);
      }
      if(!result.data?.authorization_url) throw Error('OAUTH_URL_MISSING: URL OAuth YouTube tidak tersedia.');
      window.location.href=result.data.authorization_url;
    }catch(error){
      alert(error?.message||'Gagal menghubungkan YouTube.');
    }
  }

  window.connect=connectYouTube;

  const params=new URLSearchParams(window.location.search);
  if(params.get('oauth')==='youtube'){
    const status=params.get('status');
    const stage=params.get('stage');
    const code=params.get('code');
    const reason=params.get('reason');
    const messages={
      connected:'YouTube berhasil terhubung.',
      denied:'Koneksi YouTube dibatalkan.',
      invalid_state:'Sesi koneksi YouTube tidak valid. Silakan coba lagi.',
      missing_code:'Kode OAuth YouTube tidak diterima.',
      no_channel:'Akun Google tidak memiliki channel YouTube yang dapat diakses.',
      error:`Koneksi YouTube gagal.\n${stage||'OAUTH_CALLBACK'} / ${code||'UNKNOWN'}\n${reason||'Periksa konfigurasi OAuth dan coba lagi.'}`
    };
    const message=messages[status];
    if(message) setTimeout(()=>alert(message),150);
    if(status==='connected') setTimeout(renderConnectedAccount,250);
    history.replaceState({},'',window.location.pathname);
  }

  window.renderConnectedAccount=renderConnectedAccount;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderConnectedAccount,100));
})();
