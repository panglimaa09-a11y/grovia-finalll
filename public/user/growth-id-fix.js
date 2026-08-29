(function(){
  function fix(){
    const section=document.getElementById('growth');
    if(section && section.tagName==='SECTION') section.id='growthEngine';
    document.querySelectorAll('#nav button[data-p="growth"]').forEach(b=>b.dataset.p='growthEngine');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fix,{once:true});
  else fix();
})();
