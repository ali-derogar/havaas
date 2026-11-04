import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {spaceScene} from '../src/space-ui.js';
import {missionChecklist} from '../src/play-ui.js';
import {spaceSceneryPose,PlayMotion} from '../src/play-motion.js';

test('space art preserves mission data and hides equipment until its obstacle is removed',()=>{
 for(const level of ['easy','medium','hard']){
  const session=FACTORIES.space({level,stimulusVersion:8,random:seededRandom(42),now:()=>0});
  const snapshot=()=>JSON.stringify({items:session.items,result:{...session.result,finishedAt:null}}),before=snapshot();
  const {document}=parseHTML(spaceScene(session,missionChecklist(session)));
  assert.equal(document.querySelectorAll('.scene-object').length,session.items.length);
  assert.equal(document.querySelectorAll('.mission-need').length,session.required.length);
  for(const item of session.items){
   const node=document.querySelector(`.scene-object[data-index="${item.id}"]`);
   assert.ok(node.querySelector('.equipment'));
   if(item.blocked){assert.equal(node.dataset.equipment,'obstacle');assert.equal(node.getAttribute('aria-label'),'کنار زدن مانع');assert.equal(node.querySelector('span').textContent,'کنار بزن');}
   else assert.equal(node.dataset.equipment,item.icon);
  }
  assert.equal(snapshot(),before);
  const blocked=session.items.find(item=>item.blocked);
  assert.equal(session.choose(blocked.id),'cleared');assert.equal(session.metrics.hits,0);assert.equal(session.outcomes.length,0);
  const revealed=parseHTML(spaceScene(session,missionChecklist(session))).document.querySelector(`.scene-object[data-index="${blocked.id}"]`);
  assert.equal(revealed.dataset.equipment,blocked.icon);assert.equal(revealed.getAttribute('aria-label'),blocked.name);
  assert.equal(session.choose(blocked.id),true);assert.equal(session.metrics.hits,1);
 }
});

test('spacecraft and scenery freeze together, and reduced motion retains a stable readable scene',()=>{
 let now=0;const session=FACTORIES.space({now:()=>now,random:seededRandom(42)});
 const {document}=parseHTML(`<html><body><section>${spaceScene(session,'')}</section></body></html>`),panel=document.querySelector('section');
 const motion=new PlayMotion({document,now:()=>now}),vehicle=panel.querySelector('.scene-vehicle');
 motion.sync(panel,session);const first=vehicle.getAttribute('style');
 now=1200;motion.sync(panel,session);assert.notEqual(vehicle.getAttribute('style'),first);
 session.pause();motion.sync(panel,session,{paused:true});const frozen=[panel.getAttribute('style'),vehicle.getAttribute('style')];
 now+=20000;motion.sync(panel,session,{paused:true});assert.deepEqual([panel.getAttribute('style'),vehicle.getAttribute('style')],frozen);
 session.resume();now+=500;motion.sync(panel,session);assert.notEqual(panel.getAttribute('style'),frozen[0]);
 motion.sync(panel,session,{reduced:true});const still=[panel.getAttribute('style'),vehicle.getAttribute('style')];
 now+=1000;motion.sync(panel,session,{reduced:true});assert.deepEqual([panel.getAttribute('style'),vehicle.getAttribute('style')],still);
 assert.deepEqual(spaceSceneryPose(-20),spaceSceneryPose(0));
 const rock=panel.querySelector('.space-rock');motion.sync(panel,session);motion.burst({rect:{x:0,y:0,width:60,height:60},picture:rock},'cleared');
 assert.ok(document.querySelector('.rock-burst'));now+=700;motion.sync(panel,session);assert.equal(document.querySelector('.rock-burst'),null);
});
