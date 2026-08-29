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
  function renderResult(result){
    const box=$('aiOut'); if(!box)return;
    lastResult=result;
    box.className='card';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px"><div><div class="label">GENERATED CONTENT</div><h3 style="margin:6px 0">${esc(result.title||'Untitled')}</h3></div><span class="tag">${esc(result.duration_seconds||30)} detik</span></div>
      <div class="row"><span>Hook</span><span style="max-width:70%;text-align:right">${esc(result.hook)}</span></div>
      <div class="row" style="display:block"><div class="muted">Script</div><pre style="white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 inherit;color:inherit">${esc(result.script)}</pre></div>
      <div class="row" style="display:block"><div class="muted">Caption</div><div style="margin-top:7px">${esc(result.caption)}</div></div>
      <div class="row"><span>Hashtags</span><span style="max-width:70%;text-align:right">${(result.hashtags||[]).map(esc).join(' ')}</span></div>
      <div class="row"><span>CTA</span><span style="max-width:70%;text-align:right">${esc(result.cta)}</span></div>
      <div class="row" style="display:block"><div class="muted">Visual Plan</div><ol style="margin:8px 0 0;padding-left:20px">${(result.visual_plan||[]).map(x=>`<li style="margin:5px 0">${esc(x)}</li>`).join('')}</ol></div>
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn primary" id="saveGenerated">Save to Content Library</button><button class="btn" id="regenGenerated">Regenerate</button></div>`;
    $('saveGenerated').onclick=saveGenerated;
    $('regenGenerated').onclick=()=>{const b=document.querySelector('#studio button[onclick="generateAI()"]');if(b)b.click();};
  }
  async function saveGenerated(){
    if(!lastResult)return;
    const b=$('saveGenerated'); if(b){b.disabled=true;b.textContent='Saving…';}
    try{
      const platform=$('platform')?.value||'youtube';
      await api('/api/content',{method:'POST',body:JSON.stringify({title:lastResult.title||'AI Content',format:'short',platforms:[platform],body:lastResult})});
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
    const btn=document.querySelector('#studio button.ai-generate');
    if(btn){btn.disabled=true;btn.textContent='Generating…';}
    const out=$('aiOut'); if(out){out.className='card empty';out.textContent='Gemini sedang membuat konten…';}
    try{
      const result=await api('/api/ai/generate',{method:'POST',body:JSON.stringify({topic,goal,format:'Short Video',platform:'YouTube Shorts'})});
      renderResult(result);
    }catch(e){if(out){out.className='card empty';out.textContent=e.message||'Generate gagal.';}else alert(e.message);}
    finally{if(btn){btn.disabled=false;btn.textContent='Generate Content';}}
  }
  function install(){
    const studio=$('studio'); if(!studio)return;
    const button=[...studio.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate Content');
    if(button&&!button.classList.contains('ai-generate')){button.classList.add('ai-generate');button.removeAttribute('onclick');button.addEventListener('click',generateAIReal);}
    const topic=$('topic');
    if(topic&&!$('aiPlatform')){
      const goal=topic.parentElement?.parentElement;
      if(goal){
        const wrap=document.createElement('label');wrap.className='muted';wrap.innerHTML='Platform<select id="aiPlatform" class="field"><option value="youtube">YouTube</option><option value="youtube-shorts">YouTube Shorts</option></select></label>';
        goal.appendChild(wrap);
      }
    }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,150));
  const observer=new MutationObserver(install); observer.observe(document.documentElement,{subtree:true,childList:true});
})();
