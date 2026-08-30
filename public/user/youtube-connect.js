(function(){
  const providers={
    youtube:{label:'YouTube',icon:'▶',platform:'youtube',action:'youtube'},
    facebook:{label:'Facebook',icon:'f',platform:'facebook',action:'facebook'},
    instagram:{label:'Instagram',icon:'◎',platform:'instagram',action:'instagram'},
    tiktok:{label:'TikTok',icon:'♪',platform:'tiktok',action:'tiktok'},
    threads:{label:'Threads',icon:'@',platform:'threads',action:'threads'}
  };
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function getToken(){try{
    if(typeof sb!=='undefined'&&sb){const s=await sb.auth.getSession();return s?.data?.session?.access_token||null;}
    const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
    if(!cfg.ok||!window.supabase)return null;
    const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const s=await client.auth.getSession();return s?.data?.session?.access_token||null;
  }catch{return null}}
  function toast(message,error=false){const old=document.getElementById('socialToast');if(old)old.remove();const el=document.createElement('div');el.id='socialToast';el.textContent=message;el.style.cssText=`position:fixed;right:22px;bottom:22px;z-index:99999;padding:12px 15px;border-radius:12px;background:#0c1118;border:1px solid #2a3540;color:${error?'#ffb2b2':'#dfffc0'};font-weight:700;box-shadow:0 14px 35px rgba(0,0,0,.35)`;document.body.appendChild(el);setTimeout(()=>el.remove(),3000)}
  async function renderConnectedAccount(){try{
    const token=await getToken();if(!token)return;
    const response=await fetch('/api/social/accounts',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)return;
    const accounts=Array.isArray(result.data)?result.data:[];const box=document.getElementById('accountsBox');if(!box)return;
    if(!accounts.length){box.innerHTML='<div class="empty">Belum ada akun sosial terhubung.</div>';return;}
    box.innerHTML=accounts.map(x=>{
      const p=providers[String(x.platform||'').toLowerCase()]||{label:String(x.platform||'Social'),icon:'•'};
      const followers=Number(x.followers||0).toLocaleString('id-ID');
      const name=x.youtube_channel_title||x.provider_display_name||x.handle||x.provider_username||'Connected account';
      const username=x.provider_username||x.handle||x.youtube_channel_id||'';
      return `<div class="row"><div style="display:flex;gap:10px;align-items:center"><div class="tag" style="min-width:28px;text-align:center">${esc(p.icon)}</div><div><b>${esc(p.label)}</b><div class="muted">${esc(name)}</div>${username?`<div class="muted">${esc(username)}</div>`:''}</div></div><div style="text-align:right"><span class="tag">${esc(x.status||'connected')}</span><div class="muted">${followers} followers</div><button class="btn" style="margin-top:7px" onclick="disconnectSocial('${esc(x.id)}','${esc(p.label)}')">Disconnect</button></div></div>`;
    }).join('');
  }catch(e){console.warn('Render connected social account:',e?.message||e)}}
  function chooser(){
    const old=document.getElementById('socialConnectChooser');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='socialConnectChooser';wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100000;display:grid;place-items:center;padding:20px';
    const cards=Object.values(providers).map(p=>`<button class="btn" data-provider="${p.platform}" style="display:flex;align-items:center;gap:12px;text-align:left;padding:14px;border-radius:12px"><span class="tag" style="min-width:30px;text-align:center">${esc(p.icon)}</span><span><b>${esc(p.label)}</b><small style="display:block;color:#7d8997;margin-top:3px">Hubungkan akun ${esc(p.label)}</small></span></button>`).join('');
    wrap.innerHTML=`<div style="width:min(560px,100%);background:#0c1118;border:1px solid #202a35;border-radius:18px;padding:22px;color:#edf3f8;box-shadow:0 30px 80px rgba(0,0,0,.45)"><div style="display:flex;justify-content:space-between;align-items:start;gap:10px"><div><div class="ey">SOCIAL ACCOUNTS</div><h2 style="margin:7px 0">Connect Account</h2><div style="color:#7d8997;font-size:12px">Pilih platform yang ingin kamu tautkan ke GROVIA.</div></div><button class="btn" data-close="1">×</button></div><div style="display:grid;gap:8px;margin-top:18px">${cards}</div><div style="margin-top:14px;color:#61707e;font-size:10px">Platform yang tersedia: Facebook, Instagram, TikTok, Threads, dan YouTube. X tidak digunakan.</div></div>`;
    document.body.appendChild(wrap);
    wrap.onclick=e=>{if(e.target===wrap||e.target.closest('[data-close]')){wrap.remove();return}const btn=e.target.closest('[data-provider]');if(!btn)return;wrap.remove();connectProvider(btn.dataset.provider)};
  }
  async function connectProvider(platform){
    if(platform==='youtube')return connectYouTube();
    const labels={facebook:'Facebook',instagram:'Instagram',tiktok:'TikTok',threads:'Threads'};
    try{
      const token=await getToken();if(!token){alert('Sesi login tidak valid. Silakan login kembali.');location.href='/login/';return;}
      const response=await fetch('/api/social/connect-provider',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({platform})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok)throw Error((result?.error?.code||('HTTP_'+response.status))+': '+(result?.error?.message||`${labels[platform]} belum siap.`));
      if(!result.data?.authorization_url)throw Error('OAuth URL tidak tersedia.');
      window.location.href=result.data.authorization_url;
    }catch(error){toast(error?.message||`Gagal menghubungkan ${labels[platform]}.`,true)}
  }
  async function connectYouTube(){try{
    const token=await getToken();if(!token){alert('Sesi login tidak valid. Silakan login kembali.');location.href='/login/';return;}
    const response=await fetch('/api/social/connect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({platform:'youtube'})});
    const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw Error((result?.error?.code||('HTTP_'+response.status))+': '+(result?.error?.message||'Gagal memulai koneksi YouTube.'));
    if(!result.data?.authorization_url)throw Error('OAUTH_URL_MISSING: URL OAuth YouTube tidak tersedia.');window.location.href=result.data.authorization_url;
  }catch(error){alert(error?.message||'Gagal menghubungkan YouTube.')}}
  async function disconnectSocial(id,label='akun sosial'){
    const token=await getToken();if(!token){alert('Sesi login tidak valid.');return}
    if(!confirm(`Putuskan koneksi ${label} ini?`))return;
    try{const response=await fetch('/api/social/disconnect',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({id}),cache:'no-store'});const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw Error(result?.error?.message||('HTTP '+response.status));toast(`${label} berhasil diputuskan.`);await renderConnectedAccount();if(typeof window.groviaReload==='function')await window.groviaReload();}catch(e){toast('Gagal disconnect: '+(e.message||'Unknown error'),true)}}
  window.connect=chooser;window.connectYouTube=connectYouTube;window.disconnectSocial=disconnectSocial;window.renderConnectedAccount=renderConnectedAccount;
  const params=new URLSearchParams(window.location.search);
  if(params.get('oauth')==='youtube'){const status=params.get('status');const stage=params.get('stage');const code=params.get('code');const reason=params.get('reason');const messages={connected:'YouTube berhasil terhubung.',denied:'Koneksi YouTube dibatalkan.',invalid_state:'Sesi koneksi YouTube tidak valid. Silakan coba lagi.',missing_code:'Kode OAuth YouTube tidak diterima.',no_channel:'Akun Google tidak memiliki channel YouTube yang dapat diakses.',error:`Koneksi YouTube gagal.\n${stage||'OAUTH_CALLBACK'} / ${code||'UNKNOWN'}\n${reason||'Periksa konfigurasi OAuth dan coba lagi.'}`};const message=messages[status];if(message)setTimeout(()=>alert(message),150);if(status==='connected')setTimeout(renderConnectedAccount,350);history.replaceState({},'',window.location.pathname)}
  if(params.get('oauth')==='social'){const status=params.get('status');const provider=params.get('platform')||'social';const reason=params.get('reason');if(status==='connected')setTimeout(renderConnectedAccount,350);if(status==='error')setTimeout(()=>alert(`Koneksi ${provider} gagal.\n${reason||'Periksa konfigurasi provider.'}`),150);history.replaceState({},'',window.location.pathname)}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(renderConnectedAccount,150));
})();
