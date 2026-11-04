import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceMemory=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceMemory(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setup(page,level,material){
 const options={gameId:'nback',material},base=await(await page.request.get('/api/auth/session')).json();
 const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':base.csrfToken},data:{...options,kind:'baseline'}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':base.csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const api=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{let auth=await(await api.get('/api/auth/session')).json();auth=await(await api.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();expect((await api.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{...options,level,mode:'fixed'}})).ok()).toBe(true);}finally{await api.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function open(page,material){await page.locator('[data-action=open][data-game=nback]').first().click();const option=page.locator(`[data-action=material][data-material="${material}"]`);if(await option.getAttribute('aria-pressed')!=='true')await option.click();}
async function start(page,practice){await click(page,practice?'practice':'main-game');await expect(page.locator('.memory-preparation')).toBeVisible();}
async function begin(page){await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.memory-stage')).toBeVisible();}
const current=page=>page.locator('.stimulus-shell .symbol').evaluate(node=>node.outerHTML);
async function warmup(page,n,visibleMs){
 const seen=[];
 for(let i=0;i<n;i++){
  await expect(page.locator('.memory-stage')).toHaveAttribute('data-memory-phase','remember');await expect(page.locator('.response-button')).toBeDisabled();await expect(page.locator('.memory-stimulus')).toBeDisabled();
  seen.push(await current(page));await advance(page,visibleMs-1);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await advance(page,1000-visibleMs);
 }
 await expect(page.locator('.memory-stage')).toHaveAttribute('data-memory-phase','compare');return seen;
}
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}

test('memory: all three distances and materials teach a sequence, hide old stimuli, and review five decisions',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);
 for(const [level,n,visibleMs,material] of [['easy',1,300,'shapes'],['medium',2,200,'numbers'],['hard',3,100,'toys']]){
  await setup(page,level,material);await open(page,material);
  const lesson=page.locator('#lesson-box');await expect(lesson.locator('.lesson-token')).toHaveCount(1);await expect(lesson.locator('[data-action=lesson-answer]')).toHaveCount(0);
  for(let i=0;i<n;i++)await click(page,'lesson-memory-next');
  await expect(lesson.locator('.lesson-token')).toHaveCount(1);await expect(lesson.locator('.reference')).toHaveCount(0);await lesson.locator('[data-action=lesson-answer][data-response=true]').click();await expect(lesson.locator('.lesson-feedback.good')).toBeVisible();await expect(lesson.locator('.lesson-token')).toHaveCount(n+1);
  await start(page,true);if(n===3){await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:'.local/verification/nback_preparation.png',fullPage:true,animations:'disabled'});}await begin(page);
  const seen=await warmup(page,n,visibleMs);let wrong=false;
  for(let trial=0;trial<5;trial++){
   const shape=await current(page),match=shape===seen.at(-n);await expect(page.locator('.memory-stage .symbol')).toHaveCount(1);await expect(page.locator('.memory-stage .reference,.memory-stage [data-target],.memory-status .symbol')).toHaveCount(0);
   const mistake=!match&&!wrong;if(mistake)wrong=true;await advance(page,50);if(match||mistake)await click(page,'respond');await advance(page,950);
   await expect(page.locator(`.practice-review.${mistake?'retry':'good'}`)).toBeVisible();await expect(page.locator('.memory-example .memory-token')).toHaveCount(n+1);
   expect(await page.locator('.memory-example .reference .symbol').evaluate(node=>node.outerHTML)).toBe(seen.at(-n));expect(await page.locator('.memory-example .current .symbol').evaluate(node=>node.outerHTML)).toBe(shape);
   const frozen=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(frozen);
   if(n===3&&trial===0){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/nback_review_mobile.png',fullPage:true,animations:'disabled'});}
   seen.push(shape);await click(page,'continue-review');
  }
  await expect(page.locator('.result-card')).toBeVisible();if(await page.locator('.local-note').count())await expect(page.locator('.local-note')).toContainText('ذخیره شد');await click(page,'home');
 }
 expect(errors).toEqual([]);
});

