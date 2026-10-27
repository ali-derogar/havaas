import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { GAMES, LEVELS } from '../src/config.js';
import { CLIENTS_KEY } from '../src/core/clients.js';
import { EQUIPMENT } from '../src/games/adventure.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
let iteration=0;
async function fixture({blockedStorage=false,withProfile=true}={}) {
  const {window,document}=parseHTML(html);let now=0,next=0;const queue=new Map(),values=new Map();
  if(withProfile)values.set(CLIENTS_KEY,JSON.stringify({version:1,activeId:'child-1',profiles:[{id:'child-1',firstName:'سارا',lastName:'احمدی',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:''}],records:[]}));
  const location=new URL('http://localhost:4173/');
  Object.assign(globalThis,{window,document,location,history:{pushState(_state,_unused,path){location.href=new URL(path,location).href;}},matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{queue.set(++next,fn);return next;},cancelAnimationFrame:id=>queue.delete(id)});
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){if(blockedStorage)throw new Error('Storage denied');return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}});
  window.scrollTo=()=>{};
  window.HTMLElement.prototype.focus=function(){};
  const modal=document.querySelector('#modal');
  Object.defineProperty(modal,'open',{get(){return this.hasAttribute('open');}});
  modal.showModal=function(){this.setAttribute('open','');};modal.close=function(){this.removeAttribute('open');};
  await import(`../src/app.js?fixture=${iteration++}`);
  const click=(action,selector='')=>{
    const el=document.querySelector(`[data-action="${action}"]${selector}`);assert.ok(el,`missing ${action}${selector}`);assert.ok(!el.hasAttribute('disabled'),`disabled ${action}`);
    el.dispatchEvent(new window.Event('click',{bubbles:true}));return el;
  };
  const advance=ms=>{now+=ms;const callbacks=[...queue.values()];queue.clear();for(const fn of callbacks)fn(now);};
  const register=(firstName='سارا',lastName='احمدی')=>{const form=document.querySelector('#profile-form');for(const [name,value] of Object.entries({firstName,lastName,birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:''})){const el=form.querySelector(`[name="${name}"]`);if(name==='grade')Object.defineProperty(el,'value',{configurable:true,value});else el.value=value;}form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));};
  if(blockedStorage&&withProfile){click('profiles');register();click('home');}
  const slowRendering=cost=>{
    const descriptor=Object.getOwnPropertyDescriptor(window.Element.prototype,'innerHTML');
    Object.defineProperty(window.Element.prototype,'innerHTML',{...descriptor,set(value){now+=cost;descriptor.set.call(this,value);}});
    return ()=>Object.defineProperty(window.Element.prototype,'innerHTML',descriptor);
  };
  return {document,window,click,advance,values,location,register,slowRendering};
}

function finishReaction(ui, practice, n=0) {
  let steps=0;
  while(!ui.document.querySelector('.result-card')&&steps++<180) {
    if(ui.document.querySelector('[data-action="acknowledge"]'))ui.click('acknowledge');
    // Exercise the physical Space-key handler, including ignored warm-up presses.
    const event=new ui.window.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperties(event,{code:{value:'Space'},repeat:{value:false}});
    ui.advance(180);ui.document.dispatchEvent(event);ui.advance(820);
  }
  assert.ok(steps<180,'reaction interface did not finish');
  assert.ok(ui.document.querySelector('.result-card'));
  const stats=ui.document.querySelector('.result-stats').textContent;
  assert.ok(stats.includes(practice?'۲':'۳۰'),stats);
}
function finishSearch(ui, rounds) {
  for(let i=0;i<rounds;i++) {assert.ok(ui.document.querySelector('.search-preview'));ui.advance(2000);assert.ok(ui.document.querySelector('.search-grid'));ui.advance(30000);}
  assert.ok(ui.document.querySelector('.result-card'));
}
function finishAdventure(ui,id,practice,level) {
  const required=EQUIPMENT[id].slice(0,practice?3:LEVELS[level].required).map(e=>e[1]);
  let guard=0;
  while(!ui.document.querySelector('.result-card')&&guard++<50) {
    const blocked=[...ui.document.querySelectorAll('.scene-object.blocked')];
    if(blocked.length){ui.click('item',`[data-index="${blocked[0].dataset.index}"]`);continue;}
    const items=[...ui.document.querySelectorAll('.scene-object:not(.collected):not(.rejected)')];
    if(practice) {
      if(required.includes(items[0].querySelector('span').textContent))ui.click('item',`[data-index="${items[0].dataset.index}"]`);else ui.click('reject-item');
    } else {
      const target=items.find(el=>required.includes(el.querySelector('span').textContent));
      if(target)ui.click('item',`[data-index="${target.dataset.index}"]`);else ui.click('depart');
    }
    ui.advance(100);
  }
  assert.ok(guard<50,'adventure interface did not finish');assert.ok(ui.document.querySelector('.result-card'));
}

