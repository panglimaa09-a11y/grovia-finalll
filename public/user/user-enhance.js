(function(){
  const $=id=>document.getElementById(id);
  let localClient=null,localSession=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=n=>Number(n||0).toFixed(1)+'%';
  async function boot(){
    try{
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok)return;
      localClient=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const s=await localClient.auth.getSession(); localSession=s.data.session;
      if(!localSession){location.href='/login/';return;}
      window.groviaReload=refreshAll;
      wireLibrary(); wireScheduler(); wireSettings(); wireGrowth(); wireReports();
      await refreshAll();
    }catch(e){console.error('GROVIA user enhance:',e)}
  }
  async function api(path,opt={}){
    if(!localSession)throw Error('Session tidak valid');
    const headers={'Content-Type':'application/json',Authorization:'Bearer '+localSession.access_token,...(opt.headers||{})};
    const r=await fetch(path,{...opt,headers,cache:'no-store'}); const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`); return j.data;
  }
  function fill(id,html){const el=$(id);if(el)el.innerHTML=html}
  async function refreshAll(){
    const results=await Promise.allSettled([
      api('/api/profile'),api('/api/social/accounts'),api('/api/content'),api('/api/scheduler'),api('/api/analytics/summary'),api('/api/billing/subscription'),api('/api/ai/usage')
    ]);
    const [pr,sa,co,sc,an,sub,ai]=results.map(x=>x.status==='fulfilled'?x.value:null);
    const user=pr?.auth||localSession?.user; const name=pr?.profile?.display_name||user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Creator';
    if($('hello'))$('hello').textContent='Selamat datang, '+name;
    if($('email'))$('email').textContent=user?.email||'—';
    if($('display')&&document.activeElement!==$('display'))$('display').value=pr?.profile?.display_name||name;
    if($('ws'))$('ws').textContent=pr?.profile?.display_name||name;
    if($('avatar'))$('avatar').textContent=name[0]?.toUpperCase()||'?';
    const rows=an?.rows||[]; const sum=an?.summary||{};
    if($('followers'))$('followers').textContent=fmt(sum.followers ?? (sa||[]).reduce((s,x)=>s+Number(x.followers||0),0));
    if($('reach'))$('reach').textContent=fmt(sum.reach);
    if($('eng'))$('eng').textContent=pct(sum.engagement_rate);
    if($('growth'))$('growth').textContent=rows.length?String(Math.min(100,Math.max(0,Math.round(Number(sum.engagement_rate||0)*10)))):'—';
    if($('views'))$('views').textContent=fmt(sum.views); if($('reach2'))$('reach2').textContent=fmt(sum.reach); if($('rows'))$('rows').textContent=fmt(rows.length);
    fill('queue',sc?.length?sc.filter(x=>x.status!=='cancelled').slice(0,8).map(x=>`<div class="row"><span>${esc(x.grovia_content_items?.title||'Content')}</span><span class="tag">${esc(x.platform)} · ${esc(x.status)}</span></div>`).join(''):'<div class="empty">Belum ada jadwal.</div>');
    fill('insight',rows.length?`<div class="row"><span>Views</span><b>${fmt(sum.views)}</b></div><div class="row"><span>Watch time</span><b>${Number(sum.watch_time_minutes||0).toFixed(1)} menit</b></div>`:'Belum ada analytics.');
    renderAccounts(sa||[]); renderLibrary(co||[]); renderScheduler(sc||[]); renderGrowth(rows,sc||[]); renderPlan(rows,sc||[]); renderReport(rows,co||[],sc||[]); renderBilling(sub,ai);
  }
  function renderAccounts(a){
    fill('accountsBox',a.length?a.map(x=>`<div class="row"><div><b>${esc(x.platform)}</b><div class="muted">${esc(x.youtube_channel_title||x.handle||'Connected account')}</div></div><div style="text-align:right"><span class="tag">${esc(x.status||'connected')}</span><div class="muted">${fmt(x.followers)} followers/subscribers</div><button class="btn" style="margin-top:6px" onclick="disconnectSocial('${esc(x.id)}')">Disconnect</button></div></div>`).join(''):'<div class="empty">Belum ada akun sosial. Gunakan Connect Account untuk YouTube.</div>');
  }
  function renderLibrary(items){
    fill('libraryBox',`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px"><form id="contentForm" class="card" style="padding:14px"><b>Buat konten</b><input id="ctitle" class="field" placeholder="Judul konten" required><select id="cformat" class="field"><option value="short">Short video</option><option value="post">Post</option><option value="video">Video</option><option value="script">Script</option></select><textarea id="cbody" class="field" rows="5" placeholder="Isi / brief"></textarea><input id="cplatforms" class="field" placeholder="Platform, contoh: youtube"></input><button class="btn primary" style="width:100%">Simpan Draft</button></form></div><div>${items.length?items.map(x=>`<div class="row"><div><b>${esc(x.title)}</b><div class="muted">${esc(x.format||'content')} · ${esc((x.platforms||[]).join(', '))}</div></div><div><span class="tag">${esc(x.status)}</span><button class="btn" style="margin-left:6px" onclick="deleteContent('${esc(x.id)}')">Hapus</button></div></div>`).join(''):'<div class="empty">Belum ada konten.</div>'}</div>`);
    const f=$('contentForm'); if(f)f.onsubmit=async e=>{e.preventDefault();try{const platforms=$('cplatforms').value.split(',').map(x=>x.trim()).filter(Boolean);await api('/api/content',{method:'POST',body:JSON.stringify({title:$('ctitle').value,format:$('cformat').value,platforms,body:{text:$('cbody').value}})});f.reset();await refreshAll();}catch(err){alert(err.message)}};
  }
  function renderScheduler(items){
    const opts=window.__groviaContent||[];
    fill('schedulerBox',`<form id="scheduleForm" class="card" style="margin-bottom:14px"><b>Buat jadwal</b><select id="scontent" class="field"><option value="">Tanpa content</option>${opts.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select><select id="splatform" class="field"><option value="youtube">YouTube</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="facebook">Facebook</option><option value="x">X</option></select><input id="swhen" class="field" type="datetime-local" required><button class="btn primary">Schedule</button></form>${items.length?items.map(x=>`<div class="row"><div><b>${esc(x.grovia_content_items?.title||'Content')}</b><div class="muted">${esc(x.platform)} · ${new Date(x.scheduled_at).toLocaleString('id-ID')}</div></div><div><span class="tag">${esc(x.status)}</span>${x.status==='scheduled'?`<button class="btn" style="margin-left:6px" onclick="cancelSchedule('${esc(x.id)}')">Cancel</button>`:''}</div></div>`).join(''):'<div class="empty">Belum ada jadwal.</div>'}`);
    window.__groviaSchedules=items;
    const f=$('scheduleForm');if(f)f.onsubmit=async e=>{e.preventDefault();try{await api('/api/scheduler',{method:'POST',body:JSON.stringify({content_id:$('scontent').value||null,platform:$('splatform').value,scheduled_at:new Date($('swhen').value).toISOString()})});f.reset();await refreshAll();}catch(err){alert(err.message)}};
  }
  function renderGrowth(rows,schedules){
    if(!rows.length){fill('growth','<h1>Growth Engine</h1><div class="card empty">Belum ada analytics nyata. Hubungkan akun dan kumpulkan data terlebih dahulu.</div>');return;}
    const latest=rows.at(-1), prev=rows.length>1?rows.at(-2):null; const followerDelta=prev?Number(latest.followers||0)-Number(prev.followers||0):0;
    fill('growth',`<h1>Growth Engine</h1><div class="grid three"><div class="metric"><small>GROWTH SCORE</small><strong>${Math.min(100,Math.max(0,Math.round(Number(latest.engagement_rate||0)*10 + Math.max(0,followerDelta))))}</strong></div><div class="metric"><small>FOLLOWER DELTA</small><strong>${followerDelta>=0?'+':''}${fmt(followerDelta)}</strong></div><div class="metric"><small>ACTIVE SCHEDULES</small><strong>${fmt(schedules.filter(x=>x.status==='scheduled').length)}</strong></div></div><div class="card" style="margin-top:14px"><div class="row"><span>Latest analytics</span><span>${new Date(latest.metric_date).toLocaleDateString('id-ID')}</span></div><div class="row"><span>Followers</span><b>${fmt(latest.followers)}</b></div><div class="row"><span>Reach</span><b>${fmt(latest.reach)}</b></div><div class="row"><span>Engagement</span><b>${pct(latest.engagement_rate)}</b></div></div>`);
  }
  function renderPlan(rows,schedules){
    if(!rows.length){fill('planpg','<h1>30-Day Growth Plan</h1><div class="card empty">Plan akan dibuat dari analytics nyata setelah data tersedia.</div>');return;}
    const er=Number(rows.at(-1).engagement_rate||0), cadence=schedules.filter(x=>x.status==='scheduled').length;
    const tasks=[`Publikasikan ${cadence?Math.max(1,Math.round(cadence/7)):3} konten per minggu`,`Pertahankan engagement di atas ${Math.max(1,er).toFixed(1)}%`,`Review reach dan views setiap 7 hari`,`Uji dua format konten dan bandingkan performanya`];
    fill('planpg',`<h1>30-Day Growth Plan</h1><div class="card"><p class="muted">Plan dihitung dari analytics workspace saat ini.</p>${tasks.map((t,i)=>`<div class="row"><span>Day ${i+1}</span><b>${esc(t)}</b></div>`).join('')}<button class="btn primary" onclick="go('reports')" style="margin-top:12px">Buat Report</button></div>`);
  }
  function renderReport(rows,content,schedules){
    const payload={generated_at:new Date().toISOString(),metrics:rows,content_count:content.length,schedule_count:schedules.length};
    fill('reports',`<h1>Reports</h1><div class="card"><div class="row"><span>Analytics rows</span><b>${fmt(rows.length)}</b></div><div class="row"><span>Content items</span><b>${fmt(content.length)}</b></div><div class="row"><span>Scheduled posts</span><b>${fmt(schedules.length)}</b></div><button class="btn primary" onclick='downloadReport(${JSON.stringify(JSON.stringify(payload))})'>Download JSON Report</button></div>`);
  }
  function renderBilling(sub,ai){
    if($('billPlan'))$('billPlan').textContent=sub?.plan||'Belum berlangganan'; if($('billStatus'))$('billStatus').textContent=sub?`${sub.status}${sub.period_end?' · berakhir '+new Date(sub.period_end).toLocaleDateString('id-ID'):''}`:'Belum ada subscription.'; if($('aiUsed'))$('aiUsed').textContent=fmt(ai?.used||0);
  }
  function wireLibrary(){}
  function wireScheduler(){}
  function wireGrowth(){}
  function wireReports(){}
  function wireSettings(){
    const b=$('display')?.parentElement?.querySelector('.primary'); if(b&&!b.dataset.bound){b.dataset.bound='1';b.onclick=saveProfile;}
  }
  window.saveProfile=async function(){try{await api('/api/profile',{method:'PATCH',body:JSON.stringify({display_name:$('display').value,timezone:'Asia/Jakarta'})});await refreshAll();alert('Profil tersimpan.')}catch(e){alert(e.message)}};
  window.deleteContent=async function(id){if(!confirm('Hapus konten ini?'))return;try{await api('/api/content/'+encodeURIComponent(id),{method:'DELETE'});await refreshAll()}catch(e){alert(e.message)}};
  window.cancelSchedule=async function(id){try{await api('/api/scheduler/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status:'cancelled'})});await refreshAll()}catch(e){alert(e.message)}};
  window.disconnectSocial=async function(id){if(!confirm('Putuskan akun sosial ini?'))return;try{await api('/api/social/disconnect',{method:'POST',body:JSON.stringify({id})});await refreshAll()}catch(e){alert(e.message)}};
  window.downloadReport=function(json){const blob=new Blob([json],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='grovia-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  const oldContentRender=window.renderLibrary;
  async function captureContent(){try{window.__groviaContent=await api('/api/content')}catch{window.__groviaContent=[]}}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(async()=>{await captureContent();await boot();},0)});
})();
