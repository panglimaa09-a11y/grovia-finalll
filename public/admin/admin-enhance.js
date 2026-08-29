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
    const j=await r.json().catch(()=>({})); if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`); return j.data;
  }
  async function loadAll(){
    try{
      const [dash,users,audit,health]=await Promise.all([api('/api/admin/dashboard'),api('/api/admin/users'),api('/api/admin/audit-logs'),fetch('/api/health').then(r=>r.json())]);
      renderUsers(users||[]); renderSubs(dash?.subscriptions||[]); renderPublishing(dash?.publishing||[]); renderAudit(audit||[]); renderDerived(dash,users||[],health?.data||health||{});
    }catch(e){console.error('Admin enhancer:',e)}
  }
  function box(id,html){const e=$(id);if(e)e.innerHTML=html}
  function renderUsers(rows){
    box('users',`<h2>Users & Workspaces</h2><div class="muted">Role records yang aktif di database.</div><div class="table" id="usersTable2">${rows.length?rows.map(x=>`<div class="row"><span>${esc(x.user_id)}</span><span>${esc(x.role)}</span><span>${x.active?'active':'inactive'}</span><span>${new Date(x.created_at).toLocaleString('id-ID')} <button class="btn" onclick="toggleAdminUser('${esc(x.user_id)}',${!x.active})">${x.active?'Deactivate':'Activate'}</button></span></div>`).join(''):'<div class="empty">Belum ada role admin.</div>'}</div>`);
  }
  function renderSubs(rows){box('subs',`<h2>Subscriptions</h2><div class="table">${rows.length?rows.map(x=>`<div class="row"><span>${esc(x.plan)}</span><span>${esc(x.status)}</span><span>Rp ${fmt(x.monthly_price)}</span><span>Billing data nyata</span></div>`).join(''):'<div class="empty">Belum ada subscription.</div>'}</div>`)}
  function renderPublishing(rows){box('publishing',`<h2>Publishing Queue</h2><div class="table">${rows.length?rows.map(x=>`<div class="row"><span>${esc(x.id)}</span><span>${esc(x.platform)}</span><span>${esc(x.status)}</span><span>${new Date(x.scheduled_at).toLocaleString('id-ID')}</span></div>`).join(''):'<div class="empty">Belum ada publishing job.</div>'}</div>`)}
  function renderAudit(rows){box('audit',`<h2>Audit Logs</h2><div class="table">${rows.length?rows.slice(0,100).map(x=>`<div class="row"><span>${esc(x.action)}</span><span>${esc(x.result)}</span><span>${esc(x.actor_user_id||'—')}</span><span>${new Date(x.created_at).toLocaleString('id-ID')}</span></div>`).join(''):'<div class="empty">Belum ada audit log.</div>'}</div>`)}
  function renderDerived(dash,users,health){
    box('payments',`<h2>Payments</h2><div class="card"><div class="row"><span>Payment adapter</span><b>Belum dikonfigurasi</b></div><div class="muted">Tidak ada transaksi palsu. Payment gateway harus dihubungkan sebelum checkout production.</div></div>`);
    box('pricing',`<h2>Plans & Pricing</h2><div class="card"><div class="row"><span>Subscription records</span><b>${fmt((dash?.subscriptions||[]).length)}</b></div><div class="muted">Harga ditampilkan dari data subscription nyata. Editor pricing belum memiliki tabel pricing khusus.</div></div>`);
    box('social',`<h2>Social Integrations</h2><div class="card"><div class="row"><span>YouTube OAuth</span><b>Configured / production flow</b></div><div class="row"><span>Other providers</span><b>Belum dikonfigurasi</b></div></div>`);
    box('ai',`<h2>AI Usage & Credits</h2><div class="card"><div class="row"><span>AI API</span><b>${location.origin?'Server route aktif':'—'}</b></div><div class="muted">Usage user dibaca dari database. Provider AI eksternal aktif setelah AI_API_KEY dikonfigurasi.</div></div>`);
    box('analytics',`<h2>Content & Analytics</h2><div class="grid kpis"><div class="panel"><div class="label">ADMIN ROLE RECORDS</div><div class="num">${fmt(users.length)}</div></div><div class="panel"><div class="label">SUBSCRIPTIONS</div><div class="num">${fmt((dash?.subscriptions||[]).length)}</div></div><div class="panel"><div class="label">PUBLISHING JOBS</div><div class="num">${fmt((dash?.publishing||[]).length)}</div></div></div>`);
    box('system',`<h2>System Health</h2><div class="card"><div class="row"><span>API</span><b>${esc(health?.status||'unknown')}</b></div><div class="row"><span>Service</span><b>${esc(health?.service||'grovia')}</b></div><div class="row"><span>Checked</span><b>${new Date(health?.time||Date.now()).toLocaleString('id-ID')}</b></div><button class="btn" onclick="groviaAdminReload()">Refresh Health</button></div>`);
    box('errors',`<h2>Error Monitoring</h2><div class="card"><div class="row"><span>Recent audit failures</span><b>${fmt((dash?.publishing||[]).filter(x=>x.status==='failed').length)}</b></div><div class="muted">Error monitoring provider eksternal belum dikonfigurasi. Audit logs tetap menjadi source internal.</div></div>`);
    box('support',`<h2>Support Center</h2><div class="card"><div class="row"><span>Ticket system</span><b>Belum dikonfigurasi</b></div><div class="muted">Tidak ada ticket palsu. Endpoint support siap ditambahkan saat storage/ticket provider dipilih.</div></div>`);
    box('notifications',`<h2>Notifications</h2><div class="card"><div class="row"><span>Notification service</span><b>Belum dikonfigurasi</b></div><div class="muted">Admin dapat melihat status sistem, tetapi tidak ada pengiriman notifikasi palsu.</div></div>`);
    box('settings',`<h2>Admin Settings</h2><div class="card"><div class="row"><span>Current role</span><b>${esc(dash?.role||'ADMIN')}</b></div><div class="row"><span>API status</span><b>${esc(health?.status||'unknown')}</b></div><button class="btn" onclick="location.href='/admin/'">Reload Panel</button></div>`);
    box('roles',`<h2>Roles & Permissions</h2><div class="table">${users.map(x=>`<div class="row"><span>${esc(x.user_id)}</span><span>${esc(x.role)}</span><span>${x.active?'active':'inactive'}</span><span>source: grovia_admin_roles</span></div>`).join('')||'<div class="empty">Belum ada role.</div>'}</div>`);
  }
  window.toggleAdminUser=async function(id,active){try{await api('/api/admin/users/'+encodeURIComponent(id)+'/status',{method:'PATCH',body:JSON.stringify({active})});await loadAll()}catch(e){alert(e.message)}};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
})();
