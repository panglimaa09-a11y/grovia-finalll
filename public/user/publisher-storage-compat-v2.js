(function(){
  const installedKey='__groviaStorageCompatV2';
  function install(){
    if(!window.supabase||window[installedKey])return;
    window[installedKey]=true;
    const originalCreateClient=window.supabase.createClient;
    window.supabase.createClient=function(){
      const client=originalCreateClient.apply(this,arguments);
      try{
        if(!client?.storage?.from)return client;
        const originalFrom=client.storage.from.bind(client.storage);
        client.storage.from=function(bucket){
          const api=originalFrom(bucket);
          if(api && typeof api.list==='function')return api;
          const originalApi=api||{};
          originalApi.list=async function(path='',options={}){
            try{
              const base=String(client.supabaseUrl||'').replace(/\/$/,'');
              const {data:sessionData}=await client.auth.getSession();
              const token=sessionData?.session?.access_token;
              if(!token)return {data:null,error:{message:'Session tidak tersedia untuk verifikasi Storage.'}};
              const body={prefix:path||'',limit:Number(options.limit||100),offset:Number(options.offset||0),sortBy:options.sortBy||{column:'name',order:'asc'}};
              if(options.search)body.search=String(options.search);
              const response=await fetch(`${base}/storage/v1/object/list/${encodeURIComponent(bucket)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'apikey':arguments[1]?.supabaseKey||token,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
              const text=await response.text();
              let json=null;try{json=JSON.parse(text)}catch{}
              if(!response.ok)return {data:null,error:{message:json?.message||json?.error||text||`Storage list failed (${response.status})`}};
              return {data:Array.isArray(json)?json:[],error:null};
            }catch(e){return {data:null,error:{message:e?.message||'Storage list failed.'}}}
          };
          return originalApi;
        };
      }catch(_e){}
      return client;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
