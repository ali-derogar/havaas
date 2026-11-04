import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
const essentials=['water','food','medkit','vest','flashlight','compass'];
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceArk=ms=>{now+=ms;const pending=[...callbacks.values()];callbacks.clear();for(const fn of pending)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceArk(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setupMain(page,level){
  const {csrfToken}=await(await page.request.get('/api/auth/session')).json();
  const run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId:'ark',kind:'baseline'}})).json();
  expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
  const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
  try{
    let auth=await(await admin.get('/api/auth/session')).json();
    auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
    expect((await admin.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'ark',level,mode:'fixed'}})).ok()).toBe(true);
  }finally{await admin.dispose();}
  await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function begin(page,practice=false){await page.locator('[data-action=open][data-game=ark]').first().click();await click(page,practice?'practice':'main-game');await expect(page.locator('.ark-preparation')).toBeVisible();await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.ark-panorama')).toBeVisible();}
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}

test('ark: pictorial teaching and five practice decisions keep reviews untimed',async({page})=>{
  await clock(page);await login(page);await begin(page,true);
  for(let i=0;i<5;i++){
    const item=page.locator('.scene-object'),needed=essentials.includes(await item.getAttribute('data-equipment'));
    if(needed)await item.click();else await click(page,'reject-item');
    await expect(page.locator('.practice-review.good')).toBeVisible();
    const time=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(time);
    await click(page,'continue-review');
  }
  await expect(page.locator('.result-card')).toBeVisible();
});

test('ark: hard shore remains reachable on four screen sizes, pauses, packs and departs',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await clock(page);await login(page);await setupMain(page,'hard');await begin(page);
  await expect(page.locator('.scene-object')).toHaveCount(36);
  await expect(page.locator('[data-action=depart]')).toBeDisabled();
  for(const width of [360,390,768,1440]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const blocked=await page.locator('.scene-object').evaluateAll(nodes=>nodes.filter(node=>{
      node.scrollIntoView({block:'center',behavior:'instant'});const r=node.getBoundingClientRect();
      return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.scene-object')!==node;
    }).map(node=>node.dataset.index));
    expect(blocked,`objects blocked at ${width}px`).toEqual([]);
    await expect(page.locator('.inventory')).toBeInViewport();await expect(page.locator('.play-hud')).toBeInViewport();await expect(page.locator('[data-action=depart]')).toBeInViewport();
    await page.evaluate(()=>scrollTo(0,0));
  }
  await page.setViewportSize({width:1440,height:1400});await page.screenshot({path:'.local/verification/ark_shore_desktop.png',fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/ark_shore_mobile.png',animations:'disabled'});
  await page.setViewportSize({width:1440,height:1400});
  const pose=await page.locator('.play-panel').getAttribute('style');await advance(page,650);expect(await page.locator('.play-panel').getAttribute('style')).not.toBe(pose);
  await click(page,'pause');const frozen=await page.locator('.play-panel').getAttribute('style');await advance(page,20000);expect(await page.locator('.play-panel').getAttribute('style')).toBe(frozen);await click(page,'resume');
  const wrong=await page.locator('.scene-object').evaluateAll((nodes,essential)=>nodes.find(node=>!essential.includes(node.dataset.equipment)).dataset.index,essentials);
  await page.locator(`.scene-object[data-index="${wrong}"]`).click();await expect(page.locator('.scene-object.rejected')).toHaveCount(1);await expect(page.locator('.play-panel')).toHaveAttribute('data-response','wrong');
  for(const name of essentials){
    await page.locator(`.scene-object[data-equipment="${name}"]`).click();
    await expect(page.locator(`.inventory-slot.filled[data-equipment="${name}"]`)).toBeVisible();
    await expect(page.locator('.flying-equipment')).toHaveCount(1);await advance(page,750);await expect(page.locator('.flying-equipment')).toHaveCount(0);
  }
  await expect(page.locator('.mission-need.packed')).toHaveCount(6);await expect(page.locator('.ark-world')).toHaveAttribute('data-ready','true');await expect(page.locator('[data-action=depart]')).toBeEnabled();
  await page.screenshot({path:'.local/verification/ark_ready.png',fullPage:true,animations:'disabled'});await click(page,'depart');
  await expect(page.locator('.mission-outcome-art.ark.departed')).toBeVisible();await expect(page.locator('.local-note')).toContainText('ذخیره شد');
  await page.screenshot({path:'.local/verification/ark_arrived.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('ark: easy and medium retain their choices and reduced motion keeps keyboard play usable',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);
  for(const [level,count] of [['easy',16],['medium',24]]){
    await setupMain(page,level);await begin(page);await expect(page.locator('.scene-object')).toHaveCount(count);
    await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');
    const pose=await page.locator('.play-panel').getAttribute('style');await advance(page,500);expect(await page.locator('.play-panel').getAttribute('style')).toBe(pose);
    const water=page.locator('.scene-object[data-equipment=water]');await water.focus();await page.keyboard.press('Space');
    await expect(page.locator('.inventory-slot.filled')).toHaveCount(1);await expect(page.locator('.play-effects')).toHaveCount(0);
    await page.setViewportSize({width:360,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await leave(page);
  }
});
