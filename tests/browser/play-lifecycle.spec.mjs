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
  const run=await(await guest.post(`/api/children/${childId}/sessions`,{headers,data:{gameId:'traffic',kind:'baseline'}})).json();expect((await guest.post(`/api/children/${childId}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 }finally{await admin.dispose();await guest.dispose();}
});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
async function advance(page,ms){await page.evaluate(ms=>window.advanceGame(ms),ms);}
async function start(page,{practice=false,begin=true}={}){
 await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceGame=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});
 await page.goto('/');await page.locator('#login-form [name=identifier]').fill(player.username);await page.locator('#login-form [name=password]').fill(password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
 await page.locator('[data-action=open][data-game=traffic]').first().click();await action(page,practice?'practice':'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();
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
 await advance(page,900);await expect(action(page,'respond')).toBeEnabled();await expect(action(page,'respond')).toBeFocused();
 await page.keyboard.down('Enter');await expect(action(page,'respond')).toBeEnabled();await page.keyboard.up('Enter');
 // A new key press still answers normally.
 await page.keyboard.press('Enter');await expect(action(page,'respond')).toBeDisabled();
});

test('holding Enter cannot skip the practice review when the arena restores keyboard focus',async({page})=>{
 await start(page,{practice:true});await advance(page,100);await action(page,'respond').focus();await page.keyboard.down('Enter');await advance(page,900);
 await expect(page.locator('.practice-review')).toBeVisible();await expect(action(page,'continue-review')).toBeFocused();
 await page.keyboard.down('Enter');await expect(page.locator('.practice-review')).toBeVisible();await page.keyboard.up('Enter');
 await page.keyboard.press('Enter');await expect(page.locator('.practice-review')).toHaveCount(0);await expect(page.locator('#position')).toHaveText('۲ از ۵');
});
