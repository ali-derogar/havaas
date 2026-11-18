import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {playSession} from '../helpers/play-session.mjs';
let seed,admin,csrf,account,guest,child;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
test.beforeEach(async()=>{
 admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});let auth=await(await admin.get('/api/auth/session')).json();auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();csrf=auth.csrfToken;
 const link=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':csrf},data:{label:'آزمون پنل مدیریت'}})).json();guest=await request.newContext({baseURL:'http://127.0.0.1:4181'});const anon=await(await guest.get('/api/auth/session')).json();
 const created=await guest.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':anon.csrfToken},data:{token:link.url.split('/').at(-1),username:'panels-'+randomUUID().slice(0,12),password:seed.password,profile:{firstName:'آزمون',lastName:'پنل',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'مدرسهٔ آزمایشی'}}});expect(created.status()).toBe(201);account=(await created.json()).user;child=(await(await guest.get('/api/bootstrap')).json()).profiles[0];
});
test.afterEach(async()=>{await admin.dispose();await guest.dispose();});
async function login(page,key='admin'){
 await page.goto('/');await page.locator('#login-form [name=identifier]').fill(key==='admin'?seed.users.admin.username:account.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator(key==='admin'?'.admin-stats':'.hero')).toBeVisible();
}
async function inspect(page){await login(page);await page.goto('/#admin/user/'+account.id);await expect(page.locator('.user-tabs')).toBeVisible();}
const tab=(page,key)=>page.locator(`[data-action=user-tab][data-tab="${key}"]`);
async function current(){return (await(await admin.get('/api/users/'+account.id)).json());}

test('panels: a stale form keeps its draft, shows conflict, and reloads only after discard confirmation',async({page})=>{
 await inspect(page);await tab(page,'details').click();await page.locator('#edit-user-form [name=school]').fill('پیش‌نویس مدرسه');
 const original=await current();expect((await admin.patch('/api/users/'+account.id,{headers:{'X-CSRF-Token':csrf},data:{expectedRevision:original.user.revision,expectedProfileRevision:original.profile.revision,profile:{...original.profile,concerns:'یادداشت جدید محرمانه'}}})).ok()).toBe(true);
 const conflict=page.waitForResponse(r=>r.url().endsWith('/api/users/'+account.id)&&r.request().method()==='PATCH'&&r.status()===409);await page.locator('#edit-user-form button[type=submit]').click();await conflict;
 await expect(page.locator('#profile-error')).toContainText('جای دیگری');await expect(page.locator('#edit-user-form [name=school]')).toHaveValue('پیش‌نویس مدرسه');expect((await current()).profile.concerns).toBe('یادداشت جدید محرمانه');
 await page.locator('[data-action=reload-conflict]').click();await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=discard]').click();await expect(page.locator('#edit-user-form [name=concerns]')).toHaveValue('یادداشت جدید محرمانه');
 await page.locator('#edit-user-form [name=school]').fill('مدرسهٔ نهایی');const saved=page.waitForResponse(r=>r.url().endsWith('/api/users/'+account.id)&&r.request().method()==='PATCH'&&r.status()===200);await page.locator('#edit-user-form button[type=submit]').click();await saved;await expect(page.locator('#account-status')).toContainText('ذخیره شد');expect((await current()).profile.concerns).toBe('یادداشت جدید محرمانه');expect((await guest.get('/api/bootstrap')).status()).toBe(200);
});

test('panels: dirty forms survive tabs, RTL keys are manual, and save-and-continue finishes before navigation',async({page})=>{
 await inspect(page);await tab(page,'details').click();await page.locator('#edit-user-form [name=school]').fill('ذخیره با ادامه');await tab(page,'details').focus();await page.keyboard.press('ArrowLeft');await expect(tab(page,'sessions')).toBeFocused();await expect(tab(page,'details')).toHaveAttribute('aria-selected','true');await page.keyboard.press('Enter');await expect(page.locator('#user-sessions')).toBeVisible();await tab(page,'details').click();await expect(page.locator('#edit-user-form [name=school]')).toHaveValue('ذخیره با ادامه');
 await page.locator('.admin-sidebar [data-action=admin-users]').click();await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=stay]').click();await expect(page.locator('#edit-user-form [name=school]')).toHaveValue('ذخیره با ادامه');
 await page.locator('.admin-sidebar [data-action=admin-users]').click();await page.locator('[data-guard=save]').click();await expect(page.locator('.members-table')).toBeVisible();expect((await current()).profile.school).toBe('ذخیره با ادامه');
});

