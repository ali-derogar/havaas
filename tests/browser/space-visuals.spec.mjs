import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
const essentials=['oxygen','suit','fuel','helmet','food','map'];
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceSpace=ms=>{now+=ms;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceSpace(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setupMain(page,level){
 const {csrfToken}=await(await page.request.get('/api/auth/session')).json();
 const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId:'space',kind:'baseline'}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();
  auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  expect((await admin.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'space',level,mode:'fixed'}})).ok()).toBe(true);
 }finally{await admin.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function begin(page,practice=false){await page.locator('[data-action=open][data-game=space]').first().click();await click(page,practice?'practice':'main-game');await expect(page.locator('.space-preparation')).toBeVisible();await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.space-panorama')).toBeVisible();}
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}

test('space: teaching illustrates obstacle clearing, and all five practice reviews freeze time',async({page})=>{
 await clock(page);await login(page);await page.setViewportSize({width:1200,height:1400});
 await page.locator('[data-action=open][data-game=space]').first().click();await click(page,'practice');
 await expect(page.locator('.space-preparation-steps .space-rock')).toBeVisible();
 await expect(page.locator('.need-audio')).toHaveCount(3);
 await page.screenshot({path:'.local/verification/space_preparation.png',fullPage:true,animations:'disabled'});
 await click(page,'begin-game');await advance(page,3000);
 await expect(page.locator('.scene-object.blocked')).toHaveCount(1);
 await expect(page.locator('.collect-button')).toBeDisabled();await expect(page.locator('.wait-button')).toBeDisabled();
 await page.locator('.scene-object.blocked').click();await expect(page.locator('.practice-review')).toHaveCount(0);await expect(page.locator('#hits')).toHaveText('۰');
 for(let i=0;i<5;i++){
  const item=page.locator('.scene-object'),needed=essentials.includes(await item.getAttribute('data-equipment'));
  if(needed)await item.click();else await click(page,'reject-item');
  await expect(page.locator('.practice-review.good')).toBeVisible();
  const time=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(time);
  await click(page,'continue-review');
 }
 await expect(page.locator('.result-card')).toBeVisible();
});

test('space: the hard station is reachable, motion pauses, rocks clear, equipment packs and launch saves',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await clock(page);await login(page);await setupMain(page,'hard');await begin(page);
 await expect(page.locator('.scene-object')).toHaveCount(36);await expect(page.locator('.scene-object.blocked')).toHaveCount(4);await expect(page.locator('[data-action=depart]')).toBeDisabled();
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const blocked=await page.locator('.scene-object').evaluateAll(nodes=>nodes.filter(node=>{node.scrollIntoView({block:'center',behavior:'instant'});const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.scene-object')!==node;}).map(node=>node.dataset.index));
  expect(blocked,`unreachable objects at ${width}px`).toEqual([]);
  await expect(page.locator('.inventory')).toBeInViewport();await expect(page.locator('.play-hud')).toBeInViewport();await expect(page.locator('[data-action=depart]')).toBeInViewport();
  await page.evaluate(()=>scrollTo(0,0));
 }
 await page.setViewportSize({width:1440,height:1450});await page.screenshot({path:'.local/verification/space_station_desktop.png',fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/space_station_mobile.png',animations:'disabled'});
 await page.setViewportSize({width:1440,height:1450});
 const vehicle=page.locator('.scene-vehicle'),pose=await vehicle.getAttribute('style');await advance(page,650);expect(await vehicle.getAttribute('style')).not.toBe(pose);
 await click(page,'pause');const frozen=[await vehicle.getAttribute('style'),await page.locator('.play-panel').getAttribute('style')];await advance(page,20000);expect([await vehicle.getAttribute('style'),await page.locator('.play-panel').getAttribute('style')]).toEqual(frozen);await click(page,'resume');
 const wrong=await page.locator('.scene-object:not(.blocked)').evaluateAll((nodes,essential)=>nodes.find(node=>!essential.includes(node.dataset.equipment)).dataset.index,essentials);
 await page.locator(`.scene-object[data-index="${wrong}"]`).click();await expect(page.locator('.scene-object.rejected')).toHaveCount(1);await expect(page.locator('.play-panel')).toHaveAttribute('data-response','wrong');await advance(page,750);
 for(let i=0;i<4;i++){
  const rock=page.locator('.scene-object.blocked').first(),id=await rock.getAttribute('data-index');
  await rock.click();await expect(page.locator('.rock-burst')).toHaveCount(1);await expect(page.locator('#hits')).toHaveText('۰');await expect(page.locator(`.scene-object[data-index="${id}"]`)).not.toHaveClass(/blocked/);await advance(page,750);
 }
 for(const name of essentials){await page.locator(`.scene-object[data-equipment="${name}"]`).click();await expect(page.locator(`.inventory-slot.filled[data-equipment="${name}"]`)).toBeVisible();await expect(page.locator('.flying-equipment')).toHaveCount(1);await advance(page,750);await expect(page.locator('.flying-equipment')).toHaveCount(0);}
 await expect(page.locator('.mission-need.packed')).toHaveCount(6);await expect(page.locator('.space-charge .charged')).toHaveCount(6);await expect(page.locator('.space-world')).toHaveAttribute('data-ready','true');await expect(page.locator('[data-action=depart]')).toBeEnabled();
 await page.screenshot({path:'.local/verification/space_ready.png',fullPage:true,animations:'disabled'});await click(page,'depart');
 await expect(page.locator('.mission-outcome-art.space.departed')).toBeVisible();await expect(page.locator('.local-note')).toContainText('ذخیره شد');await page.screenshot({path:'.local/verification/space_launched.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('space: easy and medium keep keyboard selection, and reduced motion freezes the spacecraft',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);
 for(const [level,count] of [['easy',16],['medium',24]]){
  await setupMain(page,level);await begin(page);await expect(page.locator('.scene-object')).toHaveCount(count);await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');
  const vehicle=page.locator('.scene-vehicle'),pose=await vehicle.getAttribute('style'),atmosphere=await page.locator('.play-panel').getAttribute('style');await advance(page,500);expect(await vehicle.getAttribute('style')).toBe(pose);expect(await page.locator('.play-panel').getAttribute('style')).toBe(atmosphere);
  const rock=page.locator('.scene-object.blocked').first();await rock.focus();const id=await rock.getAttribute('data-index');await page.keyboard.press('Space');await expect(page.locator(`.scene-object[data-index="${id}"]`)).not.toHaveClass(/blocked/);await expect(page.locator('.play-effects')).toHaveCount(0);
  const oxygen=page.locator('.scene-object[data-equipment=oxygen]');if(await oxygen.count()){await oxygen.focus();await page.keyboard.press('Space');await expect(page.locator('.inventory-slot.filled')).toHaveCount(1);}
  await page.setViewportSize({width:360,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await leave(page);
 }
});
