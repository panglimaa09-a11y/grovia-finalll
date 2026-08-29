(function(){
  function apply(){
    const kpi=document.getElementById('growth');
    if(kpi && kpi.closest('#overview')) kpi.id='growthScore';
    const section=document.getElementById('growth');
    if(section && section.tagName==='SECTION') section.id='growthEngine';
    document.querySelectorAll('#nav button').forEach(b=>{
      if(b.dataset.p==='growth'||b.dataset.p==='growthEngine'){
        b.dataset.p='growthEngine';
        b.onclick=()=>go('growthEngine');
      }
      if(b.dataset.p==='planpg') b.onclick=()=>go('planpg');
    });
    window.__growthIdsFixed=true;
  }
  apply();
})();
