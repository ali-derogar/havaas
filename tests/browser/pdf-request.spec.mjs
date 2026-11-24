import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
const sizes=[[320,568],[360,640],[390,844],[768,1024],[1440,900],[800,360]];

async function player(page,locale){
 const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{
  let auth=await(await admin.get('/api/auth/session')).json();
  auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
  const headers={'X-CSRF-Token':auth.csrfToken};
  const invitation=await(await admin.post('/api/registration-links',{headers,data:{label:'PDF request responsive review'}})).json();
  const guest=await(await page.request.get('/api/auth/session')).json();
  const registered=await page.request.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':guest.csrfToken},data:{token:invitation.url.split('/').at(-1),username:`pdf-review-${randomUUID().slice(0,12)}`,password:seed.password,profile:{firstName:'Request',lastName:'Review',birthDate:'2016-01-01',grade:'3',school:'Test'}}});
  expect(registered.status()).toBe(201);
  const own=await(await page.request.get('/api/bootstrap')).json(),childId=own.profiles[0].id;
  const session=await(await page.request.get('/api/auth/session')).json(),playerHeaders={'X-CSRF-Token':session.csrfToken};
  const modes=[...['hunt','ark','space','traffic','search','nback','stroop'].map(gameId=>({gameId,...(gameId==='hunt'?{theme:'butterfly',targetCount:2}:{})})),{gameId:'traffic',trafficMode:'signs'},{gameId:'nback',material:'numbers'},{gameId:'nback',material:'toys'}];
  for(const mode of modes){
   const options={locale,...mode},gameId=options.gameId;
   const runResponse=await page.request.post(`/api/children/${childId}/sessions`,{headers:playerHeaders,data:{...options,kind:'baseline',clientExperienceVersion:4}});
   expect(runResponse.ok()).toBe(true);
   const run=await runResponse.json();
   expect((await page.request.post(`/api/children/${childId}/sessions/${run.id}/complete`,{headers:playerHeaders,data:{result:playSession(run)}})).ok()).toBe(true);
   expect((await admin.patch(`/api/children/${childId}/difficulty`,{headers,data:{...options,mode:'fixed',level:'hard'}})).ok()).toBe(true);
  }
 }finally{await admin.dispose();}
 await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map();performance.now=()=>now;
  requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};cancelAnimationFrame=id=>frames.delete(id);
  window.advanceRequest=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));};
 });
 await page.goto(`/?lang=${locale}`);await expect(page.locator('.hero')).toBeVisible();
}

async function layout(page,label,{playing=false,gameId}={}){
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});await page.evaluate(()=>{scrollTo(0,0);window.advanceRequest?.(0);});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${label}: horizontal overflow at ${width}x${height}`).toBe(true);
  if(playing&&['hunt','traffic','nback','stroop'].includes(gameId)){
   const stimulus={hunt:'.hunt-surface',traffic:'.traffic-signal-case',nback:'.focus-corners',stroop:'.focus-corners'}[gameId];
   for(const selector of [stimulus,'.response-button','[data-action=pause]']){
    const node=page.locator(selector),box=await node.boundingBox();
    expect(box.y,`${label} ${selector} top at ${width}x${height}`).toBeGreaterThanOrEqual(0);
    expect(box.y+box.height,`${label} ${selector} bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
    const covered=await node.evaluate(node=>{const r=node.getBoundingClientRect();return [.2,.5,.8].some(t=>!node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height*t)));});
    expect(covered,`${label} ${selector} covered at ${width}x${height}`).toBe(false);
   }
  }
  if(playing&&await page.locator('html').getAttribute('lang')==='en'&&((gameId==='hunt'&&width===390)||(gameId==='traffic'&&width===1440)||(gameId==='nback'&&width===800))){
   await page.screenshot({path:`.local/verification/pdf_${gameId}_${width}.png`,animations:'disabled'});
  }
 }
 if(await page.locator('html').getAttribute('lang')==='en'){
  const untranslated=await page.locator('main').evaluate(main=>{
   const walker=document.createTreeWalker(main,NodeFilter.SHOW_TEXT),texts=[];let node;
   while(node=walker.nextNode())if(/[\u0600-\u06ff]/.test(node.textContent)&&node.parentElement.getClientRects().length&&!node.parentElement.closest('select'))texts.push(node.textContent.trim());
   return texts;
  });
  expect(untranslated,`${label}: untranslated interface text`).toEqual([]);
 }
}

