import { test,expect,request } from '@playwright/test';
import { readFile,writeFile } from 'node:fs/promises';
let seed,adminApi,adminCsrf;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));adminApi=await request.newContext({baseURL:'http://127.0.0.1:4181'});adminCsrf=(await (await adminApi.get('/api/auth/session')).json()).csrfToken;const auth=await adminApi.post('/api/auth/login',{headers:{'X-CSRF-Token':adminCsrf},data:{identifier:seed.users.admin.username,password:seed.password}});adminCsrf=(await auth.json()).csrfToken;});
test.afterAll(async()=>{await adminApi?.dispose();});
async function setLevel(gameId,level,extra={}){const response=await adminApi.patch(`/api/children/${seed.children[0].id}/difficulty`,{headers:{'X-CSRF-Token':adminCsrf},data:{gameId,level,mode:'fixed',...extra}});expect(response.ok()).toBe(true);}
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);window.advanceGame=ms=>{now+=ms;const current=[...callbacks.values()];callbacks.clear();for(const fn of current)fn(now);};});}
async function click(page,action,selector=''){
 const refresh=['open','material','search-mode','search-layout','hunt-mode','theme','level','adaptive-level','dashboard','account','assessment-reports','select-record','admin','inspect-user','report-links'].includes(action)?page.waitForResponse(r=>r.url().includes('/api/bootstrap')&&r.status()===200):null;
 await page.locator(`[data-action="${action}"]${selector}:visible`).first().click();
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

test('admin has an independent management panel, invites users and directly creates another admin',async({page,browser})=>{
 await login(page,'admin');await expect(page.locator('.hero')).toHaveCount(0);await expect(page.locator('.admin-stats')).toBeVisible();
 for(const width of [360,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page);await page.screenshot({path:`.local/verification/admin-panel-${width}.png`,fullPage:true});}
 const form=page.locator('#create-user-form');await form.locator('[name=name]').fill('مراجع دعوت‌شده');await form.locator('[name=username]').fill('invited-client');await form.locator('[name=method]').selectOption('invite');await expect(form.locator('[name=password]')).toBeDisabled();
 for(const [name,value] of Object.entries({firstName:'مراجع',lastName:'تازه',birthDate:'2016-01-01',school:'امید'}))await form.locator(`[name=${name}]`).fill(value);await form.locator('[name=grade]').selectOption({label:'پایهٔ ۳'});await form.locator('button[type=submit]').click();const url=await page.locator('#invitation-url').inputValue();expect(url).toContain('#invite/');
 const context=await browser.newContext(),invited=await context.newPage();await invited.goto(url);await invited.locator('#accept-form [name=password]').fill('Invited-test-password-2026!');await invited.locator('#accept-form button[type=submit]').click();await expect(invited.locator('.hero')).toBeVisible();await expect(invited.locator('.profile-strip')).toContainText('مراجع تازه');await expect(invited.locator('[data-action=admin]')).toHaveCount(0);await context.close();
 await form.locator('[name=name]').fill('ادمین تازه');await form.locator('[name=username]').fill('direct-admin');await form.locator('[name=role]').selectOption('admin');await form.locator('[name=method]').selectOption('direct');await form.locator('[name=password]').fill('Temporary-admin-password-2026!');await expect(form.locator('#new-profile-fields')).toBeHidden();await form.locator('button[type=submit]').click();await expect(page.locator('.members-table')).toContainText('direct-admin');
 const c2=await browser.newContext(),newAdmin=await c2.newPage();await newAdmin.goto('/');await newAdmin.locator('#login-form [name=identifier]').fill('DIRECT-ADMIN');await newAdmin.locator('#login-form [name=password]').fill('Temporary-admin-password-2026!');await newAdmin.locator('#login-form button[type=submit]').click();await expect(newAdmin.locator('#password-form')).toBeVisible();await expect(newAdmin.locator('.members-table')).toHaveCount(0);await newAdmin.locator('[name=currentPassword]').fill('Temporary-admin-password-2026!');await newAdmin.locator('#password-form [name=password]').fill('Personal-admin-password-2026!');await newAdmin.locator('#password-form button[type=submit]').click();await expect(newAdmin.locator('.members-table')).toBeVisible();await c2.close();
 await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await expect(page.locator('#profile-form')).toBeVisible();await click(page,'reset-link');await expect(page.locator('#invitation-url')).toHaveValue(/#invite\//);
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
 const reviewerContext=await browser.newContext(),reviewer=await reviewerContext.newPage();await login(reviewer,'admin');await click(reviewer,'inspect-user',`[data-user="${seed.users.user.id}"]`);await reviewer.locator('[data-report-filter=kind]').selectOption('baseline');await expect(reviewer.locator('.outcome-details')).toBeVisible();await reviewer.locator('#policy-game').selectOption('traffic');await reviewer.locator('#admin-difficulty-form [name=mode]').selectOption('fixed');await reviewer.locator('#admin-difficulty-form [name=level]').selectOption('hard');await reviewer.locator('#admin-difficulty-form button[type=submit]').click();await expect(reviewer.locator('#account-status')).toContainText('ذخیره شد');expect(await reviewer.locator('body').textContent()).toContain('clinical-secret-0');
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
 await expect(page.locator('#profile-form [name=firstName]')).toHaveValue('سارا');
 await page.locator('#report-profile').selectOption(seed.children[1].id);
 await expect(page.getByRole('heading',{level:1,name:`بررسی ${seed.users.otherUser.name}`,exact:true})).toBeVisible();
 await expect(page.locator('#profile-form [name=firstName]')).toHaveValue('علی');await expect(page.locator('#profile-form [name=concerns]')).toHaveValue('clinical-secret-1');await expect(page.locator('#edit-user-form')).toHaveAttribute('data-user',seed.users.otherUser.id);
 await page.locator('#report-profile').selectOption(seed.children[0].id);
 await expect(page.getByRole('heading',{level:1,name:`بررسی ${seed.users.user.name}`,exact:true})).toBeVisible();await expect(page.locator('#profile-form [name=firstName]')).toHaveValue('سارا');await expect(page.locator('#edit-user-form')).toHaveAttribute('data-user',seed.users.user.id);
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
 await login(page,'admin');let release,ready,intercepted=false;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve);
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
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await expect(page.locator('#profile-form [name=concerns]')).toHaveValue('clinical-secret-0');
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
 await login(page,'admin');await click(page,'inspect-user',`[data-user="${seed.users.user.id}"]`);await page.locator('[data-report-filter=kind]').selectOption('baseline');await expect(page.locator('[data-action=export-trials]')).toBeVisible();const allowed=page.waitForEvent('download');await click(page,'export-trials');const file=await allowed;expect(file.suggestedFilename()).toBe('havaas-responses.csv');const chunks=[];for await(const chunk of await file.createReadStream())chunks.push(chunk);const csv=Buffer.concat(chunks);expect(csv.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf]))).toBe(true);expect(csv.toString('utf8')).toContain('ردیف');
 let release,ready;const gate=new Promise(resolve=>release=resolve),fetched=new Promise(resolve=>ready=resolve),downloads=[];page.on('download',download=>downloads.push(download));await page.route('**/api/children/*/sessions/*/export',async route=>{const response=await route.fetch();ready();await gate;await route.fulfill({response});});
 try{
  await click(page,'export-trials');await fetched;await click(page,'logout');await page.locator('#login-form [name=identifier]').fill(seed.users.user.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
  const response=page.waitForResponse(response=>response.url().includes('/sessions/')&&response.url().endsWith('/export'));release();await response;await page.waitForLoadState('networkidle');expect(downloads).toHaveLength(0);await expect(page.locator('.hero')).toBeVisible();
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});
