import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {huntPosition} from '../src/games/hunt.js';
import {generateSearch} from '../src/games/search.js';
import {canonicalResult,normalizeSettings} from '../server/domain.js';
import {trafficProgress,trafficRoad,preparationView} from '../src/play-ui.js';
import {GuidancePlayer,GUIDANCE,guidanceKey} from '../src/guidance.js';
import {symbol} from '../src/visuals.js';
import {playSession} from './helpers/play-session.mjs';
import {comparableRecords} from '../src/core/reports.js';

test('moving animal fields have usable exposure, reproducible motion, and freeze on the active clock',()=>{
 for(const theme of ['fish','bird','butterfly'])for(const level of ['easy','medium','hard']){
  let now=0;const options={level,theme,now:()=>now};
  const a=FACTORIES.hunt({...options,random:seededRandom(42)}),b=FACTORIES.hunt({...options,random:seededRandom(42)});
  assert.deepEqual(a.trials,b.trials);assert.equal(a.moving,true);assert.ok(a.visibleMs>=650);assert.ok(a.visibleMs<a.intervalMs);
  const choice=a.trials.flatMap(t=>t.choices).find(c=>c.position.x>70);
  const start=huntPosition(choice,0,a.visibleMs),end=huntPosition(choice,a.visibleMs,a.visibleMs);assert.ok(end.x>100);assert.ok(end.x>start.x);
  now=300;a.pause();const frozen=huntPosition(choice,a.clock.elapsed,a.visibleMs);now+=10000;assert.deepEqual(huntPosition(choice,a.clock.elapsed,a.visibleMs),frozen);
  a.resume();assert.equal(a.visible,true);assert.deepEqual(huntPosition(choice,a.clock.elapsed-a.onset,a.visibleMs),frozen);
 }
 for(const theme of ['star','shape'])assert.equal(FACTORIES.hunt({theme,random:seededRandom(1)}).intervalMs,1000);
});

test('the server validates the longer animal response window and rejects shortened or forged runs',()=>{
 const settings={...normalizeSettings({gameId:'hunt',theme:'fish'}),level:'easy',seed:42};
 const run={id:'moving-fish',kind:'training',settings},payload=playSession(run);
 assert.equal(payload.durationMs,300000);assert.equal(canonicalResult(run,payload).hits,30);
 assert.throws(()=>canonicalResult(run,{...payload,durationMs:150000}));
 const forged=structuredClone(payload),response=forged.outcomes.find(o=>o.response);response.reactionMs=2000;assert.throws(()=>canonicalResult(run,forged));
});

test('traffic advances once per hit, never retreats on scene redraw, and reaches the destination',()=>{
 let now=0;const s=FACTORIES.traffic({now:()=>now,random:seededRandom(21)});let previous=0;
 while(!s.done){
  now+=100;if(s.current.target){assert.equal(s.respond(),true);assert.equal(s.respond(),null);}
  const before=trafficProgress(s);assert.ok(before>=previous);assert.ok(trafficRoad(s).includes(`data-progress="${before}"`));
  previous=before;now+=900;s.tick();assert.ok(trafficProgress(s)>=previous);previous=trafficProgress(s);
 }
 assert.equal(previous,1);assert.match(trafficRoad(s),/road-destination arrived/);
 const wrong=FACTORIES.traffic({random:seededRandom(1)});wrong.index=wrong.trials.findIndex(t=>!t.target);wrong.respond();assert.equal(trafficProgress(wrong),0);
});

