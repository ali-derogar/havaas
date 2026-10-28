import { test,expect,request } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
let seed,adminApi,adminCsrf;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));adminApi=await request.newContext({baseURL:'http://127.0.0.1:4181'});adminCsrf=(await (await adminApi.get('/api/auth/session')).json()).csrfToken;const auth=await adminApi.post('/api/auth/login',{headers:{'X-CSRF-Token':adminCsrf},data:{identifier:seed.users.admin.username,password:seed.password}});adminCsrf=(await auth.json()).csrfToken;});
test.afterAll(async()=>{await adminApi?.dispose();});
async function setLevel(gameId,level,extra={}){const response=await adminApi.patch(`/api/children/${seed.children[0].id}/difficulty`,{headers:{'X-CSRF-Token':adminCsrf},data:{gameId,level,mode:'fixed',...extra}});expect(response.ok()).toBe(true);}
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceGame=ms=>{now+=ms;const current=[...callbacks.values()];callbacks.clear();for(const fn of current)fn(now);};});}
async function click(page,action,selector=''){
 if(action==='inspect-user'&&await page.locator(`[data-action="inspect-user"]${selector}`).count()===0)await click(page,'admin-users');
 if(['export-profile','export-trials'].includes(action)&&await page.locator('[data-action="user-tab"][data-tab="sessions"]').count())await click(page,'user-tab','[data-tab="sessions"]');
 const target=page.locator(`[data-action="${action}"]${selector}:visible`).first();
 if(await target.count()&&await target.evaluate(el=>Boolean(el.closest('.admin-sidebar')))&&await page.locator('.menu-toggle').isVisible()&&!await page.locator('body').evaluate(el=>el.classList.contains('admin-menu-open')))await page.locator('.menu-toggle').click();
 const endpoint=action==='admin'?'/api/admin/dashboard':action==='admin-users'?'/api/users?':action==='admin-invitations'?'/api/registration-links':null;
 const refresh=endpoint?page.waitForResponse(r=>r.url().includes(endpoint)&&r.status()===200):['open','material','search-mode','search-layout','hunt-mode','theme','level','adaptive-level','dashboard','account','assessment-reports','select-record','inspect-user','report-links'].includes(action)?page.waitForResponse(r=>r.url().includes('/api/bootstrap')&&r.status()===200):null;
 await target.click();
 if(refresh){const response=await refresh;await response.finished();await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));}
 if(['practice','main-game','replay'].includes(action)){await expect(page.locator('.game-preparation')).toBeVisible();await click(page,'begin-game');await advance(page,3000);}
}
async function login(page,key='user'){await page.goto('/');await expect(page.locator('#login-form')).toBeVisible();await page.locator('#login-form [name=identifier]').fill(seed.users[key].username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator(key==='admin'?'.admin-main':'.hero')).toBeVisible();}
async function advance(page,ms){await page.evaluate(ms=>window.advanceGame(ms),ms);}
async function finishReaction(page,game){let guard=0;while(await page.locator('.result-card').count()===0&&guard++<180){if(await page.locator('[data-action=continue-review]').count()){await click(page,'continue-review');continue;}if(await page.locator('[data-action=acknowledge]').count())await click(page,'acknowledge');await advance(page,50);if(game==='hunt'){
 const index=await page.evaluate(()=>{const targets=[...document.querySelectorAll('.target-mini .symbol')].map(el=>el.outerHTML);return [...document.querySelectorAll('.hunt-choice')].findIndex(el=>targets.includes(el.querySelector('.symbol').outerHTML));});if(index>=0)await click(page,'stimulus-response',`[data-choice="${index}"]`);
 }else await page.keyboard.press('Space');await advance(page,950);}expect(guard).toBeLessThan(180);await expect(page.locator('.local-note')).toContainText('ذخیره شد');}
const required={ark:['آب آشامیدنی','خوراک','کمک‌های اولیه','جلیقهٔ نجات','چراغ‌قوه','قطب‌نما'],space:['اکسیژن','لباس فضایی','سوخت','کلاه فضایی','خوراک','نقشهٔ فضایی']};
async function finishAdventure(page,game,practice=true){for(let i=0;i<60;i++){if(await page.locator('.result-card').count())break;if(await page.locator('[data-action=continue-review]').count()){await click(page,'continue-review');continue;}const items=await page.locator('.scene-object:not(.collected):not(.rejected)').evaluateAll(elements=>elements.map(el=>({index:el.dataset.index,name:el.querySelector('span').textContent,blocked:el.classList.contains('blocked')})));const blocked=items.find(i=>i.blocked),target=items.find(i=>required[game].includes(i.name));await advance(page,100);if(blocked)await click(page,'item',`[data-index="${blocked.index}"]`);else if(target)await click(page,'item',`[data-index="${target.index}"]`);else {if(!practice)await expect(page.locator('[data-action=depart]')).toBeInViewport();await click(page,practice?'reject-item':'depart');}}await expect(page.locator('.local-note')).toContainText('ذخیره شد');}
async function finishSearch(page,rounds){for(let i=0;i<rounds;i++){if(await page.locator('[data-action=next-round]').count()){if(i===1){await advance(page,45000);await expect(page.locator('.round-intermission')).toBeVisible();await expect(page.locator('.search-preview')).toHaveCount(0);}await click(page,'next-round');}await expect(page.locator('.search-preview')).toBeVisible();const targets=await page.locator('.preview-target .symbol').evaluateAll(elements=>elements.map(el=>el.outerHTML));await advance(page,2000);const indices=await page.locator('.search-choice').evaluateAll((elements,targets)=>elements.filter(el=>targets.includes(el.querySelector('.symbol').outerHTML)).map(el=>el.dataset.index),targets);for(const index of indices){await advance(page,150);if(i===0){await page.locator(`[data-action="search-choice"][data-index="${index}"]`).focus();await page.keyboard.press('Space');}else await click(page,'search-choice',`[data-index="${index}"]`);}if(await page.locator('[data-action=continue-review]').count())await click(page,'continue-review');}await expect(page.locator('.local-note')).toContainText('ذخیره شد');}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}

