import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceSearch=ms=>{now+=ms;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceSearch(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setupMain(page,level,options={}){
 const {csrfToken}=await(await page.request.get('/api/auth/session')).json();
 const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId:'search',kind:'baseline',...options}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  expect((await admin.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'search',...options,level,mode:'fixed'}})).ok()).toBe(true);
 }finally{await admin.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function start(page,practice=false,{material='shapes',layout='grid',targetCount=1}={}){
 await page.locator('[data-action=open][data-game=search]').first().click();
 for(const selector of [`[data-action=material][data-material="${material}"]`,`[data-action=search-layout][data-layout="${layout}"]`,`[data-action=search-mode][data-mode="${targetCount===2?'dual':'single'}"]`]){
  const option=page.locator(selector);if(await option.getAttribute('aria-pressed')!=='true'){await option.click();await expect(option).toHaveAttribute('aria-pressed','true');}
 }
 await click(page,practice?'practice':'main-game');await expect(page.locator('.search-preparation')).toBeVisible();
}
async function begin(page){await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.clue-preview')).toBeVisible();}
const samples=page=>page.locator('.preview-target .symbol').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
const choiceIndex=(page,target)=>page.locator('.search-choice').evaluateAll((nodes,target)=>nodes.find(node=>node.querySelector('.symbol').outerHTML===target).dataset.index,target);
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}

test('search: five illustrated practice rounds keep the full sample time and freeze review',async({page})=>{
 await clock(page);await login(page);await page.setViewportSize({width:1440,height:1200});await start(page,true);
 await page.screenshot({path:'.local/verification/search_preparation.png',fullPage:true,animations:'disabled'});await begin(page);
 for(let round=0;round<5;round++){
  const [target]=await samples(page);await advance(page,1999);await expect(page.locator('.preview-target')).toHaveCount(1);await expect(page.locator('.search-choice')).toHaveCount(0);await advance(page,1);await expect(page.locator('.preview-target')).toHaveCount(0);
  if(round===0){const wrong=await page.locator('.search-choice').evaluateAll((nodes,target)=>nodes.find(node=>node.querySelector('.symbol').outerHTML!==target).dataset.index,target);await page.locator(`.search-choice[data-index="${wrong}"]`).click();await expect(page.locator('.search-choice.rejected')).toHaveCount(1);}
  const index=await choiceIndex(page,target);await page.locator(`.search-choice[data-index="${index}"]`).click();await expect(page.locator(`.practice-review.${round===0?'retry':'good'}`)).toBeVisible();
  if(round===0){await expect(page.locator('.flying-equipment')).toHaveCount(1);await click(page,'continue-review');await expect(page.locator('.flying-equipment')).toHaveCount(0);continue;}
  const frozen=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(frozen);await click(page,'continue-review');
 }
 await expect(page.locator('.result-card')).toBeVisible();if(await page.locator('.local-note').count())await expect(page.locator('.local-note')).toContainText('ذخیره شد');
});

test('search: ten hard dual rounds hide samples, keep every choice reachable, and record every discovery',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);const options={targetCount:2,layout:'scattered',material:'shapes'};await setupMain(page,'hard',options);await start(page,false,options);await begin(page);
 for(let round=0;round<10;round++){
  const targets=await samples(page);expect(targets).toHaveLength(2);
  if(round===0){
   await page.setViewportSize({width:1440,height:1450});await page.screenshot({path:'.local/verification/search_memory_desktop.png',fullPage:true,animations:'disabled'});
   await advance(page,800);const arc=await page.locator('.search-clock-arc').getAttribute('stroke-dashoffset');expect(Number(arc)).toBe(40);await click(page,'pause');await advance(page,20000);expect(await page.locator('.search-clock-arc').getAttribute('stroke-dashoffset')).toBe(arc);await click(page,'resume');await advance(page,1199);await expect(page.locator('.search-preview')).toBeVisible();await advance(page,1);
   for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const blocked=await page.locator('.search-choice').evaluateAll(nodes=>nodes.filter(node=>{node.scrollIntoView({block:'center',behavior:'instant'});const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.search-choice')!==node;}).map(node=>node.dataset.index));expect(blocked,`unreachable at ${width}`).toEqual([]);await expect(page.locator('.play-hud')).toBeInViewport();await expect(page.locator('.search-board-meta')).toBeInViewport();await page.evaluate(()=>scrollTo(0,0));
   }
   await page.setViewportSize({width:1440,height:1450});await page.screenshot({path:'.local/verification/search_workshop_desktop.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/search_workshop_mobile.png',animations:'disabled'});
  }else await advance(page,2000);
  await expect(page.locator('.preview-target')).toHaveCount(0);await expect(page.locator('.target-status .symbol')).toHaveCount(0);await expect(page.locator('.search-choice')).toHaveCount(36);
  if(round===0){
   const wrong=await page.locator('.search-choice').evaluateAll((nodes,targets)=>nodes.find(node=>!targets.includes(node.querySelector('.symbol').outerHTML)).dataset.index,targets);await page.locator(`.search-choice[data-index="${wrong}"]`).focus();await page.keyboard.press('Space');await expect(page.locator('.search-choice.rejected>.icon')).toHaveCount(1);await expect(page.locator('.search-choice:focus:not(:disabled)')).toHaveCount(1);
  }
  const first=await choiceIndex(page,targets[0]);await page.locator(`.search-choice[data-index="${first}"]`).click();await expect(page.locator('.target-status.discovered')).toHaveCount(1);await expect(page.locator('.target-status:not(.discovered) .symbol')).toHaveCount(0);await expect(page.locator('.flying-equipment')).toHaveCount(1);
  if(round===0){await advance(page,200);await click(page,'pause');const pose=await page.locator('.flying-equipment').getAttribute('style');await advance(page,20000);expect(await page.locator('.flying-equipment').getAttribute('style')).toBe(pose);await click(page,'resume');await advance(page,550);}else await advance(page,750);
  await expect(page.locator('.flying-equipment')).toHaveCount(0);const second=await choiceIndex(page,targets[1]);await page.locator(`.search-choice[data-index="${second}"]`).focus();await page.keyboard.press('Space');
  if(round<9){await expect(page.locator('.round-intermission')).toBeVisible();const frozen=await page.locator('#time').textContent();await advance(page,40000);await expect(page.locator('#time')).toHaveText(frozen);await click(page,'next-round');await expect(page.locator('.preview-target')).toHaveCount(2);}
 }
 await expect(page.locator('.result-main-score>b')).toHaveText('۲۰');await expect(page.locator('.search-result-stamp.discovered')).toHaveCount(10);await expect(page.locator('.local-note')).toContainText('ذخیره شد');await page.setViewportSize({width:1440,height:1450});await page.screenshot({path:'.local/verification/search_result.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('search: regular boards and complex letters work at all levels with reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);
 for(const [level,count,options] of [['easy',16,{targetCount:1,material:'shapes',layout:'grid'}],['medium',24,{targetCount:1,material:'shapes',layout:'grid'}],['hard',36,{targetCount:2,material:'letters',layout:'scattered'}]]){
  await setupMain(page,level,options);await start(page,false,options);await begin(page);const targets=await samples(page);await advance(page,2000);await expect(page.locator('.search-choice')).toHaveCount(count);await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');await page.setViewportSize({width:360,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(level==='hard'){await expect(page.locator('.search-choice .letter-mark')).not.toHaveCount(0);await page.screenshot({path:'.local/verification/search_letters_mobile.png',animations:'disabled'});}
  const first=await choiceIndex(page,targets[0]);await page.locator(`.search-choice[data-index="${first}"]`).focus();await page.keyboard.press('Space');await expect(page.locator('.play-effects')).toHaveCount(0);if(options.targetCount===2)await expect(page.locator('.target-status.discovered')).toHaveCount(1);else await expect(page.locator('.round-intermission')).toBeVisible();await leave(page);
 }
});
