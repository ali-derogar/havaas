import {test,expect,request} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {playSession} from '../helpers/play-session.mjs';

let seed;
test.beforeAll(async()=>{seed=JSON.parse(await readFile('.local/e2e-credentials.json','utf8'));});
async function clock(page){await page.addInitScript(()=>{let now=0,id=0;const pending=new Map();performance.now=()=>now;requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};cancelAnimationFrame=id=>pending.delete(id);window.advanceStudio=ms=>{now+=ms;const callbacks=[...pending.values()];pending.clear();for(const fn of callbacks)fn(now);};});}
const advance=(page,ms)=>page.evaluate(ms=>window.advanceStudio(ms),ms);
const click=(page,action)=>page.locator(`[data-action="${action}"]:visible`).first().click();
async function login(page){await page.goto('/');await page.locator('#login-form [name=identifier]').fill(seed.users.otherUser.username);await page.locator('#login-form [name=password]').fill(seed.password);await page.locator('#login-form button[type=submit]').click();await expect(page.locator('.hero')).toBeVisible();}
async function setup(page,level){
 const auth=await(await page.request.get('/api/auth/session')).json(),run=await(await page.request.post(`/api/children/${seed.children[1].id}/sessions`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'stroop',kind:'baseline'}})).json();
 expect((await page.request.post(`/api/children/${seed.children[1].id}/sessions/${run.id}/complete`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{result:playSession(run)}})).ok()).toBe(true);
 const api=await request.newContext({baseURL:'http://127.0.0.1:4181'});
 try{let auth=await(await api.get('/api/auth/session')).json();auth=await(await api.post('/api/auth/login',{headers:{'X-CSRF-Token':auth.csrfToken},data:{identifier:seed.users.admin.username,password:seed.password}})).json();expect((await api.patch(`/api/children/${seed.children[1].id}/difficulty`,{headers:{'X-CSRF-Token':auth.csrfToken},data:{gameId:'stroop',level,mode:'fixed'}})).ok()).toBe(true);}finally{await api.dispose();}
 await page.reload();await expect(page.locator('.hero')).toBeVisible();
}
async function start(page,practice){await page.locator('[data-action=open][data-game=stroop]').first().click();await click(page,practice?'practice':'main-game');await expect(page.locator('.studio-preparation')).toBeVisible();}
async function begin(page){await click(page,'begin-game');await advance(page,3000);await expect(page.locator('.studio-stage')).toBeVisible();}
const stimulus=page=>page.locator('.studio-stage').evaluate(stage=>{const node=stage.querySelector('.studio-stimulus').firstElementChild,phase=Number(stage.dataset.rulePhase),yellow=node.getAttribute('style')?.includes('#dc9b00')||node.outerHTML.includes('fill="#dc9b00"'),word=node.classList.contains('word-stimulus')?node.textContent:'';return {phase,yellow,word,target:phase<=1?yellow:phase===2?word==='زرد':yellow&&word==='زرد',html:node.outerHTML};});
async function gate(page,phase){
 await expect(page.locator('.studio-transition')).toBeVisible();await expect(page.locator('.studio-transition .stroop-rule-picture')).toHaveAttribute('data-rule-phase',String(phase));await expect(page.locator('.rule-sample')).toHaveCount(2);
 await expect(page.locator('.play-controls')).toBeHidden();
 const frozen=await page.locator('#time').textContent();await advance(page,20000);await expect(page.locator('#time')).toHaveText(frozen);await expect(page.locator('.studio-stimulus')).toHaveCount(0);await click(page,'acknowledge');await expect(page.locator('.studio-stage')).toHaveAttribute('data-rule-phase',String(phase));
}

test('studio: all eight illustrated lessons and five frozen practice reviews retain the four rules',async({page})=>{
 await clock(page);await login(page);await page.locator('[data-action=open][data-game=stroop]').first().click();
 for(let i=0;i<8;i++){
  const box=page.locator('#lesson-box');await expect(box.locator('.stroop-rule-picture')).toHaveAttribute('data-rule-phase',String(Math.floor(i/2)));await expect(box.locator('[data-action=listen-guide]')).toHaveAttribute('data-guide',`stroop-${Math.floor(i/2)}`);
  await box.locator(`[data-action=lesson-answer][data-response="${i%2===0}"]`).click();await expect(box.locator('.lesson-feedback.good')).toBeVisible();await click(page,'lesson-next');
 }
 await click(page,'practice');await page.setViewportSize({width:1440,height:1250});await page.screenshot({path:'.local/verification/stroop_preparation.png',fullPage:true,animations:'disabled'});await begin(page);
 for(let trial=0;trial<5;trial++){
  if(await page.locator('.studio-transition').count()){const phase=Number(await page.locator('.studio-transition .stroop-rule-picture').getAttribute('data-rule-phase'));await gate(page,phase);}
  const current=await stimulus(page);await advance(page,50);if(current.target)await page.locator('.studio-stimulus').click();await advance(page,950);await expect(page.locator('.practice-review.good')).toBeVisible();await expect(page.locator('.studio-review-sample .stroop-rule-picture')).toHaveAttribute('data-rule-phase',String(current.phase));
  const paper=page.locator('.studio-review-paper .ready-token');expect(await paper.evaluate(node=>node.firstElementChild.outerHTML)).toBe(current.html);const frozen=await page.locator('#time').textContent();await advance(page,15000);await expect(page.locator('#time')).toHaveText(frozen);await click(page,'continue-review');
 }
 await expect(page.locator('.result-card')).toBeVisible();await expect(page.locator('.local-note')).toContainText('ذخیره شد');
});

