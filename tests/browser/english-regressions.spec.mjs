import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

let seed,admin,headers;
test.beforeAll(async()=>{
 seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));
 admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 const session=await(await admin.get('/api/auth/session')).json();
 const auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':session.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
 headers={'X-CSRF-Token':auth.csrfToken,'X-App-Locale':'en'};
});
test.afterAll(async()=>{await admin?.dispose();});

for(const blocked of ['access','read'])test(`English login and offline pages honor the URL when local storage ${blocked} is blocked`,async({page})=>{
 await page.addInitScript(blocked=>{
  if(blocked==='access')Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  else Storage.prototype.getItem=()=>{throw new DOMException('Blocked','SecurityError');};
 },blocked);
 await page.goto('/?lang=en');await expect(page.locator('#login-form')).toContainText('Password');
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('html')).toHaveAttribute('dir','ltr');
 await page.goto('/offline.html?lang=en');await expect(page.locator('html')).toHaveAttribute('lang','en');
 const text=await page.locator('main').evaluate(main=>{const copy=main.cloneNode(true);copy.querySelectorAll('.language-switcher').forEach(node=>node.remove());return copy.textContent;});
 expect(text).not.toMatch(/[\u0600-\u06ff]/);
 for(const locale of ['fa','en']){
  await page.locator('[data-locale-select]').selectOption(locale);await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang',locale);
  expect(new URL(page.url()).searchParams.get('lang')).toBe(locale);
 }
});

test('an English signup link preserves the grade across languages and stays English after signup and reload without storage',async({page})=>{
 const issued=await admin.post('/api/registration-links',{headers,data:{label:'English signup regression'}});expect(issued.ok()).toBe(true);
 const {url}=await issued.json();expect(new URL(url).searchParams.get('lang')).toBe('en');
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});
 await page.goto(url);await expect(page.locator('html')).toHaveAttribute('lang','en');
 const form=page.locator('#registration-form');
 for(const [name,value]of Object.entries({username:'english-signup-'+randomUUID().slice(0,8),password:seed.password,firstName:'آبی',lastName:'English',birthDate:'2016-04-01',school:'School'}))await form.locator(`[name=${name}]`).fill(value);
 await form.locator('[name=grade]').selectOption({label:'Grade 3'});
 for(const locale of ['fa','en']){
  await page.locator('[data-locale-select]').selectOption(locale);await expect(page.locator('html')).toHaveAttribute('lang',locale);
  await expect(form.locator('[name=grade]')).toHaveValue('پایهٔ ۳');await expect(form.locator('[name=birthDate]')).toHaveValue('2016-04-01');await expect(form.locator('[name=firstName]')).toHaveValue('آبی');
 }
 await form.locator('button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();
 expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
 await page.reload();await expect(page.locator('.hero')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','en');
 expect((await(await page.request.get('/api/bootstrap')).json()).profiles[0].grade).toBe('پایهٔ ۳');
});

test('an English account invitation keeps its language after acceptance and reload',async({page})=>{
 const issued=await admin.post('/api/users',{headers,data:{username:'english-invite-'+randomUUID().slice(0,8),name:'English Administrator',role:'admin',method:'invite'}});expect(issued.status()).toBe(201);
 const {url}=await issued.json();expect(new URL(url).searchParams.get('lang')).toBe('en');
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});
 await page.goto(url);await expect(page.locator('html')).toHaveAttribute('lang','en');
 await page.locator('#accept-form [name=password]').fill(seed.password);await page.locator('#accept-form button[type=submit]').click();await expect(page.locator('.admin-stats')).toBeVisible();
 expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
 await page.reload();await expect(page.locator('.admin-stats')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','en');
});

test('English administration retains a Persian school grade through language switches and a profile save',async({page})=>{
 await page.goto('/?lang=en');await page.locator('#login-form [name=identifier]').fill(seed.users.admin.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.admin-stats')).toBeVisible();
 await page.goto(`/?lang=en#admin/user/${seed.users.user.id}`);await page.locator('[data-action=user-tab][data-tab=details]').click();
 for(const locale of ['en','fa','en']){
  if(await page.locator('html').getAttribute('lang')!==locale)await page.locator('[data-locale-select]').selectOption(locale);
  await expect(page.locator('#edit-user-form [name=grade]')).toHaveValue('پایهٔ ۳');
 }
 const saved=page.waitForResponse(response=>response.url().endsWith(`/api/users/${seed.users.user.id}`)&&response.request().method()==='PATCH');
 await page.locator('#edit-user-form button[type=submit]').click();expect((await saved).status()).toBe(200);
 expect((await(await admin.get(`/api/users/${seed.users.user.id}`)).json()).profile.grade).toBe('پایهٔ ۳');
 await page.locator('[data-action=user-tab][data-tab=sessions]').click();await expect(page.locator('.report-profile p').first()).toContainText('Grade 3');
 await expect(page.locator('.report-profile p').first()).toContainText('2016');
});

test('PWA notices and accessible controls follow English and Persian language switches',async({page})=>{
 await page.goto('/?lang=fa');await expect(page.locator('#login-form')).toBeVisible();
 await page.evaluate(()=>navigator.serviceWorker.dispatchEvent(new MessageEvent('message',{data:{type:'PWA_UPDATE_BLOCKED'}})));
 const banner=page.locator('#pwa-banner');await expect(banner).toContainText('حواس در یک پنجره');
 await page.locator('[data-locale-select]').selectOption('en');await expect(page.locator('html')).toHaveAttribute('lang','en');
 expect(await banner.textContent()).not.toMatch(/[\u0600-\u06ff]/);
 await expect(banner.locator('[data-pwa-action=update]')).toHaveText(/update/i);
 for(const attribute of [banner,banner.locator('[data-pwa-action=dismiss]')])expect(await attribute.getAttribute('aria-label')).not.toMatch(/[\u0600-\u06ff]/);
 await page.locator('[data-locale-select]').selectOption('fa');await expect(banner).toContainText('حواس در یک پنجره');
});
