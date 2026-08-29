(function(){
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function fixIds(){
    const overviewScore=document.querySelector('#overview #growth');
    if(overviewScore && overviewScore.id==='growth')overviewScore.id='growthScore';
    const section=document.querySelector('section.page#growth');
    return {overviewScore,section};
  }
  async function syncOverviewScore(){
    try{
      if(typeof session==='undefined'||!session?.access_token)return;
      const r=await fetch('/api/analytics/summary',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok)return;
      const s=j.data?.summary||{};
      const score=document.getElementById('growthScore');
      if(score)score.textContent=j.data?.rows?.length?String(Math.min(100,Math.max(0,Math.round(Number(s.engagement_rate||0)*10)))):'—';
    }catch{}
  }
  function keepGrowthEngineInPlace(){
    const {section}=fixIds();
    if(!section)return;
    if(typeof window.loadGrowthEngine==='function' && !section.innerHTML.includes('GROWTH INTELLIGENCE')){
      window.loadGrowthEngine();
    }
  }
  function install(){
    fixIds();
    syncOverviewScore();
    let lastGood=true;
    const observer=new MutationObserver(()=>{
      const {section}=fixIds();
      if(!section)return;
      const isEngine=section.innerHTML.includes('GROWTH INTELLIGENCE') && section.innerHTML.includes('growth-wrap');
      if(!isEngine && lastGood!==false){
        lastGood=false;
        setTimeout(()=>{keepGrowthEngineInPlace();lastGood=true},0);
      }else if(isEngine){
        lastGood=true;
      }
    });
    const {section}=fixIds();
    if(section)observer.observe(section,{childList:true,subtree:true});
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      fixIds();
      syncOverviewScore();
      if(window.groviaReload && window.loadGrowthEngine && !window.__growthReloadWrapped){
        const original=window.groviaReload;
        window.groviaReload=async function(){
          const out=await original();
          await window.loadGrowthEngine();
          await syncOverviewScore();
          return out;
        };
        window.__growthReloadWrapped=true;
      }
      keepGrowthEngineInPlace();
      if(window.__growthReloadWrapped && tries>20)clearInterval(timer);
    },500);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,50));
})();
