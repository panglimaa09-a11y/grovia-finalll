(function(){
  const $=id=>document.getElementById(id);
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  async function token(){
    try{
      if(window.sb){const s=await window.sb.auth.getSession();return s?.data?.session?.access_token||null;}
      if(window.supabase){
        const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
        if(cfg.ok){const c=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});const s=await c.auth.getSession();return s?.data?.session?.access_token||null;}
      }
    }catch(e){console.warn('Billing token:',e?.message||e)}
    return null;
  }
  async function api(path,t){const r=await fetch(path,{headers:{Authorization:'Bearer '+t},cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||j.ok===false)throw Error(j.error?.message||('HTTP '+r.status));return j.data;}
  function plans(){return [
    {name:'FREE',price:'Rp0',credits:'Trial / sesuai kebijakan workspace',features:['AI dasar','Content Library','Auto Scheduler']},
    {name:'PRO',price:'Segera hadir',credits:'Credit pool sesuai paket',features:['AI Content Studio','Growth Engine','Reports','Publisher']},
    {name:'BUSINESS',price:'Segera hadir',credits:'Credit pool sesuai paket',features:['Semua fitur PRO','Workspace lebih besar','Prioritas publisher']}
  ];}
  function render(data){
    const sub=data?.sub||null, usage=data?.usage||{};
    const plan=sub?.plan||'Belum berlangganan';
    const status=sub?.status||'Belum aktif';
    const balance=sub?.credits_balance ?? sub?.credit_balance ?? sub?.credits_remaining ?? null;
    const used=Number(usage?.aiCreditsUsed||0);
    const balanceText=balance===null?'—':fmt(balance);
    const renewal=sub?.period_end?new Date(sub.period_end).toLocaleDateString('id-ID'):'—';
    const planCards=plans().map(p=>`<div class="card" style="height:100%;display:flex;flex-direction:column"><div class="label">PLAN</div><h3 style="margin:8px 0 4px">${p.name}</h3><div class="num" style="font-size:24px">${p.price}</div><div class="muted" style="margin-bottom:10px">${esc(p.credits)}</div><div style="display:grid;gap:6px;margin-top:auto">${p.features.map(f=>`<div class="row"><span>${esc(f)}</span><span>✓</span></div>`).join('')}</div></div>`).join('');
    const history=`<div class="row"><span>AI usage tercatat</span><b>${fmt(used)} credits</b></div><div class="row"><span>Status usage</span><span>${usage?.usage_unavailable?'Unavailable':'Aktif'}</span></div>`;
    const html=`<div class="head"><div><div class="ey">BILLING & CREDITS</div><h1>Billing & Credits</h1><p>Pusat paket, pemakaian kredit, dan status langganan workspace.</p></div><button class="btn primary" onclick="buyCredits()">＋ Buy Credits</button></div>
      <div class="grid three">
        <div class="card"><div class="label">CURRENT PLAN</div><div class="num" style="font-size:24px">${esc(plan)}</div><div class="muted">${esc(status)}</div></div>
        <div class="card"><div class="label">CREDIT BALANCE</div><div class="num" style="font-size:24px">${balanceText}</div><div class="muted">Balance dari subscription, bila tersedia.</div></div>
        <div class="card"><div class="label">AI CREDITS USED</div><div class="num" style="font-size:24px">${fmt(used)}</div><div class="muted">Renewal: ${renewal}</div></div>
      </div>
      <div class="grid two" style="margin-top:14px">
        <div class="card"><h3>Usage Summary</h3>${history}</div>
        <div class="card"><h3>Payment Status</h3><div class="row"><span>Subscription</span><b>${esc(status)}</b></div><div class="row"><span>Plan</span><b>${esc(plan)}</b></div><div class="row"><span>Period end</span><b>${renewal}</b></div><button class="btn" style="margin-top:12px" onclick="refreshBilling()">↻ Refresh Billing</button></div>
      </div>
      <div style="margin-top:14px"><h3>Plans</h3><div class="grid three">${planCards}</div></div>
      <div class="card" style="margin-top:14px"><h3>Credit History</h3><div class="muted">Riwayat detail belum tersedia dari endpoint billing saat ini. Saat payment/ledger backend diaktifkan, transaksi akan muncul di sini.</div></div>`;
    const el=$('billing');if(el)el.innerHTML=html;
  }
  async function loadBilling(){
    try{
      const t=await token();if(!t)return;
      const [sub,usage]=await Promise.all([api('/api/billing/subscription',t),api('/api/billing/usage',t)]);
      window.__groviaBilling={sub,usage};
      render({sub,usage});
    }catch(e){console.warn('Billing UI:',e?.message||e);const el=$('billing');if(el)el.innerHTML='<h1>Billing & Credits</h1><div class="card empty">Gagal memuat billing.</div>';}
  }
  window.loadBillingUI=loadBilling;
  window.refreshBilling=loadBilling;
  window.buyCredits=async()=>{
    try{
      const t=await token();if(!t){alert('Sesi login tidak valid.');return;}
      const r=await fetch('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({product:'credits'})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j.ok===false){
        const message=j.error?.message||(`HTTP ${r.status}`);
        if(j.error?.code==='CHECKOUT_NOT_CONFIGURED'){
          alert('Pembelian Credits belum aktif karena payment gateway production belum dikonfigurasi.');
          return;
        }
        throw Error(message);
      }
      if(j.data?.checkout_url){window.location.href=j.data.checkout_url;return;}
      alert('Checkout siap digunakan.');
    }catch(e){alert(e.message||'Payment adapter belum tersedia.');}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(loadBilling,150),{once:true});else setTimeout(loadBilling,150);
})();
