(function(){
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  let lastResult=null;

  async function getSession(){
    try{
      const cfg=await fetch('/api/public-config',{cache:'no-store'}).then(r=>r.json());
      if(!cfg.ok||!window.supabase)return null;
      const client=supabase.createClient(cfg.data.supabaseUrl,cfg.data.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
      const {data}=await client.auth.getSession();
      return data?.session||null;
    }catch{return null}
  }

  async function api(path,opt={}){
    const s=await getSession();
    if(!s)throw Error('Sesi login tidak valid.');
    const r=await fetch(path,{...opt,headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.access_token,...(opt.headers||{})},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j.ok===false)throw Error(j.error?.message||`HTTP ${r.status}`);
    return j.data;
  }

  function buildStudio(){
    const studio=$('studio');
    if(!studio)return null;
    studio.innerHTML=`
      <div class="head">
        <div><div class="ey">CONTENT ENGINE</div><h1>AI Content Studio</h1><p>Buat konsep konten menggunakan Gemini dan simpan langsung ke Content Library.</p></div>
      </div>
      <div class="grid two">
        <div class="card">
          <label class="muted">Topic / Brief<input id="topic" class="field" placeholder="Contoh: 3 cara meningkatkan subscriber YouTube"></label>
          <label class="muted">Goal<select id="goal" class="field"><option>Gain Followers</option><option>Increase Engagement</option><option>Increase Views</option><option>Build Brand</option></select></label>
          <label class="muted">Platform<select id="aiPlatform" class="field"><option value="youtube">YouTube</option><option value="youtube-shorts">YouTube Shorts</option></select></label>
          <label class="muted">Format<select id="aiFormat" class="field"><option value="short">Short Video</option><option value="video">Long Video</option><option value="script">Script</option></select></label>
          <button class="btn primary ai-generate" id="aiGenerateBtn" style="width:100%">✦ Generate Content</button>
        </div>
        <div class="card" id="aiOut"><div class="empty">Masukkan topik lalu klik Generate Content.</div></div>
      </div>`;
    $('aiGenerateBtn').onclick=generateAIReal;
    return studio;
  }

  function renderResult(result){
    const box=$('aiOut'); if(!box)return;
    lastResult=result;
    box.className='card';
    box.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
        <div><div class="label">GENERATED CONTENT</div><h3 style="margin:6px 0 0">${esc(result.title||'Untitled')}</h3></div>
        <span class="tag">${esc(result.duration_seconds||30)} detik</span>
      </div>
      <div class="row"><span>Hook</span><span style="max-width:70%;text-align:right">${esc(result.hook)}</span></div>
      <div class="row" style="display:block"><div class="muted">Script</div><pre style="white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 inherit;color:inherit">${esc(result.script)}</pre></div>
      <div class="row" style="display:block"><div class="muted">Caption</div><div style="margin-top:7px">${esc(result.caption)}</div></div>
      <div class="row"><span>Hashtags</span><span style="max-width:70%;text-align:right">${(result.hashtags||[]).map(esc).join(' ')}</span></div>
      <div class="row"><span>CTA</span><span style="max-width:70%;text-align:right">${esc(result.cta)}</span></div>
      <div class="row" style="display:block"><div class="muted">Visual Plan</div><ol style="margin:8px 0 0;padding-left:20px">${(result.visual_plan||[]).map(x=>`<li style="margin:5px 0">${esc(x)}</li>`).join('')}</ol></div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn primary" id="saveGenerated">Save to Content Library</button>
        <button class="btn" id="regenGenerated">Regenerate</button>
      </div>`;
    $('saveGenerated').onclick=saveGenerated;
    $('regenGenerated').onclick=generateAIReal;
  }

  async function saveGenerated(){
    if(!lastResult)return;
    const b=$('saveGenerated');
    if(b){b.disabled=true;b.textContent='Saving…';}
    try{
      const platform=$('aiPlatform')?.value||'youtube';
      await api('/api/content',{method:'POST',body:JSON.stringify({
        title:lastResult.title||'AI Content',
        format:$('aiFormat')?.value||'short',
        platforms:[platform],
        body:lastResult
      })});
      if(window.groviaReload)await window.groviaReload();
      alert('Konten berhasil disimpan ke Content Library.');
      if(typeof window.go==='function')window.go('library');
    }catch(e){alert(e.message||'Gagal menyimpan konten.');}
    finally{if(b){b.disabled=false;b.textContent='Save to Content Library';}}
  }

  async function generateAIReal(){
    const topic=$('topic')?.value.trim();
    if(!topic){alert('Topic wajib diisi.');return;}
    const goal=$('goal')?.value||'Gain Followers';
    const platformValue=$('aiPlatform')?.value||'youtube-shorts';
    const format=$('aiFormat')?.value||'short';
    const platform=platformValue==='youtube-shorts'?'YouTube Shorts':'YouTube';
    const btn=$('aiGenerateBtn');
    if(btn){btn.disabled=true;btn.textContent='Generating…';}
    const out=$('aiOut');
    if(out){out.className='card empty';out.textContent='Gemini sedang membuat konten…';}
    try{
      const result=await api('/api/ai/generate',{method:'POST',body:JSON.stringify({topic,goal,format,platform})});
      renderResult(result);
    }catch(e){
      if(out){out.className='card empty';out.innerHTML=`<div style="color:#ff9b9b">${esc(e.message||'Generate gagal.')}</div>`;}
    }finally{
      const b=$('aiGenerateBtn');
      if(b){b.disabled=false;b.textContent='✦ Generate Content';}
    }
  }

  function install(){
    if(!$('studio'))return;
    // Replace the minimal placeholder studio once so the controls are deterministic.
    if(!$('aiGenerateBtn')) buildStudio();
  }

  window.generateAI=generateAIReal;
  window.saveGenerated=saveGenerated;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,200));
  const observer=new MutationObserver(()=>{ if(!$('aiGenerateBtn'))install(); });
  observer.observe(document.documentElement,{subtree:true,childList:true});
})();
