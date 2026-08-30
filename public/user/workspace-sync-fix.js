(function(){
  const SYNC_KEY='grovia:workspace-sync';
  const COOLDOWN=60000;
  const $=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=n=>Number(n||0).toFixed(1)+'%';

  function isolateReports(){
    const styleId='grovia-reports-isolation';
    if(!document.getElementById(styleId)){
      const style=document.createElement('style');
      style.id=styleId;
      style.textContent='#reports.page{display:none!important}#reports.page.active{display:block!important}';
      document.head.appendChild(style);
    }
    const reports=$('reports');
    const content=document.querySelector('.content');
    if(reports&&content&&reports.parentElement!==content)content.appendChild(reports);
  }

  async function session(){
    try{
      if(window.sb){
        const s=await window.sb.auth.getSession();
        return s?.data?.session||null;
      }
    }catch(e){console.warn('workspace session:',e?.message||e)}
    return null;
  }

  async function api(path,token){
    const r=await fetch(path,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Error(j.error?.message||('HTTP '+r.status));
    return j.data??j;
  }

  async function syncAndRefresh(force){
    const last=Number(sessionStorage.getItem(SYNC_KEY)||0);
    if(!force&&Date.now()-last<COOLDOWN)return;
    const s=await session();
    if(!s)return;
    const accounts=await api('/api/social/accounts',s.access_token);
    const hasYoutube=(Array.isArray(accounts)?accounts:[]).some(a=>String(a.platform).toLowerCase()==='youtube'&&a.status==='connected');
    if(!hasYoutube)return;
    sessionStorage.setItem(SYNC_KEY,String(Date.now()));
    try{
      await api('/api/social/youtube/sync',s.access_token);
    }catch(e){
      sessionStorage.removeItem(SYNC_KEY);
      console.warn('YouTube workspace sync:',e?.message||e);
      return;
    }

    const [summary,daily,latestAccounts]=await Promise.all([
      api('/api/analytics/summary',s.access_token),
      api('/api/analytics/daily?days=30',s.access_token),
      api('/api/social/accounts',s.access_token)
    ]);
    const rows=Array.isArray(daily)?daily:[];
    const sum=summary?.summary||{};
    const followers=sum.followers??(Array.isArray(latestAccounts)?latestAccounts.reduce((n,a)=>n+Number(a.followers||0),0):0);
    const reach=Number(sum.reach||0);
    const views=Number(sum.views||0);
    const engagement=Number(sum.engagement_rate||0);
    if($('followers'))$('followers').textContent=fmt(followers);
    if($('reach'))$('reach').textContent=fmt(reach);
    if($('eng'))$('eng').textContent=pct(engagement);
    if($('views'))$('views').textContent=fmt(views);
    if($('reach2'))$('reach2').textContent=fmt(reach);
    if($('rows'))$('rows').textContent=fmt(rows.length);
    if($('growth'))$('growth').textContent=rows.length?String(Math.min(100,Math.max(0,Math.round(engagement*10)))):'—';
    if(typeof window.loadReportsUI==='function')await window.loadReportsUI();
    isolateReports();
    const active=document.querySelector('#nav button.active');
    if(active?.dataset?.p!=='reports')$('reports')?.classList.remove('active');
  }

  function observe(){
    isolateReports();
    const content=document.querySelector('.content');
    if(content){
      new MutationObserver(()=>isolateReports()).observe(content,{childList:true,subtree:true});
    }
    setTimeout(()=>syncAndRefresh(false),1200);
    window.syncWorkspaceNow=()=>syncAndRefresh(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();