for(const game of GAMES) for(const level of Object.keys(LEVELS)) {
  test(`interface: ${game.id}/${level}, home → tutorial → main → result → replay`,async()=>{
    const ui=await fixture();
    assert.equal(ui.document.querySelectorAll('.game-card').length,7);
    ui.click('open',`[data-game="${game.id}"]`);assert.ok(ui.document.querySelector('h1').textContent.includes(game.title));
    ui.click('level',`[data-level="${level}"]`);assert.equal(ui.document.querySelector('.level-button.selected').dataset.level,level);
    ui.click('practice');
    if(game.kind==='reaction')finishReaction(ui,true);else if(game.kind==='search')finishSearch(ui,5);else finishAdventure(ui,game.id,true,level);
    assert.equal(ui.values.has('havaas:v1'),false,'practice must not persist a result');
    const baseline=JSON.parse(ui.values.get(CLIENTS_KEY)).records;assert.equal(baseline.length,1);assert.equal(baseline[0].kind,'baseline');
    ui.click('detail');ui.click('level',`[data-level="${level}"]`);ui.click('main-game');
    if(game.kind==='reaction')finishReaction(ui,false);else if(game.kind==='search')finishSearch(ui,10);else finishAdventure(ui,game.id,false,level);
    const saved=JSON.parse(ui.values.get(CLIENTS_KEY));assert.equal(saved.records.length,2);assert.equal(saved.records[1].kind,'training');assert.equal(saved.records[1].result.gameId,game.id);assert.equal(saved.records[1].result.level,level);
    ui.click('replay');assert.ok(ui.document.querySelector('.play-panel'));ui.click('pause');assert.ok(ui.document.querySelector('#modal').open);
    ui.click('home');assert.equal(ui.document.querySelectorAll('.game-card').length,7);assert.ok(!ui.document.querySelector('#modal').open);
  });
}
test('interface: filters and sound preference work without an account',async()=>{
  const ui=await fixture();ui.click('filter','[data-filter="memory"]');assert.equal(ui.document.querySelectorAll('.game-card').length,2);
  ui.click('filter','[data-filter="all"]');assert.equal(ui.document.querySelectorAll('.game-card').length,7);
  ui.click('sound');assert.equal(JSON.parse(ui.values.get('havaas:v1')).sound,true);
  ui.click('sound');assert.equal(JSON.parse(ui.values.get('havaas:v1')).sound,false);
  ui.click('about');assert.ok(ui.document.querySelector('#modal').open);ui.click('close-modal');assert.ok(!ui.document.querySelector('#modal').open);
});
test('interface: pause, restart and visibility change keep the session responsive',async()=>{
  const ui=await fixture();ui.click('open','[data-game="traffic"]');ui.click('practice');ui.advance(200);
  ui.click('pause');const before=ui.document.querySelector('#time').textContent;ui.advance(50000);assert.equal(ui.document.querySelector('#time').textContent,before);
  ui.click('resume');ui.advance(300);assert.ok(!ui.document.querySelector('#modal').open);
  Object.defineProperty(ui.document,'hidden',{configurable:true,value:true});ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
  assert.ok(ui.document.querySelector('#modal').open);ui.click('restart');assert.equal(ui.document.querySelector('#position').textContent,'۱ از ۵');
});
test('interface: denied localStorage does not interrupt a full game',async()=>{
  const ui=await fixture({blockedStorage:true});ui.click('open','[data-game="ark"]');ui.click('practice');finishAdventure(ui,'ark',true,'easy');
  ui.click('detail');ui.click('level','[data-level="easy"]');ui.click('main-game');finishAdventure(ui,'ark',false,'easy');assert.ok(ui.document.querySelector('.local-note').textContent.includes('در دسترس نیست'));assert.ok(ui.document.querySelector('.best-score').textContent.includes('۴ از ۴'));ui.click('home');assert.equal(ui.document.querySelectorAll('.game-card').length,7);
});
test('interface: pause and restart also work at a Stroop rule transition',async()=>{
  const ui=await fixture();ui.click('open','[data-game="stroop"]');ui.click('practice');finishReaction(ui,true);ui.click('main-game');
  for(let i=0;i<40;i++)ui.advance(1000);
  assert.ok(ui.document.querySelector('[data-action="acknowledge"]'));ui.click('pause');assert.ok(ui.document.querySelector('#modal').open);
  ui.click('resume');assert.ok(ui.document.querySelector('[data-action="acknowledge"]'));ui.click('pause');ui.click('restart');
  assert.equal(ui.document.querySelector('#position').textContent,'۱ از ۱۵۰');assert.ok(!ui.document.querySelector('[data-action="acknowledge"]'));
});

