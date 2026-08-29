(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let session=null;
  const fmtDate=v=>v?new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';
  async function getSession(){
    const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
    if(!cfg.ok||!window.supabase)throw Error('Supabase tidak siap.');
    const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const s=await client.auth.getSession(); session=s.data.session; if(!session)location.href='/login/'; return session;
  }
  async function api(path,opt={}){
    if(!session)await getSession();
    const r=await fetch(path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,...(opt.headers||{})},cache:'no-store'});
    const j=await r.json().catch(()=>({})); if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`); return j.data;
  }
  async function load(){
    try{
      const [items,schedules]=await Promise.all([api('/api/content'),api('/api/scheduler')]);
      render(items||[],schedules||[]);
    }catch(e){
      const box=$('schedulerBox'); if(box)box.innerHTML=`<div class="card"><div style="color:#ff9b9b">${esc(e.message)}</div></div>`;
    }
  }
  function render(items,schedules){
    const active=(schedules||[]).filter(x=>x.status!=='cancelled');
    const sorted=[...active].sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
    const upcoming=sorted.filter(x=>new Date(x.scheduled_at)>=new Date());
    const next=upcoming[0];
    const box=$('schedulerBox'); if(!box)return;
    box.innerHTML=`
      <div class="grid three" style="margin-bottom:14px">
        <div class="metric"><small>UPCOMING</small><strong>${upcoming.length}</strong></div>
        <div class="metric"><small>ALL SCHEDULES</small><strong>${active.length}</strong></div>
        <div class="metric"><small>NEXT POST</small><strong style="font-size:15px">${next?esc(fmtDate(next.scheduled_at)):'—'}</strong></div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="head" style="margin-bottom:12px"><div><h2 style="margin:0">Create Schedule</h2><p>Pilih konten yang sudah ada dan tentukan waktu publikasi.</p></div></div>
        <form id="scheduleForm" style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;align-items:end">
          <label class="muted">Content<select id="scontent" class="field" required><option value="">Pilih konten</option>${items.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label>
          <label class="muted">Platform<select id="splatform" class="field"><option value="youtube">YouTube</option><option value="youtube-shorts">YouTube Shorts</option></select></label>
          <label class="muted">Tanggal & jam<input id="swhen" class="field" type="datetime-local" required></label>
          <div style="grid-column:1/-1"><button class="btn primary" type="submit">＋ Schedule Post</button></div>
        </form>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px"><div><h2 style="margin:0">Publishing Queue</h2><p class="muted">Daftar jadwal milik workspace ini.</p></div><span class="tag">${active.length} active</span></div>
        ${sorted.length?sorted.map(x=>`<div class="row" style="align-items:center"><div style="min-width:0"><b>${esc(x.grovia_content_items?.title||'Untitled content')}</b><div class="muted">${esc(x.platform)} · ${esc(fmtDate(x.scheduled_at))}</div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><span class="tag">${esc(x.status)}</span><button class="btn" onclick="window.editSchedule('${esc(x.id)}')">Edit</button><button class="btn" onclick="window.cancelSchedule('${esc(x.id)}')">Cancel</button></div></div>`).join(''):'<div class="empty">Belum ada jadwal.</div>'}
      </div>`;
    const form=$('scheduleForm');
    form.onsubmit=async e=>{e.preventDefault();const when=$('swhen').value;if(new Date(when)<=new Date())return alert('Pilih waktu di masa depan.');try{await api('/api/scheduler',{method:'POST',body:JSON.stringify({content_id:$('scontent').value,platform:$('splatform').value,scheduled_at:new Date(when).toISOString()})});await load();if(window.groviaReload)await window.groviaReload();alert('Jadwal berhasil dibuat.')}catch(err){alert(err.message)}};
  }
  window.editSchedule=async function(id){
    try{
      const list=await api('/api/scheduler'); const item=list.find(x=>x.id===id); if(!item)return;
      const when=prompt('Ubah tanggal & jam (YYYY-MM-DD HH:mm):',new Date(item.scheduled_at).toISOString().slice(0,16).replace('T',' ')); if(when===null)return;
      const dt=new Date(when.replace(' ','T')); if(Number.isNaN(dt.getTime()))return alert('Format waktu tidak valid.');
      const status=prompt('Status (scheduled/cancelled):',item.status||'scheduled'); if(status===null)return;
      await api('/api/scheduler/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({scheduled_at:dt.toISOString(),status})}); await load(); if(window.groviaReload)await window.groviaReload();
    }catch(e){alert(e.message)}
  };
  window.cancelSchedule=async function(id){if(!confirm('Batalkan jadwal ini?'))return;try{await api('/api/scheduler/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status:'cancelled'}));await load();if(window.groviaReload)await window.groviaReload();}catch(e){alert(e.message)}};
  function install(){ if($('schedulerBox')&&!$('schedulerForm'))load(); }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250));
  window.loadSchedulerUI=load;
})();
