document.querySelector('#retry-connection').addEventListener('click',async event=>{
  const button=event.currentTarget,status=document.querySelector('#connection-status'),controller=new AbortController();
  button.disabled=true;status.textContent='در حال بررسی اتصال…';const timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch('/health',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('unavailable');
    location.reload();
  }catch{status.textContent='هنوز وصل نشدیم. اینترنت رو بررسی کن و دوباره تلاش کن.';}
  finally{clearTimeout(timer);button.disabled=false;}
});
window.addEventListener('online',()=>{document.querySelector('#connection-status').textContent='اینترنت وصل شد! برای ادامه «تلاش دوباره» رو بزن.';});
