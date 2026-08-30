(function(){
  const KEY='grovia:last-youtube-sync';
  const COOLDOWN=60000;
  async function getSession(){
    try{
      if(typeof window.sb!=='undefined'&&window.sb){
        const s=await window.sb.auth.getSession();
        return s?.data?.session||null;
      }
      return null;
    }catch{return null}
  }
  async function syncNow(force=false){
    const last=Number(sessionStorage.getItem(KEY)||0);
    if(!force && Date.now()-last<COOLDOWN)return {skipped:true};
    const session=await getSession();
    if(!session)return {skipped:true};
    try{
      const accountsResponse=await fetch('/api/social/accounts',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
      const accountsResult=await accountsResponse.json().catch(()=>({}));
      if(!accountsResponse.ok||!accountsResult.ok)return {skipped:true};
      const accounts=Array.isArray(accountsResult.data)?accountsResult.data:[];
      if(!accounts.some(a=>String(a.platform).toLowerCase()==='youtube'&&a.status==='connected'))return {skipped:true};
      sessionStorage.setItem(KEY,String(Date.now()));
      const response=await fetch('/api/social/youtube/sync',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},cache:'no-store'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.ok){sessionStorage.removeItem(KEY);console.warn('YouTube sync:',result?.error?.message||('HTTP '+response.status));return {ok:false};}
      window.__groviaYoutubeLastSync=result.data||null;
      return {ok:true,data:result.data};
    }catch(e){sessionStorage.removeItem(KEY);console.warn('YouTube sync:',e?.message||e);return {ok:false};}
  }
  function hookReload(){
    if(typeof window.groviaReload!=='function'||window.__youtubeSyncWrapped)return false;
    const original=window.groviaReload;
    window.groviaReload=async function(){
      await syncNow(false);
      const result=await original();
      return result;
    };
    window.__youtubeSyncWrapped=true;
    return true;
  }
  function boot(){
    const timer=setInterval(()=>{if(hookReload())clearInterval(timer)},100);
    setTimeout(()=>syncNow(false),1200);
    window.syncYouTubeNow=()=>syncNow(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
