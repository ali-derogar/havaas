import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceTraffic=ms=>{now+=ms;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceTraffic(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setupMain(page,level,trafficMode='circles'){
 const {csrfToken}=await(await page.request.get('/api/auth/session')).json();
 const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId:'traffic',kind:'baseline',trafficMode}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  expect((await admin.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'traffic',trafficMode,level,mode:'fixed'}})).ok()).toBe(true);
 }finally{await admin.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function start(page,practice=false,mode='circles'){
 await page.locator('[data-action=open][data-game=traffic]').first().click();
 const option=page.locator(`[data-action=traffic-mode][data-mode="${mode}"]`);
 if(await option.getAttribute('aria-pressed')!=='true'){await option.click();await expect(option).toHaveAttribute('aria-pressed','true');}
 await click(page,practice?'practice':'main-game');await expect(page.locator('.traffic-preparation')).toBeVisible();
}
async function begin(page){await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.traffic-world')).toBeVisible();}
const isGo=async page=>(await page.locator('.traffic-live-signal').getAttribute('data-lamp'))==='green';
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}

test('traffic: five lessons teach go and wait, reach the park and freeze reviews',async({page})=>{
 await clock(page);await login(page);await page.setViewportSize({width:1440,height:1050});await start(page,true);
 await page.screenshot({path:'.local/verification/traffic_preparation.png',fullPage:true,animations:'disabled'});await begin(page);
 let shot=false,arrived=false,previous=0;
 for(let trial=0;trial<5;trial++){
  const go=await isGo(page);
  if(go&&!shot){await page.screenshot({path:'.local/verification/traffic_town_desktop.png',fullPage:true,animations:'disabled'});shot=true;}
  await advance(page,100);if(go)await click(page,'respond');
  await advance(page,450);const progress=Number(await page.locator('.traffic-road').getAttribute('data-visual-progress'));expect(progress).toBeGreaterThanOrEqual(previous);previous=progress;
  if(progress===1){arrived=true;await expect(page.locator('.road-destination')).toHaveClass(/arrived/);await page.screenshot({path:'.local/verification/traffic_park_arrived.png',fullPage:true,animations:'disabled'});}
  await advance(page,450);await expect(page.locator('.practice-review.good')).toBeVisible();const time=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(time);await click(page,'continue-review');
 }
 expect(arrived).toBe(true);await expect(page.locator('.result-card')).toBeVisible();if(await page.locator('.local-note').count())await expect(page.locator('.local-note')).toContainText('ذخیره شد');
});

test('traffic: all 150 trials keep exact exposure, reject red and carry the car through the finish',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);await setupMain(page,'hard');await start(page);await begin(page);
 for(const [width,height] of [[360,740],[390,844],[768,900],[1440,1000]]){
  await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.traffic-signal-case')).toBeInViewport();await expect(page.locator('.response-button')).toBeInViewport();
  const button=await page.locator('.response-button').boundingBox();expect(button.y).toBeGreaterThanOrEqual(0);expect(button.y+button.height).toBeLessThanOrEqual(height);
 }
 await page.setViewportSize({width:390,height:844});let wrong=false,goCount=0,previous=0,mobile=false;
 for(let trial=0;trial<150;trial++){
  const go=await isGo(page);if(go&&!mobile)await page.screenshot({path:'.local/verification/traffic_town_mobile.png',animations:'disabled'});await advance(page,99);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();
  expect(await page.locator('.stimulus-shell').evaluate(node=>getComputedStyle(node).transitionDuration)).toBe('0s');
  if(go){
   goCount++;await page.keyboard.press('Space');
   if(!mobile){await advance(page,140);const road=page.locator('.traffic-road'),frozen=await road.getAttribute('style'),visual=await road.getAttribute('data-visual-progress');await click(page,'pause');await advance(page,20000);expect(await road.getAttribute('style')).toBe(frozen);expect(await road.getAttribute('data-visual-progress')).toBe(visual);await click(page,'resume');await advance(page,310);mobile=true;}
   else await advance(page,450);
  }else{
   if(!wrong){await click(page,'respond');wrong=true;}
   await advance(page,450);
  }
  const progress=Number(await page.locator('.traffic-road').getAttribute('data-visual-progress'));expect(progress).toBeGreaterThanOrEqual(previous);previous=progress;
  if(goCount===30){
   expect(progress).toBe(1);const car=await page.locator('.road-car').boundingBox(),finish=await page.locator('.road-destination>path').first().boundingBox();expect(car.x+car.width).toBeGreaterThanOrEqual(finish.x+finish.width);
   await expect(page.locator('.road-destination')).toHaveClass(/arrived/);
  }
  await advance(page,450);
 }
 expect(goCount).toBe(30);expect(wrong).toBe(true);await expect(page.locator('.traffic-outcome.arrived')).toBeVisible();await expect(page.locator('.result-main-score>b')).toHaveText('۲۹');await expect(page.locator('.local-note')).toContainText('ذخیره شد');await page.setViewportSize({width:1440,height:1350});await page.screenshot({path:'.local/verification/traffic_result.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('traffic: signs keep all three exposure times and reduced motion gives immediate forward feedback',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);
 for(const [level,visibleMs] of [['easy',300],['medium',200],['hard',100]]){
  await setupMain(page,level,'signs');await start(page,false,'signs');await expect(page.locator('.traffic-preparation h2')).toContainText('فلش آبی');await begin(page);await expect(page.locator('.traffic-signal')).toHaveClass(/sign-mode/);
  await advance(page,visibleMs-1);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await advance(page,1000-visibleMs);
  while(!await isGo(page))await advance(page,1000);
  await advance(page,50);await click(page,'respond');const road=page.locator('.traffic-road');expect(Number(await road.getAttribute('data-visual-progress'))).toBe(Number(await road.getAttribute('data-progress')));expect(Number(await road.getAttribute('data-progress'))).toBeGreaterThan(0);
  await expect(page.locator('.play-effects')).toHaveCount(0);if(level==='hard'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/traffic_signs_mobile.png',animations:'disabled'});}await leave(page);
 }
});
