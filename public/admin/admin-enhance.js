(function(){
  let sb,session;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  async function init(){
    const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
    sb=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const s=await sb.auth.getSession();session=s.data.session;if(!session)return;
    window.groviaAdminReload=loadAll; await loadAll();
  }
  async function api(path,opt={}){
    const r=await fetch(path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token,...(opt.headers||{})},cache:'no-store'});
    const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`);return j.data;
  }
  async function loadAll(){
    try{
      const [dash,users,audit,roles,health]=await Promise.all([api('/api/admin/dashboard'),api('/api/admin/users'),api('/api/admin/audit-logs'),api('/api/admin/roles'),fetch('/api/health',{cache:'no-store'}).then(r=>r.json())]);
      renderUsers(users||[]);renderSubs(dash?.subscriptions||[]);renderPublishing(dash?.publishing||[]);renderAudit(audit||[]);renderRoles(roles);renderDerived(dash,users||[],health?.data||health||{});
      const el=$('role');if(el)el.textContent=(dash?.role||'ADMIN').toUpperCase();
    }catch(e){console.error('Admin enhancer:',e)}
  }
  function box(id,html){const e=$(id);if(e)e.innerHTML=html}
  function renderUsers(rows){
    box('users',`<div style="display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap"><div><h2>Users & Workspaces</h2><div class="muted">Workspace, plan, social accounts, konten, dan status dari database user.</div></div><button class="btn" onclick="groviaAdminReload()">↻ Refresh</button></div><div class="table" id="usersTable2" style="margin-top:12px">${rows.length?rows.map(x=>{const social=(x.social_accounts||[]).map(s=>`${esc(s.platform)} (${fmt(s.followers)})`).join(', ')||'—';const plan=x.subscription?.plan||'free';return `<div class="row" style="grid-template-columns:1.1fr .7fr .8fr 1.5fr .6fr 1fr"><span><b>${esc(x.user_id)}</b></span><span>${esc(x.role)}</span><span><span class="tag">${x.active?'active':'inactive'}</span></span><span>${esc(plan)} · ${esc(x.subscription?.status||'—')}<br><span class="muted">${social}</span></span><span>${fmt(x.content_count)}</span><span>${x.role!=='super_admin'?`<button class="btn" onclick="toggleAdminUser('${esc(x.user_id)}',${!x.active})">${x.active?'Deactivate':'Activate'}</button>`:''}</span></div>`}).join(''):'<div class="empty">Belum ada user/workspace.</div>'}</div>`);
  }
  function renderSubs(rows){box('subs',`<h2>Subscriptions</h2><div class="table">${rows.length?rows.map(x=>`<div class="row"><span>${esc(x.plan)}</span><span>${esc(x.status)}</span><span>Rp ${fmt(x.monthly_price)}</span><span>Source: grovia_subscriptions</span></div>`).join(''):'<div class="empty">Belum ada subscription.</div>'}</div>`)}
  function renderPublishing(rows){box('publishing',`<h2>Publishing Queue</h2><div class="table">${rows.length?rows.map(x=>`<div class="row"><span>${esc(x.id)}</span><span>${esc(x.platform)}</span><span>${esc(x.status)}</span><span>${x.scheduled_at?new Date(x.scheduled_at).toLocaleString('id-ID'):'—'}</span></div>`).join(''):'<div class="empty">Belum ada publishing job.</div>'}</div>`)}
  function renderAudit(rows){box('audit',`<h2>Audit Logs</h2><div class="table">${rows.length?rows.slice(0,100).map(x=>`<div class="row"><span>${esc(x.action)}</span><span>${esc(x.result)}</span><span>${esc(x.actor_user_id||'—')}</span><span>${x.created_at?new Date(x.created_at).toLocaleString('id-ID'):'—'}</span></div>`).join(''):'<div class="empty">Belum ada audit log.</div>'}</div>`)}
  function renderRoles(payload){
    const rows=payload?.roles||[];const permissions=payload?.permissions||{};
    box('roles',`<h2>Roles & Permissions</h2><div class="grid" style="gap:10px;margin-bottom:16px">${Object.entries(permissions).map(([role,ps])=>`<div class="panel"><b>${esc(role)}</b><div class="muted" style="margin-top:8px;line-height:1.7">${ps.map(esc).join(' · ')}</div></div>`).join('')}</div><div class="table">${rows.length?rows.map(x=>`<div class="row" style="grid-template-columns:1.4fr .8fr .8fr 1fr"><span>${esc(x.user_id)}</span><span>${esc(x.role)}</span><span>${x.active?'active':'inactive'}</span><span>${x.role!=='super_admin'?`<select class="field" style="margin:0;width:auto" onchange="changeAdminRole('${esc(x.user_id)}',this.value)"><option value="operator" ${x.role==='operator'?'selected':''}>operator</option><option value="admin" ${x.role==='admin'?'selected':''}>admin</option><option value="super_admin">super_admin</option></select>`:'Protected Super Admin'}</span></div>`).join(''):'<div class="empty">Belum ada role.</div>'}</div>`);
  }
  function renderDerived(dash,users,health){
    box('payments',`<h2>Payments</h2><div class="card"><div class="row"><span>Payment adapter</span><b>Not configured</b></div><div class="muted">Tidak ada transaksi palsu yang ditampilkan.</div></div>`);
    box('pricing',`<h2>Plans & Pricing</h2><div class="grid three"><div class="panel"><b>FREE</b><div class="muted">Internal activation</div></div><div class="panel"><b>PRO</b><div class="muted">Checkout gateway</div></div><div class="panel"><b>BUSINESS</b><div class="muted">Checkout gateway</div></div></div>`);
    box('social',`<h2>Social Integrations</h2><div class="table"><div class="row"><span>YouTube</span><b>OAuth + sync active</b></div><div class="row"><span>Facebook</span><b>Provider connector</b></div><div class="row"><span>Instagram</span><b>Provider connector</b></div><div class="row"><span>TikTok</span><b>Provider connector</b></div><div class="row"><span>Threads</span><b>Provider connector</b></div></div>`);
    box('ai',`<h2>AI Usage & Credits</h2><div class="card"><div class="row"><span>AI usage records</span><b>Available</b></div><div class="muted">Gunakan endpoint usage per user untuk detail billing.</div></div>`);
    box('analytics',`<h2>Content & Analytics</h2><div class="grid kpis"><div class="panel"><div class="label">ADMIN ROLE RECORDS</div><div class="num">${fmt(users.length)}</div></div><div class="panel"><div class="label">SUBSCRIPTIONS</div><div class="num">${fmt((dash?.subscriptions||[]).length)}</div></div><div class="panel"><div class="label">PUBLISHING JOBS</div><div class="num">${fmt((dash?.publishing||[]).length)}</div></div></div>`);
    box('system',`<h2>System Health</h2><div class="card"><div class="row"><span>API</span><b>${esc(health?.status||'unknown')}</b></div><div class="row"><span>Service</span><b>${esc(health?.service||'grovia')}</b></div><div class="row"><span>Checked</span><b>${new Date(health?.time||Date.now()).toLocaleString('id-ID')}</b></div><button class="btn" onclick="groviaAdminReload()">Refresh Health</button></div>`);
    box('errors',`<h2>Error Monitoring</h2><div class="card"><div class="row"><span>Failed publishing jobs</span><b>${fmt((dash?.publishing||[]).filter(x=>x.status==='failed').length)}</b></div><div class="muted">Internal audit + publishing status sebagai monitor dasar.</div></div>`);
    box('support',`<h2>Support Center</h2><div class="card"><b>Support backend belum terhubung</b><div class="muted">Tidak membuat ticket palsu.</div></div>`);
    box('notifications',`<h2>Notifications</h2><div class="card"><b>Notification service belum terhubung</b><div class="muted">Admin panel tidak mengklaim pengiriman yang belum dikonfigurasi.</div></div>`);
    box('settings',`<h2>Admin Settings</h2><div class="card"><div class="row"><span>Current role</span><b>${esc(dash?.role||'ADMIN')}</b></div><div class="row"><span>API status</span><b>${esc(health?.status||'unknown')}</b></div></div>`);
  }
  window.toggleAdminUser=async function(id,active){try{await api('/api/admin/users/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({active})});await loadAll()}catch(e){alert(e.message)}};
  window.changeAdminRole=async function(id,role){try{await api('/api/admin/users/'+encodeURIComponent(id)+'/role',{method:'PATCH',body:JSON.stringify({role})});await loadAll()}catch(e){alert(e.message);await loadAll()}};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
})();
