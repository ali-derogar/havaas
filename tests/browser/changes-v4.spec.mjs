import {FACTORIES} from '../../src/games/index.js';
import {seededRandom} from '../../src/core/random.js';
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

test('English Stroop follows each phase color and defers a language change until the saved result',async({page})=>{
 await clock(page);await login(page);await baseline(page,'stroop');await page.locator('[data-action=open][data-game=stroop]').first().click();
 const launching=page.waitForResponse(response=>/\/sessions$/.test(response.url())&&response.request().method()==='POST');await click(page,'main-game');const run=await(await launching).json(),engine=FACTORIES.stroop({...run.settings,random:seededRandom(run.settings.seed)});await click(page,'begin-game');await advance(page,3000);
 const saved=page.waitForResponse(response=>response.url().endsWith('/complete')&&response.request().method()==='POST');
 for(let i=0;i<150;i++){
  if([40,80,120].includes(i)){await expect(page.locator('.automatic-rule-notice')).toBeVisible();await advance(page,3000);}
  const trial=engine.trials[i],color=run.settings.stimulusPlan.colorsByPhase[trial.phase][0];await expect(page.locator('.studio-stage-heading b')).toContainText(color);if(trial.stimulus.word)await expect(page.locator('.word-stimulus')).toHaveText(trial.stimulus.word);
  if(i===30){await click(page,'pause');await page.locator('#modal [data-locale-select]').selectOption('fa');await expect(page.locator('html')).toHaveAttribute('lang','en');await click(page,'resume');}
  if(i===120)await page.screenshot({path:'.local/verification/v4_english_stroop.png',fullPage:true});
  await advance(page,100);if(trial.target)await click(page,'respond');await advance(page,engine.intervalMs-100);
 }
 await expect(page.locator('.result-card')).toBeVisible();expect((await(await saved).json()).record.result.locale).toBe('en');await expect(page.locator('html')).toHaveAttribute('lang','fa');await page.reload();await expect(page.locator('html')).toHaveAttribute('lang','fa');
});

test('all English voice clips decode in Chrome and the offline page keeps its selected language',async({page})=>{
 await page.goto('/?lang=en');const durations=await page.evaluate(async()=>{const {GUIDANCE}=await import('/src/guidance.js');const context=new AudioContext();try{return await Promise.all(Object.keys(GUIDANCE).map(async key=>{const response=await fetch(`/assets/audio/en/${key}.mp3`);if(!response.ok)throw Error(key);const buffer=await context.decodeAudioData(await response.arrayBuffer());return {key,duration:buffer.duration};}));}finally{await context.close();}});expect(durations).toHaveLength(53);expect(durations.every(clip=>clip.duration>.2)).toBe(true);
 await page.goto('/offline.html');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('h1')).toHaveText('Reconnect to continue');await page.locator('[data-locale-select]').selectOption('fa');await expect(page.locator('h1')).toHaveText('برای ادامه، دوباره وصل شو');
});

test('switching a registration form between calendars preserves its unsaved date, password and Persian name',async({page,browser})=>{
 await login(page,'admin');const auth=await(await page.request.get('/api/auth/session')).json();const invitation=await(await page.request.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'Language and calendar test'}})).json();
 const context=await browser.newContext(),registration=await context.newPage(),url=new URL(invitation.url);url.searchParams.set('lang','en');await registration.goto(url.href);await expect(registration.locator('#registration-form')).toBeVisible();await registration.locator('[name=firstName]').fill('آبی');await registration.locator('[name=lastName]').fill('Preserved');await registration.locator('[name=birthDate]').fill('2016-04-01');await registration.locator('[name=password]').fill('Unsaved-password-2026!');
 await registration.locator('[data-locale-select]').selectOption('fa');await expect(registration.locator('[name=birthDate]')).toHaveValue('2016-04-01');await expect(registration.locator('[data-birth-part=year]')).toHaveValue('1395');await expect(registration.locator('[data-birth-part=month]')).toHaveValue('1');await expect(registration.locator('[data-birth-part=day]')).toHaveValue('13');await expect(registration.locator('[name=firstName]')).toHaveValue('آبی');await expect(registration.locator('[name=password]')).toHaveValue('Unsaved-password-2026!');
 await registration.locator('[data-locale-select]').selectOption('en');await expect(registration.locator('[name=birthDate]')).toHaveAttribute('type','date');await expect(registration.locator('[name=birthDate]')).toHaveValue('2016-04-01');await expect(registration.locator('[name=firstName]')).toHaveValue('آبی');await context.close();
});
