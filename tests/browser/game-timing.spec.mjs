import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';

let seed,admin,csrf,player,childId;
const key={gameId:'traffic',variant:'standard',timingFamily:'standard',level:'hard'};
const query=new URLSearchParams(key).toString();
const path=()=>`/api/children/${childId}/game-timings`;
async function configure(target,timing){const data=await(await admin.get(`${target}?${query}`)).json();const saved=await admin.patch(target,{headers:{'X-CSRF-Token':csrf},data:{...key,timing,expectedRevision:data.levels.find(row=>row.level==='hard').revision}});expect(saved.status()).toBe(200);}
test.beforeAll(async()=>{
 seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();csrf=auth.csrfToken;
 const link=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':csrf},data:{label:'آزمون زمان‌بندی'}})).json();
 const guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  const session=await(await guest.get('/api/auth/session')).json(),registered=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':session.csrfToken},data:{token:link.url.split('/').at(-1),username:`timings-${randomUUID().slice(0,12)}`,password:seed.password,profile:{firstName:'آزمون',lastName:'زمان‌بندی',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'}}});expect(registered.status()).toBe(201);player=(await registered.json()).user;
  childId=(await(await guest.get('/api/bootstrap')).json()).activeId;const {csrfToken}=await(await guest.get('/api/auth/session')).json();
  const run=await(await guest.post(`/api/children/${childId}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId:'traffic',kind:'baseline',clientExperienceVersion:3}})).json();expect((await guest.post(`/api/children/${childId}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).status()).toBe(200);
 }finally{await guest.dispose();}
 expect((await admin.patch(`/api/children/${childId}/difficulty`,{headers:{'X-CSRF-Token':csrf},data:{gameId:'traffic',mode:'fixed',level:'hard'}})).ok()).toBe(true);
});
test.afterAll(async()=>{if(admin){await configure('/api/admin/game-timings',null);await admin.dispose();}});
async function login(page,asAdmin=false){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(asAdmin?seed.users.admin.username:player.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator(asAdmin?'.admin-stats':'.hero')).toBeVisible();}
async function trafficSettings(page){await page.locator('[data-timing-select=gameId]').selectOption('traffic');await expect(page.locator('#game-timing-hard-form')).toHaveAttribute('data-game','traffic');}
async function saveForm(page,level='hard'){const form=page.locator(`#game-timing-${level}-form`);const done=page.waitForResponse(response=>response.url().includes('/game-timings')&&response.request().method()==='PATCH');await form.locator('button[type=submit]').click();expect((await done).status()).toBe(200);await expect(page.locator('#account-status')).toContainText('ذخیره شد');}
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
const advance=(page,ms)=>page.evaluate(ms=>window.advanceTimingGame(ms),ms);
async function instrument(page){await page.addInitScript(()=>{
 localStorage.setItem('havaas:v1',JSON.stringify({version:1,games:{},sound:true}));
 let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceTimingGame=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};
 window.spoken=[];const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.spoken.push(this);return play.call(this);};
 });}

test('admin configures global and personal timings, resets inheritance, and guards unsaved selectors',async({page})=>{
 await login(page,true);await page.locator('.admin-sidebar [data-action=account]').click();await trafficSettings(page);
 const hard=page.locator('#game-timing-hard-form');await hard.locator('[name=visibleMs]').fill('1.5');await hard.locator('[name=intervalMs]').fill('2.5');await saveForm(page);
 await expect(hard.locator('.timing-source')).toContainText('تنظیم عمومی');
 await page.goto(`/#admin/user/${player.id}`);await page.locator('[data-action=user-tab][data-tab=difficulty]').click();await trafficSettings(page);
 await expect(hard.locator('[name=visibleMs]')).toHaveValue('1.5');await hard.locator('[name=visibleMs]').fill('2');await hard.locator('[name=intervalMs]').fill('3');await saveForm(page);await expect(hard.locator('.timing-source')).toContainText('اختصاصی');
 await page.setViewportSize({width:1440,height:1050});await page.locator('#game-timing-settings').scrollIntoViewIfNeeded();await page.locator('#game-timing-settings').screenshot({path:'.local/verification/game_timing_admin.png'});
 await hard.locator('[name=visibleMs]').fill('2.5');await page.locator('[data-timing-select=gameId]').selectOption('search');await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=stay]').click();await expect(hard.locator('[name=visibleMs]')).toHaveValue('2.5');await expect(page.locator('[data-timing-select=gameId]')).toHaveValue('traffic');
 await page.locator('[data-timing-select=gameId]').selectOption('search');await page.locator('[data-guard=discard]').click();await expect(page.locator('#game-timing-hard-form')).toHaveAttribute('data-game','search');await expect(page.locator('#game-timing-hard-form [name=previewMs]')).toHaveValue('2');
 await trafficSettings(page);await hard.locator('[data-action=reset-game-timing]').click();await expect(hard.locator('.timing-source')).toContainText('تنظیم عمومی');await expect(hard.locator('[name=visibleMs]')).toHaveValue('1.5');
 for(const width of [360,768]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});