test('interface: registration is required, resumes the requested exercise, and escapes profile text',async()=>{
  const ui=await fixture({withProfile:false});ui.click('open','[data-game="traffic"]');ui.click('practice');assert.ok(ui.document.querySelector('#profile-form'));
  ui.register('<script>سارا</script>','احمدی');assert.ok(ui.document.querySelector('.play-panel'));assert.equal(ui.document.querySelectorAll('#app script').length,0);
  finishReaction(ui,true);const saved=JSON.parse(ui.values.get(CLIENTS_KEY));assert.equal(saved.profiles.length,1);assert.equal(saved.records[0].kind,'baseline');
});
test('interface: reports expose baseline, parent summary, trial details, and a separate second child',async()=>{
  const ui=await fixture();ui.click('open','[data-game="ark"]');ui.click('practice');finishAdventure(ui,'ark',true,'easy');ui.click('main-game');finishAdventure(ui,'ark',false,'medium');
  ui.click('dashboard');assert.ok(ui.document.querySelector('.report-metrics'));assert.ok(ui.document.querySelector('.outcome-details'));assert.equal(ui.document.querySelectorAll('.session-history tbody tr').length,1);
  ui.click('report-tab','[data-tab="parents"]');assert.ok(ui.document.querySelector('h1').textContent.includes('والدین'));assert.equal(ui.document.querySelector('.outcome-details'),null);
  ui.click('profiles');ui.register('علی','رضایی');ui.click('dashboard');assert.ok(ui.document.querySelector('.empty-state'));assert.equal(ui.document.querySelector('.report-metrics'),null);
  ui.click('profiles');ui.click('select-profile','[data-id="child-1"]');ui.click('dashboard');assert.ok(ui.document.querySelector('.report-metrics'));ui.click('profiles');
  ui.click('delete-profile','[data-id="child-1"]');assert.ok(ui.document.querySelector('#modal').open);ui.click('close-modal');assert.equal(JSON.parse(ui.values.get(CLIENTS_KEY)).profiles.length,2);
  ui.click('delete-profile','[data-id="child-1"]');ui.click('confirm-delete-profile');const saved=JSON.parse(ui.values.get(CLIENTS_KEY));assert.equal(saved.profiles.length,1);assert.equal(saved.records.length,0);
});
test('interface: variants teach and complete through the real controls',async()=>{
  for(const [id,action,selector,variant] of [['traffic','traffic-mode','[data-mode="signs"]','signs'],['nback','material','[data-material="numbers"]','numbers'],['nback','material','[data-material="toys"]','toys'],['search','material','[data-material="letters"]','letters']]) {
    const ui=await fixture();ui.click('open',`[data-game="${id}"]`);ui.click(action,selector);ui.click('practice');
    if(id==='search')finishSearch(ui,5);else finishReaction(ui,true);
    assert.equal(JSON.parse(ui.values.get(CLIENTS_KEY)).records[0].result.variant,variant);
    ui.click('main-game');if(id==='search')finishSearch(ui,10);else finishReaction(ui,false);
    assert.equal(JSON.parse(ui.values.get(CLIENTS_KEY)).records[1].result.variant,variant);
  }
});