for(const locale of ['fa','en'])test(`PDF request: ${locale} all seven games retain usable controls on phones, tablets and desktop`,async({page})=>{
 test.setTimeout(240000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await player(page,locale);await layout(page,`${locale} home`);
 for(const gameId of ['hunt','ark','space','traffic','search','nback','stroop']){
  await page.setViewportSize({width:1440,height:900});
  await page.locator(`[data-action=open][data-game=${gameId}]`).first().click();
  if(gameId==='hunt'){
   await page.locator('[data-action=theme][data-theme=butterfly]').click();
   await page.locator('[data-action=hunt-mode][data-mode=divided]').click();
  }
  await layout(page,`${locale} ${gameId} introduction`);
  await action(page,'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();
  await layout(page,`${locale} ${gameId} preparation`);
  await action(page,'begin-game').click();await page.evaluate(()=>window.advanceRequest(3000));
  await layout(page,`${locale} ${gameId} playing`,{playing:true,gameId});
  if(gameId==='hunt'){
   await expect(page.locator('.hunt-choice .butterfly-orientation').first()).toHaveAttribute('transform','rotate(90 32 32)');
   await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.advanceRequest(0));
   await expect(page.locator('.hunt-choice .butterfly-orientation').first()).toHaveAttribute('transform','rotate(90 32 32)');
  }
  if(gameId==='traffic'){
   await expect(page.locator('.road-bump')).toHaveCount(3);
   await expect(page.locator('.traffic-road')).toHaveAttribute('data-travel','562.5');
  }
  if(gameId==='nback'){
   const interval=Number(await page.locator('.play-panel').getAttribute('data-interval-ms'));
   for(let i=0;i<3;i++)await page.evaluate(ms=>window.advanceRequest(ms),interval);
   await expect(page.locator('.response-button')).toBeEnabled();
   if(locale==='en')await expect(page.locator('.response-button>span').first()).toHaveText('Same as the item 3 back!');
   await layout(page,`${locale} nback comparison`,{playing:true,gameId});
  }
  await action(page,'pause').click();await action(page,'home').click();await expect(page.locator('.hero')).toBeVisible();
 }
 expect(errors).toEqual([]);
});

test('PDF request: English administration stays usable at mobile and desktop widths',async({page})=>{
 await page.goto('/?lang=en');await page.locator('#login-form [name=identifier]').fill(seed.users.admin.username);
 await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form [type=submit]').click();
 await expect(page.locator('.admin-stats')).toBeVisible();
 for(const hash of ['admin','admin/users','admin/invitations','admin/game-settings','admin/settings']){
  await page.goto(`/?lang=en#${hash}`);
  await expect(page.locator('main h1')).toBeVisible();
  for(const [width,height]of sizes){
   await page.setViewportSize({width,height});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${hash} at ${width}x${height}`).toBe(true);
   await expect(page.locator('[data-locale-select]')).toBeVisible();
  }
 }
});

test('PDF request: the first-page language selector remains reachable and preserves typed credentials',async({page})=>{
 await page.goto('/?lang=fa');
 await page.locator('#login-form [name=identifier]').fill('unsaved-username');
 await page.locator('#login-form [name=password]').fill('unsaved-password');
 for(const [width,height]of sizes){
  await page.setViewportSize({width,height});
  for(const locale of ['en','fa']){
   await page.locator('[data-locale-select]').selectOption(locale);
   await expect(page.locator('html')).toHaveAttribute('lang',locale);
   await expect(page.locator('[data-locale-select]')).toBeInViewport();
   await expect(page.locator('#login-form [name=identifier]')).toHaveValue('unsaved-username');
   await expect(page.locator('#login-form [name=password]')).toHaveValue('unsaved-password');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
});

test('PDF request: touch input selects the moving butterfly once and can pause and leave the game',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4181',viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();await player(page,'en');
  await page.locator('[data-action=open][data-game=hunt]').first().tap();
  await page.locator('[data-action=theme][data-theme=butterfly]').tap();
  await page.locator('[data-action=hunt-mode][data-mode=divided]').tap();
  await action(page,'main-game').tap();await expect(page.locator('.game-preparation')).toBeVisible();
  await action(page,'begin-game').tap();await page.evaluate(()=>window.advanceRequest(3000));
  const targets=await page.locator('.instruction-strip .target-mini .symbol').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
  let choice;
  for(let i=0;i<20;i++){
   choice=await page.locator('.hunt-choice').evaluateAll((nodes,targets)=>nodes.find(node=>targets.includes(node.querySelector('.symbol').outerHTML))?.dataset.choice,targets);
   if(choice!==undefined)break;
   await page.evaluate(()=>window.advanceRequest(Number(document.querySelector('.play-panel').dataset.intervalMs)));
  }
  expect(choice).toBeDefined();await page.evaluate(()=>window.advanceRequest(100));
  await page.locator(`.hunt-choice[data-choice="${choice}"]`).tap();
  await expect(page.locator('.play-panel')).toHaveAttribute('data-response','good');
  await expect(page.locator('.response-button')).toBeDisabled();
  await action(page,'pause').tap();await expect(page.locator('#modal')).toBeVisible();
  await action(page,'home').tap();await expect(page.locator('.hero')).toBeVisible();
 }finally{await context.close();}
});

for(const locale of ['fa','en'])test(`PDF boundary: ${locale} short landscape keeps the stimulus and response reachable`,async({page})=>{
 await player(page,locale);
 for(const [gameId,variant]of [['hunt','butterfly'],['traffic','circles'],['traffic','signs'],['nback','shapes'],['nback','numbers'],['nback','toys'],['stroop','standard']]){
  await page.setViewportSize({width:1440,height:900});
  await page.locator(`[data-action=open][data-game=${gameId}]`).first().click();
  if(gameId==='hunt'){
   await page.locator('[data-action=theme][data-theme=butterfly]').click();
   await page.locator('[data-action=hunt-mode][data-mode=divided]').click();
  }
  if(gameId==='traffic')await page.locator(`[data-action=traffic-mode][data-mode=${variant}]`).click();
  if(gameId==='nback')await page.locator(`[data-action=material][data-material=${variant}]`).click();
  await action(page,'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();
  await action(page,'begin-game').click();await page.evaluate(()=>window.advanceRequest(3000));
  for(const [width,height]of [[480,320],[568,320],[640,360],[667,375],[736,414],[1024,520]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>{scrollTo(0,0);window.advanceRequest(0);});
   expect.soft(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${locale} ${gameId} overflow at ${width}x${height}`).toBe(true);
   for(const selector of [{hunt:'.hunt-surface',traffic:'.traffic-signal-case',nback:'.focus-corners',stroop:'.focus-corners'}[gameId],'.response-button','[data-action=pause]']){
    const node=page.locator(selector),rect=await node.boundingBox();
    expect.soft(rect.y,`${locale} ${gameId} ${selector} top at ${width}x${height}`).toBeGreaterThanOrEqual(0);
    expect.soft(rect.y+rect.height,`${locale} ${gameId} ${selector} bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
    const covering=await node.evaluate(node=>{const r=node.getBoundingClientRect();return [.2,.5,.8].map(t=>{const at=document.elementFromPoint(r.x+r.width/2,r.y+r.height*t);return node.contains(at)?null:at?.className||'outside viewport';}).filter(Boolean);});
    expect.soft(covering,`${locale} ${gameId} ${selector} covered at ${width}x${height}`).toEqual([]);
   }
   if(gameId==='hunt'){
    const overlaps=await page.locator('.hunt-choice').evaluateAll(nodes=>{const rects=nodes.map(node=>node.getBoundingClientRect());return rects.flatMap((a,i)=>rects.slice(i+1).filter(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5));});
    expect.soft(overlaps,`separate hunt targets at ${width}x${height}`).toEqual([]);
   }
   await page.screenshot({path:`.local/verification/boundary_${locale}_${gameId}_${variant}_${width}.png`,animations:'disabled'});
  }
  await page.setViewportSize({width:1440,height:900});await action(page,'pause').click();await action(page,'home').click();await expect(page.locator('.hero')).toBeVisible();
 }
});

test('PDF request: the final hunt review shows each phase target rather than the last target pair',async({page})=>{
 await player(page,'en');await page.locator('[data-action=open][data-game=hunt]').first().click();
 await page.locator('[data-action=theme][data-theme=butterfly]').click();await page.locator('[data-action=hunt-mode][data-mode=divided]').click();
 await action(page,'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();
 await action(page,'begin-game').click();await page.evaluate(()=>window.advanceRequest(3000));
 const goals=[],missed=new Set();let phase=0;
 for(let i=0;i<150;i++){
  if(i===20||i===70){phase++;await page.evaluate(()=>window.advanceRequest(3000));}
  const targets=await page.locator('.instruction-strip .target-mini .symbol').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
  if([0,20,70].includes(i))goals.push(targets);
  const choice=await page.locator('.hunt-choice').evaluateAll((nodes,targets)=>nodes.find(node=>targets.includes(node.querySelector('.symbol').outerHTML))?.dataset.choice,targets);
  await page.evaluate(()=>window.advanceRequest(100));
  if(choice!==undefined){if(missed.has(phase))await page.locator(`.hunt-choice[data-choice="${choice}"]`).click();else missed.add(phase);}
  await page.evaluate(()=>window.advanceRequest(Number(document.querySelector('.play-panel').dataset.intervalMs)-100));
 }
 await expect(page.locator('.result-main-score>b')).toHaveText('27');await expect(page.locator('.local-note')).toContainText('saved');
 await page.locator('.result-learning>summary').click();await expect(page.locator('.recap-step')).toHaveCount(3);
 for(let phase=0;phase<3;phase++){
  const actual=await page.locator('.recap-step').nth(phase).locator('.review-comparison>div:last-child .symbol').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
  expect(actual).toEqual(goals[phase]);
 }
 await page.screenshot({path:'.local/verification/second_hunt_phase_review.png',fullPage:true,animations:'disabled'});
});

for(const locale of ['fa','en'])test(`PDF boundary: ${locale} changing-color notices fit short screens`,async({page})=>{
 await player(page,locale);
 for(const [gameId,blocks]of [['hunt',[20,50]],['stroop',[40,40,40]]]){
  await page.setViewportSize({width:1440,height:900});await page.locator(`[data-action=open][data-game=${gameId}]`).first().click();
  if(gameId==='hunt'){
   await page.locator('[data-action=theme][data-theme=butterfly]').click();await page.locator('[data-action=hunt-mode][data-mode=divided]').click();
  }
  await action(page,'main-game').click();await expect(page.locator('.game-preparation')).toBeVisible();
  await action(page,'begin-game').click();await page.evaluate(()=>window.advanceRequest(3000));
  const interval=Number(await page.locator('.play-panel').getAttribute('data-interval-ms'));
  for(const [phase,length]of blocks.entries()){
   for(let i=0;i<length;i++)await page.evaluate(ms=>window.advanceRequest(ms),interval);
   await expect(page.locator('.automatic-rule-notice')).toBeVisible();
   for(const [width,height]of [[480,320],[568,320],[640,360],[800,360],[320,568],[1024,520]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    for(const selector of ['.automatic-rule-notice h2',gameId==='hunt'?'.automatic-rule-notice .target-examples':'.automatic-rule-notice>.stroop-rule-picture','#transition-seconds','[data-action=pause]']){
     const node=page.locator(selector),rect=await node.boundingBox();
     expect.soft(rect.y,`${locale} ${gameId} phase ${phase+1} ${selector} top at ${width}x${height}`).toBeGreaterThanOrEqual(0);
     expect.soft(rect.y+rect.height,`${locale} ${gameId} phase ${phase+1} ${selector} bottom at ${width}x${height}`).toBeLessThanOrEqual(height);
    }
    if(width===568)await page.screenshot({path:`.local/verification/second_notice_${locale}_${gameId}_${phase+1}.png`,animations:'disabled'});
   }
   await page.evaluate(()=>window.advanceRequest(3000));
  }
  await page.setViewportSize({width:1440,height:900});await action(page,'pause').click();await action(page,'home').click();await expect(page.locator('.hero')).toBeVisible();
 }
});
