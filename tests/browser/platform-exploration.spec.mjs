import {test,expect,request} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';

let seed,explorer,explorerChild;
const output='.local/verification/exploration';
test.beforeAll(async()=>{
 seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));await mkdir(output,{recursive:true});
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'}),guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  const link=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'آزمون مستقل پوستهٔ اکتشاف'}})).json(),anon=await(await guest.get('/api/auth/session')).json();
  const created=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':anon.csrfToken},data:{token:link.url.split('/').at(-1),username:'explorer-'+randomUUID().slice(0,12),password:seed.password,profile:{firstName:'علی',lastName:'کاوشگر',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'مدرسهٔ آزمایشی'}}});expect(created.status()).toBe(201);
  explorer=(await created.json()).user;explorerChild=(await(await guest.get('/api/bootstrap')).json()).profiles[0].id;
 }finally{await admin.dispose();await guest.dispose();}
});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
async function login(page,key='explorer'){
 await page.goto('/');await page.locator('#login-form [name=identifier]').fill(key==='explorer'?explorer.username:seed.users[key].username);
 await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form [type=submit]').click();
 await expect(page.locator(key==='admin'?'.admin-stats':'.client-welcome')).toBeVisible();
}
async function shot(page,name,width){
 await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}, ${width}px`).toBe(true);
 const small=await page.locator('button:visible').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width<43.9||r.height<43.9;}).map(el=>el.dataset.action||el.textContent.trim()));
 expect(small,`touch targets in ${name}, ${width}px`).toEqual([]);
 await page.screenshot({path:`${output}/${name}-${width}.png`,fullPage:true,animations:'disabled'});
}

test('exploration pages remain readable at 320px and follow the motion preference live',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await login(page);
 await expect(page.locator('body')).toHaveAttribute('data-platform-theme','explorer');
 await expect(page.locator('.scene-compass')).toBeVisible();
 expect(await page.locator('.compass-needle').evaluate(el=>getComputedStyle(el).animationName)).toBe('platform-needle');
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await page.locator('.compass-needle').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 for(const width of [320,360,768,1440])await shot(page,'home',width);
 for(const name of ['assessment','dashboard','account','report-links']){
  await action(page,name).click();
  for(const width of [320,360,768,1440])await shot(page,name,width);
 }
 await action(page,'home').click();await page.setViewportSize({width:320,height:700});
 await page.locator('[data-action=filter][data-filter=memory]').click();await expect(page.locator('.game-card')).toHaveCount(2);
 const card=page.locator('.game-card').first();await card.focus();await expect(card).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.locator('.intro-layout')).toBeVisible();
 await expect(page.locator('body')).not.toHaveAttribute('data-platform-theme');
 expect(errors).toEqual([]);
});

test('a real saved assessment updates the island markers, map and PDF without changing the data',async({page})=>{
 await login(page);const {csrfToken}=await(await page.request.get('/api/auth/session')).json();
 const headers={'X-CSRF-Token':csrfToken},child=explorerChild;
 for(const gameId of ['hunt','ark','space']){
  const response=await page.request.post(`/api/children/${child}/sessions`,{headers,data:{clientExperienceVersion:4,gameId,kind:'baseline'}});expect(response.ok()).toBe(true);
  const run=await response.json();expect((await page.request.post(`/api/children/${child}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 }
 const trainingResponse=await page.request.post(`/api/children/${child}/sessions`,{headers,data:{gameId:'ark',kind:'training'}});expect(trainingResponse.ok()).toBe(true);
 const training=await trainingResponse.json();expect((await page.request.post(`/api/children/${child}/sessions/${training.id}/complete`,{headers,data:{result:playSession(training)}})).ok()).toBe(true);
 await page.reload();await expect(page.locator('.scene-waypoints>.visited')).toHaveCount(3);
 await action(page,'assessment').click();await expect(page.locator('.map-done')).toHaveCount(3);await expect(page.locator('.assessment-step.step-complete')).toHaveCount(3);
 await shot(page,'assessment-progress',1440);await shot(page,'assessment-progress',360);
 await action(page,'dashboard').click();await expect(page.locator('.report-metrics')).toBeVisible();
 await page.emulateMedia({media:'print'});await expect(page.locator('.platform-illustration')).toBeHidden();await expect(page.locator('.client-header')).toBeHidden();
 await page.pdf({path:`${output}/report.pdf`,format:'A4',printBackground:true});
});

