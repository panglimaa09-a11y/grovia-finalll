(function(){
  const originalFetch=window.fetch.bind(window);
  const cache=new Map();
  const inflight=new Map();
  const GET_TTL=30000;
  function isApiGet(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const method=(init&&init.method)||((typeof input!=='string'&&input&&input.method)||'GET');
    return method.toUpperCase()==='GET' && url.startsWith('/api/');
  }
  function key(input){return typeof input==='string'?input:input.url}
  function jsonResponse(body,status,headers){
    return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...(headers||{})}})
  }
  window.fetch=async function(input,init){
    if(!isApiGet(input,init)) return originalFetch(input,init);
    const url=key(input);
    const now=Date.now();
    const cached=cache.get(url);
    if(cached&&now-cached.time<GET_TTL)return cached.response.clone();
    if(inflight.has(url))return (await inflight.get(url)).clone();
    const promise=(async()=>{
      let response=await originalFetch(input,init);
      const contentType=(response.headers.get('content-type')||'').toLowerCase();
      if(response.status===429){
        const text=await response.text();
        response=jsonResponse({ok:false,error:{code:'RATE_LIMITED',message:text||'Too many requests. Tunggu sebentar lalu coba lagi.'}},429,response.headers);
      }else if(!contentType.includes('application/json')){
        const text=await response.text();
        const message=text||`HTTP ${response.status}`;
        response=jsonResponse({ok:false,error:{code:'API_NON_JSON',message}},response.status,response.headers);
      }
      if(response.ok&&response.status!==204)cache.set(url,{time:Date.now(),response:response.clone()});
      return response;
    })();
    inflight.set(url,promise);
    try{return (await promise).clone();}
    finally{inflight.delete(url)}
  };
  window.groviaClearApiCache=function(){cache.clear()};
})();
