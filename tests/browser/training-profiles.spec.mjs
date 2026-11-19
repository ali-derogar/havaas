import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';
import {createProfileSettings,profileEntry} from '../../src/training-profiles.js';
let seed,admin,csrf,player,childId,a,b;
test.beforeAll(async()=>{
 seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();csrf=auth.csrfToken;
 for(const age of [6,10]){const settings=createProfileSettings('hard');profileEntry(settings,'traffic').timings.standard=age===6?{visibleMs:1500,intervalMs:2500}:{visibleMs:800,intervalMs:1800};const response=await admin.post('/api/admin/training-profiles',{headers:{'X-CSRF-Token':csrf},data:{name:`سخت کودکان تا ${age===6?'۶':'۱۰'} سال`,settings}});expect(response.status()).toBe(201);const profile=(await response.json()).profile;if(age===6)a=profile;else b=profile;}
 const link=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':csrf},data:{label:'آزمون پروفایل تمرین'}})).json(),guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{const auth=await(await guest.get('/api/auth/session')).json(),response=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':auth.csrfToken},data:{token:link.url.split('/').at(-1),username:'profile-'+randomUUID().slice(0,12),password:seed.password,profile:{firstName:'آزمون',lastName:'پروفایل',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'}}});expect(response.status()).toBe(201);player=(await response.json()).user;childId=(await(await guest.get('/api/bootstrap')).json()).activeId;
  const {csrfToken}=await(await guest.get('/api/auth/session')).json();for(const gameId of ['traffic','ark']){const run=await(await guest.post(`/api/children/${childId}/sessions`,{headers:{'X-CSRF-Token':csrfToken},data:{gameId,kind:'baseline',clientExperienceVersion:3}})).json();expect((await guest.post(`/api/children/${childId}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':csrfToken},data:{result:playSession(run)}})).status()).toBe(200);}
 }finally{await guest.dispose();}
});
test.afterAll(async()=>{await admin?.dispose();});
async function login(page,isAdmin=true){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(isAdmin?seed.users.admin.username:player.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator(isAdmin?'.admin-stats':'.hero')).toBeVisible();}
async function settings(page){await page.locator('.admin-sidebar [data-action=admin-game-settings]').click();await expect(page.locator(`[data-training-profile="${a.id}"]`)).toBeVisible();}
async function inspect(page){await page.goto(`/#admin/user/${player.id}`);await page.locator('[data-action=user-tab][data-tab=difficulty]').click();await expect(page.locator('#policy-level')).toBeVisible();}
async function saveAssignment(page){const done=page.waitForResponse(response=>response.url().endsWith('/difficulty')&&response.request().method()==='PATCH');await page.locator('#admin-difficulty-form button[type=submit]').click();expect((await done).status()).toBe(200);await expect(page.locator('#account-status')).toContainText('ذخیره شد');}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceProfileGame(ms),ms);
async function patchProfile(id,data){const result=await(await admin.get(`/api/admin/training-profiles/${id}`)).json();const response=await admin.patch(`/api/admin/training-profiles/${id}`,{headers:{'X-CSRF-Token':csrf},data:{...data,expectedRevision:result.profile.revision}});expect(response.status()).toBe(200);return (await response.json()).profile;}

test('game settings are directly accessible from the admin menu, URL and mobile menu',async({page})=>{
 await login(page);
 const menu=page.locator('.admin-sidebar [data-action=admin-game-settings]');
 await expect(menu).toHaveText('تنظیمات بازی‌ها');
 await settings(page);
 await expect(page).toHaveURL(/#admin\/game-settings$/);
 await expect(page.locator('h1')).toHaveText('تنظیمات بازی‌ها');
 await expect(menu).toHaveAttribute('aria-current','page');
 await expect(page.locator('#password-form')).toHaveCount(0);
 await expect(page.locator('[data-training-profile^="builtin:"]')).toHaveCount(3);
 await page.reload();
 await expect(page.locator(`[data-training-profile="${a.id}"]`)).toBeVisible();
 await page.locator('[data-action=admin-users]').filter({hasText:'تنظیم تمرین کاربران'}).click();
 await expect(page.locator('.members-table')).toBeVisible();
 await page.goBack();
 await expect(page.locator('h1')).toHaveText('تنظیمات بازی‌ها');
 await page.setViewportSize({width:360,height:780});
 await page.locator('.menu-toggle').click();
 await expect(menu).toBeInViewport();
 await menu.click();
 await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded','false');
 await expect(page.locator('#training-profile-list')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('game settings navigation protects unsaved profile and account edits',async({page})=>{
 await login(page);
 await page.locator('.admin-sidebar [data-action=account]').click();
 await page.locator('#password-form [name=password]').fill('Unsaved-profile-navigation-2026!');
 await page.locator('.admin-sidebar [data-action=admin-game-settings]').click();
 await expect(page.locator('.navigation-confirm')).toBeVisible();
 await page.locator('[data-guard=stay]').click();
 await expect(page.locator('#password-form [name=password]')).toHaveValue('Unsaved-profile-navigation-2026!');
 await page.locator('.admin-sidebar [data-action=admin-game-settings]').click();
 await page.locator('[data-guard=discard]').click();
 await expect(page.locator(`[data-training-profile="${a.id}"]`)).toBeVisible();
 await page.locator(`[data-training-profile="${a.id}"] [data-action=edit-training-profile]`).click();
 await page.locator('#training-profile-form [name=name]').fill('پیش‌نویس تنظیمات بازی');
 await page.locator('.admin-sidebar [data-action=admin-users]').click();
 await expect(page.locator('.navigation-confirm')).toBeVisible();
 await page.locator('[data-guard=stay]').click();
 await expect(page.locator('#training-profile-form [name=name]')).toHaveValue('پیش‌نویس تنظیمات بازی');
});

test('game settings are restricted to administrators',async({page})=>{
 await login(page,false);
 await expect(page.locator('[data-action=admin-game-settings]')).toHaveCount(0);
 await page.goto('/#admin/game-settings');
 await expect(page.locator('.client-welcome')).toBeVisible();
 await expect(page.locator('#training-profiles')).toHaveCount(0);
});

test('profile editor copies a complete seven-game bundle and preserves edits between game sections',async({page})=>{
 await login(page);await settings(page);await page.locator(`[data-training-profile="${a.id}"] [data-action=copy-training-profile]`).click();const form=page.locator('#training-profile-form');await form.locator('[name=name]').fill('سخت کودکان تا ۸ سال');
 const traffic=form.locator('details').filter({has:page.locator('summary',{hasText:'چراغ راهنمایی'})});await traffic.locator('summary').click();await form.locator('[name="traffic:standard:level"]').selectOption('medium');await form.locator('[name="traffic:standard:standard:visibleMs"]').fill('1.1');await form.locator('[name="traffic:standard:standard:intervalMs"]').fill('2.1');
 const ark=form.locator('details').filter({has:page.locator('summary',{hasText:'کشتی نوح'})});await ark.locator('summary').click();await form.locator('[name="ark:standard:level"]').selectOption('easy');await form.locator('[name="ark:standard:standard:limitMs"]').fill('90');await expect(form.locator('[name="traffic:standard:standard:visibleMs"]')).toHaveValue('1.1');
 const saved=page.waitForResponse(response=>response.url().endsWith('/training-profiles')&&response.request().method()==='POST');await form.locator('button[type=submit]').click();const response=await saved;expect(response.status()).toBe(201);const profile=(await response.json()).profile;expect(profileEntry(profile.settings,'ark').level).toBe('easy');expect(profileEntry(profile.settings,'traffic').timings.standard.visibleMs).toBe(1100);
 await page.locator('[data-action=close-training-profile]').click();await page.setViewportSize({width:1440,height:1000});await page.locator('.training-profile-grid').screenshot({path:'.local/verification/training_profiles_catalog.png'});
});

test('the level selector assigns different named profiles per game and retains fixed mode on mobile',async({page})=>{
 await login(page);await inspect(page);await page.locator('#policy-game').selectOption('traffic');await page.locator('#policy-level').selectOption(`profile:${a.id}`);await expect(page.locator('#admin-difficulty-form [name=mode]')).toBeDisabled();await expect(page.locator('#admin-difficulty-form [name=mode]')).toHaveValue('fixed');await saveAssignment(page);await expect(page.locator('#policy-profile-summary')).toContainText(a.name);
 await page.locator('#policy-game').selectOption('ark');await page.locator('#policy-level').selectOption(`profile:${b.id}`);await saveAssignment(page);await page.locator('#policy-game').selectOption('traffic');await expect(page.locator('#policy-level')).toHaveValue(`profile:${a.id}`);await expect(page.locator('#policy-profile-summary')).toContainText('۱٫۵ ثانیه');
 await page.locator('#user-difficulty').screenshot({path:'.local/verification/training_profile_assignment.png'});
 for(const width of [360,768]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#policy-level')).toHaveValue(`profile:${a.id}`);}
 const own=await(await admin.get(`/api/children/${childId}/difficulty`)).json();expect(own.settings.find(row=>row.gameId==='ark').trainingProfileId).toBe(b.id);
});

test('a live profile edit changes the next game while current play and saved reports retain their snapshot',async({page})=>{
 await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceProfileGame=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});
 await login(page,false);await page.locator('[data-action=open][data-game=traffic]').first().click();await expect(page.locator('.level-selector')).toContainText(a.name);
 const begun=page.waitForResponse(response=>response.url().endsWith('/sessions')&&response.request().method()==='POST');await page.locator('[data-action=main-game]').click();const run=await(await begun).json();expect(run.settings.trainingProfile.name).toBe(a.name);await page.locator('[data-action=begin-game]').click();await advance(page,3000);
 const changed=structuredClone(a.settings);profileEntry(changed,'traffic').level='medium';profileEntry(changed,'traffic').timings.standard={visibleMs:650,intervalMs:1950};
 try{
  await patchProfile(a.id,{name:'پروفایل تازهٔ کودکان',settings:changed});await expect(page.locator('.play-panel')).toHaveAttribute('data-interval-ms','2500');
  const completed=page.waitForResponse(response=>response.url().endsWith('/complete'));for(let i=0;i<150;i++)await advance(page,2500);const record=(await(await completed).json()).record;expect(record.result.trainingProfile.name).toBe(a.name);expect(record.result.level).toBe('hard');await expect(page.locator('.result-card')).toBeVisible();
  await page.locator('[data-action=replay]').click();await expect(page.locator('.play-panel')).toHaveAttribute('data-interval-ms','1950');await expect(page.locator('.level-pill')).toContainText('متوسط');
 }finally{await patchProfile(a.id,{name:a.name,settings:a.settings});}
});

test('stale profile edits retain the complete draft and require discard before reloading',async({page})=>{
 await login(page);await settings(page);await page.locator(`[data-training-profile="${a.id}"] [data-action=edit-training-profile]`).click();const form=page.locator('#training-profile-form');await form.locator('[name=name]').fill('پیش‌نویس محلی');await patchProfile(a.id,{description:'ویرایش ادمین دیگر'});
 const done=page.waitForResponse(response=>response.url().endsWith('/'+a.id)&&response.request().method()==='PATCH');await form.locator('button[type=submit]').click();expect((await done).status()).toBe(409);await expect(page.locator('#training-profile-error')).toContainText('جای دیگری');await expect(form.locator('[name=name]')).toHaveValue('پیش‌نویس محلی');
 await page.locator(`[data-training-profile="${b.id}"] [data-action=edit-training-profile]`).click();await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=stay]').click();await expect(form.locator('[name=name]')).toHaveValue('پیش‌نویس محلی');
 await page.locator(`[data-training-profile="${a.id}"] [data-action=edit-training-profile]`).click();await page.locator('[data-guard=discard]').click();await expect(form.locator('[name=description]')).toHaveValue('ویرایش ادمین دیگر');
});

test('repeating a baseline keeps standard easy timing and never labels its result with the assigned custom profile',async({page})=>{
 await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceProfileGame=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});
 await login(page,false);await page.goto('/#assessment');await page.locator('[data-action=assess-game][data-game=traffic]').click();await page.locator('[data-action=practice]').click();await expect(page.locator('.play-panel')).toHaveAttribute('data-interval-ms','1500');await expect(page.locator('.level-pill')).toContainText('آسان');await page.locator('[data-action=begin-game]').click();await advance(page,3000);
 const saved=page.waitForResponse(response=>response.url().endsWith('/complete'));
 for(let i=0;i<5;i++){await advance(page,1500);await expect(page.locator('.practice-review')).toBeVisible();await page.locator('[data-action=continue-review]').click();}
 const response=await saved;expect(response.status()).toBe(200);expect(response.request().postDataJSON().result.trainingProfile).toBeUndefined();expect((await response.json()).record.result.trainingProfile).toBeUndefined();
});

test('archiving keeps the currently assigned profile visible and built-in selection restores adaptive controls',async({page})=>{
 await login(page);await settings(page);const card=page.locator(`[data-training-profile="${a.id}"]`);await card.locator('[data-action=archive-training-profile]').click();await expect(card).toContainText('بایگانی‌شده');
 try{
  await inspect(page);await page.locator('#policy-game').selectOption('traffic');await expect(page.locator('#policy-level')).toHaveValue(`profile:${a.id}`);await expect(page.locator(`#policy-level option[value="profile:${a.id}"]`)).toContainText('بایگانی');await page.locator('#policy-game').selectOption('ark');await expect(page.locator(`#policy-level option[value="profile:${a.id}"]`)).toHaveCount(0);
  await page.locator('#policy-game').selectOption('traffic');await page.locator('#policy-level').selectOption('hard');await expect(page.locator('#admin-difficulty-form [name=mode]')).toBeEnabled();await page.locator('#admin-difficulty-form [name=mode]').selectOption('adaptive');await saveAssignment(page);
 }finally{await patchProfile(a.id,{archived:false});}
});
