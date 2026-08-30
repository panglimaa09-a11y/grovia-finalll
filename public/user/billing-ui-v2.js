(function(){
  const $=id=>document.getElementById(id);
  async function token(){
    try{
      if(window.sb){const s=await window.sb.auth.getSession();return s?.data?.session?.access_token||null;}
      if(window.supabase){const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());if(cfg.ok){const c=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});const s=await c.auth.getSession();return s?.data?.session?.access_token||null;}}
    }catch(e){console.warn('Billing token:',e?.message||e)}
    return null;
  }
  function chooser(){
    const old=document.getElementById('groviaBillingChooser');if(old)old.remove();
    const wrap=document.createElement('div');wrap.id='groviaBillingChooser';wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;display:grid;place-items:center;padding:20px';
    wrap.innerHTML='<div style="width:min(520px,100%);background:#0c1118;border:1px solid #202a35;border-radius:16px;padding:20px;color:#edf3f8"><h3 style="margin:0 0 8px">Pilih Paket</h3><div style="color:#7d8997;font-size:12px;margin-bottom:16px">Pilih paket yang akan digunakan untuk checkout Credits.</div><div style="display:grid;gap:8px"><button class="btn primary" data-plan="pro">PRO</button><button class="btn" data-plan="business">BUSINESS</button><button class="btn" data-plan="free">FREE</button><button class="btn" data-close="1">Batal</button></div></div>';
    document.body.appendChild(wrap);
    wrap.onclick=e=>{if(e.target===wrap||e.target.dataset.close){wrap.remove();return;}const plan=e.target.dataset.plan;if(plan){wrap.remove();checkout(plan)}};
  }
  async function checkout(plan){
    try{
      const t=await token();if(!t){alert('Sesi login tidak valid. Silakan login kembali.');return;}
      const r=await fetch('/api/billing/checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({plan})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||j.ok===false){
        const code=j.error?.code||'';const message=j.error?.message||('HTTP '+r.status);
        if(code==='CHECKOUT_NOT_CONFIGURED'){alert('Checkout '+plan.toUpperCase()+' belum aktif karena payment gateway production belum dikonfigurasi.');return;}
        if(code==='INVALID_PLAN'){alert('Pilihan paket tidak valid. Silakan coba lagi.');return;}
        throw Error(message);
      }
      if(j.data?.checkout_url){window.location.href=j.data.checkout_url;return;}
      if(j.data?.mode==='internal'&&j.data?.plan==='free'){alert('Paket FREE berhasil diaktifkan.');if(typeof window.refreshBilling==='function')await window.refreshBilling();return;}
      alert('Checkout berhasil disiapkan.');
    }catch(e){alert(e.message||'Checkout gagal.');}
  }
  window.buyCredits=chooser;
})();
