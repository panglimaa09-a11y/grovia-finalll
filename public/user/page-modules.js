(function(){
  function boot(){
    let wrappedGo=false;
    const attachGo=()=>{
      if(typeof window.go!=='function'||wrappedGo)return;
      const originalGo=window.go;
      window.go=function(page){
        const target=page==='growth'?'growthEngine':page;
        originalGo(target);
        if(target==='growthEngine'&&typeof window.loadGrowthEngine==='function')setTimeout(()=>window.loadGrowthEngine(),0);
        if(target==='planpg'&&typeof window.loadGrowthPlan==='function')setTimeout(()=>window.loadGrowthPlan(),0);
      };
      wrappedGo=true;
    };
    attachGo();
    const timer=setInterval(()=>{
      attachGo();
      if(wrappedGo)clearInterval(timer);
    },100);

    const protectRefresh=()=>{
      if(typeof window.groviaReload!=='function'||window.__groviaModuleRefreshWrapped)return false;
      const original=window.groviaReload;
      window.groviaReload=async function(){
        const result=await original();
        if(typeof window.loadGrowthEngine==='function')await window.loadGrowthEngine();
        if(typeof window.loadGrowthPlan==='function')await window.loadGrowthPlan();
        return result;
      };
      window.__groviaModuleRefreshWrapped=true;
      return true;
    };
    const refreshTimer=setInterval(()=>{if(protectRefresh())clearInterval(refreshTimer)},100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
