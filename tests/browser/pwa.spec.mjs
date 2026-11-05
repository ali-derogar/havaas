import {test,expect,request,chromium} from '@playwright/test';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

let seed,player,password;
test.beforeAll(async()=>{
 seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));password=seed.password;
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'}),guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password}})).json();
  const issued=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'آزمون مستقل نصب برنامه'}})).json(),session=await(await guest.get('/api/auth/session')).json();
  const response=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':session.csrfToken},data:{token:issued.url.split('/').at(-1),username:`pwa-${randomUUID().slice(0,12)}`,password,profile:{firstName:'آزمون',lastName:'نصب',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'}}});expect(response.status()).toBe(201);player=(await response.json()).user;
 }finally{await admin.dispose();await guest.dispose();}
});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(player.username);await page.locator('#login-form [name=password]').fill(password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function adminLogin(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.admin.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.admin-main')).toBeVisible();await ready(page);}
async function ready(page){await page.evaluate(()=>navigator.serviceWorker.ready);await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);}
async function cachePaths(page){return page.evaluate(async()=>{const paths=[];for(const name of await caches.keys())if(name.startsWith('havaas-static-'))for(const req of await(await caches.open(name)).keys())paths.push(new URL(req.url).pathname);return paths;});}
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advancePwa=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advancePwa(ms),ms);
async function nextRelease(page){
 expect((await page.request.post('/__e2e/pwa-release')).ok()).toBe(true);
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting)),{timeout:30000}).toBe(true);
}

test('PWA manifest is installable, icons decode at their declared sizes and the root worker controls the app',async()=>{
 // A regular temporary profile allows Chrome's real installability check;
 // private browser contexts correctly report installation as unavailable.
 const profile=await mkdtemp(join(tmpdir(),'havaas-install-')),context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome',args:['--no-sandbox'],baseURL:'http://127.0.0.1:4181'}),page=await context.newPage();
 try{
 await page.goto('/');await ready(page);
 const manifest=await(await page.request.get('/manifest.webmanifest')).json();expect(manifest.lang).toBe('fa');expect(manifest.dir).toBe('rtl');expect(manifest.display).toBe('standalone');expect(manifest.scope).toBe('/');
 for(const icon of manifest.icons){const size=Number(icon.sizes.split('x')[0]),actual=await page.evaluate(async path=>{const image=new Image();image.src=path;await image.decode();return [image.naturalWidth,image.naturalHeight];},icon.src);expect(actual).toEqual([size,size]);}
 const cdp=await page.context().newCDPSession(page),installability=await cdp.send('Page.getInstallabilityErrors');expect(installability.installabilityErrors).toEqual([]);await cdp.detach();
 expect(await page.evaluate(()=>(navigator.serviceWorker.controller.scriptURL))).toBe('http://127.0.0.1:4181/sw.js');
 const paths=await cachePaths(page);expect(paths).toContain('/offline.html');expect(paths).toContain('/src/app.js');expect(paths).toContain('/assets/fonts/Vazirmatn.woff2');expect(paths.some(path=>path.startsWith('/api/'))).toBe(false);
 }finally{await context.close();await rm(profile,{recursive:true,force:true});}
});

test('PWA relaunches offline without cached account data, serves cached audio ranges and reconnects to the account',async({page,context})=>{
 await login(page);await ready(page);await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:'برای ادامه، دوباره وصل شو'})).toBeVisible();await expect(page.locator('.hero')).toHaveCount(0);await expect(page.locator('#login-form')).toHaveCount(0);
 expect(await page.locator('main>img').evaluate(image=>image.complete&&image.naturalWidth===192)).toBe(true);
 await page.locator('#retry-connection').click();await expect(page.locator('#connection-status')).toContainText('هنوز ارتباط');
 const audio=await page.evaluate(async()=>{
  const cache=await caches.open((await caches.keys()).find(name=>name.startsWith('havaas-static-'))),url=(await cache.keys()).find(request=>request.url.endsWith('.mp3')).url;
  const response=await fetch(url,{headers:{Range:'bytes=0-15'}});return {status:response.status,length:(await response.arrayBuffer()).byteLength,range:response.headers.get('Content-Range')};
 });expect(audio.status).toBe(206);expect(audio.length).toBe(16);expect(audio.range).toMatch(/^bytes 0-15\//);
 expect(await page.evaluate(()=>fetch('/api/auth/session').then(()=>false,()=>true))).toBe(true);expect((await cachePaths(page)).some(path=>path.startsWith('/api/'))).toBe(false);
 await page.screenshot({path:'.local/verification/pwa-offline.png'});await context.setOffline(false);await page.locator('#retry-connection').click();await expect(page.locator('.hero')).toBeVisible();
});

