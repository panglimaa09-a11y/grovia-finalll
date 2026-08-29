(async()=>{
  try {
    // Independent fallback loader. Do not depend on the main dashboard's session variable.
    const cfgRes=await fetch('/api/public-config',{cache:'no-store'});
    const cfg=await cfgRes.json();
    if(!cfg.ok||!cfg.data?.supabaseUrl||!cfg.data?.supabaseAnonKey)return;
    const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const {data,error}=await client.auth.getSession();
    if(error||!data?.session)return;
    const token=data.session.access_token;
    const r=await fetch('/api/profile',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
    if(!r.ok)return;
    const j=await r.json();
    if(!j.ok)return;
    const auth=j.data?.auth||data.session.user;
    const profile=j.data?.profile;
    const name=profile?.display_name||auth?.user_metadata?.full_name||auth?.user_metadata?.name||auth?.email?.split('@')[0]||'Creator';
    const hello=document.getElementById('hello');
    const email=document.getElementById('email');
    const display=document.getElementById('display');
    const ws=document.getElementById('ws');
    const avatar=document.getElementById('avatar');
    if(hello)hello.textContent='Selamat datang, '+name;
    if(email)email.textContent=auth?.email||'—';
    if(display&&document.activeElement!==display)display.value=profile?.display_name||name;
    if(ws)ws.textContent=profile?.display_name||name;
    if(avatar)avatar.textContent=name[0]?.toUpperCase()||'?';
  }catch(e){console.warn('Overview recovery:',e?.message||e)}
})();
