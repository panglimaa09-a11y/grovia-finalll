(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let session=null;
  const fmtDate=v=>v?new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';
  async function getSession(){const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());if(!cfg.ok||!window.supabase)throw Error('Supabase tidak siap.');const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});const s=await client.auth.getSession();session=s.data.session;if(!session)location.href='/login/';return session;}
  async function api(path,opt={}){if(!session)await getSession();const r=await fetch(path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,...(opt.headers||{})},cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`);return j.data;}
  function toast(message,type='ok'){const old=$('groviaSchedulerToast');if(old)old.remove();const el=document.createElement('div');el.id='groviaSchedulerToast';el.textContent=message;el.style.cssText=`position:fixed;right:22px;bottom:22px;z-index:9999;padding:12px 15px;border:1px solid #2a3540;border-radius:12px;background:#0c1118;color:${type==='error'?'#ffadad':'#dfffc0'};box-shadow:0 12px 30px rgba(0,0,0,.3);font-weight:700;max-width:360px`;document.body.appendChild(el);setTimeout(()=>el.remove(),2800)}
  async function load(){const box=$('schedulerBox');if(!box)return;box.innerHTML='<div class="empty">Memuat scheduler…</div>';try{const[items,schedules,accounts]=await Promise.all([api('/api/content'),api('/api/scheduler'),api('/api/social/accounts')]);render(items||[],schedules||[],accounts||[])}catch(e){box.innerHTML=`<div class="card"><div style="color:#ff9b9b">${esc(e.message)}</div></div>`}}
  function render(items,schedules,accounts){
    const active=schedules.filter(x=>x.status!=='cancelled');const now=Date.now();const upcoming=active.filter(x=>new Date(x.scheduled_at).getTime()>=now).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));const next=upcoming[0];
    const connectedPlatforms=new Set(accounts.filter(x=>x.status==='connected').map(x=>String(x.platform).toLowerCase()));
    const all=[['youtube','YouTube'],['youtube-shorts','YouTube Shorts'],['instagram','Instagram'],['tiktok','TikTok'],['facebook','Facebook'],['x','X']];
    const available=all.filter(([v])=>v.startsWith('youtube')?connectedPlatforms.has('youtube'):connectedPlatforms.has(v));
    const opts=available.length?available:all.filter(([v])=>v.startsWith('youtube'));
    const box=$('schedulerBox');box.innerHTML=`
      <div class="grid three" style="margin-bottom:14px">
        <div class="metric"><small>UPCOMING</small><strong>${upcoming.length}</strong><div class="muted">Jadwal mendatang</div></div>
        <div class="metric"><small>ACTIVE</small><strong>${active.length}</strong><div class="muted">Jadwal aktif</div></div>
        <div class="metric"><small>NEXT POST</small><strong style="font-size:14px">${next?esc(fmtDate(next.scheduled_at)):'—'}</strong><div class="muted">${next?esc(next.platform):'Belum ada'}</div></div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px"><div><div class="ey">PUBLISHING WORKFLOW</div><h2 style="margin:6px 0">Schedule Post</h2><p class="muted">Pilih konten, akun yang sudah terhubung, lalu tentukan waktu publikasi.</p></div><span class="tag">${accounts.filter(x=>x.status==='connected').length} account connected</span></div>
        <form id="scheduleForm" style="display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:12px;align-items:end">
          <label class="muted">Content<select id="scontent" class="field" required><option value="">Pilih konten</option>${items.map(x=>`<option value="${esc(x.id)}">${esc(x.title)}</option>`).join('')}</select></label>
          <label class="muted">Platform<select id="splatform" class="field" required>${opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="muted">Tanggal & jam<input id="swhen" class="field" type="datetime-local" required></label>
          <div style="grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" type="submit">＋ Schedule Post</button><span class="muted">Menyimpan jadwal ke queue. Auto-publish menyusul pada Publisher.</span></div>
        </form>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px"><div><div class="ey">QUEUE</div><h2 style="margin:6px 0 0">Publishing Queue</h2><p class="muted">Semua jadwal milik workspace ini.</p></div><span class="tag">${active.length} active</span></div>
        ${active.length?active.sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)).map(scheduleRow).join(''):'<div class="empty">Belum ada jadwal. Buat jadwal pertama di atas.</div>'}
      </div>`;
    const form=$('scheduleForm');form.onsubmit=async e=>{e.preventDefault();const contentId=$('scontent').value,platform=$('splatform').value,when=$('swhen').value;if(!contentId||!platform||!when)return toast('Lengkapi konten, platform, dan waktu.','error');const dt=new Date(when);if(Number.isNaN(dt.getTime())||dt.getTime()<=Date.now())return toast('Pilih waktu di masa depan.','error');try{await api('/api/scheduler',{method:'POST',body:JSON.stringify({content_id:contentId,platform,scheduled_at:dt.toISOString()})});await load();if(window.groviaReload)await window.groviaReload();toast('Jadwal berhasil dibuat.')}catch(err){toast(err.message||'Gagal membuat jadwal.','error')}};
  }
  function scheduleRow(x){const past=new Date(x.scheduled_at).getTime()<Date.now();const canCancel=x.status==='scheduled'&&!past;return `<div class="row" style="align-items:center;gap:14px"><div style="min-width:0;flex:1"><b>${esc(x.grovia_content_items?.title||'Untitled content')}</b><div class="muted">${esc(x.platform)} · ${esc(fmtDate(x.scheduled_at))}${past?' · waktu terlewat':''}</div></div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><span class="tag">${esc(x.status)}</span>${x.status==='scheduled'?`<button class="btn" onclick="window.editSchedule('${esc(x.id)}')">Edit</button>`:''}${canCancel?`<button class="btn" onclick="window.cancelSchedule('${esc(x.id)}')">Cancel</button>`:''}</div></div>`}
  window.editSchedule=async function(id){try{const list=await api('/api/scheduler');const item=list.find(x=>x.id===id);if(!item)return toast('Jadwal tidak ditemukan.','error');const row=[...document.querySelectorAll('#schedulerBox .row')].find(r=>r.innerHTML.includes(id));if(!row)return;row.outerHTML=`<div class="card" style="margin:8px 0"><div class="muted" style="margin-bottom:8px">Edit jadwal · ${esc(item.grovia_content_items?.title||'Content')}</div><div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:end"><label class="muted">Tanggal & jam<input id="editWhen" class="field" type="datetime-local" value="${esc(new Date(item.scheduled_at).toISOString().slice(0,16))}"></label><button class="btn primary" onclick="window.saveScheduleEdit('${esc(item.id)}')">Save</button><button class="btn" onclick="window.loadSchedulerUI()">Back</button></div></div>`}catch(e){toast(e.message,'error')}};
  window.saveScheduleEdit=async function(id){try{const dt=new Date($('editWhen').value);if(Number.isNaN(dt.getTime())||dt.getTime()<=Date.now())return toast('Pilih waktu di masa depan.','error');await api('/api/scheduler/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({scheduled_at:dt.toISOString(),status:'scheduled'})});await load();if(window.groviaReload)await window.groviaReload();toast('Jadwal diperbarui.')}catch(e){toast(e.message,'error')}};
  window.cancelSchedule=async function(id){if(!confirm('Batalkan jadwal ini?'))return;try{await api('/api/scheduler/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({status:'cancelled'})});await load();if(window.groviaReload)await window.groviaReload();toast('Jadwal dibatalkan.')}catch(e){toast(e.message,'error')}};
  window.loadSchedulerUI=load;
  function install(){if($('schedulerBox'))load()}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,250));
})();
