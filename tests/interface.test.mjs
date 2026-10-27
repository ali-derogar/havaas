import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { GAMES, LEVELS } from '../src/config.js';
import { EQUIPMENT } from '../src/games/adventure.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
let iteration=0;
async function fixture({blockedStorage=false}={}) {
  const {window,document}=parseHTML(html);let now=0,next=0;const queue=new Map(),values=new Map();
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
  return {document,window,click,advance,values,location};
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
    ui.click('main-game');
    if(game.kind==='reaction')finishReaction(ui,false);else if(game.kind==='search')finishSearch(ui,10);else finishAdventure(ui,game.id,false,level);
    const saved=JSON.parse(ui.values.get('havaas:v1'));assert.equal(saved.games[`${game.id}:${level}`].last.gameId,game.id);
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
  ui.click('main-game');finishAdventure(ui,'ark',false,'easy');assert.ok(ui.document.querySelector('.local-note').textContent.includes('در دسترس نیست'));assert.ok(ui.document.querySelector('.best-score').textContent.includes('۴ از ۴'));ui.click('home');assert.equal(ui.document.querySelectorAll('.game-card').length,7);
});
test('interface: pause and restart also work at a Stroop rule transition',async()=>{
  const ui=await fixture();ui.click('open','[data-game="stroop"]');ui.click('practice');finishReaction(ui,true);ui.click('main-game');
  for(let i=0;i<40;i++)ui.advance(1000);
  assert.ok(ui.document.querySelector('[data-action="acknowledge"]'));ui.click('pause');assert.ok(ui.document.querySelector('#modal').open);
  ui.click('resume');assert.ok(ui.document.querySelector('[data-action="acknowledge"]'));ui.click('pause');ui.click('restart');
  assert.equal(ui.document.querySelector('#position').textContent,'۱ از ۱۵۰');assert.ok(!ui.document.querySelector('[data-action="acknowledge"]'));
});