test('PWA account offers manual installation and uses the browser install prompt when available',async({page})=>{
 await page.setViewportSize({width:360,height:780});await login(page);await ready(page);await action(page,'account').click();
 const card=page.locator('[data-pwa-install]');await expect(card).toBeVisible();await card.locator('[data-pwa-action=install]').click();await expect(card.locator('[data-pwa-help]')).toContainText('منوی مرورگر');
 await page.evaluate(()=>{const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.pwaPromptCount=(window.pwaPromptCount||0)+1;};event.userChoice=Promise.resolve({outcome:'accepted'});dispatchEvent(event);});
 await expect(card.locator('[data-pwa-action=install]')).toHaveText('نصب حواس');await page.screenshot({path:'.local/verification/pwa-install-360.png',fullPage:true});
 await card.locator('[data-pwa-action=install]').click();expect(await page.evaluate(()=>window.pwaPromptCount)).toBe(1);await expect(card).toBeHidden();
});

test('PWA update cannot interrupt another window playing or awaiting a save, then updates both windows after saving',async({page,context})=>{
 await clock(page);await login(page);await ready(page);
 await page.locator('[data-action=open][data-game=traffic]').first().click();await action(page,'practice').click();await expect(page.locator('.game-preparation')).toBeVisible();await action(page,'begin-game').click();await advance(page,3000);
 const idle=await context.newPage();
 try{
  await page.evaluate(()=>caches.open('another-app-cache'));await nextRelease(page);
  await expect(page.locator('#pwa-banner')).toBeHidden();await idle.goto('/');await expect(idle.locator('.hero')).toBeVisible();await ready(idle);
  const update=idle.locator('[data-pwa-action=update]');await expect(update).toBeVisible();await update.click();await expect(idle.locator('#pwa-banner')).toContainText('ابتدا بازی');
  expect(await page.evaluate(()=>document.querySelector('#app').inert)).toBe(false);expect(await idle.evaluate(()=>document.querySelector('#app').inert)).toBe(false);await expect(page.locator('.play-panel')).toHaveAttribute('data-phase','playing');
  await page.route('**/api/children/*/sessions/*/complete',route=>route.abort('failed'));
  for(let n=0;n<5;n++){await advance(page,1000);await expect(page.locator('.practice-review')).toBeVisible();await action(page,'continue-review').click();}
  await expect(action(page,'retry-save')).toBeVisible();await update.click();await expect(idle.locator('#pwa-banner')).toContainText('ابتدا بازی');await expect(action(page,'retry-save')).toBeVisible();
  await page.unroute('**/api/children/*/sessions/*/complete');await action(page,'retry-save').click();await expect(page.locator('.local-note')).toContainText('ذخیره شد');await action(page,'home').click();await expect(page.locator('.hero')).toBeVisible();
  await Promise.all([page.waitForEvent('domcontentloaded'),idle.waitForEvent('domcontentloaded'),update.click()]);await expect(page.locator('.hero')).toBeVisible();await expect(idle.locator('.hero')).toBeVisible();
  const keys=await idle.evaluate(()=>caches.keys());expect(keys.filter(name=>name.startsWith('havaas-static-'))).toHaveLength(1);expect(keys).toContain('another-app-cache');
 }finally{await idle.close();}
});

test('PWA update preserves an edited form after its field loses focus and allows updating after reset',async({page,context})=>{
 await login(page);await ready(page);await action(page,'account').click();await expect(page.locator('#password-form')).toBeVisible();
 await page.locator('#password-form [name=currentPassword]').fill('unsaved-current-password');await page.locator('#password-form [name=password]').fill('unsaved-new-password');await page.locator('h1').click();
 expect(await page.evaluate(()=>document.activeElement.matches('input,textarea,select'))).toBe(false);
 const idle=await context.newPage();
 try{
  await nextRelease(page);
  await idle.goto('/');await ready(idle);const update=idle.locator('[data-pwa-action=update]');await expect(update).toBeVisible();await update.click();await expect(idle.locator('#pwa-banner')).toContainText('ابتدا بازی');
  await expect(page.locator('#password-form [name=password]')).toHaveValue('unsaved-new-password');expect(await page.evaluate(()=>document.querySelector('#app').inert)).toBe(false);
  await page.locator('#password-form').evaluate(form=>form.reset());
  await Promise.all([page.waitForEvent('domcontentloaded'),idle.waitForEvent('domcontentloaded'),update.click()]);await expect(page.locator('#password-form')).toBeVisible();await expect(idle.locator('.hero')).toBeVisible();
 }finally{await idle.close();}
});