test('new styling has zero pixel impact on the introduction, arena and result of all seven games',async({page})=>{
 test.setTimeout(240000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceGame=ms=>{now+=ms;const current=[...callbacks.values()];callbacks.clear();for(const fn of current)fn(now);};});
 await login(page);const {csrfToken}=await(await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken},child=explorerChild;
 const games=['hunt','ark','space','traffic','search','nback','stroop'];
 for(const gameId of games){
  const response=await page.request.post(`/api/children/${child}/sessions`,{headers,data:{clientExperienceVersion:4,gameId,kind:'baseline'}});expect(response.ok()).toBe(true);
  const run=await response.json();expect((await page.request.post(`/api/children/${child}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 }
 async function unchanged(game,stage){
  await expect(page.locator('body')).not.toHaveAttribute('data-platform-theme');
  await expect(page.locator('[data-reveal],.explorer-scene,.platform-illustration')).toHaveCount(0);
  for(const width of [360,1440]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
   const styled=await page.screenshot({animations:'disabled',fullPage:true});
   await page.locator('link[href="/src/platform-exploration.css"]').evaluate(el=>el.disabled=true);
   const original=await page.screenshot({animations:'disabled',fullPage:true});
   await page.locator('link[href="/src/platform-exploration.css"]').evaluate(el=>el.disabled=false);
   expect(styled.equals(original),`${game} ${stage} at ${width}px`).toBe(true);
  }
 }
 for(const game of games){
  await action(page,'home').click();await page.locator(`.game-card[data-game="${game}"]`).click();await expect(page.locator('.intro-layout')).toBeVisible();
  await unchanged(game,'introduction');await action(page,'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();await unchanged(game,'preparation');
  await action(page,'begin-game').click();await page.evaluate(()=>window.advanceGame(3000));await unchanged(game,'arena');
  if(['ark','space'].includes(game)){
   const required=game==='ark'?['آب آشامیدنی','خوراک','کمک‌های اولیه','جلیقهٔ نجات','چراغ‌قوه','قطب‌نما']:['اکسیژن','لباس فضایی','سوخت','کلاه فضایی','خوراک','نقشهٔ فضایی'];
   for(let i=0;i<30&&!await page.locator('.result-card').count();i++){
    const items=await page.locator('.scene-object:not(.collected):not(.rejected)').evaluateAll(els=>els.map(el=>({index:el.dataset.index,name:el.querySelector('span').textContent,blocked:el.classList.contains('blocked')})));
    const target=items.find(i=>i.blocked)||items.find(i=>required.includes(i.name));await page.evaluate(()=>window.advanceGame(100));
    if(target)await page.locator(`[data-action=item][data-index="${target.index}"]`).click();else await action(page,'depart').click();
   }
  }else if(game==='search'){
   for(let i=0;i<10;i++){
    const targets=await page.locator('.preview-target .symbol').evaluateAll(els=>els.map(el=>el.outerHTML));await page.evaluate(()=>window.advanceGame(2000));
    const indices=await page.locator('.search-choice').evaluateAll((els,targets)=>els.filter(el=>targets.includes(el.querySelector('.symbol').outerHTML)).map(el=>el.dataset.index),targets);
    for(const index of indices){await page.evaluate(()=>window.advanceGame(150));await page.locator(`[data-action=search-choice][data-index="${index}"]`).click();}
   }
  }else{
   await page.evaluate(()=>{for(let i=0;i<170&&document.body.dataset.screen==='play';i++){const interval=Number(document.querySelector('.play-panel').dataset.intervalMs);window.advanceGame(document.querySelector('.automatic-rule-notice')?3000:interval);}});
  }
  await expect(page.locator('.result-card')).toBeVisible();await expect(page.locator('.local-note')).toContainText('ذخیره شد');await unchanged(game,'result');
 }
});
