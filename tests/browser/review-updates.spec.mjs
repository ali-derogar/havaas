import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceGame=ms=>{now+=ms;const current=[...callbacks.values()];callbacks.clear();for(const fn of current)fn(now);};});}
async function advance(page,ms){await page.evaluate(ms=>window.advanceGame(ms),ms);}
async function click(page,action,selector=''){await page.locator(`[data-action="${action}"]${selector}:visible`).first().click();}
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function start(page,game,practice=true){await click(page,'open',`[data-game="${game}"]`);await click(page,practice?'practice':'main-game');await expect(page.locator('.game-preparation')).toBeVisible();}
async function begin(page){await click(page,'begin-game');await advance(page,3000);}
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}
async function baseline(page,gameId){const {csrfToken}=await(await page.request.get('/api/auth/session')).json();const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId,kind:'baseline'}})).json();expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);}
async function policy(gameId,level){const api=await request.newContext({baseURL:'http://127.0.0.1:4181'});try{let auth=await(await api.get('/api/auth/session')).json();auth=await(await api.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();expect((await api.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId,level,mode:'fixed'}})).ok()).toBe(true);}finally{await api.dispose();}}

test('review: Persian audio really plays, stops before countdown, and traffic reaches its flag without retreating',async({page})=>{
 await clock(page);await login(page);
 await page.evaluate(()=>{const play=HTMLMediaElement.prototype.play;window.playedGuides=[];HTMLMediaElement.prototype.play=function(){window.playedGuides.push(this);return play.call(this);};});
 await start(page,'traffic');
 const clip=page.waitForResponse(r=>r.url().includes('/assets/audio/traffic.mp3')&&r.ok());await click(page,'listen-guide');await clip;
 await expect(page.locator('.guide-audio-button')).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>window.playedGuides[0]?.duration)).toBeGreaterThan(1);
 await page.screenshot({path:'.local/verification/review-spoken-guide.png',fullPage:true});
 await click(page,'begin-game');expect(await page.evaluate(()=>window.playedGuides.every(audio=>audio.paused))).toBe(true);await advance(page,3000);
 let previous=0,arrived=false;
 for(let i=0;i<5;i++){
  const green=await page.locator('.stimulus-shell').evaluate(el=>el.innerHTML.includes('#0ba867'));
  await advance(page,100);if(green)await click(page,'respond');
  const before=Number(await page.locator('.traffic-road').getAttribute('data-progress'));expect(before).toBeGreaterThanOrEqual(previous);previous=before;
  if(before===1){arrived=true;await expect(page.locator('.road-destination')).toHaveClass(/arrived/);await page.screenshot({path:'.local/verification/review-traffic-arrived.png',fullPage:true});}
  await advance(page,900);
  if(i<4){await click(page,'continue-review');expect(Number(await page.locator('.traffic-road').getAttribute('data-progress'))).toBeGreaterThanOrEqual(previous);}
 }
 expect(arrived).toBe(true);await click(page,'continue-review');await expect(page.locator('.local-note')).toContainText('ذخیره شد');
});

test('review: moving birds remain selectable and pause freezes their route',async({page})=>{
 await clock(page);await login(page);await click(page,'open','[data-game="hunt"]');await click(page,'theme','[data-theme="bird"]');await click(page,'practice');await expect(page.locator('.game-preparation')).toBeVisible();await begin(page);
 const positions=()=>page.locator('.hunt-choice').evaluateAll(nodes=>nodes.map(node=>node.style.left));
 const initial=await positions();await advance(page,500);const moved=await positions();expect(moved).not.toEqual(initial);
 await click(page,'pause');await advance(page,20000);expect(await positions()).toEqual(moved);await click(page,'resume');expect(await positions()).toEqual(moved);
 const target=await page.evaluate(()=>{const goals=[...document.querySelectorAll('.target-mini .symbol')].map(el=>el.outerHTML);return [...document.querySelectorAll('.hunt-choice')].findIndex(el=>goals.includes(el.querySelector('.symbol').outerHTML));});
 if(target>=0)await click(page,'stimulus-response',`[data-choice="${target}"]`);
 await page.screenshot({path:'.local/verification/review-moving-birds.png',fullPage:true});
 await page.setViewportSize({width:360,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.response-button')).toBeInViewport();
 await page.screenshot({path:'.local/verification/review-moving-birds-mobile.png',fullPage:true});
});

test('review: crowded mission fields keep every object reachable and the spacecraft moves on the active clock',async({page})=>{
 await clock(page);await login(page);await baseline(page,'ark');await baseline(page,'space');await policy('ark','hard');await policy('space','hard');await page.reload();await expect(page.locator('.hero')).toBeVisible();
 for(const gameId of ['ark','space']){
  await start(page,gameId,false);await begin(page);await expect(page.locator('.scene-object')).toHaveCount(36);await expect(page.locator('.scattered-objects')).toBeVisible();
  for(const width of [360,768,1440]){
   await page.setViewportSize({width,height:900});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const blocked=await page.locator('.scene-object').evaluateAll(nodes=>nodes.filter(node=>{
    node.scrollIntoView({block:'center',behavior:'instant'});const rect=node.getBoundingClientRect(),hit=document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2);return hit?.closest('.scene-object')!==node;
   }).map(node=>node.dataset.index));expect(blocked).toEqual([]);
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.local/verification/review-${gameId}-crowded-${width}.png`,fullPage:true});
  }
  if(gameId==='space'){
   const ship=page.locator('.adventure-scene.space .scene-vehicle'),before=await ship.getAttribute('style');await advance(page,1000);const after=await ship.getAttribute('style');expect(after).not.toEqual(before);
   await click(page,'pause');await advance(page,20000);expect(await ship.getAttribute('style')).toEqual(after);await click(page,'resume');
  }
  await leave(page);
 }
});
