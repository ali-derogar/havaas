import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {GAMES,EXPERIENCE_VERSION} from '../../src/config.js';
import {playSession} from '../helpers/play-session.mjs';
import {trialMs} from '../helpers/browser-timing.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
const action=(page,name)=>page.locator(`[data-action="${name}"]:visible`).first();
const advance=(page,ms)=>page.evaluate(ms=>window.advancePractice(ms),ms);

async function createPlayer(page){
  const admin=await request.newContext({baseURL:'http://127.0.0.1:4181'});
  try{
    let auth=await(await admin.get('/api/auth/session')).json();
    auth=await(await admin.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();
    const link=await(await admin.post('/api/registration-links',{headers:{'X-CSRF-Token':auth.csrfToken},data:{label:'آزمون آمادگی و تمرین دوباره'}})).json();
    const guest=await(await page.request.get('/api/auth/session')).json();
    const response=await page.request.post('/api/public/registration/complete',{headers:{'X-CSRF-Token':guest.csrfToken},data:{
      token:link.url.split('/').at(-1),username:`practice-${randomUUID().slice(0,12)}`,password:seed.password,
      profile:{firstName:'آزمون',lastName:'تمرین دوباره',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'آزمون'},
    }});
    expect(response.status()).toBe(201);
  }finally{await admin.dispose();}
  const own=await(await page.request.get('/api/bootstrap')).json();
  await page.addInitScript(()=>{
    let now=0,id=0;const callbacks=new Map();
    performance.now=()=>now;requestAnimationFrame=fn=>{callbacks.set(++id,fn);return id;};cancelAnimationFrame=id=>callbacks.delete(id);
    window.advancePractice=ms=>{now+=ms;const queued=[...callbacks.values()];callbacks.clear();for(const fn of queued)fn(now);};
  });
  await page.goto('/');await expect(page.locator('.hero')).toBeVisible();
  return own.profiles[0].id;
}
async function begin(page){await expect(page.locator('.game-preparation')).toBeVisible();await action(page,'begin-game').click();await advance(page,3000);}
async function finishPractice(page,{correct=false,stroop=false}={}){
  const interval=await trialMs(page);
  for(let i=0;i<5;i++){
    if(stroop&&await action(page,'acknowledge').count())await action(page,'acknowledge').click();
    const green=correct&&await page.locator('.stimulus-shell').evaluate(node=>node.innerHTML.includes('#0ba867'));
    await advance(page,100);if(green)await action(page,'respond').click();
    await advance(page,interval-100);await expect(page.locator('.practice-review')).toBeVisible();await action(page,'continue-review').click();
  }
  await expect(page.locator('.result-card')).toBeVisible();
}

for(const correct of [false,true])test(`practice advice: ${correct?'successful':'weak'} results offer an unrecorded repeat and keep the main game available`,async({page})=>{
  const childId=await createPlayer(page);let starts=0,completions=0;
  page.on('request',req=>{if(req.method()==='POST'){if(req.url().endsWith('/sessions'))starts++;if(req.url().endsWith('/complete'))completions++;}});
  await page.locator('[data-action="open"][data-game="traffic"]').click();await action(page,'practice').click();await begin(page);await finishPractice(page,{correct});
  await expect(page.locator('.local-note')).toContainText('ذخیره شد');
  const primary=page.locator('.result-actions>.primary');
  await expect(primary).toHaveAttribute('data-action',correct?'main-game':'repeat-practice');
  await expect(action(page,'main-game')).toBeEnabled();
  if(!correct)await expect(page.locator('.result-learning')).toHaveAttribute('open','');
  const records=await(await page.request.get(`/api/children/${childId}/sessions`)).json();
  const policy=await(await page.request.get(`/api/children/${childId}/difficulty`)).json();
  await page.setViewportSize({width:360,height:780});
  await expect(page.locator('.result-actions')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(!correct)await page.screenshot({path:'.local/verification/practice-advice-mobile.png',fullPage:true,animations:'disabled'});
  await action(page,'repeat-practice').focus();await page.keyboard.press('Enter');await expect(page.locator('.game-preparation')).toBeVisible();
  await expect(page.locator('.play-heading .level-pill')).toHaveText('آسان');
  await action(page,'pause').click();await action(page,'restart').click();await begin(page);await finishPractice(page,{correct});
  await expect(page.locator('.result-actions>.primary')).toHaveAttribute('data-action',correct?'main-game':'repeat-practice');
  expect(starts).toBe(1);expect(completions).toBe(1);
  expect(await(await page.request.get(`/api/children/${childId}/sessions`)).json()).toEqual(records);
  expect(await(await page.request.get(`/api/children/${childId}/difficulty`)).json()).toEqual(policy);
  await action(page,'main-game').click();await expect(page.locator('.compact-preparation')).toBeVisible();
  await expect(page.locator('.play-heading .level-pill')).toHaveText(correct?'متوسط':'آسان');expect(starts).toBe(2);
});

test('the seventh assessment shows its summary after retrying a failed save while bootstrap is offline',async({page})=>{
  const childId=await createPlayer(page),auth=await(await page.request.get('/api/auth/session')).json(),headers={'X-CSRF-Token':auth.csrfToken};
  for(const {id:gameId} of GAMES.slice(0,6)){
    const runResponse=await page.request.post(`/api/children/${childId}/sessions`,{headers,data:{gameId,kind:'baseline',clientExperienceVersion:EXPERIENCE_VERSION}});expect(runResponse.ok()).toBe(true);
    const run=await runResponse.json();expect((await page.request.post(`/api/children/${childId}/sessions/${run.id}/complete`,{headers,data:{result:playSession(run)}})).ok()).toBe(true);
  }
  await action(page,'assessment').click();await expect(page.locator('.assessment-state.done')).toHaveCount(6);await action(page,'assessment-next').click();
  let failSave=true;
  await page.route('**/api/children/*/sessions/*/complete',route=>failSave?route.abort('failed'):route.continue());
  await action(page,'practice').click();await begin(page);await finishPractice(page,{stroop:true});
  await expect(action(page,'retry-save')).toBeVisible();await expect(action(page,'repeat-practice')).toBeDisabled();
  expect((await(await page.request.get(`/api/children/${childId}/sessions`)).json()).records).toHaveLength(6);
  failSave=false;await page.route('**/api/bootstrap*',route=>route.abort('failed'));await action(page,'retry-save').click();
  await expect(page.locator('.local-note')).toContainText('نتیجهٔ شما ثبت شده');
  const summary=page.getByRole('button',{name:'جمع‌بندی ارزیابی هفت بازی',exact:true});
  await expect(summary).toBeEnabled();await expect(page.locator('.result-actions [data-action="assessment-next"]')).toHaveCount(0);
  expect((await(await page.request.get(`/api/children/${childId}/sessions`)).json()).records).toHaveLength(7);
  await page.setViewportSize({width:360,height:780});await summary.focus();
  await page.screenshot({path:'.local/verification/assessment-summary-after-save.png',fullPage:true,animations:'disabled'});
  await page.unroute('**/api/bootstrap*');await page.keyboard.press('Enter');await expect(page.locator('.assessment-state.done')).toHaveCount(7);
});