test('studio: all 150 trials preserve ink, exposure, keyboard timing, rule pauses and real per-rule scores',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await clock(page);await login(page);await setup(page,'hard');await start(page,false);await begin(page);
 const omitted=[false,false,false,false],wrong=[false,false,false,false],counts=[0,0,0,0];
 for(let trial=0;trial<150;trial++){
  if(await page.locator('.studio-transition').count()){
   const phase=Number(await page.locator('.studio-transition .stroop-rule-picture').getAttribute('data-rule-phase'));if(phase===3){await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/verification/stroop_transition_mobile.png',fullPage:true,animations:'disabled'});}await gate(page,phase);
  }
  const current=await stimulus(page),phase=current.phase;counts[phase]++;await expect(page.locator('.studio-stimulus>.symbol,.studio-stimulus>.word-stimulus')).toHaveCount(1);
  if([0,40,80,120].includes(trial)){
   await expect(page.locator('.studio-phase-path>span.passed')).toHaveCount(phase);await expect(page.locator('.instruction-strip .stroop-rule-picture')).toHaveAttribute('data-rule-phase',String(phase));
   for(const [width,height] of [[360,640],[390,844],[768,900],[1440,1000],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const selector of ['.focus-corners','.response-button','[data-action=pause]']){const node=page.locator(selector),rect=await node.boundingBox();expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(height);expect(await node.evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);}
    const picture=page.locator('.studio-stimulus>:first-child');expect(await picture.evaluate(node=>({opacity:getComputedStyle(node).opacity,transform:getComputedStyle(node).transform,animation:getComputedStyle(node).animationName}))).toEqual({opacity:'1',transform:'none',animation:'none'});
    if(width===390||width===1440||width===844)await page.screenshot({path:`.local/verification/stroop_rule_${phase}_${width}.png`,fullPage:width===1440,animations:'disabled'});
   }
   await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  }
  if(trial===40){await advance(page,50);const before=await page.locator('.studio-interval-track>span').getAttribute('style');await click(page,'pause');await advance(page,20000);expect(await page.locator('.studio-interval-track>span').getAttribute('style')).toBe(before);await click(page,'resume');await expect(page.locator('.response-button')).toBeFocused();expect((await stimulus(page)).html).toBe(current.html);}
  await advance(page,99);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await expect(page.locator('.response-button')).toBeEnabled();
  const omit=current.target&&!omitted[phase];if(omit)omitted[phase]=true;const falseResponse=!current.target&&!wrong[phase];if(falseResponse)wrong[phase]=true;await advance(page,100);
  if(current.target&&!omit||falseResponse){await page.locator('.response-button').focus();await page.keyboard.press('Space');await expect(page.locator('.response-button')).toBeDisabled();await page.keyboard.press('Space');}
  await advance(page,800);if(trial<149)await expect(page.locator('.play-effects')).toHaveCount(0);
 }
 expect(counts).toEqual([40,40,40,30]);expect(omitted.every(Boolean)&&wrong.every(Boolean)).toBe(true);await expect(page.locator('.result-main-score>b')).toHaveText('۲۲');await expect(page.locator('.local-note')).toContainText('ذخیره شد');
 expect(await page.locator('.studio-result-pot').evaluateAll(nodes=>nodes.map(node=>[Number(node.dataset.correct),Number(node.dataset.total)]))).toEqual([[38,40],[38,40],[38,40],[28,30]]);
 expect(await page.locator('.rule-score meter').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('value'))))).toEqual([38,38,38,28]);await page.setViewportSize({width:1440,height:1600});await page.screenshot({path:'.local/verification/stroop_result.png',fullPage:true,animations:'disabled'});expect(errors).toEqual([]);
});

test('studio: reduced motion and all difficulty exposures keep the complete response window',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await login(page);
 for(const [level,visible] of [['easy',300],['medium',200]]){
  await setup(page,level);await start(page,false);await begin(page);await advance(page,visible-1);await expect(page.locator('.stimulus-shell')).toBeVisible();await advance(page,1);await expect(page.locator('.stimulus-shell')).toBeHidden();await advance(page,400);await page.locator('.response-button').focus();await page.keyboard.press('Space');await expect(page.locator('.play-panel')).toHaveAttribute('data-motion','reduced');await expect(page.locator('.response-button')).toBeDisabled();await expect(page.locator('.play-effects')).toHaveCount(0);await click(page,'pause');await click(page,'home');
 }
});