test('memory: 150 scored trials preserve exposure, late keyboard responses, pause, mistakes and a saved album',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);await setup(page,'hard','numbers');await open(page,'numbers');await start(page,false);await begin(page);
 const seen=await warmup(page,3,100);let omitted=false,falseAlarm=false,hits=0,correctRejections=0;
 for(let trial=0;trial<150;trial++){
  const shape=await current(page),match=shape===seen.at(-3);await expect(page.locator('.memory-stage .symbol')).toHaveCount(1);await expect(page.locator('.memory-stage .reference,.memory-status .symbol')).toHaveCount(0);
  if(trial===0){
   await advance(page,40);const arc=await page.locator('.memory-interval-arc').getAttribute('stroke-dashoffset');await click(page,'pause');await advance(page,20000);expect(await page.locator('.memory-interval-arc').getAttribute('stroke-dashoffset')).toBe(arc);await click(page,'resume');expect(await current(page)).toBe(shape);await expect(page.locator('.response-button')).toBeFocused();expect(await page.locator('.memory-interval-arc').getAttribute('stroke-dashoffset')).toBe('0');
   for(const [width,height] of [[360,640],[390,844],[768,900],[1440,1000],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const selector of ['.focus-corners','.response-button','[data-action=pause]']){
     const node=page.locator(selector);await expect(node).toBeInViewport();const rect=await node.boundingBox();expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(height);
     expect(await node.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
    }
    expect(await page.locator('.memory-stage .symbol').evaluate(node=>({transform:getComputedStyle(node).transform,opacity:getComputedStyle(node).opacity,animation:getComputedStyle(node).animationName}))).toEqual({transform:'none',opacity:'1',animation:'none'});
    if(width===390||width===1440||width===844)await page.screenshot({path:`.local/verification/nback_station_${width}.png`,fullPage:width===1440,animations:'disabled'});
   }
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  }
  await advance(page,99);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await expect(page.locator('.response-button')).toBeEnabled();
  const omit=match&&!omitted;if(omit)omitted=true;const falseResponse=!match&&!falseAlarm;if(falseResponse)falseAlarm=true;
  await advance(page,50);
  if(match&&!omit||falseResponse){await page.locator('.response-button').focus();await page.keyboard.press('Space');await expect(page.locator('.response-button')).toBeDisabled();await page.keyboard.press('Space');if(match)hits++;}else if(!match)correctRejections++;
  seen.push(shape);await advance(page,850);if(trial<149)await expect(page.locator('.play-effects')).toHaveCount(0);
 }
 expect(hits).toBe(29);expect(correctRejections).toBe(119);await expect(page.locator('.result-main-score>b')).toHaveText('۲۸');await expect(page.locator('.memory-result-tile')).toHaveCount(15);
 expect(await page.locator('.memory-result-tile').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.dataset.correct),0))).toBe(148);await expect(page.locator('.local-note')).toContainText('ذخیره شد');await page.setViewportSize({width:1440,height:1400});await page.screenshot({path:'.local/verification/nback_result.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('memory: reduced motion keeps toys immediate and the response works while the stimulus is hidden',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);await setup(page,'medium','toys');await open(page,'toys');await start(page,false);await begin(page);const seen=await warmup(page,2,200);await page.setViewportSize({width:360,height:740});
 for(let trial=0;trial<150;trial++){
  const shape=await current(page),match=shape===seen.at(-2);await advance(page,200);await expect(page.locator('.stimulus-shell')).toBeHidden();
  if(match){await page.locator('.response-button').focus();await page.keyboard.press('Space');await expect(page.locator('.play-panel')).toHaveAttribute('data-response','good');await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');await expect(page.locator('.play-effects')).toHaveCount(0);await expect(page.locator('.response-button')).toBeInViewport();break;}
  seen.push(shape);await advance(page,800);
 }
 await leave(page);
});
