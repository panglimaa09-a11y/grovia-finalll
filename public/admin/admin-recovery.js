(function(){
  let session=null;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  async function init(){
    try{
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const s=await client.auth.getSession();session=s.data.session;if(!session)return;
      window.groviaAdminUserReload=loadUsers; await loadUsers();
    }catch(e){console.error('Admin recovery init:',e)}
  }
  async function api(path,opt={}){
    const r=await fetch(path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,...(opt.headers||{})},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`);
    return j.data;
  }
  async function loadUsers(){
    try{
      const users=await api('/api/admin/users');
      renderUsers(users||[]);
      const dash=await api('/api/admin/dashboard').catch(()=>null);
      if(dash)renderDashboardTotals(dash,users||[]);
    }catch(e){console.error('Admin recovery users:',e);const box=$('users');if(box)box.innerHTML='<h2>Users & Workspaces</h2><div class="empty">Gagal memuat user: '+esc(e.message)+'</div>'}
  }
  function renderDashboardTotals(dash,users){
    const all=document.querySelectorAll('#dashboard .num');
    if(all.length>=4){all[0].textContent=fmt(dash.totalUsers||users.length);all[1].textContent=fmt((dash.subscriptions||[]).length)}
  }
  function renderUsers(rows){
    const e=$('users');if(!e)return;
    e.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap"><div><h2>Users & Workspaces</h2><div class="muted">Seluruh user aplikasi dari Auth + profile + subscription + social + content.</div></div><button class="btn" id="adminRecoveryRefresh">↻ Refresh</button></div><div class="table" style="margin-top:12px">${rows.length?rows.map(x=>{const social=(x.social_accounts||[]).map(s=>`${esc(s.platform)} · ${esc(s.provider_display_name||s.provider_username||s.handle||'—')} · ${fmt(s.followers)}`).join('<br>')||'—';return `<div class="row" style="grid-template-columns:1.5fr .7fr .7fr .9fr 1.5fr .6fr 1fr"><span><b>${esc(x.display_name||'—')}</b><br><span class="muted">${esc(x.email||'—')}</span><br><span class="muted">${esc(x.user_id)}</span></span><span>${esc(x.role)}</span><span>${x.active?'active':'inactive'}</span><span>${esc(x.subscription?.plan||'free')}<br><span class="muted">${esc(x.subscription?.status||'—')}</span></span><span>${social}</span><span>${fmt(x.content_count)}</span><span><button class="btn" onclick="adminRecoveryViewUser('${esc(x.user_id)}','${esc(x.email||'')}')">View / Notes</button>${x.role!=='super_admin'?` <button class="btn" onclick="adminRecoveryToggle('${esc(x.user_id)}',${!x.active})">${x.active?'Deactivate':'Activate'}</button>`:''}</span></div>`}).join(''):'<div class="empty">Tidak ada user.</div>'}</div><div id="adminRecoveryDrawer"></div>`;
    const b=$('adminRecoveryRefresh');if(b)b.onclick=loadUsers;
  }
  window.adminRecoveryViewUser=async function(id,email){
    const d=$('adminRecoveryDrawer');if(!d)return;
    let notes=[];try{notes=await api('/api/admin/users/'+encodeURIComponent(id)+'/notes')}catch(e){notes=[]}
    d.innerHTML=`<div class="panel" style="margin-top:14px"><div style="display:flex;justify-content:space-between"><div><h3 style="margin:0">Catatan User</h3><div class="muted">${esc(email)} · ${esc(id)}</div></div><button class="btn" onclick="document.getElementById('adminRecoveryDrawer').innerHTML=''">Close</button></div><textarea id="adminRecoveryNote" rows="3" style="width:100%;margin-top:12px;padding:10px;background:#0b1117;color:#fff;border:1px solid var(--l);border-radius:10px" placeholder="Tulis catatan admin..."></textarea><button class="btn primary" style="margin-top:8px" onclick="adminRecoverySaveNote('${esc(id)}','${esc(email)}')">Simpan Catatan</button><div style="margin-top:14px"><h4>Riwayat</h4>${notes.length?notes.map(n=>`<div style="padding:9px 0;border-top:1px solid var(--l)"><b>${n.created_at?new Date(n.created_at).toLocaleString('id-ID'):'—'}</b><div>${esc(n.metadata?.note||'')}</div><div class="muted">Admin: ${esc(n.actor_user_id||'—')}</div></div>`).join(''):'<div class="muted">Belum ada catatan.</div>'}</div></div>`;
  };
  window.adminRecoverySaveNote=async function(id,email){const el=$('adminRecoveryNote');if(!el||!el.value.trim())return alert('Catatan masih kosong.');try{await api('/api/admin/users/'+encodeURIComponent(id)+'/notes',{method:'POST',body:JSON.stringify({note:el.value.trim(),email})});await adminRecoveryViewUser(id,email)}catch(e){alert(e.message)}};
  window.adminRecoveryToggle=async function(id,active){try{await api('/api/admin/users/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({active})});await loadUsers()}catch(e){alert(e.message)}};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80));
})();
