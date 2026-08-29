(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>Number(n||0).toLocaleString('id-ID');
  const pct=n=>Number(n||0).toFixed(1)+'%';
  const key='grovia-growth-plan-progress-v1';
  let sessionRef=null;
  async function api(path){
    if(!sessionRef?.access_token)throw Error('Session login tidak valid.');
    const r=await fetch(path,{headers:{Authorization:'Bearer '+sessionRef.access_token},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`);
    return j.data??j;
  }
  function readProgress(){try{return JSON.parse(localStorage.getItem(key)||'{}')}catch{return {}}}
  function writeProgress(p){localStorage.setItem(key,JSON.stringify(p))}
  function buildTasks(stats){
    const er=stats.engagement, active=stats.activeSchedules, published=stats.published, views=stats.avgViews;
    const cadence=active>=4?4:3;
    const tasks=[
      `Tentukan 2 format konten utama berdasarkan performa saat ini`,
      `Tulis ${cadence} ide konten dengan hook kuat 1–3 detik`,
      `Produksi dan simpan ${cadence} konten ke Content Library`,
      `Jadwalkan ${cadence} publikasi untuk minggu pertama`,
      `Review views, reach, dan engagement setelah 7 hari`,
      `Ulangi format dengan performa terbaik dan ubah angle/hook`,
      `Buat ${cadence} konten baru dengan variasi hook`,
      `Jadwalkan batch konten minggu kedua`,
      `Periksa konten yang memiliki engagement di atas rata-rata`,
      `Perbaiki CTA pada konten dengan retention/engagement rendah`,
      `Uji satu format baru tanpa mengubah niche utama`,
      `Review hasil eksperimen format baru`,
      `Buat ${cadence} konten dari topik yang paling konsisten performanya`,
      `Jadwalkan batch minggu ketiga`,
      `Bandingkan rata-rata views minggu 1 vs minggu 3`,
      `Pilih 3 hook terbaik berdasarkan hasil nyata`,
      `Produksi batch konten terakhir untuk bulan ini`,
      `Jadwalkan publikasi minggu keempat`,
      `Audit konten: simpan pola yang berhasil dan buang pola lemah`,
      `Review subscriber/follower delta dan engagement terbaru`,
      `Buat 3 variasi konten dari top performer`,
      `Uji CTA dan opening baru pada topik yang sama`,
      `Periksa konsistensi jadwal publikasi`,
      `Pastikan seluruh draft prioritas sudah memiliki platform`,
      `Review analytics harian dan catat 3 insight utama`,
      `Pilih strategi konten untuk 30 hari berikutnya`,
      `Buat backlog minimal 8 ide untuk siklus berikutnya`,
      `Rapikan Content Library dan tandai konten terbaik`,
      `Hitung perubahan views dan engagement dari awal periode`,
      `Tulis ringkasan hasil 30 hari dan target periode berikutnya`
    ];
    const notes=[
      `Baseline engagement saat ini ${pct(er)}.`,
      `Rata-rata views harian ${fmt(Math.round(views))}.`,
      `${fmt(active)} jadwal aktif dan ${fmt(published)} konten berstatus published saat ini.`,
      er<2?'Prioritas utama: hook, CTA, dan format yang meningkatkan engagement.':'Prioritas utama: scale format yang sudah menunjukkan performa sehat.'
    ];
    return {tasks,notes,cadence};
  }
  function render(stats){
    const section=$('planpg');if(!section)return;
    const plan=buildTasks(stats), progress=readProgress();
    const done=plan.tasks.reduce((n,_,i)=>n+(progress[i]?1:0),0), completion=Math.round(done/plan.tasks.length*100);
    const targetFollowers=Math.max(1,Math.round(stats.followers*1.15));
    const targetViews=Math.max(1,Math.round(stats.avgViews*1.25));
    const weeks=[
      {name:'Week 1',focus:'Foundation',start:0,end:6,desc:'Bangun ritme, rapikan ide, dan siapkan batch pertama.'},
      {name:'Week 2',focus:'Consistency',start:7,end:13,desc:'Pertahankan cadence dan mulai ulangi pola yang bekerja.'},
      {name:'Week 3',focus:'Experiment',start:14,end:20,desc:'Uji format, hook, CTA, lalu bandingkan hasil nyata.'},
      {name:'Week 4',focus:'Scale',start:21,end:29,desc:'Perbesar format terbaik dan siapkan siklus pertumbuhan berikutnya.'}
    ];
    const taskRows=weeks.map((w,wi)=>{const local=Array.from({length:w.end-w.start+1},(_,k)=>w.start+k);return `<div class="gp-week"><div class="gp-week-head"><div><span class="gp-week-no">${w.name}</span><h3>${esc(w.focus)}</h3><p>${esc(w.desc)}</p></div><span class="gp-badge">${local.filter(i=>progress[i]).length}/${local.length} selesai</span></div><div class="gp-task-list">${local.map(i=>`<label class="gp-task ${progress[i]?'done':''}"><input type="checkbox" data-day="${i}" ${progress[i]?'checked':''}><span><b>Day ${i+1}</b>${esc(plan.tasks[i])}</span></label>`).join('')}</div></div>`}).join('');
    const css=`<style>
      #planpg .gp-wrap{display:grid;gap:16px}
      #planpg .gp-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-end}
      #planpg .gp-title{font-size:28px;margin:7px 0}.gp-sub{margin:0;color:var(--m);font-size:12px;line-height:1.55}
      #planpg .gp-actions{display:flex;gap:8px;flex-wrap:wrap}
      #planpg .gp-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
      #planpg .gp-card{background:var(--p);border:1px solid var(--l);border-radius:16px;padding:17px;min-width:0}
      #planpg .gp-label{font-size:9px;color:#6f7b88;letter-spacing:.12em}.gp-num{font-size:24px;font-weight:900;margin-top:9px}.gp-muted{color:var(--m);font-size:11px;margin-top:6px;line-height:1.5}
      #planpg .gp-progress{height:9px;background:#141b23;border-radius:99px;overflow:hidden;margin-top:11px}.gp-progress>div{height:100%;background:linear-gradient(90deg,#bdf85e,#6fe8b2);border-radius:99px}
      #planpg .gp-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.8fr);gap:14px;align-items:start}
      #planpg .gp-week{background:var(--p);border:1px solid var(--l);border-radius:16px;padding:18px;margin-bottom:12px}.gp-week:last-child{margin-bottom:0}
      #planpg .gp-week-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.gp-week-no{font-size:9px;color:#78dcae;letter-spacing:.14em}.gp-week h3{margin:5px 0 3px;font-size:16px}.gp-week p{margin:0;color:var(--m);font-size:11px}.gp-badge{padding:5px 9px;border:1px solid var(--l);border-radius:99px;font-size:9px;color:#aab6c2;white-space:nowrap}
      #planpg .gp-task-list{display:grid;gap:6px;margin-top:16px}.gp-task{display:flex;gap:11px;align-items:flex-start;padding:11px 12px;border:1px solid transparent;border-radius:11px;background:#0b1218;cursor:pointer}.gp-task:hover{border-color:var(--l)}.gp-task input{margin-top:2px;accent-color:#bdf85e}.gp-task span{display:grid;gap:3px;font-size:11px;color:#c9d1d9;line-height:1.5}.gp-task span b{font-size:9px;color:#6f7b88;text-transform:uppercase;letter-spacing:.08em}.gp-task.done{opacity:.62}.gp-task.done span{text-decoration:line-through}
      #planpg .gp-side{display:grid;gap:14px;position:sticky;top:84px}.gp-side h3{margin:0 0 4px;font-size:15px}.gp-note{padding:11px 12px;border:1px solid var(--l);border-radius:11px;background:#0b1218;color:#aab6c2;font-size:11px;line-height:1.55}.gp-target{display:grid;grid-template-columns:1fr auto;gap:9px;padding:11px 0;border-top:1px solid var(--l);font-size:11px}.gp-target:first-child{border-top:0}.gp-target b{font-size:12px}
      #planpg .gp-empty{padding:28px;text-align:center;color:var(--m);background:var(--p);border:1px solid var(--l);border-radius:16px}
      @media(max-width:1050px){#planpg .gp-grid{grid-template-columns:repeat(2,minmax(0,1fr))}#planpg .gp-layout{grid-template-columns:1fr}.gp-side{position:static!important}}
      @media(max-width:650px){#planpg .gp-grid{grid-template-columns:1fr 1fr}#planpg .gp-hero{align-items:flex-start;flex-direction:column}.gp-actions{width:100%}}
      @media(max-width:480px){#planpg .gp-grid{grid-template-columns:1fr}}
    </style>`;
    section.innerHTML=`${css}<div class="gp-wrap"><div class="gp-hero"><div><div class="ey">EXECUTION ROADMAP</div><h1 class="gp-title">30-Day Growth Plan</h1><p class="gp-sub">Rencana kerja 30 hari yang dihitung dari performa dan aktivitas workspace saat ini.</p></div><div class="gp-actions"><button class="btn" id="gpReset">Reset Progress</button><button class="btn primary" onclick="go('studio')">✦ Create Content</button></div></div>
      <div class="gp-grid"><div class="gp-card"><div class="gp-label">PLAN PROGRESS</div><div class="gp-num">${completion}%</div><div class="gp-progress"><div style="width:${completion}%"></div></div><div class="gp-muted">${done} dari ${plan.tasks.length} tugas selesai</div></div><div class="gp-card"><div class="gp-label">FOLLOWERS TARGET</div><div class="gp-num">${fmt(targetFollowers)}</div><div class="gp-muted">Baseline ${fmt(stats.followers)} · target indikatif +15%</div></div><div class="gp-card"><div class="gp-label">AVG VIEWS TARGET</div><div class="gp-num">${fmt(targetViews)}</div><div class="gp-muted">Baseline ${fmt(Math.round(stats.avgViews))} · target indikatif +25%</div></div><div class="gp-card"><div class="gp-label">WEEKLY CADENCE</div><div class="gp-num">${plan.cadence}x</div><div class="gp-muted">Konten terjadwal per minggu</div></div></div>
      <div class="gp-layout"><div>${taskRows}</div><aside class="gp-side"><div class="gp-card"><h3>Current Baseline</h3><div class="gp-target"><span>Followers</span><b>${fmt(stats.followers)}</b></div><div class="gp-target"><span>Avg daily views</span><b>${fmt(Math.round(stats.avgViews))}</b></div><div class="gp-target"><span>Engagement</span><b>${pct(stats.engagement)}</b></div><div class="gp-target"><span>Published content</span><b>${fmt(stats.published)}</b></div><div class="gp-target"><span>Active schedules</span><b>${fmt(stats.activeSchedules)}</b></div></div><div class="gp-card"><h3>Plan Signals</h3><div style="display:grid;gap:8px;margin-top:12px">${plan.notes.map(n=>`<div class="gp-note">${esc(n)}</div>`).join('')}</div></div><div class="gp-card"><h3>Next Action</h3><p class="gp-muted">Selesaikan tugas berikutnya, lalu gunakan Analytics untuk membandingkan hasil dengan baseline.</p><button class="btn primary" style="width:100%;margin-top:12px" onclick="go('analytics')">◒ Review Analytics</button></div></aside></div></div>`;
    section.querySelectorAll('.gp-task input').forEach(box=>box.addEventListener('change',()=>{const p=readProgress();p[box.dataset.day]=box.checked;writeProgress(p);render(stats)}));
    $('gpReset').onclick=()=>{if(!confirm('Reset seluruh progress Growth Plan?'))return;localStorage.removeItem(key);render(stats)};
  }
  async function load(){
    try{
      const [a,sc,c,sa]=await Promise.all([api('/api/analytics/summary'),api('/api/scheduler'),api('/api/content'),api('/api/social/accounts')]);
      const rows=a?.rows||[], s=a?.summary||{}, latest=rows.at(-1)||{};
      const followers=Number(s.followers??latest.followers??0);
      const avgViews=rows.length?rows.slice(-30).reduce((sum,x)=>sum+Number(x.views||0),0)/Math.min(30,rows.length):0;
      const activeSchedules=(sc||[]).filter(x=>x.status==='scheduled'&&new Date(x.scheduled_at)>new Date()).length;
      const published=(c||[]).filter(x=>x.status==='published').length;
      render({followers,avgViews,engagement:Number(s.engagement_rate||latest.engagement_rate||0),activeSchedules,published});
    }catch(e){const section=$('planpg');if(section)section.innerHTML=`<div class="gp-empty">${esc(e.message||'Growth Plan gagal dimuat.')}</div>`;console.warn('Growth Plan:',e)}
  }
  window.loadGrowthPlan=load;
  function waitForSession(){let tries=0;const timer=setInterval(()=>{if(typeof session!=='undefined'&&session?.access_token){clearInterval(timer);sessionRef=session;load()}else if(++tries>60){clearInterval(timer)}},250)}
  document.addEventListener('DOMContentLoaded',waitForSession);
})();