(function(){
  const KEY='grovia:last-youtube-sync-v2';
  const COOLDOWN=60000;
  let running=false;
  async function getSession(){
    try{
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok||!window.supabase)return null;
      const client=window.supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const s=await client.auth.getSession();
      return s?.data?.session||null;
    }catch(e){return null}
  }
  async function syncNow(force=false){
    if(running)return {skipped:true};
    const last=Number(sessionStorage.getItem(KEY)||0);
    if(!force && Date.now()-last<COOLDOWN)return {skipped:true};
    const session=await getSession();
    if(!session)return {skipped:true};
    running=true;
    try{
      const accountsResponse=await fetch('/api/social/accounts',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
      const accountsResult=await accountsResponse.json().catch(()=>({}));
      if(!accountsResponse.ok||!accountsResult.ok)return {skipped:true};
      const accounts=Array.isArray(accountsResult.data)?accountsResult.data:[];
      const yt=accounts.find(a=>String(a.platform).toLowerCase()==='youtube'&&a.status==='connected');
      if(!yt)return {skipped:true};
      sessionStorage.setItem(KEY,String(Date.now()));
      const response=await fetch('/api/social/youtube/sync',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},cache:'no-store'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok){sessionStorage.removeItem(KEY);console.warn('YouTube sync v2:',result?.error?.message||('HTTP '+response.status));return {ok:false};}
      window.__groviaYoutubeLastSync=result.data||null;
      if(typeof window.groviaReload==='function'){
        try{await window.groviaReload()}catch(e){console.warn('Refresh after YouTube sync:',e?.message||e)}
      }
      if(typeof window.renderConnectedAccount==='function'){
        try{await window.renderConnectedAccount()}catch{}
      }
      return {ok:true,data:result.data};
    }catch(e){sessionStorage.removeItem(KEY);console.warn('YouTube sync v2:',e?.message||e);return {ok:false};}
    finally{running=false}
  }
  window.syncYouTubeNow=()=>syncNow(true);
  function boot(){setTimeout(()=>syncNow(false),1200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
