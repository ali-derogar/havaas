import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceHunt=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceHunt(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setup(page,level,options){
 const auth=await(await page.request.get('/api/auth/session')).json(),run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'hunt',kind:'baseline',...options}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const api=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{let auth=await(await api.get('/api/auth/session')).json();auth=await(await api.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();expect((await api.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'hunt',level,mode:'fixed',...options}})).ok()).toBe(true);}finally{await api.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function start(page,practice,{theme='star',targetCount=1}={}){
 await page.locator('[data-action=open][data-game=hunt]').first().click();
 for(const selector of [`[data-action=theme][data-theme="${theme}"]`,`[data-action=hunt-mode][data-mode="${targetCount===2?'divided':'standard'}"]`]){const node=page.locator(selector);if(await node.getAttribute('aria-pressed')!=='true'){await node.click();await expect(node).toHaveAttribute('aria-pressed','true');}}
 await click(page,practice?'practice':'main-game');await expect(page.locator('.hunt-preparation')).toBeVisible();
}
async function begin(page){await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.hunt-world')).toBeVisible();}
const targets=page=>page.locator('.instruction-strip .target-mini .symbol').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
const choices=page=>page.locator('.hunt-choice').evaluateAll(nodes=>nodes.map(node=>({index:node.dataset.choice,html:node.querySelector('.symbol').outerHTML,style:node.getAttribute('style')})));
const pose=page=>page.locator('.hunt-choice').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('style')));
async function leave(page){await click(page,'pause');await click(page,'home');await expect(page.locator('.hero')).toBeVisible();}

test('trail: all five themes, both target modes and five practice reviews preserve exact visual matching',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);
 for(const [theme,level,targetCount,interval] of [['star','easy',1,1000],['shape','medium',2,1000],['fish','easy',1,2000],['bird','medium',2,1500],['butterfly','hard',2,1000]]){
  const options={theme,targetCount};await setup(page,level,options);await start(page,true,options);await page.setViewportSize({width:1440,height:1100});if(theme==='fish')await page.screenshot({path:'.local/verification/hunt_preparation.png',fullPage:true,animations:'disabled'});await begin(page);const goals=await targets(page);expect(goals).toHaveLength(targetCount);
  for(let trial=0;trial<5;trial++){
   const field=await choices(page),target=field.find(choice=>goals.includes(choice.html));await expect(page.locator('.hunt-choice[data-target]')).toHaveCount(0);await advance(page,50);
   if(trial===0){await page.screenshot({path:`.local/verification/hunt_${theme}_desktop.png`,fullPage:true,animations:'disabled'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`.local/verification/hunt_${theme}_mobile.png`,animations:'disabled'});}
   if(target)await page.locator(`.hunt-choice[data-choice="${target.index}"]`).click();await advance(page,interval-50);await expect(page.locator('.practice-review.good')).toBeVisible();const frozen=await page.locator('#time').textContent();await advance(page,15000);await expect(page.locator('#time')).toHaveText(frozen);await click(page,'continue-review');
  }
  await expect(page.locator('.result-card')).toBeVisible();await click(page,'home');
 }
 expect(errors).toEqual([]);
});

