import {trialMs} from '../helpers/browser-timing.mjs';
import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';

let player,password;
test.beforeAll(async()=>{
 const seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));password=seed.password;
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'}),guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password}})).json();
  const issued=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'آزمون مستقل توقف و ورودی'}})).json(),session=await(await guest.get('/api/auth/session')).json();
  const response=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':session.csrfToken},data:{token:issued.url.split('/').at(-1),username:`lifecycle-${randomUUID().slice(0,12)}`,password,profile:{firstName:'آزمون',lastName:'ورودی',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'}}});expect(response.status()).toBe(201);
  player=(await response.json()).user;
  const own=await(await guest.get('/api/bootstrap')).json(),authSession=await(await guest.get('/api/auth/session')).json(),headers={'X-CSRF-Token':authSession.csrfToken},childId=own.profiles[0].id;
  for(const gameId of ['traffic','stroop']){const run=await(await guest.post(`/api/children/${childId}/sessions`,{headers,data:{gameId,kind:'baseline'}})).json();expect((await guest.post(`/api/children/${childId}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);}
 }finally{await admin.dispose();await guest.dispose();}
});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
async function advance(page,ms){await page.evaluate(ms=>window.advanceGame(ms),ms);}
async function start(page,{practice=false,begin=true,gameId='traffic'}={}){
 await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceGame=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});
 await page.goto('/');await page.locator('#login-form [name=identifier]').fill(player.username);await page.locator('#login-form [name=password]').fill(password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
 await page.locator(`[data-action=open][data-game="${gameId}"]`).first().click();await page.evaluate(()=>{window.guidanceBeforeStart=window.guideStarts?.length||0;});await action(page,practice?'practice':'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();
 if(begin){await action(page,'begin-game').click();await advance(page,3000);}
}

test('rotating during the countdown freezes the remaining preparation time until explicit resume',async({page})=>{
 await start(page,{begin:false});await action(page,'begin-game').click();await advance(page,1000);await expect(page.locator('#countdown-number')).toHaveText('۲');
 await page.evaluate(()=>dispatchEvent(new Event('orientationchange')));await expect(page.locator('#modal')).toBeVisible();
 await advance(page,60000);await expect(page.locator('#countdown-number')).toHaveText('۲');await expect(page.locator('#time')).toHaveText('۰۰:۰۰');
 await action(page,'resume').click();await advance(page,1999);await expect(page.locator('.game-countdown')).toBeVisible();await advance(page,1);
 await expect(page.locator('.stimulus-shell')).toBeVisible();await expect(page.locator('#position')).toHaveText('۱ از ۱۵۰');await expect(page.locator('#time')).toHaveText('۰۰:۰۰');
});

test('holding Enter records one response and cannot answer the next trial through keyboard repeat',async({page})=>{
 await start(page);await advance(page,100);await action(page,'respond').focus();await page.keyboard.down('Enter');await expect(action(page,'respond')).toBeDisabled();
 await advance(page,(await trialMs(page))-100);await expect(action(page,'respond')).toBeEnabled();await expect(action(page,'respond')).toBeFocused();
 await page.keyboard.down('Enter');await expect(action(page,'respond')).toBeEnabled();await page.keyboard.up('Enter');
 // A new key press still answers normally.
 await page.keyboard.press('Enter');await expect(action(page,'respond')).toBeDisabled();
});

test('holding Enter cannot skip the practice review when the arena restores keyboard focus',async({page})=>{
 await start(page,{practice:true});await advance(page,100);await action(page,'respond').focus();await page.keyboard.down('Enter');await advance(page,(await trialMs(page))-100);
 await expect(page.locator('.practice-review')).toBeVisible();await expect(action(page,'continue-review')).toBeFocused();
 await page.keyboard.down('Enter');await expect(page.locator('.practice-review')).toBeVisible();await page.keyboard.up('Enter');
 await page.keyboard.press('Enter');await expect(page.locator('.practice-review')).toHaveCount(0);await expect(page.locator('#position')).toHaveText('۲ از ۵');
});

test('compact main preparation stays silent; automatic rule notices freeze on rotation and hidden tabs',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('havaas:v1',JSON.stringify({version:1,games:{},sound:true}));
  window.guideStarts=[];const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){window.guideStarts.push(this);return play.call(this);};
 });
 await page.setViewportSize({width:390,height:844});await start(page,{gameId:'stroop',begin:false});
 await expect(page.locator('.compact-preparation')).toBeVisible();await expect(page.locator('.compact-preparation .companion-guide,.compact-preparation .rule-sample')).toHaveCount(0);
 expect(await page.evaluate(()=>window.guideStarts.length)).toBe(await page.evaluate(()=>window.guidanceBeforeStart));
 await page.screenshot({path:'.local/verification/change-request-main-ready.png'});
 await action(page,'listen-guide').click();await expect.poll(()=>page.evaluate(()=>window.guideStarts.length)).toBeGreaterThan(await page.evaluate(()=>window.guidanceBeforeStart));
 await action(page,'begin-game').click();expect(await page.evaluate(()=>window.guideStarts.every(audio=>audio.paused))).toBe(true);await advance(page,3000);
 const spoken=await page.evaluate(()=>window.guideStarts.length),interval=await trialMs(page);
 for(let i=0;i<40;i++){await advance(page,interval);await expect(page.locator('.practice-review')).toHaveCount(0);}
 await expect(page.locator('.automatic-rule-notice')).toBeVisible();await expect(page.locator('.rule-sample,[data-action=acknowledge],#arena [data-action=listen-guide]')).toHaveCount(0);
 for(const [width,height] of [[320,568],[800,360],[390,844]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  for(const selector of ['.automatic-rule-notice h2','.automatic-rule-notice>.stroop-rule-picture','#transition-seconds']){
   const bounds=await page.locator(selector).boundingBox();expect(bounds.y,`${selector} top at ${width}x${height}`).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height,`${selector} bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
  }
 }
 await page.screenshot({path:'.local/verification/change-request-rule-notice.png',animations:'disabled'});
 const active=await page.locator('#time').textContent();await page.keyboard.press('Space');await advance(page,1000);await expect(page.locator('#transition-seconds')).toHaveText('۲');
 await page.evaluate(()=>dispatchEvent(new Event('orientationchange')));await expect(page.locator('#modal')).toBeVisible();await advance(page,60000);await expect(page.locator('#transition-seconds')).toHaveText('۲');await action(page,'resume').click();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#modal')).toBeVisible();await advance(page,60000);
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));await action(page,'resume').click();await advance(page,1999);await expect(page.locator('.automatic-rule-notice')).toBeVisible();await advance(page,1);
 await expect(page.locator('.studio-stage')).toHaveAttribute('data-rule-phase','1');await expect(page.locator('#time')).toHaveText(active);await expect(page.locator('.stimulus-shell')).toBeVisible();expect(await page.evaluate(()=>window.guideStarts.length)).toBe(spoken);
});

