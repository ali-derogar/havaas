import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {arkSceneryPose,PlayMotion} from '../src/play-motion.js';
import {arkScene} from '../src/ark-ui.js';
import {missionChecklist} from '../src/play-ui.js';

test('the illustrated shore preserves every mission choice, layout and outcome',()=>{
  for(const level of ['easy','medium','hard']){
    const session=FACTORIES.ark({level,stimulusVersion:8,random:seededRandom(42),now:()=>0});
    const before=JSON.stringify({items:session.items,result:{...session.result,finishedAt:null}});
    const {document}=parseHTML(arkScene(session,missionChecklist(session)));
    const buttons=[...document.querySelectorAll('.scene-object')];
    assert.equal(buttons.length,session.items.length);
    assert.equal(document.querySelectorAll('.mission-brief .need-art').length,session.required.length);
    assert.deepEqual(buttons.map(node=>Number(node.dataset.index)),session.items.map(item=>item.id));
    assert.ok(buttons.every(node=>node.getAttribute('aria-label')&&node.querySelector('.equipment')));
    assert.equal(document.querySelectorAll('.scene-object.required,[data-required]').length,0);
    assert.equal(JSON.stringify({items:session.items,result:{...session.result,finishedAt:null}}),before);
    session.choose(session.items.find(item=>item.required).id);
    const updated=parseHTML(arkScene(session,missionChecklist(session))).document;
    assert.equal(updated.querySelectorAll('.scene-object.collected:disabled').length,1);
    assert.equal(updated.querySelectorAll('.mission-need.packed').length,1);
  }
});

test('all shore motion follows the active clock, freezes with pause and stops for reduced motion',()=>{
  let now=0;
  const session=FACTORIES.ark({now:()=>now,random:seededRandom(42)});
  const {document}=parseHTML(`<html><body><section>${arkScene(session,'')}</section></body></html>`);
  const panel=document.querySelector('section'),motion=new PlayMotion({document,now:()=>now});
  motion.sync(panel,session);const first=panel.getAttribute('style');
  now=1200;motion.sync(panel,session);assert.notEqual(panel.getAttribute('style'),first);
  session.pause();motion.sync(panel,session,{paused:true});const frozen=panel.getAttribute('style');
  now+=20000;motion.sync(panel,session,{paused:true});assert.equal(panel.getAttribute('style'),frozen);
  session.resume();now+=500;motion.sync(panel,session);assert.notEqual(panel.getAttribute('style'),frozen);
  motion.sync(panel,session,{reduced:true});const reduced=panel.getAttribute('style');
  now+=1500;motion.sync(panel,session,{reduced:true});assert.equal(panel.getAttribute('style'),reduced);
  assert.deepEqual(arkSceneryPose(-20),arkSceneryPose(0));
});
