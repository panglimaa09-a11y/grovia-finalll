(function(){
  function repair(){
    const reports=document.getElementById('reports');
    if(!reports)return;
    const activeNav=document.querySelector('#nav button.active');
    const isReports=activeNav?.dataset?.p==='reports';
    if(!isReports)reports.classList.remove('active');
    if(isReports && typeof window.loadReportsUI==='function'){
      if(!reports.dataset.__reportWatch){
        reports.dataset.__reportWatch='1';
        const observer=new MutationObserver(()=>{
          if(isReports && reports.textContent.includes('Analytics rows')){
            reports.dataset.reportsMounted='';
            window.loadReportsUI();
          }
        });
        observer.observe(reports,{childList:true,subtree:true});
      }
    }
  }
  function boot(){
    repair();
    setInterval(repair,300);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
