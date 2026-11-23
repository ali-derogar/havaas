import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function login(page,role='otherUser',locale='fa'){
 await page.goto(`/?lang=${locale}`);
 await page.locator('#login-form [name=identifier]').fill(seed.users[role].username);
 await page.locator('#login-form [name=password]').fill(seed.password);
 await page.locator('#login-form button[type=submit]').click();
 await expect(page.locator(role==='admin'?'.admin-stats':'.hero')).toBeVisible();
}
async function account(page){
 await page.evaluate(()=>{location.hash='#account';});
 await expect(page.locator('#password-form')).toBeVisible();
}

test('a late language response cannot overwrite edits made after switching back',async({page})=>{
 await login(page);await account(page);
 let release,ready;
 const gate=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>ready=resolve);
 await page.route('**/api/bootstrap?**',async route=>{
  if(route.request().headers()['x-app-locale']==='en'){
   const response=await route.fetch();ready();await gate;await route.fulfill({response});
  }else await route.continue();
 });
 try{
  const oldForm=await page.locator('#password-form').elementHandle();
  await page.locator('[data-locale-select]').selectOption('en');await requested;
  await page.locator('[data-locale-select]').selectOption('fa');
  await expect.poll(()=>oldForm.evaluate(form=>form.isConnected)).toBe(false);
  await page.locator('#password-form [name=currentPassword]').fill('edited-after-switch');
  release();await page.waitForLoadState('networkidle');
  await expect(page.locator('#password-form [name=currentPassword]')).toHaveValue('edited-after-switch');
  await expect(page.locator('html')).toHaveAttribute('lang','fa');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('a failed language refresh keeps the current language and unsaved form intact',async({page})=>{
 await login(page);await account(page);
 await page.locator('#password-form [name=currentPassword]').fill('unsaved-form-value');
 await page.route('**/api/bootstrap?**',route=>route.abort('failed'));
 await page.locator('[data-locale-select]').selectOption('en');
 await expect(page.locator('#account-error')).not.toBeEmpty();
 await expect(page.locator('html')).toHaveAttribute('lang','fa');
 await expect(page.locator('[data-locale-select]')).toHaveValue('fa');
 await expect(page.locator('#password-form [name=currentPassword]')).toHaveValue('unsaved-form-value');
 expect(await page.evaluate(()=>localStorage.getItem('havaas:locale:v1'))).toBe('fa');
});

test('typing while a language refresh is pending survives the translated form',async({page})=>{
 await login(page);await account(page);
 let release,ready;
 const gate=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>ready=resolve);
 let delayed=false;
 await page.route('**/api/bootstrap?**',async route=>{
  if(!delayed){delayed=true;const response=await route.fetch();ready();await gate;await route.fulfill({response});}
  else await route.continue();
 });
 try{
  const oldForm=await page.locator('#password-form').elementHandle();
  await page.locator('[data-locale-select]').selectOption('en');await requested;
  await page.locator('#password-form [name=currentPassword]').fill('typed-during-refresh');
  release();await expect.poll(()=>oldForm.evaluate(form=>form.isConnected)).toBe(false);
  await expect(page.locator('#password-form [name=currentPassword]')).toHaveValue('typed-during-refresh');
  await expect(page.locator('#password-form')).toContainText('Current password');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('a failed rapid language switch rolls back to the last rendered language',async({page})=>{
 await login(page);await account(page);
 let release,ready;
 const gate=new Promise(resolve=>release=resolve),requested=new Promise(resolve=>ready=resolve);
 await page.route('**/api/bootstrap?**',async route=>{
  if(route.request().headers()['x-app-locale']==='en'){
   const response=await route.fetch();ready();await gate;await route.fulfill({response});
  }else await route.abort('failed');
 });
 try{
  await page.locator('[data-locale-select]').selectOption('en');await requested;
  await page.locator('[data-locale-select]').selectOption('fa');
  await expect(page.locator('#account-error')).not.toBeEmpty();
  await expect(page.locator('html')).toHaveAttribute('lang','fa',{timeout:1000});
  await expect(page.locator('[data-locale-select]')).toHaveValue('fa');
  release();await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('lang','fa');
  expect(new URL(page.url()).searchParams.get('lang')).toBe('fa');
 }finally{release();await page.unrouteAll({behavior:'wait'});}
});

test('English session CSV uses the selected interface language',async({page})=>{
 await login(page,'admin','en');
 const auth=await(await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':auth.csrfToken};
 const response=await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers,data:{gameId:'traffic',kind:'baseline',locale:'en',clientExperienceVersion:4}});
 expect(response.ok()).toBe(true);const run=await response.json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 await page.evaluate(id=>{location.hash=`#admin/user/${id}`;},seed.users.otherUser.id);
 await page.locator('[data-action=user-tab][data-tab=sessions]').click();
 await page.locator('[data-report-filter=kind]').selectOption('baseline');
 const downloaded=page.waitForEvent('download');await page.locator('[data-action=export-trials]').click();
 const csv=await readFile(await(await downloaded).path(),'utf8');
 expect(csv.split('\n')[0]).not.toMatch(/[\u0600-\u06ff]/);
 expect(csv.split('\n')[0]).toContain('Response');
});
