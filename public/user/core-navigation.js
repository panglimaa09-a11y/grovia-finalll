(function(){
  let client=null;
  async function initCore(){
    try{
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok||!window.supabase)return;
      client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const s=await client.auth.getSession();
      window.sb=client;
      window.session=s.data.session||null;
      client.auth.onAuthStateChange((_event,next)=>{window.session=next||null});
    }catch(e){console.warn('GROVIA core auth:',e)}
  }
  window.go=function(page){
    const target=page==='growth'?'growthEngine':page;
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    const el=document.getElementById(target)||document.getElementById(page);
    if(el)el.classList.add('active');
    document.querySelectorAll('#nav button').forEach(x=>{
      const p=x.dataset.p;
      x.classList.toggle('active',p===page||p===target);
    });
    if(target==='growthEngine'&&typeof window.loadGrowthEngine==='function')setTimeout(window.loadGrowthEngine,0);
    if(target==='planpg'&&typeof window.loadGrowthPlan==='function')setTimeout(window.loadGrowthPlan,0);
  };
  async function logout(){try{if(client)await client.auth.signOut()}finally{location.href='/login/'}}
  function bind(){
    document.querySelectorAll('#nav button').forEach(b=>{b.onclick=()=>window.go(b.dataset.p)});
    const b=document.getElementById('logout');if(b)b.onclick=logout;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();initCore()},{once:true});
  else{bind();initCore()}
})();