test('one automatic guide per visit; manual speech freezes custom gameplay and reopening permits one new guide',async({page})=>{
 await configure(path(),{visibleMs:1500,intervalMs:2500});await instrument(page);await page.setViewportSize({width:390,height:844});await login(page);
 await page.locator('[data-action=open][data-game=traffic]').first().click();await expect(page.locator('#lesson-box')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(1);
 await page.locator('[data-action=traffic-mode][data-mode=signs]').click();
 await expect(page.locator('[data-action=traffic-mode][data-mode=signs]')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>window.spoken.length)).toBe(1);
 await page.locator('[data-action=traffic-mode][data-mode=circles]').click();await expect(page.locator('[data-action=traffic-mode][data-mode=circles]')).toHaveAttribute('aria-pressed','true');
 await action(page,'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(1);await action(page,'begin-game').click();await advance(page,3000);
 await expect(page.locator('.play-panel')).toHaveAttribute('data-visible-ms','1500');await expect(page.locator('.play-panel')).toHaveAttribute('data-interval-ms','2500');await advance(page,1499);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await expect(action(page,'respond')).toBeEnabled();
 await page.locator('.play-heading-actions [data-action=listen-guide]').click();await expect(page.locator('#modal')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(2);const frozen=await page.locator('#time').textContent(),position=await page.locator('#position').textContent();await advance(page,60000);await expect(page.locator('#time')).toHaveText(frozen);await expect(page.locator('#position')).toHaveText(position);
 await page.screenshot({path:'.local/verification/game_audio_paused.png'});await action(page,'resume').click();expect(await page.evaluate(()=>window.spoken.every(audio=>audio.paused))).toBe(true);
 await action(page,'pause').click();await action(page,'home').click();await page.locator('[data-action=open][data-game=traffic]').first().click();await expect(page.locator('#lesson-box')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('practice reviews and repeats stay silent and retain the selected timing snapshot',async({page})=>{
 await configure(path(),{visibleMs:650,intervalMs:1950});await instrument(page);await login(page);await page.locator('[data-action=open][data-game=traffic]').first().click();await action(page,'practice').click();await expect(page.locator('.game-preparation')).toBeVisible();await expect(page.locator('.play-panel')).toHaveAttribute('data-interval-ms','1950');await action(page,'begin-game').click();await advance(page,3000);
 for(let i=0;i<5;i++){await advance(page,1950);await expect(page.locator('.practice-review')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(1);await action(page,'continue-review').click();}
 await expect(page.locator('.result-card')).toBeVisible();await configure(path(),{visibleMs:1500,intervalMs:2500});await action(page,'repeat-practice').click();await expect(page.locator('.play-panel')).toHaveAttribute('data-interval-ms','1950');expect(await page.evaluate(()=>window.spoken.length)).toBe(1);
});

for(const succeeds of [true,false])test(`timing save across tabs preserves ${succeeds?'the accepted revision':'the unsuccessful draft'}`,async({page})=>{
 await login(page,true);await page.goto(`/#admin/user/${player.id}`);await page.locator('[data-action=user-tab][data-tab=difficulty]').click();await trafficSettings(page);
 const form=page.locator('#game-timing-hard-form'),original=Number(await form.getAttribute('data-revision'));await form.locator('[name=visibleMs]').fill('1.1');await form.locator('[name=intervalMs]').fill('2.1');
 let release,ready;const gate=new Promise(resolve=>release=resolve),pending=new Promise(resolve=>ready=resolve);
 await page.route(`**${path()}`,async route=>{
  if(route.request().method()!=='PATCH')return route.continue();const response=succeeds?await route.fetch():null;ready();await gate;
  if(response)await route.fulfill({response});else await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'ذخیره انجام نشد.'})});
 });
 try{
  await form.locator('button[type=submit]').click();await pending;await page.locator('[data-action=user-tab][data-tab=overview]').click();const done=page.waitForResponse(response=>response.url().endsWith(path())&&response.request().method()==='PATCH');release();await done;
  await page.locator('[data-action=user-tab][data-tab=difficulty]').click();await expect(form.locator('[name=visibleMs]')).toHaveValue('1.1');
  if(succeeds){await expect(form).toHaveAttribute('data-revision',String(original+1));await page.unroute(`**${path()}`);await form.locator('[name=visibleMs]').fill('1.2');await saveForm(page);}
  else{await expect(form).toHaveAttribute('data-revision',String(original));await page.locator('.admin-sidebar [data-action=admin-users]').click();await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=stay]').click();}
 }finally{release();}
});

test('manual guide pauses a countdown and changing sound never creates another automatic narration',async({page})=>{
 await instrument(page);await login(page);await page.locator('[data-action=open][data-game=traffic]').first().click();await expect(page.locator('#lesson-box')).toBeVisible();await action(page,'sound').click();await action(page,'sound').click();expect(await page.evaluate(()=>window.spoken.length)).toBe(1);
 await action(page,'main-game').click();await action(page,'begin-game').click();await advance(page,1000);await expect(page.locator('#countdown-number')).toHaveText('۲');await page.locator('.play-heading-actions [data-action=listen-guide]').click();await expect(page.locator('#modal')).toBeVisible();await advance(page,60000);await expect(page.locator('#countdown-number')).toHaveText('۲');await action(page,'resume').click();await advance(page,2000);await expect(page.locator('.stimulus-shell')).toBeVisible();expect(await page.evaluate(()=>window.spoken.length)).toBe(2);
});
