(function(){
  let syncRunning=false;
  let lastSync=0;
  const SYNC_COOLDOWN=60000;
  const $=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=n=>Number(n||0).toFixed(1)+'%';

  function syncReportVisibility(){
    const reports=$('reports');
    if(!reports)return;
    const active=document.querySelector('#nav button.active')?.dataset?.p;
    reports.classList.toggle('active',active==='reports');
    if(active!=='reports')reports.style.display='none';
    else reports.style.removeProperty('display');
  }

  function observeReports(){
    const reports=$('reports');
    if(!reports||reports.dataset.__visibilityWatch)return;
    reports.dataset.__visibilityWatch='1';
    new MutationObserver(()=>{
      const active=document.querySelector('#nav button.active')?.dataset?.p==='reports';
      if(active && reports.textContent.includes('Analytics rows') && typeof window.loadReportsUI==='function'){
        reports.dataset.reportsMounted='';
        window.loadReportsUI();
      }
      syncReportVisibility();
    }).observe(reports,{childList:true,subtree:true});
  }

  async function getSession(){
    try{
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok||typeof window.supabase==='undefined')return null;
      const client=window.supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const s=await client.auth.getSession();
      return s?.data?.session||null;
    }catch{return null}
  }

  async function syncWorkspace(){
    if(syncRunning||Date.now()-lastSync<SYNC_COOLDOWN)return;
    const session=await getSession();
    if(!session)return;
    syncRunning=true;
    try{
      const headers={Authorization:'Bearer '+session.access_token};
      const accountsResponse=await fetch('/api/social/accounts',{headers,cache:'no-store'});
      const accountsResult=await accountsResponse.json().catch(()=>({}));
      const accounts=Array.isArray(accountsResult.data)?accountsResult.data:[];
      const yt=accounts.find(a=>String(a.platform).toLowerCase()==='youtube'&&a.status==='connected');
      if(!yt){syncReportVisibility();return;}
      const syncResponse=await fetch('/api/social/youtube/sync',{method:'POST',headers:{...headers,'Content-Type':'application/json'},cache:'no-store'});
      const syncResult=await syncResponse.json().catch(()=>({}));
      if(!syncResponse.ok||!syncResult.ok)return;
      lastSync=Date.now();
      const [summaryResponse,accountsLatestResponse]=await Promise.all([
        fetch('/api/analytics/summary',{headers,cache:'no-store'}),
        fetch('/api/social/accounts',{headers,cache:'no-store'})
      ]);
      const summaryResult=await summaryResponse.json().catch(()=>({}));
      const accountsLatestResult=await accountsLatestResponse.json().catch(()=>({}));
      const summary=summaryResult?.data?.summary||{};
      const latestAccounts=Array.isArray(accountsLatestResult?.data)?accountsLatestResult.data:[];
      const latestYoutube=latestAccounts.find(a=>String(a.platform).toLowerCase()==='youtube');
      const followers=Number(summary.followers??latestYoutube?.followers??0);
      const reach=Number(summary.reach||0);
      const engagement=Number(summary.engagement_rate||0);
      if($('followers'))$('followers').textContent=fmt(followers);
      if($('reach'))$('reach').textContent=fmt(reach);
      if($('eng'))$('eng').textContent=pct(engagement);
      if($('reach2'))$('reach2').textContent=fmt(reach);
      if(typeof window.renderConnectedAccount==='function')await window.renderConnectedAccount();
      if(typeof window.loadGrowthEngine==='function')await window.loadGrowthEngine();
      if(typeof window.loadGrowthPlan==='function')await window.loadGrowthPlan();
      if(typeof window.loadReportsUI==='function' && document.querySelector('#nav button.active')?.dataset?.p==='reports')await window.loadReportsUI();
      syncReportVisibility();
    }catch(e){console.warn('Workspace sync:',e?.message||e)}
    finally{syncRunning=false}
  }

  function boot(){
    syncReportVisibility();
    observeReports();
    const nav=document.querySelector('#nav');
    if(nav&&!nav.dataset.__reportVisibilityWatch){
      nav.dataset.__reportVisibilityWatch='1';
      new MutationObserver(syncReportVisibility).observe(nav,{attributes:true,subtree:true,attributeFilter:['class']});
    }
    setTimeout(syncWorkspace,1200);
    setInterval(()=>{syncReportVisibility();syncWorkspace()},3000);
    window.syncWorkspaceNow=()=>{lastSync=0;return syncWorkspace()};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
