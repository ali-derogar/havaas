import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {trialMs} from '../helpers/browser-timing.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
const advance=(page,ms)=>page.evaluate(ms=>window.advanceSessionLanguage(ms),ms);
async function player(page,locale='en'){
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();
  auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  const link=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'Session language regression'}})).json();
  const guest=await(await page.request.get('/api/auth/session')).json();
  const registered=await page.request.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':guest.csrfToken},data:{
   token:link.url.split('/').at(-1),username:`session-lang-${randomUUID().slice(0,12)}`,password:seed.password,
   profile:{firstName:'آزمون',lastName:'زبان جلسه',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'},
  }});
  expect(registered.status()).toBe(201);
 }finally{await admin.dispose();}
 await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map();performance.now=()=>now;
  requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};cancelAnimationFrame=id=>frames.delete(id);
  window.advanceSessionLanguage=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));};
 });
 await page.goto(`/?lang=${locale}`);await expect(page.locator('.hero')).toBeVisible();
}
async function begin(page){await expect(page.locator('.game-preparation')).toBeVisible();await action(page,'begin-game').click();await advance(page,3000);}
async function practice(page,gameId){await page.locator(`[data-action=open][data-game=${gameId}]`).click();await action(page,'practice').click();await begin(page);}
async function finishPractice(page){
 const interval=await trialMs(page);
 for(let i=0;i<5;i++){
  if(await action(page,'acknowledge').count())await action(page,'acknowledge').click();
  await advance(page,interval);await expect(page.locator('.practice-review')).toBeVisible();await action(page,'continue-review').click();
 }
 await expect(page.locator('.result-card')).toBeVisible();
}

test('a queued language change can be cancelled before leaving a paused game',async({page})=>{
 await player(page);await practice(page,'traffic');await action(page,'pause').click();
 await page.locator('#modal [data-locale-select]').selectOption('fa');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('#modal [data-locale-select]')).toHaveValue('fa');
 await action(page,'resume').click();await action(page,'pause').click();await expect(page.locator('#modal [data-locale-select]')).toHaveValue('fa');
 await page.locator('#modal [data-locale-select]').selectOption('en');await action(page,'home').click();
 await expect(page.locator('.hero')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','en',{timeout:1500});
 expect(await page.evaluate(()=>localStorage.getItem('havaas:locale:v1'))).toBe('en');
 expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
});

test('a repeated Stroop practice uses the newly selected language for its words',async({page})=>{
 await player(page);await practice(page,'stroop');const interval=await trialMs(page);
 await finishPractice(page);await expect(page.locator('.local-note')).toContainText('saved');
 await page.locator('[data-locale-select]').selectOption('fa');await expect(page.locator('.result-card h1')).toContainText('ارزیابی');
 await action(page,'repeat-practice').click();await begin(page);expect(await trialMs(page)).toBe(interval);
 for(let i=0;i<2;i++){await advance(page,interval);await action(page,'continue-review').click();}
 await action(page,'acknowledge').click();
 await expect(page.locator('.stimulus-shell .word-stimulus')).toHaveText(/^[\u0600-\u06ff]+$/,{timeout:1500});
 await expect(page.locator('html')).toHaveAttribute('lang','fa');
});

test('changing language after a failed save preserves retry and the original result language',async({page})=>{
 await player(page,'fa');await practice(page,'traffic');
 await page.route('**/api/children/*/sessions/*/complete',route=>route.abort('failed'));
 await finishPractice(page);await expect(action(page,'retry-save')).toBeVisible();
 await page.locator('[data-locale-select]').selectOption('en');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(action(page,'retry-save')).toBeVisible({timeout:1500});
 await page.unroute('**/api/children/*/sessions/*/complete');
 const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
 await action(page,'retry-save').click();const response=await saved;expect(response.ok()).toBe(true);
 expect((await response.json()).record.result.locale).toBe('fa');await expect(page.locator('.local-note')).toContainText('saved');
 await expect(action(page,'main-game')).toBeEnabled();
});
