(function(){
  function install(){
    if(!window.supabase||window.__groviaStorageCompat)return;
    window.__groviaStorageCompat=true;
    const originalCreateClient=window.supabase.createClient;
    window.supabase.createClient=function(){
      const client=originalCreateClient.apply(this,arguments);
      try{
        const originalFrom=client.storage.from.bind(client.storage);
        client.storage.from=function(bucket){
          const bucketApi=originalFrom(bucket);
          if(bucketApi.__groviaPatched)return bucketApi;
          bucketApi.__groviaPatched=true;
          const originalList=bucketApi.list.bind(bucketApi);
          bucketApi.list=async function(path='',options={}){
            const result=await originalList(path,options);
            if(!result?.error && Array.isArray(result.data) && result.data.length) return result;
            const search=options?.search||'';
            if(!search) return result;
            const objectPath=path ? `${String(path).replace(/\/$/,'')}/${search}` : search;
            try{
              const signed=await bucketApi.createSignedUrl(objectPath,120);
              if(!signed?.error && signed?.data?.signedUrl){
                const head=await fetch(signed.data.signedUrl,{method:'HEAD',cache:'no-store'});
                if(head.ok){
                  const name=objectPath.split('/').pop();
                  const length=head.headers.get('content-length');
                  return {data:[{name,metadata:{size:length?Number(length):0}}],error:null};
                }
              }
            }catch(_e){}
            return result;
          };
        };
      }catch(_e){}
      return client;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
