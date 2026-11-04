import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceGame=ms=>{now+=ms;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};});}
async function advance(page,ms){await page.evaluate(ms=>window.advanceGame(ms),ms);}
async function click(page,action,selector=''){await page.locator(`[data-action="${action}"]${selector}:visible`).first().click();}
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function baseline(page,gameId){const {csrfToken}=await(await page.request.get('/api/auth/session')).json();const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId,kind:'baseline'}})).json();expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);}
async function begin(page,game,practice=true){await click(page,'open',`[data-game="${game}"]`);await click(page,practice?'practice':'main-game');await expect(page.locator('.game-preparation')).toBeVisible();await click(page,'begin-game');await advance(page,3000);}

test('motion: fish tails and animal flight articulate while pause holds the exact pose',async({page})=>{
 await clock(page);await login(page);await click(page,'open','[data-game="hunt"]');await click(page,'theme','[data-theme="fish"]');await click(page,'practice');await click(page,'begin-game');await advance(page,3000);
 await expect(page.locator('.animal-tail')).toHaveCount(5); // Four swimmers and the fixed target sample.
 const swimmer=page.locator('.hunt-choice').first(),initial=await swimmer.getAttribute('style');await advance(page,120);expect(await swimmer.getAttribute('style')).not.toBe(initial);
 await click(page,'pause');const frozen=await swimmer.getAttribute('style');await advance(page,10000);expect(await swimmer.getAttribute('style')).toBe(frozen);
 await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','paused');
 expect(await page.locator('.pond-bubbles>i').first().evaluate(node=>getComputedStyle(node).animationPlayState)).toBe('paused');
 await click(page,'resume');expect(await swimmer.getAttribute('style')).toBe(frozen);
 await page.emulateMedia({reducedMotion:'reduce'});await advance(page,0);expect(await swimmer.evaluate(node=>node.style.getPropertyValue('--tail-angle'))).toBe('0deg');
 await expect(page.locator('.response-button')).toBeEnabled();
});

test('motion: a collected object flies into its own bag slot and all effects freeze and clean up',async({page})=>{
 await page.setViewportSize({width:1280,height:1050});await clock(page);await login(page);await baseline(page,'ark');await page.reload();await expect(page.locator('.hero')).toBeVisible();await begin(page,'ark',false);
 await page.locator('.scene-object[aria-label="آب آشامیدنی"]').click();await expect(page.locator('.flying-equipment')).toHaveCount(1);
 await advance(page,200);const flight=page.locator('.flying-equipment'),midway=await flight.getAttribute('style');
 await page.screenshot({path:'.local/verification/motion-collecting.png'});
 await click(page,'pause');await advance(page,15000);expect(await flight.getAttribute('style')).toBe(midway);await click(page,'resume');expect(await flight.getAttribute('style')).toBe(midway);
 await advance(page,520);await expect(flight).toHaveCount(0);await expect(page.locator('.inventory-slot[data-equipment=water]')).toHaveClass(/filled.*just-packed/);
 await page.locator('.scene-object[aria-label="خوراک"]').click();await expect(page.locator('.play-effects')).toHaveCount(1);await click(page,'pause');await click(page,'home');await expect(page.locator('.play-effects')).toHaveCount(0);
});

test('motion: the car eases forward with turning wheels and never retreats across a pause',async({page})=>{
 await clock(page);await login(page);await begin(page,'traffic');
 for(let trial=0;trial<5;trial++){
  const green=await page.locator('.stimulus-shell').evaluate(node=>node.innerHTML.includes('#0ba867'));
  if(green)break;await advance(page,1000);await click(page,'continue-review');
 }
 await advance(page,100);await click(page,'respond');const road=page.locator('.traffic-road'),target=Number(await road.getAttribute('data-progress'));
 expect(target).toBeGreaterThan(0);expect(Number(await road.getAttribute('data-visual-progress'))).toBeLessThan(target);
 await advance(page,140);const value=Number(await road.getAttribute('data-visual-progress'));expect(value).toBeGreaterThan(0);expect(value).toBeLessThan(target);
 const wheel=await page.locator('.car-wheel').first().getAttribute('transform');expect(wheel).not.toContain('rotate(0 ');
 await click(page,'pause');await advance(page,10000);expect(Number(await road.getAttribute('data-visual-progress'))).toBe(value);await click(page,'resume');
 await advance(page,300);expect(Number(await road.getAttribute('data-visual-progress'))).toBe(target);
});

test('motion: reduced motion keeps immediate selection feedback and full-size memory stimuli',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);await baseline(page,'space');await page.reload();await expect(page.locator('.hero')).toBeVisible();await begin(page,'space',false);
 await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');const ship=page.locator('.scene-vehicle');await advance(page,500);expect(await ship.evaluate(node=>node.style.transform)).toBe('none');
 await page.locator('.scene-object[aria-label="اکسیژن"],.scene-object[aria-label="لباس فضایی"],.scene-object[aria-label="سوخت"],.scene-object[aria-label="کلاه فضایی"],.scene-object[aria-label="خوراک"],.scene-object[aria-label="نقشهٔ فضایی"]').first().click();
 await expect(page.locator('.inventory-slot.filled')).toHaveCount(1);
 await expect(page.locator('.play-effects')).toHaveCount(0);
 await click(page,'pause');await click(page,'home');
 for(const game of ['nback','stroop']){
  await begin(page,game);const stimulus=page.locator('.stimulus-shell .symbol');
  expect(await stimulus.evaluate(node=>getComputedStyle(node).opacity)).toBe('1');expect(await stimulus.evaluate(node=>getComputedStyle(node).transform)).toBe('none');
  await click(page,'pause');await click(page,'home');
 }
});

test('motion: a real-time spacecraft mission collects equipment and launches with a recorded demonstration',async({page,browser})=>{
 await login(page);await baseline(page,'space');
 const context=await browser.newContext({storageState:await page.context().storageState(),viewport:{width:1200,height:1000},recordVideo:{dir:'.local/verification/motion-recording',size:{width:1200,height:1000}}});
 const demo=await context.newPage(),video=demo.video();let success=false;
 try{
  await demo.goto('/');await expect(demo.locator('.hero')).toBeVisible();await click(demo,'open','[data-game="space"]');await click(demo,'main-game');await click(demo,'begin-game');
  await expect(demo.locator('.play-panel')).toHaveAttribute('data-phase','playing');
  const ship=demo.locator('.scene-vehicle'),pose=await ship.getAttribute('style');await expect.poll(()=>ship.getAttribute('style')).not.toBe(pose);
  while(await demo.locator('.scene-object.blocked').count()){
   await demo.locator('.scene-object.blocked').first().click();await demo.waitForTimeout(420);
  }
  for(const name of ['اکسیژن','لباس فضایی','سوخت','کلاه فضایی','خوراک','نقشهٔ فضایی']){
   const item=demo.locator(`.scene-object[aria-label="${name}"]`);if(!await item.count())continue;
   await item.click();await expect(demo.locator('.flying-equipment')).toHaveCount(1);await expect(demo.locator('.flying-equipment')).toHaveCount(0);
  }
  await expect(demo.locator('[data-action=depart]')).toBeEnabled();await demo.screenshot({path:'.local/verification/motion-space-ready.png'});
  await click(demo,'depart');await expect(demo.locator('.mission-outcome-art.departed')).toBeVisible();await expect(demo.locator('.local-note')).toContainText('ذخیره شد');await demo.waitForTimeout(1800);
  success=true;
 }finally{await context.close();if(success)await video.saveAs('.local/verification/space-animations.webm');}
});
