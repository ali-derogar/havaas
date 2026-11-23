import {getLocale,setLocale,fragment,t,languageSelector} from './i18n.js';
const main=document.querySelector('main'),original=main.innerHTML;
function render(){setLocale(getLocale());main.innerHTML=fragment(original);main.insertAdjacentHTML('afterbegin',languageSelector());document.title=getLocale()==='en'?'Havaas — Reconnect':'حواس — اتصال دوباره';}
render();
document.addEventListener('change',event=>{if(event.target.matches('[data-locale-select]')){setLocale(event.target.value);render();}});
document.addEventListener('click',async event=>{
 const button=event.target.closest('#retry-connection');if(!button||button.disabled)return;
 const status=document.querySelector('#connection-status'),controller=new AbortController();button.disabled=true;status.textContent=t('در حال بررسی اتصال…');const timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch('/health',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('unavailable');location.reload();}
 catch{status.textContent=t('هنوز وصل نشدیم. اینترنت رو بررسی کن و دوباره تلاش کن.');}
 finally{clearTimeout(timer);button.disabled=false;}
});
window.addEventListener('online',()=>{document.querySelector('#connection-status').textContent=t('اینترنت وصل شد! برای ادامه «تلاش دوباره» رو بزن.');});
