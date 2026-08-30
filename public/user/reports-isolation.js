(function(){
  let syncRunning=false;
  let lastSync=0;
  const SYNC_COOLDOWN=60000;
  const $=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=n=>Number(n||0).toFixed(1)+'%';

  function repair(){
    const reports=$('reports');
    if(!reports)return;
    const activeNav=document.querySelector('#nav button.active');
    const isReports=activeNav?.dataset?.p==='reports';
    if(!isReports)reports.classList.remove('active');
    if(isReports && typeof window.loadReportsUI==='function' && !reports.dataset.__reportWatch){
      reports.dataset.__reportWatch='1';
      const observer=new MutationObserver(()=>{
        const active=document.querySelector('#nav button.active')?.dataset?.p==='reports';
        if(active && reports.textContent.includes('Analytics rows')){
          reports.dataset.reportsMounted='';
          window.loadReportsUI();
        }
      });
      observer.observe(reports,{childList:true,subtree:true});
    }
  }

  async function getSession(){
    try{
      if(typeof window.supabase==='undefined')return null;
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok)return null;
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
      if(!yt){repair();return;}

      const syncResponse=await fetch('/api/social/youtube/sync',{method:'POST',headers:{...headers,'Content-Type':'application/json'},cache:'no-store'});
      const syncResult=await syncResponse.json().catch(()=>({}));
      if(!syncResponse.ok||!syncResult.ok){console.warn('Workspace YouTube sync:',syncResult?.error?.message||('HTTP '+syncResponse.status));return;}
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
      const views=Number(summary.views||0);
      const engagement=Number(summary.engagement_rate||0);
      if($('followers'))$('followers').textContent=fmt(followers);
      if($('reach'))$('reach').textContent=fmt(reach);
      if($('eng'))$('eng').textContent=pct(engagement);
      if($('views'))$('views').textContent=fmt(views);
      if($('reach2'))$('reach2').textContent=fmt(reach);
      if(typeof window.renderConnectedAccount==='function')await window.renderConnectedAccount();
      if(typeof window.loadReportsUI==='function')await window.loadReportsUI();
      if(typeof window.loadGrowthEngine==='function')await window.loadGrowthEngine();
      if(typeof window.loadGrowthPlan==='function')await window.loadGrowthPlan();
      repair();
    }catch(e){console.warn('Workspace sync:',e?.message||e)}
    finally{syncRunning=false}
  }

  function boot(){
    repair();
    setTimeout(syncWorkspace,1200);
    setInterval(()=>{repair();syncWorkspace()},3000);
    window.syncWorkspaceNow=()=>{lastSync=0;return syncWorkspace()};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
