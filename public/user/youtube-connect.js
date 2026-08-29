(function(){
  async function connectYouTube(){
    try{
      if(typeof session==='undefined'||!session?.access_token){
        alert('Sesi login tidak valid. Silakan login kembali.');
        location.href='/login/';
        return;
      }
      const response=await fetch('/api/social/connect',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({platform:'youtube'})
      });
      const result=await response.json();
      if(!response.ok||!result.ok) throw Error(result.error?.message||'Gagal memulai koneksi YouTube.');
      if(!result.data?.authorization_url) throw Error('URL OAuth YouTube tidak tersedia.');
      window.location.href=result.data.authorization_url;
    }catch(error){
      alert(error?.message||'Gagal menghubungkan YouTube.');
    }
  }

  window.connect=connectYouTube;

  const params=new URLSearchParams(window.location.search);
  if(params.get('oauth')==='youtube'){
    const status=params.get('status');
    const messages={
      connected:'YouTube berhasil terhubung.',
      denied:'Koneksi YouTube dibatalkan.',
      invalid_state:'Sesi koneksi YouTube tidak valid. Silakan coba lagi.',
      missing_code:'Kode OAuth YouTube tidak diterima.',
      no_channel:'Akun Google tidak memiliki channel YouTube yang dapat diakses.',
      error:'Koneksi YouTube gagal. Periksa konfigurasi OAuth dan coba lagi.'
    };
    const message=messages[status];
    if(message) setTimeout(()=>alert(message),150);
    history.replaceState({},'',window.location.pathname);
  }
})();