test('higher difficulty adds unique mission objects and hard search targets include attachments',()=>{
 for(const id of ['ark','space'])for(const [level,count] of [['easy',16],['medium',24],['hard',36]]){
  const s=FACTORIES[id]({level,random:seededRandom(42)});assert.equal(s.items.length,count);assert.equal(new Set(s.items.map(i=>i.icon)).size,count);
  assert.equal(s.scattered,level!=='easy');assert.equal(s.items.filter(i=>i.required).length,({easy:4,medium:5,hard:6})[level]);
  for(const item of s.items)if(s.scattered)assert.ok(Number.isFinite(item.layout.angle));
 }
 const details=new Set();
 for(let seed=0;seed<100;seed++)for(const count of [1,2]){
  const board=generateSearch('hard',seededRandom(seed),'scattered','shapes',count);
  for(const target of board.targets){assert.ok(target.detail>=4);details.add(target.detail);assert.match(symbol(target),/shape-attachment/);}
  assert.equal(board.choices.filter(c=>c.target).length,count);
 }
 assert.deepEqual([...details].sort(),[4,5,6,7]);
});

test('saved revision-five seeds still reconstruct the original fields and are comparable only to their revision',()=>{
 // Fingerprints were captured from the pre-review source at seed 42.
 const fingerprints={hunt:'25e7a1b957d75bee4781975583a5a2da269fb82e9aa23be5be29c679bd397c10',ark:'a4caccc62d360394e3e666c48e17fca2b3cc09b38b72784183bcbba1e5833536',space:'3278fa834df9ad6b0dcea541c5120a389f7ca3883fb23852788f76a07126f6a0'};
 const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 for(const [gameId,expected] of Object.entries(fingerprints)){
  const s=FACTORIES[gameId]({level:'hard',theme:'fish',stimulusVersion:5,random:seededRandom(42)});
  assert.equal(digest(gameId==='hunt'?s.trials:s.items),expected);assert.equal(s.stimulusVersion,5);
 }
 assert.equal(digest(generateSearch('hard',seededRandom(42),'scattered','letters',2,5)),'81e981ca112bab5cf6f66d628a1dccabb25cb29c48f14738a771c7848d65b5f8');
 for(const gameId of ['hunt','ark','space','search']){
  const run={id:'old-in-progress',kind:'training',settings:{...normalizeSettings({gameId,theme:'fish'}),level:'hard',seed:42,stimulusVersion:5}};
  const result=canonicalResult(run,playSession(run));assert.equal(result.stimulusVersion,5);assert.equal(result.completed,true);
  const old={kind:'training',result},current={kind:'training',result:{...result,stimulusVersion:6}};assert.deepEqual(comparableRecords([old,current],current),[current]);
 }
});

test('each spoken instruction has a local audio file and a matching visual preparation',async()=>{
 for(const key of Object.keys(GUIDANCE)){const data=await readFile(new URL(`../assets/audio/${key}.mp3`,import.meta.url));assert.ok(data.length>1000,key);}
 const cases=[{gameId:'hunt',theme:'bird',targetCount:2},{gameId:'search',targetCount:2},{gameId:'nback',level:'hard'},{gameId:'traffic',trafficMode:'signs'},{gameId:'stroop',phase:3}];
 assert.deepEqual(cases.map(guidanceKey),['hunt-moving-dual','search-dual','nback-3','traffic-signs','stroop-3']);
 for(const gameId of ['hunt','traffic','nback','stroop','ark','space','search']){
  const s=FACTORIES[gameId]({level:'easy',practice:true,random:seededRandom(42)});assert.match(preparationView(s),/data-action="listen-guide"/);assert.match(preparationView(s),/companion-guide/);
 }
});

test('a delayed audio start cannot restart the voice after the game starts or the page changes',async()=>{
 let release;const created=[],states=[];
 class Audio{constructor(src){this.src=src;this.paused=false;created.push(this);}play(){return new Promise(resolve=>{release=resolve;});}pause(){this.paused=true;}}
 const player=new GuidancePlayer({AudioClass:Audio,onState:state=>states.push(state)}),pending=player.play('hunt');
 player.stop();release();assert.equal(await pending,false);assert.equal(created[0].paused,true);assert.equal(states.includes('playing'),false);
 const failed=new GuidancePlayer({AudioClass:class{pause(){}async play(){throw Error('Playback denied');}},onState:state=>states.push(state)});
 assert.equal(await failed.play('traffic'),false);assert.equal(states.at(-1),'unavailable');
});