test('slowly rendering a rule notice preserves three full seconds and excludes CPU work from active time',async({page})=>{
 await start(page,{gameId:'stroop'});const interval=await trialMs(page);
 for(let i=0;i<39;i++)await advance(page,interval);
 await page.evaluate(()=>{
  const now=performance.now,descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');let cost=0;
  performance.now=()=>now()+cost;
  Object.defineProperty(Element.prototype,'innerHTML',{...descriptor,set(value){if(typeof value==='string'&&value.includes('automatic-rule-notice'))cost+=5000;descriptor.set.call(this,value);}});
 });
 await advance(page,interval);await expect(page.locator('.automatic-rule-notice')).toBeVisible();
 const active=await page.locator('#time').textContent();await advance(page,0);await expect(page.locator('#transition-seconds')).toHaveText('۳');
 await page.screenshot({path:'.local/verification/bug-audit-stroop-notice.png',animations:'disabled'});
 await advance(page,2999);await expect(page.locator('.automatic-rule-notice')).toBeVisible();await expect(page.locator('#transition-seconds')).toHaveText('۱');await expect(page.locator('#time')).toHaveText(active);
 await advance(page,1);await expect(page.locator('.studio-stage')).toHaveAttribute('data-rule-phase','1');await expect(page.locator('.stimulus-shell')).toBeVisible();await expect(page.locator('#time')).toHaveText(active);
});
