(function(){
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  function ensureUI(){
    const section=document.getElementById('analytics');
    if(!section||document.getElementById('analyticsPanel'))return;
    section.innerHTML=`<div class="head"><div><div class="ey">PERFORMANCE DATA</div><h1>Analytics</h1><p>Data nyata dari akun sosial yang terhubung.</p></div><button class="btn primary" id="syncAnalytics">↻ Sync YouTube</button></div><div id="analyticsPanel"><div class="grid three" id="analyticsKpis"><div class="metric"><small>VIEWS 30 HARI</small><strong>0</strong></div><div class="metric"><small>SUBSCRIBERS GAINED</small><strong>0</strong></div><div class="metric"><small>WATCH TIME</small><strong>0</strong></div></div><div class="card" style="margin-top:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><h3 style="margin:0 0 4px">Views per Day</h3><div class="muted">Riwayat harian yang tersedia dari YouTube Analytics.</div></div><span class="tag" id="analyticsRange">30 hari</span></div><div id="viewsChart" style="margin-top:14px;min-height:280px"></div></div><div class="card" style="margin-top:14px"><h3 style="margin:0 0 4px">Subscribers Gained</h3><div class="muted">Subscriber baru per hari.</div><div id="subsChart" style="margin-top:14px;min-height:240px"></div></div><div id="analyticsNotice" class="empty" style="display:none"></div></div>`;
    document.getElementById('syncAnalytics').onclick=sync;
  }
  function lineChart(rows,key,boxId,label){
    const box=document.getElementById(boxId); if(!box)return;
    if(!rows.length){box.innerHTML='<div class="empty">Belum ada data analytics dari YouTube.</div>';return;}
    const values=rows.map(r=>Number(r[key]||0)), max=Math.max(1,...values), w=900,h=260,p=42,gw=w-p*2,gh=h-p*2;
    const points=values.map((v,i)=>{const x=p+(rows.length===1?gw/2:gw*(i/(rows.length-1)));const y=h-p-gh*(v/max);return [x,y]});
    const poly=points.map(p=>p.join(',')).join(' ');
    const dots=points.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="3" fill="currentColor"><title>${esc(rows[i].metric_date)}: ${fmt(values[i])}</title></circle>`).join('');
    const grid=[0,.25,.5,.75,1].map(t=>{const y=h-p-gh*t;const val=Math.round(max*t);return `<line x1="${p}" y1="${y}" x2="${w-p}" y2="${y}" stroke="currentColor" opacity=".12"/><text x="4" y="${y+4}" font-size="10" fill="currentColor" opacity=".55">${fmt(val)}</text>`}).join('');
    const labelIndexes=[0,Math.floor((rows.length-1)/2),rows.length-1].filter((v,i,a)=>a.indexOf(v)===i);
    const labels=labelIndexes.map(i=>{const r=rows[i];const x=p+(rows.length===1?gw/2:gw*(i/(rows.length-1)));return `<text x="${x}" y="${h-8}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".55">${esc(r.metric_date)}</text>`}).join('');
    box.innerHTML=`<div style="overflow-x:auto"><svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}"><g>${grid}</g><polyline points="${poly}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><g>${dots}</g><g>${labels}</g></svg></div>`;
  }
  async function load(){
    ensureUI();
    try{
      if(typeof session==='undefined'||!session?.access_token)return;
      const r=await fetch('/api/analytics/summary',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});
      const j=await r.json(); if(!r.ok||!j.ok)throw Error(j.error?.message||'Analytics gagal dimuat');
      const rows=Array.isArray(j.data?.rows)?j.data.rows:[];
      const s=j.data?.summary||{};
      const k=document.getElementById('analyticsKpis');
      if(k)k.innerHTML=`<div class="metric"><small>VIEWS 30 HARI</small><strong>${fmt(s.views)}</strong></div><div class="metric"><small>SUBSCRIBERS GAINED</small><strong>${fmt(s.subscribers_gained)}</strong></div><div class="metric"><small>WATCH TIME</small><strong>${Number(s.watch_time_minutes||0).toLocaleString('id-ID',{maximumFractionDigits:1})} min</strong></div>`;
      lineChart(rows,'views','viewsChart','Views per Day');
      lineChart(rows,'subscribers_gained','subsChart','Subscribers Gained');
    }catch(e){const n=document.getElementById('analyticsNotice');if(n){n.style.display='block';n.textContent=e.message}console.warn('Analytics UI:',e)}
  }
  async function sync(){
    const b=document.getElementById('syncAnalytics');if(!b)return;
    const old=b.textContent;b.disabled=true;b.textContent='Syncing…';
    try{
      if(typeof session==='undefined'||!session?.access_token)throw Error('Sesi login tidak valid.');
      const r=await fetch('/api/social/youtube/sync',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.ok)throw Error(j.error?.message||'Sinkronisasi YouTube gagal.');
      await load();
      alert(`Analytics YouTube tersinkron. ${Number(j.data?.rows||0)} hari diperbarui.`);
    }catch(e){alert(e.message||'Sinkronisasi gagal.')}finally{b.disabled=false;b.textContent=old}
  }
  window.loadAnalyticsUI=load;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(load,150));
})();