test('panels: a dirty creation modal is protected when Escape is pressed',async({page})=>{
 await login(page);await page.locator('[data-action=new-user]').first().click();await page.locator('#create-user-form [name=username]').fill('unsaved-'+Date.now());await page.keyboard.press('Escape');await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=stay]').click();await expect(page.locator('#modal')).toBeVisible();await expect(page.locator('#create-user-form [name=username]')).not.toHaveValue('');
 await page.keyboard.press('Escape');await page.locator('[data-guard=discard]').click();await expect(page.locator('#modal')).not.toBeVisible();
});

test('panels: cancelling Back preserves the entry and a later discard keeps Forward usable',async({page})=>{
 await login(page);await page.locator('.admin-sidebar [data-action=admin-users]').click();await page.locator(`[data-action=inspect-user][data-user="${account.id}"]`).click();await tab(page,'details').click();await page.locator('#edit-user-form [name=school]').fill('پیش‌نویس بازگشت');
 const currentURL=page.url();await page.goBack();await expect(page.locator('.navigation-confirm')).toBeVisible();await expect(page).toHaveURL(currentURL);await page.locator('[data-guard=stay]').click();await expect(page.locator('#edit-user-form [name=school]')).toHaveValue('پیش‌نویس بازگشت');
 await page.goBack();await expect(page.locator('.navigation-confirm')).toBeVisible();await page.locator('[data-guard=discard]').click();await expect(page).toHaveURL(/#admin\/users$/);await expect(page.locator('.members-table')).toBeVisible();await page.goForward();await expect(page).toHaveURL(currentURL);await expect(page.locator('.user-tabs')).toBeVisible();
});

test('panels: an acknowledged admin invitation stays visible when refreshing users fails',async({page})=>{
 await login(page);await page.locator('.admin-sidebar [data-action=admin-users]').click();await expect(page.locator('.members-table')).toBeVisible();await page.locator('[data-action=new-user]').click();await page.locator('#new-user-role').selectOption('admin');await page.locator('#new-user-method').selectOption('invite');await page.locator('#create-user-form [name=username]').fill('invitation-'+randomUUID().slice(0,10));await page.locator('#create-user-form [name=name]').fill('مدیر دعوت‌شده');
 let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/users'))posts++;});await page.route('**/api/users?*',route=>route.abort('failed'));await page.locator('#create-user-form button[type=submit]').click();await expect(page.locator('#invitation-url')).toHaveValue(/#invite\//);await page.locator('#modal [data-action=close-modal]').click();await expect(page.locator('[data-action=refresh-panel]')).toBeVisible();await page.unroute('**/api/users?*');await page.locator('[data-action=refresh-panel]').click();await expect(page.locator('.members-table')).toBeVisible();expect(posts).toBe(1);
});

test('panels: a saved parent link survives a failed list refresh without creating another link',async({page})=>{
 await login(page,'user');await page.goto('/#report-links');await expect(page.locator('#report-link-form')).toBeVisible();let posts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/report-links'))posts++;});
 await page.route('**/api/children/*/report-links',route=>route.request().method()==='GET'?route.abort('failed'):route.continue());await page.locator('#report-link-form button[type=submit]').click();await expect(page.locator('#invitation-url')).toHaveValue(/#report\//);await expect(page.locator('[data-action=refresh-panel]')).toBeVisible();await page.unroute('**/api/children/*/report-links');await page.locator('[data-action=refresh-panel]').click();expect(posts).toBe(1);expect((await(await guest.get(`/api/children/${child.id}/report-links`)).json()).links.filter(l=>!l.revokedAt)).toHaveLength(1);
 await page.setViewportSize({width:360,height:780});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/verification/panels-link-after-refresh-failure.png',fullPage:true});
});

test('panels: a saved edit is acknowledged before refresh failure and retry only reads the server',async({page})=>{
 await inspect(page);await tab(page,'details').click();await page.locator('#edit-user-form [name=school]').fill('ذخیره پیش از رفرش');
 let patches=0;page.on('request',r=>{if(r.method()==='PATCH'&&r.url().endsWith('/api/users/'+account.id))patches++;});await page.route('**/api/bootstrap?*',r=>r.abort('failed'));await page.locator('#edit-user-form button[type=submit]').click();await expect(page.locator('[data-action=refresh-panel]')).toBeVisible();await expect(page.locator('#edit-user-form')).toHaveAttribute('data-acknowledged','true');expect((await current()).profile.school).toBe('ذخیره پیش از رفرش');
 await page.locator('#edit-user-form button[type=submit]').click();expect(patches).toBe(1);await page.unroute('**/api/bootstrap?*');await page.locator('[data-action=refresh-panel]').click();await expect(page.locator('#edit-user-form [name=school]')).toHaveValue('ذخیره پیش از رفرش');await page.locator('.admin-sidebar [data-action=admin-users]').click();await expect(page.locator('.members-table')).toBeVisible();await expect(page.locator('.navigation-confirm')).toHaveCount(0);expect(patches).toBe(1);
});

test('panels: session history and raw outcomes load on demand, with independent selection and public pagination',async({page,browser})=>{
 const auth=await(await guest.get('/api/auth/session')).json(),headers={'X-CSRF-Token':auth.csrfToken};
 for(let i=0;i<26;i++){const run=await(await guest.post(`/api/children/${child.id}/sessions`,{headers,data:{gameId:'traffic',kind:i?'training':'baseline',clientExperienceVersion:2}})).json();expect((await guest.post(`/api/children/${child.id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);}
 let reports=0,details=0;page.on('request',r=>{const path=new URL(r.url()).pathname;if(path.endsWith('/reports'))reports++;if(/\/sessions\/[^/]+$/.test(path)&&r.method()==='GET')details++;});
 await inspect(page);expect(reports).toBe(0);await expect(page.locator('.session-history')).toHaveCount(0);await tab(page,'sessions').click();await expect(page.locator('.session-history tbody tr')).toHaveCount(20);expect(details).toBe(0);
 await page.locator('[data-action=report-page][data-page="2"]').click();await expect(page.locator('.session-history tbody tr')).toHaveCount(5);await page.locator('.session-history [data-action=select-record]').last().click();await page.locator('.outcome-details>summary').click();await expect(page.locator('.outcome-details tbody tr')).toHaveCount(150);expect(details).toBe(1);
 const link=await(await guest.post(`/api/children/${child.id}/report-links`,{headers,data:{label:'گزارش صفحه‌بندی‌شده'}})).json();const family=await browser.newContext(),parent=await family.newPage();try{await parent.goto(link.url);await expect(parent.locator('.session-history tbody tr')).toHaveCount(20);await parent.locator('[data-action=report-page][data-page="2"]').click();await expect(parent.locator('.session-history tbody tr')).toHaveCount(6);await expect(parent.locator('.outcome-details')).toHaveCount(0);}finally{await family.close();}
});

test('panels: audit history is available per user and globally with no clinical value copied',async({page})=>{
 const data=await current();expect((await admin.patch('/api/users/'+account.id,{headers:{'X-CSRF-Token':csrf},data:{expectedRevision:data.user.revision,expectedProfileRevision:data.profile.revision,profile:{...data.profile,concerns:'secret-audit-value'}}})).ok()).toBe(true);
 await inspect(page);await tab(page,'audit').click();await expect(page.locator('#user-audit')).toContainText('یادداشت بالینی');await expect(page.locator('#user-audit')).not.toContainText('secret-audit-value');await page.locator('.admin-sidebar [data-action=admin-audit]').click();await expect(page.locator('h1')).toHaveText('تاریخچهٔ مدیریت');await page.locator('[name=actorSearch]').fill(account.username);await page.locator('#audit-filter-form button[type=submit]').click();await expect(page.locator(`[name=actorId] option[value="${account.id}"]`)).toHaveCount(1);await page.locator('[name=actorId]').selectOption(account.id);await page.locator('#audit-filter-form button[type=submit]').click();await expect(page.locator('#audit-filter-form')).toBeVisible();await page.setViewportSize({width:360,height:780});await expect(page.locator('.admin-sidebar')).not.toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/verification/panels-audit-mobile.png',fullPage:true});
});
