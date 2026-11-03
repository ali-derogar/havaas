import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function login(page,key='otherUser'){
 await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users[key].username);
 await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();
 await expect(page.locator(key==='admin'?'.admin-stats':'.client-welcome')).toBeVisible();
}
async function action(page,name,extra=''){
 const button=page.locator(`[data-action="${name}"]${extra}:visible`).first();
 if(await button.count()&&await button.evaluate(el=>!!el.closest('.admin-sidebar'))&&await page.locator('.menu-toggle').isVisible())await page.locator('.menu-toggle').click();
 await button.click();
}
async function shots(page,name){
 await page.evaluate(()=>document.fonts.ready);
 for(const width of [360,768,1440]){
  await page.setViewportSize({width,height:960});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} at ${width}`).toBe(true);
  await page.screenshot({path:`.local/verification/platform-${name}-${width}.png`,fullPage:true,animations:'disabled'});
 }
}

test('platform design: illustrated login preserves labels, password visibility, errors and keyboard sign-in',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await expect(page.locator('.auth-story .journey-art')).toBeVisible();await shots(page,'login');
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.locator('.journey-tile').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await page.emulateMedia({reducedMotion:'no-preference'});
 const textContrast=await page.locator('.auth-card>p:not(.auth-note)').evaluate(el=>{
  const values=getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return 1.05/(values[0]*.2126+values[1]*.7152+values[2]*.0722+.05);
 });expect(textContrast).toBeGreaterThanOrEqual(4.5);
 const user=page.locator('#login-form [name=identifier]'),password=page.locator('#login-form [name=password]'),toggle=page.locator('[data-action=toggle-password]');
 await user.fill(seed.users.otherUser.username);await password.fill('incorrect-test-password');await toggle.click();
 await expect(password).toHaveAttribute('type','text');await expect(toggle).toHaveAttribute('aria-pressed','true');
 await toggle.click();await expect(password).toHaveAttribute('type','password');await expect(toggle).toHaveAccessibleName('نمایش رمز');
 await page.locator('#login-form button[type=submit]').click();await expect(page.locator('#account-error')).not.toBeEmpty();
 await password.fill(seed.password);await password.press('Enter');await expect(page.locator('.client-welcome')).toBeVisible();
 expect(errors).toEqual([]);
});

test('platform design: centre dashboard, users, details, settings and invitations fit all screen sizes',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await login(page,'admin');
 await shots(page,'admin');
 await action(page,'admin-users');await expect(page.locator('.users-card')).toBeVisible();await shots(page,'users');
 await action(page,'inspect-user',`[data-user="${seed.users.otherUser.id}"]`);await expect(page.locator('.user-tabs')).toBeVisible();await shots(page,'user-overview');
 for(const tab of ['details','difficulty']){
  await action(page,'user-tab',`[data-tab="${tab}"]`);await expect(page.locator(`#user-${tab}`)).toBeVisible();await shots(page,`user-${tab}`);
 }
 await action(page,'account');await expect(page.locator('#password-form')).toBeVisible();await shots(page,'admin-settings');
 await action(page,'admin-invitations');await expect(page.locator('.invitations-list')).toBeVisible();await shots(page,'invitations');
 await action(page,'new-registration');await expect(page.locator('#registration-link-form')).toBeVisible();await shots(page,'create-invitation');await action(page,'close-modal');
 expect(errors).toEqual([]);
});

test('platform design: client library, assessment, report and account preserve their real data and mobile navigation',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await login(page);
 const {csrfToken}=await(await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':csrfToken};
 for(const kind of ['baseline','training']){
  const response=await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers,data:{gameId:'ark',kind}});expect(response.ok()).toBe(true);
  const run=await response.json();expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
 }
 await page.reload();await expect(page.locator('.client-welcome')).toBeVisible();await shots(page,'home');
 await action(page,'assessment');await expect(page.locator('.assessment-grid')).toBeVisible();await expect(page.locator('.assessment-step')).toHaveCount(7);await shots(page,'assessment');
 await action(page,'dashboard');await expect(page.locator('.report-metrics')).toBeVisible();await shots(page,'reports');
 await page.emulateMedia({media:'print'});await expect(page.locator('.client-header')).toBeHidden();await page.pdf({path:'.local/verification/platform-report.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});
 await action(page,'account');await expect(page.locator('#password-form')).toBeVisible();await shots(page,'account');
 await action(page,'report-links');await expect(page.locator('#report-link-form')).toBeVisible();await shots(page,'family-links');
 await page.setViewportSize({width:360,height:780});await expect(page.locator('.client-bottom-nav')).toBeVisible();await action(page,'home');await expect(page.locator('.client-welcome')).toBeVisible();
 await action(page,'open','[data-game="stroop"]');await expect(page.locator('#lesson-box')).toBeVisible();await shots(page,'game-intro');
 expect(errors).toEqual([]);
});
