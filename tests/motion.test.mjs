import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {ForwardMotion,PlayMotion,animalPose,vehiclePose} from '../src/play-motion.js';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';

test('car interpolation moves only forward, reaches its goal, and can be sampled at a frozen clock',()=>{
 const motion=new ForwardMotion();assert.equal(motion.sample(.2,100),0);
 const midway=motion.sample(.2,240);assert.ok(midway>0&&midway<.2);
 assert.equal(motion.sample(.2,240),midway);
 let previous=midway;
 for(let now=260;now<=540;now+=20){const value=motion.sample(.2,now);assert.ok(value>=previous);previous=value;}
 assert.equal(previous,.2);assert.equal(motion.sample(0,800),.2);
 assert.equal(motion.sample(1,900,true),1);
});

test('animal and vehicle articulation is deterministic and leaves seeded game content untouched',()=>{
 for(const theme of ['fish','bird','butterfly']){
  const session=FACTORIES.hunt({theme,random:seededRandom(42),now:()=>0}),before=JSON.stringify(session.trials);
  assert.notDeepEqual(animalPose(theme,0),animalPose(theme,120));assert.deepEqual(animalPose(theme,120),animalPose(theme,120));
  assert.equal(JSON.stringify(session.trials),before);
 }
 for(const gameId of ['ark','space']){
  assert.notDeepEqual(vehiclePose(gameId,0,30000),vehiclePose(gameId,1000,30000));
  assert.deepEqual(vehiclePose(gameId,1000,30000),vehiclePose(gameId,1000,30000));
 }
 assert.ok(vehiclePose('space',30000,30000).left<=66);
});

test('transient flight and particles freeze, resume, finish and are removed on page reset',()=>{
 const {document}=parseHTML('<html><body><section><span class="inventory-slot" data-equipment="water"></span></section></body></html>');
 let now=0;const session=FACTORIES.ark({now:()=>now,random:seededRandom(42)}),motion=new PlayMotion({document,now:()=>now}),panel=document.querySelector('section');
 const destination=document.querySelector('.inventory-slot');destination.getBoundingClientRect=()=>({x:200,y:250,width:40,height:40});
 const source={rect:{x:10,y:20,width:50,height:50},picture:document.createElement('svg')};
 motion.sync(panel,session);motion.fly(source,destination);motion.burst(source);
 assert.equal(document.querySelectorAll('.flying-equipment').length,1);
 now=200;motion.sync(panel,session);const position=document.querySelector('.flying-equipment').style.transform;
 motion.sync(panel,session,{paused:true});now=20200;motion.sync(panel,session,{paused:true});
 assert.equal(document.querySelector('.flying-equipment').style.transform,position);
 motion.sync(panel,session);now+=520;motion.sync(panel,session);
 assert.equal(document.querySelector('.play-effects'),null);assert.ok(destination.classList.contains('just-packed'));
 motion.burst(source);motion.reset();assert.equal(document.querySelector('.play-effects'),null);
 motion.sync(panel,session,{reduced:true});motion.burst(source);motion.fly(source,destination);assert.equal(document.querySelector('.play-effects'),null);
});