test('admin overview, self registration, unified users and direct administrator creation work independently',async({page,browser})=>{
 await login(page,'admin');await expect(page.locator('.hero')).toHaveCount(0);await expect(page.locator('.admin-stats')).toBeVisible();await expect(page.locator('.activity-chart')).toBeVisible();expect(await page.locator('body').textContent()).not.toContain('پرونده');
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page);await page.screenshot({path:`.local/verification/admin-panel-${width}.png`,fullPage:true});}
 await click(page,'new-user');await click(page,'create-mode','[data-mode="link"]');await page.locator('#registration-link-form [name=label]').fill('مراجع دعوت‌شده');await page.locator('#registration-link-form button[type=submit]').click();await expect(page.locator('#invitation-url')).toBeVisible();const url=await page.locator('#invitation-url').inputValue();expect(url).toContain('#register/');
 const context=await browser.newContext(),invited=await context.newPage();
 try{await invited.goto(url);await expect(invited.locator('#registration-form')).toBeVisible();expect(await invited.locator('body').textContent()).not.toContain('یادداشت بالینی');const form=invited.locator('#registration-form');for(const [name,value] of Object.entries({username:'invited-client',firstName:'مراجع',lastName:'تازه',birthDate:'2016-01-01',school:'امید',password:'Invited-test-password-2026!'}))await form.locator(`[name=${name}]`).fill(value);await form.locator('[name=grade]').selectOption({label:'پایهٔ ۳'});await form.locator('button[type=submit]').click();await expect(invited.locator('.hero')).toBeVisible();await expect(invited.locator('.profile-strip')).toContainText('مراجع تازه');await expect(invited.locator('[data-action=admin]')).toHaveCount(0);for(const width of [360,768,1440]){await invited.setViewportSize({width,height:1000});await noOverflow(invited);await invited.screenshot({path:`.local/verification/client-dashboard-${width}.png`,fullPage:true});}await invited.goto(url);await expect(invited.getByRole('heading',{name:'ثبت‌نام در دسترس نیست'})).toBeVisible();}finally{await context.close();}
 await click(page,'close-modal');await click(page,'admin-invitations');await expect(page.locator('.invitation-row')).toContainText('استفاده‌شده');await click(page,'admin-users');await expect(page.locator('.members-table')).toContainText('invited-client');
 await click(page,'new-user');const form=page.locator('#create-user-form');await form.locator('[name=role]').selectOption('admin');await form.locator('[name=name]').fill('ادمین تازه');await form.locator('[name=username]').fill('direct-admin');await form.locator('[name=password]').fill('Temporary-admin-password-2026!');await expect(form.locator('#new-profile-fields')).toBeHidden();await form.locator('button[type=submit]').click();await expect(page.locator('.members-table')).toContainText('direct-admin');
 const c2=await browser.newContext(),newAdmin=await c2.newPage();try{await newAdmin.goto('/');await newAdmin.locator('#login-form [name=identifier]').fill('DIRECT-ADMIN');await newAdmin.locator('#login-form [name=password]').fill('Temporary-admin-password-2026!');await newAdmin.locator('#login-form button[type=submit]').click();await expect(newAdmin.locator('#password-form')).toBeVisible();await expect(newAdmin.locator('.members-table')).toHaveCount(0);await newAdmin.locator('[name=currentPassword]').fill('Temporary-admin-password-2026!');await newAdmin.locator('#password-form [name=password]').fill('Personal-admin-password-2026!');await newAdmin.locator('#password-form button[type=submit]').click();await expect(newAdmin.locator('.admin-stats')).toBeVisible();}finally{await c2.close();}
 await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await click(page,'user-tab','[data-tab="details"]');await expect(page.locator('#profile-form')).toBeVisible();await click(page,'reset-link');await expect(page.locator('#invitation-url')).toHaveValue(/#invite\//);
});