test('trail: 150 dual moving rounds keep paths, keyboard choices, pauses, boundaries and recorded scores',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);const options={theme:'butterfly',targetCount:2};await setup(page,'hard',options);await start(page,false,options);await begin(page);const goals=await targets(page);let wrong=false,omitted=false,gates=0,hits=0;
 for(let trial=0;trial<150;trial++){
  if(await page.locator('.hunt-intermission').count()){
   gates++;await expect(page.locator('.play-controls')).toBeHidden();const frozen=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(frozen);await expect(page.locator('.hunt-choice')).toHaveCount(0);if(gates===1){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/hunt_intermission_mobile.png',fullPage:true,animations:'disabled'});}await click(page,'acknowledge');
  }
  const field=await choices(page),target=field.find(choice=>goals.includes(choice.html));let elapsed=50;
  if(trial===0){
   const initial=await pose(page);await advance(page,120);const moved=await pose(page);expect(moved).not.toEqual(initial);await click(page,'pause');await advance(page,20000);expect(await pose(page)).toEqual(moved);await click(page,'resume');expect(await pose(page)).toEqual(moved);elapsed=120;
   for(const [width,height] of [[360,640],[390,844],[768,900],[1440,1000],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const selector of ['.hunt-surface','.response-button','[data-action=pause]']){const node=page.locator(selector),r=await node.boundingBox();expect(r.y).toBeGreaterThanOrEqual(0);expect(r.y+r.height).toBeLessThanOrEqual(height);}
    const blocked=await page.locator('.hunt-choice').evaluateAll(nodes=>nodes.filter(node=>{const r=node.getBoundingClientRect(),s=node.closest('.hunt-surface').getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return x>s.left&&x<s.right&&y>s.top&&y<s.bottom&&!node.contains(document.elementFromPoint(x,y));}).map(node=>node.dataset.choice));expect(blocked,`blocked at ${width}`).toEqual([]);
    if(width===390||width===1440||width===844)await page.screenshot({path:`.local/verification/hunt_hard_${width}.png`,fullPage:width===1440,animations:'disabled'});
   }
   await page.setViewportSize({width:390,height:844});const first=page.locator('.hunt-choice').first();await first.focus();const before=await first.getAttribute('data-choice'),rect=await first.boundingBox();await page.keyboard.press(rect.x>190?'ArrowLeft':'ArrowRight');await expect(page.locator('.hunt-choice:focus')).not.toHaveAttribute('data-choice',before);
  }else await advance(page,50);
  if(target&&!wrong){const distractor=field.find(choice=>!goals.includes(choice.html));await page.locator(`.hunt-choice[data-choice="${distractor.index}"]`).focus();await page.keyboard.press('Space');await expect(page.locator('.play-panel')).toHaveAttribute('data-response','wrong');wrong=true;}
  else if(target&&!omitted)omitted=true;
  else if(target){await page.locator(`.hunt-choice[data-choice="${target.index}"]`).focus();await page.keyboard.press('Space');await expect(page.locator('.play-panel')).toHaveAttribute('data-response','good');hits++;}
  if(target&&(!omitted||hits)){await expect(page.locator('.response-button')).toBeDisabled();}
  await advance(page,1000-elapsed);if(trial<149)await expect(page.locator('.play-effects')).toHaveCount(0);
 }
 expect(gates).toBe(2);expect(hits).toBe(28);await expect(page.locator('.result-main-score>b')).toHaveText('۲۷');await expect(page.locator('.local-note')).toContainText('ذخیره شد');expect(await page.locator('.hunt-result-stop').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.total)))).toEqual([20,50,80]);expect(await page.locator('.hunt-result-stop').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.dataset.correct),0))).toBe(148);await page.setViewportSize({width:1440,height:1400});await page.screenshot({path:'.local/verification/hunt_result.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('trail: departure clips animals, prevents invisible clicks and reduced motion preserves scored routes',async({page})=>{
 await clock(page);await login(page);const options={theme:'fish',targetCount:2};await setup(page,'easy',options);await start(page,false,options);await begin(page);const initial=await pose(page);await advance(page,1599);
 const exits=await page.locator('.hunt-choice').evaluateAll(nodes=>nodes.filter(node=>parseFloat(node.style.left)>100).map(node=>({index:node.dataset.choice,x:parseFloat(node.style.left),disabled:node.disabled})));expect(exits.length).toBeGreaterThan(0);expect(exits.some(node=>node.x>110&&node.disabled)).toBe(true);
 await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await expect(page.locator('.hunt-choice:not(:disabled)')).toHaveCount(0);await advance(page,400);await page.emulateMedia({reducedMotion:'reduce'});await advance(page,0);const calm=await pose(page);await advance(page,250);expect(await pose(page)).not.toEqual(calm);await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');expect(await page.locator('.hunt-choice').first().evaluate(node=>node.style.getPropertyValue('--tail-angle'))).toBe('0deg');await page.locator('.response-button').focus();await page.keyboard.press('Space');await expect(page.locator('.play-effects')).toHaveCount(0);expect(initial.length).toBe(4);await leave(page);
});
