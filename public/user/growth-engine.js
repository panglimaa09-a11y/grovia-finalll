(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=n=>Number(n||0).toFixed(1)+'%';
  async function api(path){
    if(typeof session==='undefined'||!session?.access_token)throw Error('Session login tidak valid.');
    const r=await fetch(path,{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`);
    return j.data??j;
  }
  function score(rows,schedules,content){
    if(!rows.length)return {total:null,components:[]};
    const recent=rows.slice(-14), earlier=rows.slice(-28,-14);
    const avg=(a,k)=>a.length?a.reduce((s,x)=>s+Number(x[k]||0),0)/a.length:0;
    const rEng=avg(recent,'engagement_rate');
    const eEng=avg(earlier,'engagement_rate');
    const engScore=Math.min(100,Math.max(0,(rEng/5)*100));
    const rViews=avg(recent,'views'),eViews=avg(earlier,'views');
    const viewsTrend=eViews>0?((rViews-eViews)/eViews)*100:0;
    const trendScore=Math.min(100,Math.max(0,50+viewsTrend*2));
    const active=schedules.filter(x=>x.status==='scheduled'&&new Date(x.scheduled_at)>new Date()).length;
    const cadenceScore=Math.min(100,active>=4?100:active*25);
    const published=content.filter(x=>x.status==='published').length;
    const contentScore=Math.min(100,published>=12?100:published/12*100);
    const total=Math.round(engScore*.35+trendScore*.30+cadenceScore*.20+contentScore*.15);
    return {total,components:[['Engagement',engScore],['View momentum',trendScore],['Publishing cadence',cadenceScore],['Content consistency',contentScore]],rEng,eEng,viewsTrend,active,published};
  }
  function recommendation(d){
    if(!d.total)return [['Connect & sync analytics','Belum ada data analytics yang cukup untuk rekomendasi pertumbuhan.']];
    const out=[];
    if(d.rEng<2)out.push(['Naikkan engagement','Perkuat hook 1–3 detik pertama dan akhiri video dengan CTA yang spesifik.']);
    if(d.viewsTrend<0)out.push(['Pulihkan momentum views',`Views rata-rata 14 hari terakhir turun ${Math.abs(d.viewsTrend).toFixed(1)}% dibanding 14 hari sebelumnya. Uji 2 format berbeda.`]);
    if(d.active<3)out.push(['Tambah konsistensi publikasi',`Saat ini hanya ada ${d.active} jadwal aktif. Targetkan minimal 3–4 slot terjadwal agar ritme konten stabil.`]);
    if(d.published<4)out.push(['Bangun volume konten',`Baru ${d.published} konten berstatus published. Gunakan AI Content Studio untuk membangun backlog konten.`]);
    if(!out.length)out.push(['Pertahankan momentum','Metrik utama relatif sehat. Fokuskan eksperimen pada format yang menghasilkan views dan engagement tertinggi.']);
    return out;
  }
  function render(rows,schedules,content,accounts){
    const section=$('growth');if(!section)return;
    const d=score(rows,schedules,content);
    const latest=rows.at(-1)||{};
    const followersDelta=rows.length>1?Number(latest.followers||0)-Number(rows.at(-2).followers||0):0;
    const avgViews=rows.length?rows.slice(-30).reduce((s,x)=>s+Number(x.views||0),0)/Math.min(30,rows.length):0;
    const recs=recommendation(d);
    section.innerHTML=`<div class="head"><div><div class="ey">GROWTH INTELLIGENCE</div><h1>Growth Engine</h1><p>Mesin analisis pertumbuhan berdasarkan analytics, konten, jadwal, dan akun nyata.</p></div><button class="btn primary" id="refreshGrowth">↻ Refresh Analysis</button></div>
      <div class="grid kpis"><div class="card"><div class="label">GROWTH SCORE</div><div class="num">${d.total===null?'—':d.total}</div><div class="muted">Composite performance score</div></div><div class="card"><div class="label">FOLLOWER DELTA</div><div class="num">${followersDelta>=0?'+':''}${fmt(followersDelta)}</div><div class="muted">Perubahan vs hari sebelumnya</div></div><div class="card"><div class="label">AVG DAILY VIEWS</div><div class="num">${fmt(Math.round(avgViews))}</div><div class="muted">30 hari terakhir yang tersedia</div></div><div class="card"><div class="label">CONNECTED ACCOUNTS</div><div class="num">${fmt(accounts.length)}</div><div class="muted">Akun sosial terhubung</div></div></div>
      <div class="grid two" style="margin-top:14px"><div class="card"><h3>Score Breakdown</h3>${d.components?.length?d.components.map(([n,v])=>`<div style="margin:14px 0"><div class="row" style="border-top:0;padding:0 0 6px"><span>${esc(n)}</span><b>${Math.round(v)}</b></div><div style="height:8px;background:#141b23;border-radius:99px;overflow:hidden"><div style="height:100%;width:${Math.max(0,Math.min(100,v))}%;background:linear-gradient(90deg,#bdf85e,#6fe8b2);border-radius:99px"></div></div></div>`).join(''):'<div class="empty">Belum cukup analytics untuk menghitung score.</div>'}</div>
      <div class="card"><h3>Growth Signals</h3>${recs.map(([title,text])=>`<div class="row" style="display:block"><b>${esc(title)}</b><div class="muted" style="margin-top:5px;line-height:1.6">${esc(text)}</div></div>`).join('')}</div></div>
      <div class="card" style="margin-top:14px"><h3>What to do next</h3><div class="grid three"><button class="btn" onclick="go('studio')">✦ Create Content</button><button class="btn" onclick="go('scheduler')">▦ Schedule Posts</button><button class="btn" onclick="go('analytics')">◒ Review Analytics</button></div></div>`;
    $('refreshGrowth').onclick=load;
  }
  async function load(){
    try{
      const [a,sc,c,sa]=await Promise.all([api('/api/analytics/summary'),api('/api/scheduler'),api('/api/content'),api('/api/social/accounts')]);
      render(a?.rows||[],sc||[],c||[],sa||[]);
    }catch(e){
      const section=$('growth');if(section)section.innerHTML=`<div class="head"><div><div class="ey">GROWTH INTELLIGENCE</div><h1>Growth Engine</h1><p>Analisis pertumbuhan workspace.</p></div></div><div class="card empty">${esc(e.message||'Growth Engine gagal dimuat.')}</div>`;
      console.warn('Growth Engine:',e);
    }
  }
  window.loadGrowthEngine=load;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(load,250));
})();