test('seven baselines sync on another device, parent report needs no account, and admin reviews raw data',async({page,browser})=>{
 await clock(page);await login(page);await click(page,'assessment');await click(page,'assessment-next');
 for(const [i,game] of ['hunt','ark','space','traffic','search','nback','stroop'].entries()){
  await expect(page.locator('.guided-banner')).toBeVisible();await click(page,'practice');if(required[game])await finishAdventure(page,game);else if(game==='search')await finishSearch(page,5);else await finishReaction(page,game);if(i<6)await click(page,'assessment-next');
 }
 await click(page,'assessment');await expect(page.locator('.assessment-state.done')).toHaveCount(7);await page.reload();await expect(page.locator('.assessment-state.done')).toHaveCount(7);await click(page,'assessment-reports');await expect(page.locator('.session-history tbody tr')).toHaveCount(7);await page.locator('.session-history [data-action=select-record]').last().click();await expect(page.locator('.progress-chart')).toBeVisible();
 const family=await browser.newContext(),second=await family.newPage();await clock(second);await login(second);await click(second,'assessment');await expect(second.locator('.assessment-state.done')).toHaveCount(7);await click(second,'assessment-reports');await expect(second.locator('.parent-narrative')).toBeVisible();await expect(second.locator('[data-action=export-profile]')).toHaveCount(0);await expect(second.locator('[data-action=export-trials]')).toHaveCount(0);expect(await second.locator('body').textContent()).not.toContain('clinical-secret');
 await click(second,'report-links');await second.locator('#report-link-form button[type=submit]').click();const url=await second.locator('#invitation-url').inputValue();
 const guestContext=await browser.newContext(),parent=await guestContext.newPage();await parent.goto(url);await expect(parent.locator('.public-report')).toBeVisible();await expect(parent.locator('#login-form')).toHaveCount(0);await expect(parent.locator('.parent-narrative')).toBeVisible();await expect(parent.locator('.outcome-details')).toHaveCount(0);
 for(const width of [360,768,1440]){await parent.setViewportSize({width,height:1000});await noOverflow(parent);await parent.screenshot({path:`.local/verification/server-parent-${width}.png`,fullPage:true});}
 await parent.emulateMedia({media:'print'});const pdf=await parent.pdf({printBackground:true});expect(pdf.subarray(0,4).toString()).toBe('%PDF');expect(pdf.length).toBeGreaterThan(2000);await writeFile('.local/verification/server-parent-report.pdf',pdf);await parent.emulateMedia({media:'screen'});
 const reviewerContext=await browser.newContext(),reviewer=await reviewerContext.newPage();await login(reviewer,'admin');await click(reviewer,'inspect-user',`[data-user="${seed.users.user.id}"]`);await click(reviewer,'user-tab','[data-tab="sessions"]');await reviewer.locator('[data-report-filter=kind]').selectOption('baseline');await expect(reviewer.locator('.outcome-details')).toBeVisible();await click(reviewer,'user-tab','[data-tab="difficulty"]');await reviewer.locator('#policy-game').selectOption('traffic');await reviewer.locator('#admin-difficulty-form [name=mode]').selectOption('fixed');await reviewer.locator('#admin-difficulty-form [name=level]').selectOption('hard');await reviewer.locator('#admin-difficulty-form button[type=submit]').click();await expect(reviewer.locator('#account-status')).toContainText('ذخیره شد');expect(await reviewer.locator('body').textContent()).toContain('clinical-secret-0');
 for(const width of [360,768,1440]){await reviewer.setViewportSize({width,height:1000});await noOverflow(reviewer);await reviewer.screenshot({path:`.local/verification/admin-user-${width}.png`,fullPage:true});}
 const other=await browser.newContext(),otherPage=await other.newPage();await login(otherPage,'otherUser');await expect(otherPage.locator('.profile-strip')).toContainText('علی');expect((await other.request.get(`/api/children/${seed.children[0].id}/reports`)).status()).toBe(404);await other.close();
 await setLevel('search','hard',{targetCount:2,material:'letters',layout:'scattered'});await click(page,'home');await click(page,'open','[data-game="search"]');await click(page,'search-mode','[data-mode="dual"]');await click(page,'material','[data-material="letters"]');await click(page,'search-layout','[data-layout="scattered"]');await click(page,'practice');await finishSearch(page,5);
 await click(second,'home');await click(second,'open','[data-game="search"]');await click(second,'search-mode','[data-mode="dual"]');await click(second,'material','[data-material="letters"]');await click(second,'search-layout','[data-layout="scattered"]');await expect(second.locator('[data-action=level]').first()).toBeDisabled();await click(second,'main-game');await expect(second.locator('.level-pill')).toContainText('سخت');await finishSearch(second,10);await expect(second.locator('.result-main-score')).toContainText('۲۰');await click(second,'dashboard');await expect(second.locator('.report-focus')).toContainText('دو حرف');
 await click(page,'home');await click(page,'open','[data-game="ark"]');await click(page,'main-game');await finishAdventure(page,'ark',false);await click(reviewer,'admin');await click(reviewer,'inspect-user',`[data-user="${seed.users.user.id}"]`);const download=reviewer.waitForEvent('download');await click(reviewer,'export-profile');expect((await download).suggestedFilename()).toBe('havaas-profile.json');
 await click(second,'report-links');await click(second,'revoke-report-link');await parent.reload();await expect(parent.locator('h1')).toContainText('گزارش در دسترس نیست');await reviewerContext.close();await family.close();await guestContext.close();
});

