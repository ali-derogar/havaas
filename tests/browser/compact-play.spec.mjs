import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{
 seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));
 // These layout baselines must not turn later teaching tests into free practice.
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'}),guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  const issued=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'آزمون مستقل نمایش فشرده'}})).json(),session=await(await guest.get('/api/auth/session')).json();
  const response=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':session.csrfToken},data:{token:issued.url.split('/').at(-1),username:`compact-${randomUUID().slice(0,12)}`,password:seed.password,profile:{firstName:'نمایش',lastName:'فشرده',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'}}});expect(response.status()).toBe(201);
  const created=await response.json(),own=await(await guest.get('/api/bootstrap')).json();seed={...seed,users:{...seed.users,otherUser:created.user},children:[seed.children[0],own.profiles[0]]};
 }finally{await admin.dispose();await guest.dispose();}
});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceCompact=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});}
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function start(page,gameId,extra={}){
 await clock(page);await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
 const options={gameId,...(gameId==='hunt'?{theme:'shape',targetCount:2}:{}),...extra},auth=await(await page.request.get('/api/auth/session')).json(),run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{...options,kind:'baseline'}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const api=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{let auth=await(await api.get('/api/auth/session')).json();auth=await(await api.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();expect((await api.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{...options,level:'hard',mode:'fixed'}})).ok()).toBe(true);}finally{await api.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();await page.locator(`[data-action=open][data-game="${gameId}"]`).first().click();
 if(gameId==='hunt'){await page.locator(`[data-action=theme][data-theme="${options.theme}"]`).click();await page.locator('[data-action=hunt-mode][data-mode=divided]').click();}
 if(extra.trafficMode==='signs')await page.locator('[data-action=traffic-mode][data-mode=signs]').click();
 await click(page,'main-game');await expect(page.locator('.game-preparation')).toBeVisible();await click(page,'begin-game');await page.evaluate(()=>window.advanceCompact(3000));
}

for(const [gameId,extra] of [['hunt',{}],['traffic',{}],['traffic',{trafficMode:'signs'}],['nback',{}],['stroop',{}]])test(`compact: ${gameId}${extra.trafficMode?' signs':''} keeps the full stimulus and controls visible without overlapping touch targets`,async({page})=>{
 await start(page,gameId,extra);
 for(const [width,height] of [[320,568],[360,600],[800,360]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));if(await page.locator('#modal[open]').count())await click(page,'resume');await page.evaluate(()=>window.advanceCompact(0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const picture=gameId==='hunt'?'.hunt-surface':gameId==='traffic'?'.traffic-signal-case':'.focus-corners';
  for(const selector of [picture,'.response-button','[data-action=pause]']){
   const node=page.locator(selector),box=await node.boundingBox();expect(box.y,`${selector} top at ${width}x${height}`).toBeGreaterThanOrEqual(0);expect(box.y+box.height,`${selector} bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
   const covered=await node.evaluate(node=>{const r=node.getBoundingClientRect();return [.2,.5,.8].filter(t=>!node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height*t)));});expect(covered,`${selector} covered at ${width}x${height}`).toEqual([]);
  }
  if(gameId==='hunt'){
   const overlaps=await page.locator('.hunt-choice').evaluateAll(nodes=>{const rects=nodes.map(node=>node.getBoundingClientRect());return rects.flatMap((a,i)=>rects.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5));});expect(overlaps).toEqual([]);
  }
  await page.screenshot({path:`.local/verification/audit-${gameId}${extra.trafficMode?'-signs':''}-${width}x${height}.png`,animations:'disabled'});
 }
});

test('compact: hunt direction keys never focus an animal already clipped beyond the field',async({page})=>{
 await start(page,'hunt',{theme:'fish'});await page.setViewportSize({width:800,height:360});await page.evaluate(()=>{scrollTo(0,0);window.advanceCompact(550);});
 const state=await page.locator('.hunt-choice').evaluateAll(nodes=>nodes.filter(node=>!node.disabled).map(node=>{const box=node.getBoundingClientRect(),clip=node.closest('.hunt-surface').getBoundingClientRect();return {index:node.dataset.choice,visible:box.left<clip.right&&box.right>clip.left&&box.top<clip.bottom&&box.bottom>clip.top};}));
 expect(state.some(node=>!node.visible)).toBe(true);
 const visible=state.filter(node=>node.visible).map(node=>node.index);
 for(const index of visible){await page.locator(`.hunt-choice[data-choice="${index}"]`).focus();await page.keyboard.press('ArrowRight');expect(visible).toContain(await page.locator('.hunt-choice:focus').getAttribute('data-choice'));}
});

test('compact: native Tab skips animals beyond the clipped field without scrolling their hidden paths into view',async({page})=>{
 await start(page,'hunt',{theme:'fish'});await page.setViewportSize({width:800,height:360});await page.evaluate(()=>{scrollTo(0,0);window.advanceCompact(550);});
 const hidden=await page.locator('.hunt-choice').evaluateAll(nodes=>nodes.filter(node=>{const box=node.getBoundingClientRect(),clip=node.closest('.hunt-surface').getBoundingClientRect();return box.left>=clip.right||box.right<=clip.left||box.top>=clip.bottom||box.bottom<=clip.top;}).map(node=>node.dataset.choice));expect(hidden.length).toBeGreaterThan(0);
 await page.locator('[data-action=pause]').focus();
 for(let step=0;step<14;step++){
  await page.keyboard.press('Tab');const focused=page.locator('.hunt-choice:focus');if(await focused.count())expect(hidden).not.toContain(await focused.getAttribute('data-choice'));
  expect(await page.locator('.hunt-surface').evaluate(node=>Math.abs(node.scrollLeft))).toBe(0);
 }
});

test('compact: an animal leaving the field hands keyboard focus to the response button',async({page})=>{
 await start(page,'hunt',{theme:'fish'});await page.setViewportSize({width:800,height:360});await page.evaluate(()=>{scrollTo(0,0);window.advanceCompact(0);});
 const index=await page.locator('.hunt-choice:not(:disabled)').evaluateAll(nodes=>nodes.toSorted((a,b)=>b.getBoundingClientRect().x-a.getBoundingClientRect().x)[0].dataset.choice),animal=page.locator(`.hunt-choice[data-choice="${index}"]`);
 await animal.focus();await page.keyboard.press('ArrowRight');await expect(animal).toBeFocused();await page.evaluate(()=>window.advanceCompact(550));
 await expect(animal).toHaveAttribute('aria-hidden','true');await expect(page.locator('[data-action=respond]')).toBeFocused();expect(await page.locator('.hunt-surface').evaluate(node=>Math.abs(node.scrollLeft))).toBe(0);
});