test('PWA update cancels when a new playing window opens during the readiness handshake',async({page,context})=>{
 await page.addInitScript(()=>{navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='PWA_PREPARE_UPDATE'&&window.holdPwaReadiness){event.stopImmediatePropagation();window.heldPwaPort=event.ports[0];}});});
 await login(page);await ready(page);let newcomer;
 try{
  await nextRelease(page);
  await page.evaluate(()=>window.holdPwaReadiness=true);await page.locator('[data-pwa-action=update]').click();await expect.poll(()=>page.evaluate(()=>Boolean(window.heldPwaPort))).toBe(true);
  newcomer=await context.newPage();await newcomer.goto('/');await expect(newcomer.locator('.hero')).toBeVisible();await ready(newcomer);await newcomer.locator('[data-action=open][data-game=traffic]').first().click();await action(newcomer,'practice').click();await expect(newcomer.locator('.game-preparation')).toBeVisible();
  await page.evaluate(()=>{window.heldPwaPort.postMessage({ready:true});window.heldPwaPort.close();window.holdPwaReadiness=false;});
  await expect(page.locator('#pwa-banner')).toContainText('ابتدا بازی');expect(await newcomer.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);await expect(newcomer.locator('.game-preparation')).toBeVisible();
 }finally{await newcomer?.close();}
});

test('PWA allows updating after a successful form save resets the password fields',async({page})=>{
 await login(page);await ready(page);await action(page,'account').click();await expect(page.locator('#password-form')).toBeVisible();
 const nextPassword=`Saved-PWA-${randomUUID()}`;
 let release=()=>{};
 try{
  await page.locator('#password-form [name=currentPassword]').fill(password);await page.locator('#password-form [name=password]').fill(nextPassword);await page.locator('h1').click();
  await nextRelease(page);
  const update=page.locator('[data-pwa-action=update]');await expect(update).toBeHidden();
  await page.route('**/api/auth/change-password',route=>route.fulfill({status:503,json:{error:'آزمون خطای ذخیره',code:'TEST_UNAVAILABLE'}}));
  await page.locator('#password-form button[type=submit]').click();await expect(page.locator('#account-error')).toContainText('آزمون خطای ذخیره');await expect(page.locator('#password-form [name=password]')).toBeEnabled();await expect(page.locator('#password-form [name=password]')).toHaveValue(nextPassword);await expect(update).toBeHidden();await page.unroute('**/api/auth/change-password');
  let acknowledged;const gate=new Promise(resolve=>release=resolve),atServer=new Promise(resolve=>acknowledged=resolve);
  await page.route('**/api/auth/change-password',async route=>{const response=await route.fetch();acknowledged();await gate;await route.fulfill({response});});
  const saved=page.waitForResponse(response=>response.url().endsWith('/api/auth/change-password')&&response.status()===200);await page.locator('#password-form button[type=submit]').click();await atServer;
  await expect(page.locator('#password-form [name=password]')).toBeDisabled();await expect(page.locator('#password-form [name=currentPassword]')).toBeDisabled();release();await saved;password=nextPassword;
  await expect(page.locator('#account-status')).toContainText('رمز تغییر کرد');await expect(page.locator('#password-form [name=password]')).toHaveValue('');await expect(update).toBeVisible();
  await Promise.all([page.waitForEvent('domcontentloaded'),update.click()]);await expect(page.locator('#password-form')).toBeVisible();
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('PWA does not retain update protection from a cancelled modal form',async({page})=>{
 await adminLogin(page);
 await action(page,'new-user').click();await page.locator('#create-user-form [name=username]').fill('cancelled-pwa-user');await page.locator('#modal [data-action=close-modal]').first().click();await expect(page.locator('#modal')).toBeHidden();
 await expect(page.locator('#create-user-form [name=username]')).toHaveValue('cancelled-pwa-user');await nextRelease(page);const update=page.locator('[data-pwa-action=update]');await expect(update).toBeVisible();
 await Promise.all([page.waitForEvent('domcontentloaded'),update.click()]);await expect(page.locator('.admin-main')).toBeVisible();
});

test('PWA treats initialized difficulty values as clean and accepts a successful save without resetting the form',async({page})=>{
 await adminLogin(page);
 const auth=await(await page.request.get('/api/auth/session')).json(),details=await(await page.request.get(`/api/users/${player.id}`)).json();
 expect((await page.request.patch(`/api/children/${details.profile.id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'hunt',mode:'fixed',level:'hard'}})).ok()).toBe(true);
 await page.goto(`/#admin/user/${player.id}`);await page.locator('[data-action=user-tab][data-tab=difficulty]').click();const form=page.locator('#admin-difficulty-form');
 await expect(form.locator('[name=level]')).toHaveValue('hard');await expect(form.locator('[name=mode]')).toHaveValue('fixed');await nextRelease(page);const update=page.locator('[data-pwa-action=update]');await expect(update).toBeVisible();
  await form.locator('[name=level]').selectOption('medium');await page.locator('h1:visible').click();await expect(update).toBeHidden();await form.locator('button[type=submit]').click();await expect(page.locator('#account-status')).toContainText('ذخیره شد');await expect(update).toBeVisible();
 await Promise.all([page.waitForEvent('domcontentloaded'),update.click()]);await page.locator('[data-action=user-tab][data-tab=difficulty]').click();await expect(page.locator('#admin-difficulty-form [name=level]')).toHaveValue('medium');
});
