import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {trafficScene} from '../src/traffic-ui.js';
import {trafficRoad,trafficProgress} from '../src/play-ui.js';
import {PlayMotion} from '../src/play-motion.js';

test('traffic presentation keeps the only live cue inside its timed shell without mutating trials',()=>{
 for(const trafficMode of ['circles','signs'])for(const level of ['easy','medium','hard']){
  const session=FACTORIES.traffic({trafficMode,level,random:seededRandom(42),now:()=>0}),before=JSON.stringify(session.trials);
  for(const target of [true,false]){
   session.index=session.trials.findIndex(trial=>trial.target===target);
   const {document}=parseHTML(trafficScene(session,trafficRoad(session)));
   assert.equal(document.querySelectorAll('.stimulus-shell').length,1);
   assert.equal(document.querySelectorAll('.traffic-signal-case .symbol').length,1);
   assert.ok(document.querySelector('.stimulus-shell .symbol'));
   assert.ok(document.querySelector('.stimulus-shell .traffic-cue-halo'));
   assert.ok(document.querySelector('.stimulus-shell .traffic-cue-sheen'));
   assert.equal(document.querySelector('.stimulus-tap').dataset.trial,String(session.index));
   assert.equal(document.querySelectorAll('.traffic-socket').length,trafficMode==='circles'?3:0);
  }
  assert.equal(JSON.stringify(session.trials),before);
 }
});

test('traffic camera and wheels freeze with the active clock and forward progress survives a redraw',()=>{
 let now=0;const session=FACTORIES.traffic({random:seededRandom(42),now:()=>now});
 const {document}=parseHTML(`<html><body><section>${trafficScene(session,trafficRoad(session))}</section></body></html>`),panel=document.querySelector('section'),road=panel.querySelector('.traffic-road'),town=panel.querySelector('.traffic-town');
 Object.defineProperty(road,'clientWidth',{value:620});Object.defineProperty(town,'clientWidth',{value:320});
 const motion=new PlayMotion({document,now:()=>now});motion.sync(panel,session);
 road.dataset.progress='.5';motion.sync(panel,session);now=200;motion.sync(panel,session);
 const pose=[road.dataset.visualProgress,road.style.getPropertyValue('--traffic-camera-x'),panel.querySelector('.road-car').getAttribute('transform'),panel.querySelector('.car-wheel').getAttribute('transform')];
 assert.ok(Number(pose[0])>0&&Number(pose[0])<.5);assert.ok(parseFloat(pose[1])<0);
 session.pause();motion.sync(panel,session,{paused:true});now+=20000;motion.sync(panel,session,{paused:true});
 assert.deepEqual([road.dataset.visualProgress,road.style.getPropertyValue('--traffic-camera-x'),panel.querySelector('.road-car').getAttribute('transform'),panel.querySelector('.car-wheel').getAttribute('transform')],pose);
 session.resume();now+=300;motion.sync(panel,session);assert.equal(Number(road.dataset.visualProgress),.5);
 road.dataset.progress='0';motion.sync(panel,session);assert.equal(Number(road.dataset.visualProgress),.5);
 road.dataset.progress='1';motion.sync(panel,session,{reduced:true});assert.equal(Number(road.dataset.visualProgress),1);assert.equal(road.style.getPropertyValue('--traffic-camera-x'),'-300px');
});

test('all thirty correct signals reach the finish line once; red responses never move the car',()=>{
 for(const trafficMode of ['circles','signs']){
  let now=0;const session=FACTORIES.traffic({trafficMode,level:'hard',random:seededRandom(21),now:()=>now});let previous=0;
  while(!session.done){now+=100;if(session.current.target)session.respond();assert.ok(trafficProgress(session)>=previous);previous=trafficProgress(session);now+=900;session.tick();assert.ok(trafficProgress(session)>=previous);previous=trafficProgress(session);}
  assert.equal(previous,1);assert.equal(session.metrics.hits,30);assert.equal(session.result.outcomes.length,150);
  const {document}=parseHTML(trafficRoad(session)),car=document.querySelector('.road-car');assert.equal(car.getAttribute('transform'),'translate(375 0)');assert.ok(document.querySelector('.road-destination.arrived'));
  const wrong=FACTORIES.traffic({trafficMode,random:seededRandom(42),now:()=>0});wrong.index=wrong.trials.findIndex(trial=>!trial.target);wrong.respond();assert.equal(trafficProgress(wrong),0);
 }
});
