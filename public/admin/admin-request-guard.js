(function(){
  if(window.__groviaAdminRequestGuard)return; window.__groviaAdminRequestGuard=1;
  const nativeFetch=window.fetch.bind(window);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function getBearer(){
    for(let i=0;i<30;i++){
      try{
        if(window.sb?.auth){const s=await window.sb.auth.getSession();const t=s?.data?.session?.access_token;if(t)return t;}
      }catch{}
      await sleep(100);
    }
    return '';
  }
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input?.url||'');
    const isAdmin=/\/api\/admin\//.test(url);
    let response=await nativeFetch(input,init);
    if(isAdmin&&response.status===401){
      const token=await getBearer();
      if(token){
        const headers=new Headers(init?.headers||{}); headers.set('Authorization','Bearer '+token); headers.set('Cache-Control','no-cache');
        response=await nativeFetch(input,{...init,headers});
      }
    }
    if(isAdmin&&/\/api\/admin\/audit-logs(?:\?|$)/.test(url)&&response.ok){
      try{
        const data=await response.clone().json();
        const rows=Array.isArray(data?.data)?data.data:(Array.isArray(data)?data:(Array.isArray(data?.data?.logs)?data.data.logs:[]));
        return new Response(JSON.stringify({...data,data:rows}),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json'}});
      }catch{}
    }
    return response;
  };
})();
