(function(){
  const $=id=>document.getElementById(id);
  const navLabels={
    dashboard:['Dashboard','Ringkasan sistem & aktivitas utama'],
    users:['Users & Workspaces','Pantau user, akun sosial, plan, dan catatan'],
    subs:['Subscriptions','Status paket dan langganan user'],
    payments:['Payments','Transaksi pembayaran dan status checkout'],
    pricing:['Plans & Pricing','Atur paket, harga, dan benefit'],
    publishing:['Publishing Queue','Pantau antrean dan hasil publish'],
    social:['Social Integrations','Status koneksi Facebook, Instagram, TikTok, Threads, YouTube'],
    ai:['AI Usage & Credits','Pantau pemakaian AI dan credit'],
    analytics:['Content & Analytics','Performa konten dan statistik platform'],
    system:['System Health','Status layanan dan integrasi'],
    errors:['Error Monitoring','Pantau error dan kegagalan sistem'],
    audit:['Audit Logs','Riwayat aktivitas Admin'],
    support:['Support Center','Kelola bantuan dan kasus user'],
    notifications:['Notifications','Notifikasi dan pengumuman'],
    settings:['Admin Settings','Konfigurasi Admin'],
    roles:['Roles & Permissions','Hak akses setiap role']
  };
  function apply(){
    document.querySelectorAll('#nav button').forEach(b=>{
      const p=b.dataset.p;if(!p||!navLabels[p])return;
      const [title,desc]=navLabels[p];b.setAttribute('aria-label',title+' — '+desc);
      if(!b.querySelector('.nav-copy')){const raw=b.textContent.trim();b.innerHTML='<span class="nav-copy"><strong>'+raw+'</strong><small>'+desc+'</small></span>';}
    });
    const style=document.createElement('style');style.textContent=`
      .nav button{min-height:48px;padding:9px 11px!important;line-height:1.15}
      .nav-copy{display:flex;flex-direction:column;gap:3px}
      .nav-copy strong{font-size:12px;color:inherit;font-weight:750}
      .nav-copy small{font-size:9px;color:#697683;font-weight:500}
      .nav button.active .nav-copy small{color:#aab5c1}
      #dashboard h1,#users h2,#subs h2,#payments h2,#pricing h2,#publishing h2,#social h2,#ai h2,#analytics h2,#system h2,#errors h2,#audit h2,#support h2,#notifications h2,#settings h2,#roles h2{letter-spacing:-.02em}
      #dashboard .adm-card{box-shadow:0 10px 30px rgba(0,0,0,.14)}
    `;document.head.appendChild(style);
    const top=$('role');if(top&&top.parentElement){top.parentElement.title='Role aktif';}
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,80));
})();
