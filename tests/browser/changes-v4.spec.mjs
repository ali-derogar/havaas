import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const frames=new Map();performance.now=()=>now;requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};cancelAnimationFrame=id=>frames.delete(id);window.advanceV4=ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(now));};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceV4(ms),ms);
async function login(page,role='otherUser',locale='en'){
 await page.goto(`/?lang=${locale}`);await page.locator('#login-form [name=identifier]').fill(seed.users[role].username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.locator(role==='admin'?'.admin-stats':'.hero')).toBeVisible();
}
async function baseline(page,gameId,options={}){
 const auth=await(await page.request.get('/api/auth/session')).json();
 const response=await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId,kind:'baseline',locale:'en',clientExperienceVersion:4,...options}});expect(response.ok()).toBe(true);
 const run=await response.json();expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
test('language selection preserves typed credentials, persists and renders English administration',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');
 await page.locator('#login-form [name=identifier]').fill(seed.users.admin.username);await page.locator('#login-form [name=password]').fill(seed.password);
 await page.locator('[data-locale-select]').selectOption('en');await expect(page.locator('html')).toHaveAttribute('dir','ltr');await expect(page.locator('#login-form [name=identifier]')).toHaveValue(seed.users.admin.username);await expect(page.locator('#login-form [name=password]')).toHaveValue(seed.password);await expect(page.locator('#login-form')).toContainText('Password');
 await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.admin-stats')).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'.local/verification/v4_english_admin.png',fullPage:true});
 await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('.admin-stats')).toBeVisible();expect(errors).toEqual([]);
});
test('butterfly hunt changes its target at both section boundaries and saves all 150 trials',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);await baseline(page,'hunt',{theme:'butterfly'});
 await page.locator('[data-action=open][data-game=hunt]').first().click();await page.locator('[data-action=theme][data-theme=butterfly]').click();await expect(page.locator('[data-action=theme][data-theme=butterfly]')).toHaveAttribute('aria-pressed','true');
 await click(page,'main-game');await expect(page.locator('.hunt-preparation')).toBeVisible();await expect(page.locator('.butterfly-orientation').first()).toHaveAttribute('transform','rotate(90 32 32)');await click(page,'begin-game');await advance(page,3000);
 const colors=[];let notices=0;const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
 for(let i=0;i<150;i++){
  if(i===20||i===70){await expect(page.locator('.automatic-rule-notice')).toBeVisible();notices++;const frozen=await page.locator('#time').textContent();await advance(page,2999);await expect(page.locator('#time')).toHaveText(frozen);await advance(page,1);}
  const targets=await page.locator('.instruction-strip .target-mini .symbol').evaluateAll(nodes=>nodes.map(node=>node.outerHTML));
  if([0,20,70].includes(i))colors.push(targets[0]);
  const choice=await page.locator('.hunt-choice').evaluateAll((nodes,targets)=>nodes.find(node=>targets.includes(node.querySelector('.symbol').outerHTML))?.dataset.choice,targets);
  await advance(page,50);if(choice!==undefined)await page.locator(`.hunt-choice[data-choice="${choice}"]`).click();
  const interval=await page.locator('.play-panel').getAttribute('data-interval-ms');await advance(page,Number(interval)-50);
 }
 await expect(page.locator('.result-card')).toBeVisible();const result=(await(await saved).json()).record.result;expect(result.hits).toBe(30);expect((await saved).request().postDataJSON().result.outcomes).toHaveLength(150);expect(result.locale).toBe('en');expect(notices).toBe(2);expect(new Set(colors).size).toBe(3);
 await page.screenshot({path:'.local/verification/v4_hunt_result.png',fullPage:true});expect(errors).toEqual([]);
});
test('traffic completes the longer route with three scored stops and a fresh green response',async({page})=>{
 await clock(page);await login(page);await baseline(page,'traffic');await page.locator('[data-action=open][data-game=traffic]').first().click();await click(page,'main-game');await click(page,'begin-game');await advance(page,3000);
 await expect(page.locator('.road-bump')).toHaveCount(3);await expect(page.locator('.traffic-road')).toHaveAttribute('data-travel','562.5');
 const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
 let before=0;
 for(let i=0;i<150;i++){
  const green=await page.locator('.traffic-live-signal').getAttribute('data-lamp')==='green';await advance(page,100);if(green)await click(page,'respond');const progress=Number(await page.locator('.traffic-road').getAttribute('data-progress'));expect(progress).toBeGreaterThanOrEqual(before);before=progress;
  if(i===65)await page.screenshot({path:'.local/verification/v4_traffic_route.png',fullPage:true});
  const interval=Number(await page.locator('.play-panel').getAttribute('data-interval-ms'));await advance(page,interval-100);
 }
 await expect(page.locator('.result-card')).toBeVisible();const result=(await(await saved).json()).record.result;expect(result.hits).toBe(30);expect(result.journey.progress).toBe(1);const stops=(await saved).request().postDataJSON().result.journey.stops;expect(stops).toHaveLength(3);expect(stops.every(stop=>stop.correct)).toBe(true);
});
test('English public reports and PDF preserve participant names and exclude clinical data',async({page,browser})=>{
 await login(page);await baseline(page,'stroop');const auth=await(await page.request.get('/api/auth/session')).json();
 const link=await(await page.request.post(`/api/children/${seed.children[1].id}/report-links`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'English report'}})).json();
 const context=await browser.newContext(),parent=await context.newPage();const url=new URL(link.url);url.searchParams.set('lang','en');await parent.goto(url.href);await expect(parent.locator('.public-report')).toBeVisible();await expect(parent.locator('html')).toHaveAttribute('dir','ltr');await expect(parent.locator('.parent-narrative')).not.toContainText('در تمرین');await expect(parent.locator('body')).toContainText(seed.children[1].firstName);await expect(parent.locator('body')).not.toContainText('clinical-secret');
 await parent.screenshot({path:'.local/verification/v4_english_family_report.png',fullPage:true});await parent.pdf({path:'.local/verification/v4_english_family_report.pdf',printBackground:true});await context.close();
});