test('a failed completion stays pending and can be saved after reauthentication without duplication',async({page})=>{
 await clock(page);await login(page,'user');
 const {playSession}=await import('../helpers/play-session.mjs'),{csrfToken}=await (await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken};
 const run=await (await page.request.post(`/api/children/${seed.children[0].id}/sessions`,{headers,data:{gameId:'traffic',kind:'baseline'}})).json();expect((await page.request.post(`/api/children/${seed.children[0].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 await click(page,'open','[data-game="traffic"]');await click(page,'main-game');
 await page.route('**/api/children/*/sessions/*/complete',route=>route.abort('failed'));
 for(let i=0;i<150;i++){await advance(page,100);await page.keyboard.press('Space');await advance(page,900);}
 await expect(page.locator('[data-action=retry-save]')).toBeVisible();await expect(page.locator('.result-actions button').first()).toBeDisabled();
 await page.unroute('**/api/children/*/sessions/*/complete');await page.context().clearCookies();await click(page,'reauth');await page.locator('#modal #login-form [name=identifier]').fill(seed.users.user.username);await page.locator('#modal #login-form [name=password]').fill(seed.password);await page.locator('#modal #login-form button[type=submit]').click();await expect(page.locator('.local-note')).toContainText('ذخیره شد');await expect(page.locator('.result-actions button').first()).toBeEnabled();await click(page,'dashboard');await expect(page.locator('.report-metrics')).toBeVisible();
});

test('every main game completes and its preparation and arena fit mobile, tablet and desktop',async({page})=>{
 const {playSession}=await import('../helpers/play-session.mjs');await clock(page);await login(page);
 const {csrfToken}=await (await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken};
 // Each main mode has its own completed initial assessment, even when run in isolation.
 for(const gameId of ['hunt','ark','space','traffic','search','nback','stroop']){
  const runResponse=await page.request.post(`/api/children/${seed.children[0].id}/sessions`,{headers,data:{gameId,kind:'baseline'}});expect(runResponse.ok()).toBe(true);
  const run=await runResponse.json();const saved=await page.request.post(`/api/children/${seed.children[0].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}});expect(saved.ok()).toBe(true);
 }
 for(const game of ['hunt','ark','space','traffic','search','nback','stroop']){
  await click(page,'home');await click(page,'open',`[data-game="${game}"]`);
  await page.locator('[data-action="main-game"]').first().click();await expect(page.locator('.game-preparation')).toBeVisible();
  for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page);await page.screenshot({path:`.local/verification/game-${game}-ready-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:360,height:780});await expect(page.locator('.site-header')).toBeHidden();await click(page,'begin-game');await advance(page,3000);
  for(const width of [360,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page);await page.screenshot({path:`.local/verification/game-${game}-play-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:360,height:780});if(!required[game]&&game!=='search')await expect(page.locator('.response-button')).toBeInViewport();
  if(required[game])await finishAdventure(page,game,false);else if(game==='search')await finishSearch(page,10);else await finishReaction(page,game);
  await expect(page.locator('.result-card')).toBeVisible();await expect(page.locator('.site-header')).toBeVisible();await noOverflow(page);
  if(await page.locator('.result-learning').count()){await page.locator('.result-learning>summary').click();await expect(page.locator('.recap-step').first()).toBeVisible();await noOverflow(page);}
  if(required[game]){await expect(page.locator('.mission-outcome-art.departed')).toBeVisible();await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.outcome-vehicle').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.emulateMedia({reducedMotion:'no-preference'});}
  await page.screenshot({path:`.local/verification/game-${game}-result-360.png`,fullPage:true,animations:'disabled'});
 }
});


test('interactive search lessons work by keyboard, allow retry, and finish without recording a game',async({page})=>{
 await clock(page);await login(page);await click(page,'open','[data-game="search"]');await click(page,'search-mode','[data-mode="dual"]');await click(page,'material','[data-material="letters"]');
 const indices=await page.locator('#lesson-box').evaluate(box=>{const targets=[...box.querySelectorAll('.lesson-search-samples .symbol')].map(el=>el.outerHTML);return [...box.querySelectorAll('.lesson-choice')].map(el=>({index:el.dataset.index,correct:targets.includes(el.querySelector('.symbol').outerHTML)}));});
 await click(page,'lesson-choice',`[data-index="${indices.find(i=>!i.correct).index}"]`);await expect(page.locator('.lesson-feedback.wrong')).toBeVisible();
 for(const target of indices.filter(i=>i.correct)){await page.locator(`[data-action=lesson-choice][data-index="${target.index}"]`).focus();await page.keyboard.press('Space');}
 await expect(page.locator('.lesson-choice.found')).toHaveCount(2);await expect(page.locator('[data-action=lesson-next]')).toBeVisible();await click(page,'lesson-next');await expect(page.locator('.lesson-choice')).toHaveCount(0);await click(page,'lesson-hide');await expect(page.locator('.lesson-search-samples .symbol')).toHaveCount(0);await expect(page.locator('.lesson-choice')).toHaveCount(4);
 await page.setViewportSize({width:360,height:780});await noOverflow(page);await page.locator('#lesson-box').screenshot({path:'.local/verification/search-interactive-lesson-360.png'});
});