test('interface: hunt renders simultaneous choices and preserves the selected attention mode when changing theme',async()=>{
  const ui=await fixture();ui.click('open','[data-game="hunt"]');ui.click('hunt-mode','[data-mode="divided"]');ui.click('theme','[data-theme="fish"]');
  assert.equal(ui.document.querySelector('.hunt-mode.selected').dataset.mode,'divided');ui.click('practice');
  assert.equal(ui.document.querySelectorAll('.hunt-choice').length,3);assert.equal(ui.document.querySelectorAll('.target-mini').length,2);
  const choice=ui.document.querySelector('.hunt-choice');assert.ok(choice.hasAttribute('data-choice'));
  ui.click('stimulus-response',`[data-choice="${choice.dataset.choice}"]`);ui.advance(1000);assert.equal(ui.document.querySelectorAll('.hunt-choice').length,3);
});
test('interface: space explains the mission and reports mandatory obstacle clearing',async()=>{
  const ui=await fixture();ui.click('open','[data-game="space"]');ui.click('practice');assert.ok(ui.document.querySelector('.mission-brief').textContent.includes('سفر فضایی'));finishAdventure(ui,'space',true,'easy');
  ui.click('main-game');const level=ui.document.querySelector('.level-pill').textContent==='متوسط'?'medium':'easy';finishAdventure(ui,'space',false,level);
  ui.click('dashboard');assert.ok(ui.document.querySelector('.mission-report').textContent.includes('موانع کناررفته'));
  const saved=JSON.parse(ui.values.get(CLIENTS_KEY)).records.at(-1).result;assert.ok(saved.departed);assert.equal(saved.obstaclesCleared,LEVELS[level].obstacles);
});


test('interface: slow DOM rendering does not consume the 100ms stimulus exposure',async()=>{
  const ui=await fixture(),restore=ui.slowRendering(400);
  try {
    ui.click('open','[data-game="hunt"]');ui.click('level','[data-level="hard"]');ui.click('practice');
    assert.equal(ui.document.querySelector('.stimulus-shell').style.visibility,'visible');
    assert.equal(ui.document.querySelector('#position').textContent,'۱ از ۵');
    ui.advance(99);assert.equal(ui.document.querySelector('.stimulus-shell').style.visibility,'visible');
    ui.advance(1);assert.equal(ui.document.querySelector('.stimulus-shell').style.visibility,'hidden');
    ui.advance(900);assert.equal(ui.document.querySelector('#position').textContent,'۲ از ۵');
    assert.equal(ui.document.querySelector('.stimulus-shell').style.visibility,'visible');
  } finally {restore();}
});

test('interface: untimed Stroop and n-back lessons respond interactively without recording assessment results',async()=>{
  const ui=await fixture();ui.click('open','[data-game="stroop"]');
  for(let i=0;i<8;i++) {ui.click('lesson-answer',`[data-response="${i%2===0}"]`);assert.ok(ui.document.querySelector('.lesson-feedback.good'));ui.click('lesson-next');}
  assert.equal(JSON.parse(ui.values.get(CLIENTS_KEY)).records.length,0);
  ui.click('home');ui.click('open','[data-game="nback"]');ui.click('level','[data-level="hard"]');assert.equal(ui.document.querySelectorAll('.lesson-token').length,4);
  ui.click('lesson-answer','[data-response="false"]');assert.ok(ui.document.querySelector('.lesson-feedback.wrong'));ui.click('lesson-next');ui.click('lesson-answer','[data-response="false"]');assert.ok(ui.document.querySelector('.lesson-feedback.good'));
});
test('interface: the guided initial assessment completes all seven components and opens baseline reports',async()=>{
  const ui=await fixture();ui.click('assessment');assert.equal(ui.document.querySelectorAll('.assessment-step').length,7);ui.click('assessment-next');
  for(const [index,game] of GAMES.entries()) {
    assert.ok(ui.document.querySelector('.guided-banner'));assert.ok(ui.document.querySelector('h1').textContent.includes(game.title));
    assert.equal(ui.document.querySelector('.level-button.selected').dataset.level,'easy');assert.ok(ui.document.querySelector('[data-action="level"]').disabled);
    ui.click('practice');
    if(game.kind==='reaction')finishReaction(ui,true);else if(game.kind==='search')finishSearch(ui,5);else finishAdventure(ui,game.id,true,'easy');
    const records=JSON.parse(ui.values.get(CLIENTS_KEY)).records;assert.equal(records.length,index+1);assert.equal(records[index].kind,'baseline');assert.equal(records[index].result.gameId,game.id);assert.equal(records[index].result.level,'easy');
    if(index<6)ui.click('assessment-next');
  }
  ui.click('assessment');assert.equal(ui.document.querySelectorAll('.assessment-state.done').length,7);assert.equal(ui.document.querySelector('[data-action="assessment-next"]'),null);
  ui.click('assessment-reports');assert.equal(ui.document.querySelectorAll('.session-history tbody tr').length,7);assert.ok(ui.document.querySelector('.report-focus').textContent.includes('ارزیابی پایه'));
  ui.click('home');ui.click('assessment');ui.click('assessment-train','[data-game="ark"]');assert.equal(ui.document.querySelector('.level-button.selected').dataset.level,'medium');assert.equal(ui.document.querySelector('.guided-banner'),null);assert.ok(ui.document.querySelector('[data-action="main-game"]'));
});
test('interface: dual letter search previews both targets and completes only after the second discovery',async()=>{
  const ui=await fixture();ui.click('open','[data-game="search"]');ui.click('search-mode','[data-mode="dual"]');ui.click('material','[data-material="letters"]');ui.click('search-layout','[data-layout="scattered"]');ui.click('practice');
  for(let round=0;round<5;round++) {
    const targets=[...ui.document.querySelectorAll('.preview-target .symbol')].map(el=>el.outerHTML);assert.equal(targets.length,2);ui.advance(2000);
    const indices=[...ui.document.querySelectorAll('.search-choice')].flatMap(el=>targets.includes(el.querySelector('.symbol').outerHTML)?[el.dataset.index]:[]);assert.equal(indices.length,2);
    ui.click('search-choice',`[data-index="${indices[0]}"]`);assert.equal(ui.document.querySelectorAll('.search-choice.found').length,1);assert.ok(!ui.document.querySelector('.search-preview'));
    ui.click('search-choice',`[data-index="${indices[1]}"]`);
  }
  const result=JSON.parse(ui.values.get(CLIENTS_KEY)).records[0].result;assert.equal(result.score,10);assert.equal(result.maxScore,10);assert.equal(result.variant,'letters-scattered-dual');
});

