export function setupPwa({canUpdate=()=>true}={}){
 if(!globalThis.navigator?.serviceWorker||!globalThis.isSecureContext)return null;
 const worker=navigator.serviceWorker,standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const banner=document.createElement('aside');banner.id='pwa-banner';banner.className='pwa-banner';banner.hidden=true;banner.setAttribute('aria-label','وضعیت برنامه');
 banner.innerHTML='<p role="status" aria-live="polite"></p><button type="button" class="button subtle" data-pwa-action="update">به‌روزرسانی</button><button type="button" class="pwa-dismiss" data-pwa-action="dismiss" aria-label="بستن پیام">×</button>';
 document.body.append(banner);
 const message=banner.querySelector('p'),update=banner.querySelector('[data-pwa-action=update]');
 let registration=null,installPrompt=null,installed=standalone(),dismissed='',notice='',preparing=false,previousInert=false,updateTimer=null;
 const state=()=>navigator.onLine===false?'offline':notice?'notice':registration?.waiting?'update':'';
 const safe=()=>canUpdate()&&!document.querySelector('dialog[open],form[data-waiting]')&&!document.activeElement?.matches('input,textarea,select');
 function sync(){
  for(const card of document.querySelectorAll('[data-pwa-install]')){card.hidden=installed||standalone();const button=card.querySelector('[data-pwa-action=install]'),label=installPrompt?'نصب حواس':'راهنمای نصب';if(button&&button.textContent!==label)button.textContent=label;}
  const current=state();banner.hidden=!current||dismissed===current||document.body.dataset.screen==='play';
  message.textContent=current==='offline'?'آفلاین هستی؛ برای دریافت و ثبت نتیجه، اتصال لازم است.':notice||'نسخهٔ تازهٔ حواس آماده است.';
  update.hidden=current==='offline'||!registration?.waiting||!safe();update.disabled=preparing;
 }
 function release(){
  clearTimeout(updateTimer);if(preparing){const app=document.querySelector('#app');if(app)app.inert=previousInert;preparing=false;}sync();
 }
 function prepare(){
  if(preparing||!safe())return false;
  preparing=true;const app=document.querySelector('#app');if(app){previousInert=app.inert;app.inert=true;}
  // A terminated worker or interrupted update must never leave the page inert.
  updateTimer=setTimeout(release,10000);sync();return true;
 }
 worker.addEventListener('message',event=>{
  if(event.data?.type==='PWA_PREPARE_UPDATE')event.ports[0]?.postMessage({ready:prepare()});
  if(event.data?.type==='PWA_CANCEL_UPDATE')release();
  if(event.data?.type==='PWA_UPDATE_BLOCKED'){release();notice='ابتدا بازی، ثبت نتیجه یا فرم باز را در پنجره‌های دیگر کامل کن؛ سپس دوباره تلاش کن.';dismissed='';sync();}
 });
 worker.addEventListener('controllerchange',()=>{if(preparing){clearTimeout(updateTimer);location.reload();}else sync();});
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;installed=false;sync();});
 window.addEventListener('appinstalled',()=>{installPrompt=null;installed=true;sync();});
 for(const name of ['online','offline'])window.addEventListener(name,()=>{dismissed='';notice='';sync();});
 document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-pwa-action]');if(!button)return;
  if(button.dataset.pwaAction==='dismiss'){dismissed=state();sync();return;}
  if(button.dataset.pwaAction==='update'){
   notice='';dismissed='';if(!registration?.waiting||!safe()){sync();return;}
   update.disabled=true;registration.waiting.postMessage({type:'PWA_APPLY_UPDATE'});return;
  }
  if(button.dataset.pwaAction==='install'){
   if(installPrompt){
    const prompt=installPrompt;installPrompt=null;button.disabled=true;
    try{await prompt.prompt();const choice=await prompt.userChoice;if(choice?.outcome==='accepted')installed=true;}
    catch{/* The browser menu remains available if the prompt is dismissed. */}
    finally{button.disabled=false;sync();}
   }else{
    const help=button.closest('[data-pwa-install]').querySelector('[data-pwa-help]');help.hidden=false;
    help.textContent=ios?'در Safari، دکمهٔ اشتراک‌گذاری را بزن و «افزودن به صفحهٔ اصلی» (Add to Home Screen) را انتخاب کن.':'از منوی مرورگر، «نصب برنامه» یا «افزودن به صفحهٔ اصلی» را انتخاب کن.';
   }
  }
 });
 // New views replace #app; keep the install card and update button in sync.
 new MutationObserver(sync).observe(document.querySelector('#app'),{childList:true,subtree:true});
 document.addEventListener('focusin',sync);document.addEventListener('focusout',()=>queueMicrotask(sync));
 async function register(){
  try{
   registration=await worker.register('/sw.js',{scope:'/',updateViaCache:'none'});
   registration.addEventListener('updatefound',()=>{const installing=registration.installing;installing?.addEventListener('statechange',()=>{if(installing.state==='installed'){dismissed='';notice='';sync();}});});
   sync();
  }catch{/* Installation is optional; an unavailable cache must not stop the app. */}
 }
 if(document.readyState==='complete')void register();else window.addEventListener('load',register,{once:true});
 return {sync};
}