test.describe('touch gameplay',()=>{
 test.use({hasTouch:true,viewport:{width:360,height:780}});
 test('a real touch on the response button records one onset response and leaves the next trial unanswered',async({page})=>{
  const {playSession}=await import('../helpers/play-session.mjs');await clock(page);await login(page,'user');
  const {csrfToken}=await (await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken};
  const run=await (await page.request.post(`/api/children/${seed.children[0].id}/sessions`,{headers,data:{gameId:'traffic',kind:'baseline'}})).json();expect((await page.request.post(`/api/children/${seed.children[0].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
  await click(page,'open','[data-game="traffic"]');await click(page,'main-game');let submitted;
  page.on('request',request=>{if(request.url().endsWith('/complete'))submitted=request.postDataJSON().result;});
  const button=page.locator('.response-button');await expect(button).toBeInViewport();await advance(page,100);const bounds=await button.boundingBox();await page.touchscreen.tap(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await expect(button).toBeDisabled();
  await advance(page,900);await advance(page,1000);await finishReaction(page,'traffic');expect(submitted.outcomes[0].reactionMs).toBe(100);expect(submitted.outcomes[0].response).toBe(true);expect(submitted.outcomes[1].response).toBe(false);expect(submitted.outcomes).toHaveLength(150);
 });
});

test('hunt hit areas stay separate and the response remains reachable on short portrait and landscape screens',async({page})=>{
 const {playSession}=await import('../helpers/play-session.mjs');await clock(page);await login(page);
 const {csrfToken}=await (await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken};
 const run=await (await page.request.post(`/api/children/${seed.children[0].id}/sessions`,{headers,data:{gameId:'hunt',kind:'baseline'}})).json();expect((await page.request.post(`/api/children/${seed.children[0].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 for(const level of ['easy','medium','hard']){
  await setLevel('hunt',level);await click(page,'open','[data-game="hunt"]');await click(page,'main-game');
  for(const viewport of [{width:360,height:600},{width:800,height:360}]){
   await page.setViewportSize(viewport);await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));if(await page.locator('#modal[open]').count())await click(page,'resume');await advance(page,0);
   const boxes=await page.locator('.hunt-choice').evaluateAll(elements=>elements.map(el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height};}));
   for(const [i,a] of boxes.entries()){expect(a.width).toBeGreaterThanOrEqual(44);expect(a.height).toBeGreaterThanOrEqual(44);expect(a.top).toBeGreaterThanOrEqual(0);expect(a.bottom).toBeLessThanOrEqual(viewport.height+1);for(const b of boxes.slice(i+1))expect(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5).toBe(false);}
   const button=await page.locator('.response-button').boundingBox();expect(button.y).toBeGreaterThanOrEqual(0);expect(button.y+button.height).toBeLessThanOrEqual(viewport.height+1);await noOverflow(page);
   await page.screenshot({path:`.local/verification/hunt-${level}-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
  await click(page,'pause');await click(page,'home');
 }
});

test('admin can switch the reviewed client from the report selector without returning to the previous account',async({page})=>{
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);
 await click(page,'user-tab','[data-tab="details"]');await expect(page.locator('#profile-form [name=firstName]')).toHaveValue('سارا');
 await click(page,'user-tab','[data-tab="sessions"]');await page.locator('#report-profile').selectOption(seed.children[1].id);
 await expect(page.getByRole('heading',{level:1,name:`بررسی ${seed.users.otherUser.name}`,exact:true})).toBeVisible();
 await click(page,'user-tab','[data-tab="details"]');await expect(page.locator('#profile-form [name=firstName]')).toHaveValue('علی');await expect(page.locator('#profile-form [name=concerns]')).toHaveValue('clinical-secret-1');await expect(page.locator('#edit-user-form')).toHaveAttribute('data-user',seed.users.otherUser.id);
 await click(page,'user-tab','[data-tab="sessions"]');await page.locator('#report-profile').selectOption(seed.children[0].id);
 await expect(page.getByRole('heading',{level:1,name:`بررسی ${seed.users.user.name}`,exact:true})).toBeVisible();await click(page,'user-tab','[data-tab="details"]');await expect(page.locator('#profile-form [name=firstName]')).toHaveValue('سارا');await expect(page.locator('#edit-user-form')).toHaveAttribute('data-user',seed.users.user.id);
});

test('malformed and unknown parent links show a report error even when the browser is signed in as admin',async({page})=>{
 await login(page,'admin');const errors=[],privateRequests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/api\/(bootstrap|users)(?:[/?]|$)/.test(request.url()))privateRequests.push(request.url());});
 for(const token of ['incomplete-link','0'.repeat(64)]){
  await page.goto(`/#report/${token}`);await expect(page.getByRole('heading',{name:'گزارش در دسترس نیست',exact:true})).toBeVisible();await expect(page.locator('#login-form')).toHaveCount(0);await expect(page.locator('.admin-main')).toHaveCount(0);await expect(page.locator('[data-action=admin]')).toHaveCount(0);await expect(page.locator('.public-report')).toHaveCount(0);await page.reload();await expect(page.getByRole('heading',{name:'گزارش در دسترس نیست',exact:true})).toBeVisible();await expect(page.locator('#login-form')).toHaveCount(0);
 }
 expect(privateRequests).toHaveLength(0);expect(errors).toHaveLength(0);
});

test('leaving while a session is starting cancels late success and failure without blocking another game',async({page})=>{
 await login(page);
 for(const abort of [false,true]){
  await click(page,'home');await click(page,'open','[data-game="traffic"]');
  let release;const gate=new Promise(resolve=>release=resolve);await page.route('**/api/children/*/sessions',async route=>{await gate;if(abort)await route.abort('failed');else await route.continue();});
  try{
   const requested=page.waitForRequest(request=>request.url().endsWith('/sessions')&&request.method()==='POST');const repeat=page.locator('[data-action=baseline]');await (await repeat.count()?repeat:page.locator('[data-action=practice]')).click();await requested;
   await page.goBack();await expect(page.locator('.hero')).toBeVisible();await page.locator('[data-action=open][data-game=hunt]').click();await expect(page.getByRole('heading',{name:'شکار هدفمند',exact:true})).toBeVisible();
   const completed=abort?page.waitForEvent('requestfailed',{predicate:request=>request.url().endsWith('/sessions')}):page.waitForResponse(response=>response.url().endsWith('/sessions')&&response.status()===201);release();await completed;await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await expect(page.getByRole('heading',{name:'شکار هدفمند',exact:true})).toBeVisible();await expect(page.locator('.game-preparation')).toHaveCount(0);await expect(page.locator('#app-status')).toHaveCount(0);await expect(page).toHaveURL(/#hunt$/);
  }finally{release();await page.unrouteAll({behavior:'wait'});}
 }
});

for(const delayed of ['user','bootstrap'])test(`an old admin ${delayed} response cannot render clinical data after switching to the client in the same tab`,async({page})=>{
 await login(page,'admin');await click(page,'admin-users');let release,ready,intercepted=false;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve);
 const matches=url=>delayed==='user'?url.endsWith(`/api/users/${seed.users.user.id}`):url.includes('/api/bootstrap');
 await page.route(delayed==='user'?`**/api/users/${seed.users.user.id}`:'**/api/bootstrap*',async route=>{if(intercepted)return route.continue();intercepted=true;const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  await page.locator(`[data-action=inspect-user][data-user="${seed.users.user.id}"]`).click();await fetched;await click(page,'logout');await expect(page.locator('#login-form')).toBeVisible();
  await page.locator('#login-form [name=identifier]').fill(seed.users.user.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
  const response=page.waitForResponse(response=>matches(response.url()));release();await response;await page.waitForLoadState('networkidle');
  await expect(page.locator('.hero')).toBeVisible();await expect(page.locator('#profile-form')).toHaveCount(0);await expect(page.locator('.admin-main')).toHaveCount(0);expect(await page.locator('body').textContent()).not.toContain('clinical-secret');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('logout removes the private screen even if loading the next login session fails',async({page})=>{
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await click(page,'user-tab','[data-tab="details"]');await expect(page.locator('#profile-form [name=concerns]')).toHaveValue('clinical-secret-0');
 await page.route('**/api/auth/session',route=>route.abort('failed'));await click(page,'logout');await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#account-error')).not.toBeEmpty();await expect(page.locator('#profile-form')).toHaveCount(0);expect(await page.locator('body').textContent()).not.toContain('clinical-secret');
 await page.unroute('**/api/auth/session');await page.locator('#login-form [name=identifier]').fill(seed.users.user.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();expect(await page.locator('body').textContent()).not.toContain('clinical-secret');
});

test('a report link created by a previous account cannot appear in the next family account',async({page})=>{
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await click(page,'report-links');let release,ready;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve);
 const path=`/api/children/${seed.children[0].id}/report-links`;await page.route(`**${path}`,async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  await page.locator('#report-link-form button[type=submit]').click();await fetched;await click(page,'logout');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();await click(page,'report-links');
  const response=page.waitForResponse(response=>response.url().endsWith(path)&&response.request().method()==='POST');release();await response;await page.waitForLoadState('networkidle');
  await expect(page.locator('#invitation-url')).toHaveCount(0);expect(await page.locator('body').textContent()).not.toContain('سارا');await expect(page.locator('.page-title')).toContainText('علی');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('a delayed raw CSV export does not download after switching from admin to a user',async({page})=>{
 const {playSession}=await import('../helpers/play-session.mjs'),headers={'X-CSRF-Token':adminCsrf};const run=await (await adminApi.post(`/api/children/${seed.children[0].id}/sessions`,{headers,data:{gameId:'traffic',kind:'baseline'}})).json();expect((await adminApi.post(`/api/children/${seed.children[0].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await click(page,'user-tab','[data-tab="sessions"]');await page.locator('[data-report-filter=kind]').selectOption('baseline');await expect(page.locator('[data-action=export-trials]')).toBeVisible();const allowed=page.waitForEvent('download');await click(page,'export-trials');const file=await allowed;expect(file.suggestedFilename()).toBe('havaas-responses.csv');const chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);const csv=Buffer.concat(chunks);expect(csv.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))).toBe(true);expect(csv.toString('utf8')).toContain('ردیف');
 let release,ready;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve),downloads=[];page.on('download',download=>downloads.push(download));await page.route('**/api/children/*/sessions/*/export',async route=>{const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  await click(page,'export-trials');await fetched;await click(page,'logout');await page.locator('#login-form [name=identifier]').fill(seed.users.user.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
  const response=page.waitForResponse(response=>response.url().includes('/sessions/')&&response.url().endsWith('/export'));release();await response;await page.waitForLoadState('networkidle');expect(downloads).toHaveLength(0);await expect(page.locator('.hero')).toBeVisible();
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('legacy import validates files, recognizes a repeat, and lets its owner start training from the imported baseline',async({page,browser})=>{
 const {playSession}=await import('../helpers/play-session.mjs'),{normalizeSettings}=await import('../../server/domain.js');
 const result=playSession({id:'legacy-browser-run',kind:'baseline',settings:{...normalizeSettings({gameId:'traffic'}),seed:42}});delete result.variant;
 const profile={id:'legacy-browser-case',firstName:'انتقال',lastName:'مرورگری',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:'private-import-note',createdAt:'2026-01-01T12:00:00.000+03:30'},document={version:1,profile,records:[{id:'legacy-browser-result',profileId:profile.id,kind:'baseline',result}]};
 const upload=async data=>page.locator('#import-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await login(page,'admin');await click(page,'account');
 await upload({...document,records:[{...document.records[0],result:{...result,finishedAt:'2026-02-30T12:00:00Z'}}]});await expect(page.locator('#import-preview [role=alert]')).toBeVisible();await expect(page.locator('[data-action=commit-import]')).toHaveCount(0);
 await upload(document);await expect(page.locator('.import-mapping [name=targetId]')).toHaveValue('');await click(page,'import-create-user');await page.locator('#create-user-form [name=username]').fill('legacy-browser-client');await page.locator('#create-user-form [name=password]').fill('Imported-client-password-2026!');await page.locator('#create-user-form button[type=submit]').click();await expect(page.locator('#modal')).not.toBeVisible();
 const commit=page.waitForResponse(response=>response.url().endsWith('/api/imports/commit'));await click(page,'commit-import');const imported=await (await commit).json();expect(imported.createdProfiles).toBe(0);expect(imported.importedRecords).toBe(1);const childId=imported.childIds[0];await expect(page.locator('#account-status')).toContainText('منتقل شد');
 await upload({...document,profile:Object.fromEntries(Object.entries(profile).reverse())});await expect(page.locator('.import-mapping [name=targetId]')).toHaveValue(childId);
 const repeat=page.waitForResponse(response=>response.url().endsWith('/api/imports/commit'));await click(page,'commit-import');const repeated=await (await repeat).json();expect(repeated.createdProfiles).toBe(0);expect(repeated.importedRecords).toBe(0);await expect(page.locator('#account-status')).toContainText('منتقل شد');
 expect((await (await adminApi.get(`/api/children/${childId}/sessions`)).json()).records).toHaveLength(1);
 const context=await browser.newContext(),owner=await context.newPage();
 try{
  await owner.goto('/');await owner.locator('#login-form [name=identifier]').fill('legacy-browser-client');await owner.locator('#login-form [name=password]').fill('Imported-client-password-2026!');await owner.locator('#login-form button[type=submit]').click();await owner.locator('#password-form [name=currentPassword]').fill('Imported-client-password-2026!');await owner.locator('#password-form [name=password]').fill('Updated-import-client-password-2026!');await owner.locator('#password-form button[type=submit]').click();await expect(owner.locator('.hero')).toBeVisible();await expect(owner.locator('.profile-strip')).toContainText('انتقال مرورگری');expect(await owner.locator('body').textContent()).not.toContain('private-import-note');
  await click(owner,'open','[data-game=traffic]');const started=owner.waitForResponse(response=>response.url().endsWith(`/api/children/${childId}/sessions`)&&response.request().method()==='POST');await owner.locator('[data-action=main-game]').click();expect((await started).status()).toBe(201);await expect(owner.locator('.game-preparation')).toBeVisible();await expect(owner.locator('.level-pill')).toContainText('متوسط');
 }finally{await context.close();}
});

test('an expired session removes clinical data even when preparing the next login fails',async({page})=>{
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await click(page,'user-tab','[data-tab="details"]');await expect(page.locator('#profile-form [name=concerns]')).toHaveValue('clinical-secret-0');
 await page.context().clearCookies();await page.route('**/api/auth/session',route=>route.abort('failed'));
 const expired=page.waitForResponse(response=>response.url().includes('/api/bootstrap')&&response.status()===401);await page.locator('[data-action=account]').first().click();await expired;
 await expect(page.locator('#login-form')).toBeVisible();await expect(page.locator('#profile-form')).toHaveCount(0);await expect(page.locator('.admin-main')).toHaveCount(0);expect(await page.locator('body').textContent()).not.toContain('clinical-secret');
 await page.unroute('**/api/auth/session');await page.locator('#login-form [name=identifier]').fill(seed.users.user.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
});

test('an acknowledged result remains saved when refreshing the account afterwards loses connection',async({page})=>{
 const {playSession}=await import('../helpers/play-session.mjs');await clock(page);await login(page);
 const {csrfToken}=await (await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken};
 const baseline=await (await page.request.post(`/api/children/${seed.children[0].id}/sessions`,{headers,data:{gameId:'traffic',kind:'baseline'}})).json();expect((await page.request.post(`/api/children/${seed.children[0].id}/sessions/${baseline.id}/complete`,{headers,data:{result:playSession(baseline)}})).ok()).toBe(true);
 await click(page,'open','[data-game=traffic]');await click(page,'main-game');await page.route('**/api/bootstrap*',route=>route.abort('failed'));
 const completed=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.status()===200);
 for(let i=0;i<150;i++){await advance(page,100);await page.keyboard.press('Space');await advance(page,900);}
 const saved=await (await completed).json();expect(saved.record.id).toBeTruthy();expect((await (await page.request.get(`/api/children/${seed.children[0].id}/sessions/${saved.record.id}`)).json()).record.id).toBe(saved.record.id);
 await expect(page.locator('.local-note')).toContainText('ذخیره شد');await expect(page.locator('[data-action=retry-save]')).toHaveCount(0);await expect(page.locator('.result-actions button').first()).toBeEnabled();
 await page.unroute('**/api/bootstrap*');await click(page,'dashboard');await expect(page.locator('.report-metrics')).toBeVisible();
});

test('repeated form submission while a report link is being created sends only one request',async({page})=>{
 await login(page);await click(page,'report-links');const path=`/api/children/${seed.children[0].id}/report-links`,before=(await (await page.request.get(path)).json()).links.length;
 let release,ready,posts=0;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve);
 await page.route(`**${path}`,async route=>{if(route.request().method()!=='POST')return route.continue();posts++;const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  await page.locator('#report-link-form button[type=submit]').click();await fetched;await page.locator('#report-link-form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  release();await expect(page.locator('#invitation-url')).toBeVisible();await page.waitForLoadState('networkidle');expect(posts).toBe(1);expect((await (await page.request.get(path)).json()).links).toHaveLength(before+1);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('only the newest import preview remains actionable, and invalid JSON clears the previous selection',async({page})=>{
 await login(page,'admin');await click(page,'account');const profile={id:'preview-older',firstName:'قدیمی',lastName:'پیش‌نمایش',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'},older={version:1,profile,records:[]},latest={...older,profile:{...profile,id:'preview-latest',firstName:'تازه'}};
 const upload=data=>page.locator('#import-file').setInputFiles({name:'preview.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 let release,ready;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve);await page.route('**/api/imports/preview',async route=>{if(route.request().postDataJSON().document.profile.id!=='preview-older')return route.continue();const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  await upload(older);await fetched;await upload(latest);await expect(page.locator('.import-mapping')).toContainText('تازه');const late=page.waitForResponse(response=>response.url().endsWith('/api/imports/preview')&&response.request().postDataJSON().document.profile.id==='preview-older');release();await late;await page.waitForLoadState('networkidle');await expect(page.locator('.import-mapping')).toContainText('تازه');
  await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});await expect(page.locator('#import-preview [role=alert]')).toBeVisible();await expect(page.locator('[data-action=commit-import]')).toHaveCount(0);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('an import preview cannot render an error into a screen opened after leaving the import page',async({page})=>{
 await login(page,'admin');await click(page,'account');let release,ready;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve);await page.route('**/api/imports/preview',async route=>{const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  const document={version:1,profile:{id:'preview-left-page',firstName:'ترک',lastName:'صفحه',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'},records:[]};await page.locator('#import-file').setInputFiles({name:'preview.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});await fetched;await click(page,'admin');const late=page.waitForResponse(response=>response.url().endsWith('/api/imports/preview'));release();await late;await page.waitForLoadState('networkidle');await expect(page.locator('.admin-main')).toBeVisible();await expect(page.locator('#app-status')).toHaveCount(0);await expect(page.locator('#account-error')).toHaveCount(0);await expect(page.locator('.import-mapping')).toHaveCount(0);
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});