test('interface: slow search rendering preserves preview time and response timing',async()=>{
  const ui=await fixture(),restore=ui.slowRendering(400);
  try {
    ui.click('open','[data-game="search"]');ui.click('practice');
    for(let round=0;round<5;round++) {
      const target=ui.document.querySelector('.preview-target .symbol').outerHTML;
      ui.advance(1999);assert.ok(ui.document.querySelector('.search-preview'));
      ui.advance(1);assert.ok(ui.document.querySelector('.search-grid'));
      const option=[...ui.document.querySelectorAll('.search-choice')].find(el=>el.querySelector('.symbol').outerHTML===target);
      ui.advance(150);ui.click('search-choice',`[data-index="${option.dataset.index}"]`);
    }
    const result=JSON.parse(ui.values.get(CLIENTS_KEY)).records[0].result;assert.equal(result.meanReactionMs,150);assert.equal(result.hits,5);
  } finally {restore();}
});
test('interface: packing all equipment without departing before timeout does not award completion stars',async()=>{
  const ui=await fixture();ui.click('open','[data-game="ark"]');ui.click('practice');finishAdventure(ui,'ark',true,'easy');ui.click('detail');ui.click('level','[data-level="easy"]');ui.click('main-game');
  const required=EQUIPMENT.ark.slice(0,4).map(e=>e[1]);
  for(const name of required){const item=[...ui.document.querySelectorAll('.scene-object')].find(el=>el.querySelector('span').textContent===name);ui.click('item',`[data-index="${item.dataset.index}"]`);}
  ui.advance(60000);assert.ok(ui.document.querySelector('.result-card'));assert.equal(ui.document.querySelectorAll('.result-stars .earned').length,0);
  const result=JSON.parse(ui.values.get(CLIENTS_KEY)).records.at(-1).result;assert.equal(result.completed,false);assert.equal(result.hits,4);assert.equal(result.departed,false);
});

test('interface: viewing a completed result opens that record even after earlier assessment report filters',async()=>{
  const ui=await fixture();ui.click('assessment');ui.click('assessment-reports');ui.click('home');ui.click('open','[data-game="search"]');ui.click('search-mode','[data-mode="dual"]');ui.click('practice');finishSearch(ui,5);
  ui.click('dashboard');assert.ok(ui.document.querySelector('.report-metrics'));assert.ok(ui.document.querySelector('.report-focus').textContent.includes('ارزیابی پایه'));assert.ok(ui.document.querySelector('.report-focus').textContent.includes('دو هدف'));
  ui.click('home');ui.click('open','[data-game="search"]');ui.click('main-game');finishSearch(ui,10);ui.click('dashboard');
  assert.ok(ui.document.querySelector('.report-metrics'));assert.ok(ui.document.querySelector('.report-focus').textContent.includes('بازی اصلی'));assert.equal(ui.document.querySelectorAll('.session-history tbody tr').length,1);
});
