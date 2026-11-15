import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {reactionTiming, LEVELS} from '../src/config.js';
import {seededRandom} from '../src/core/random.js';
import {canonicalResult, normalizeSettings, summaryResult} from '../server/domain.js';
import {comparableRecords} from '../src/core/reports.js';
import {preparationView, transitionView} from '../src/play-ui.js';
import {playSession} from './helpers/play-session.mjs';

const fixed=[[800,1500],[500,1200],[300,1000]],moving=[[2000,2500],[1400,1800],[900,1200]];
test('new reaction exposure and response windows gradually change at every difficulty; legacy timing survives',()=>{
 for(const [i,level] of Object.keys(LEVELS).entries())for(const gameId of ['hunt','traffic','nback','stroop'])for(const theme of ['star','shape','fish','bird','butterfly']){
  const options={gameId,level,theme},animal=gameId==='hunt'&&['fish','bird','butterfly'].includes(theme);
  const expected=(animal?moving:fixed)[i],timing=reactionTiming(options),s=FACTORIES[gameId]({...options,random:seededRandom(42)});
  assert.deepEqual([timing.visibleMs,timing.intervalMs],expected);
  assert.deepEqual([s.visibleMs,s.intervalMs],expected);
  for(const stimulusVersion of [5,6,7,8]){
   const old=FACTORIES[gameId]({...options,stimulusVersion,experienceVersion:1,random:seededRandom(42)});
   assert.deepEqual([old.visibleMs,old.intervalMs],animal&&stimulusVersion>=6?[[1600,2000],[1100,1500],[650,1000]][i]:[[300,1000],[200,1000],[100,1000]][i]);
  }
 }
});
test('the server owns experience versions, accepts old runs, and rejects shortened or out-of-window new runs',()=>{
 for(const gameId of ['hunt','traffic','nback','stroop','search','ark','space'])for(const level of Object.keys(LEVELS)){
  const settings={...normalizeSettings({gameId,theme:'bird',experienceVersion:1,pacedRounds:true}),seed:42,level};
  assert.equal(settings.experienceVersion,2);if(gameId==='search')assert.equal(settings.pacedRounds,false);
  const run={id:'current',kind:'training',settings},payload=playSession(run);
  const result=canonicalResult(run,{...payload,experienceVersion:999});assert.equal(result.experienceVersion,2);assert.equal(summaryResult(result).experienceVersion,2);
  if(['hunt','traffic','nback','stroop'].includes(gameId)){
   assert.throws(()=>canonicalResult(run,{...payload,durationMs:payload.durationMs-10}));
   const forged=structuredClone(payload);forged.outcomes.find(o=>o.response).reactionMs=reactionTiming(settings).intervalMs;assert.throws(()=>canonicalResult(run,forged));
  }
  const oldSettings={...settings};delete oldSettings.experienceVersion;if(gameId==='search')oldSettings.pacedRounds=true;
  const oldRun={...run,id:'old',settings:oldSettings},oldResult=canonicalResult(oldRun,playSession(oldRun));assert.equal(oldResult.experienceVersion,1);
  assert.equal(summaryResult({...oldResult,experienceVersion:undefined}).experienceVersion,1);
 }
});
test('Stroop notices advance automatically after three unpaused seconds and never enter scored duration',()=>{
 let now=0,notices=0;const s=FACTORIES.stroop({now:()=>now,random:seededRandom(42)});
 while(!s.done){
  if(s.gate){
   notices++;const elapsed=s.clock.elapsed,index=s.index;
   const {document}=parseHTML(transitionView(s));assert.equal(document.querySelector('[data-action]'),null);assert.equal(document.querySelector('.rule-sample'),null);
   s.acknowledge();assert.equal(s.gate,true);assert.equal(s.respond(),null);
   now+=1000;s.tick();assert.equal(s.gate,true);s.pause();now+=90000;s.tick();assert.equal(s.index,index);assert.equal(s.clock.elapsed,elapsed);
   s.resume();now+=1999;s.tick();assert.equal(s.gate,true);now++;s.tick();assert.equal(s.gate,false);assert.equal(s.clock.elapsed,elapsed);assert.equal(s.index,index);assert.equal(s.visible,true);
  }
  now+=100;if(s.current.target)s.respond();now+=s.intervalMs-100;s.tick();assert.equal(s.review,null);
 }
 assert.equal(notices,3);assert.equal(s.outcomes.length,150);assert.equal(s.result.hits,30);assert.equal(s.result.durationMs,225000);
});
test('main hunting crosses every block without a gate or review',()=>{
 for(const theme of ['star','bird']){
  let now=0;const s=FACTORIES.hunt({theme,reviewEnabled:true,now:()=>now,random:seededRandom(42)});
  while(!s.done){now+=100;if(s.current.target)s.respond();now+=s.intervalMs-100;s.tick();assert.equal(s.gate,false);assert.equal(s.review,null);}
  assert.equal(s.result.hits,30);assert.equal(s.outcomes.length,150);
 }
});
test('search automatically previews the next round after discovery or timeout, retaining the full sample time',()=>{
 for(const targetCount of [1,2]){
  let now=0;const s=FACTORIES.search({targetCount,pacedRounds:true,now:()=>now,random:seededRandom(42)});
  for(let round=0;round<10;round++){
   assert.equal(s.index,round);now+=1999;assert.equal(s.preview,true);now++;assert.equal(s.preview,false);
   if(round===1){now+=30000;s.tick();}else {now+=100;const indices=s.current.choices.flatMap((c,i)=>c.target?[i]:[]);for(const i of indices)s.choose(i);}
   assert.equal(s.roundBreak,null);assert.equal(s.review,null);if(round<9)assert.equal(s.preview,true);
  }
  assert.equal(s.done,true);assert.equal(s.result.hits,9*targetCount);assert.equal(s.result.omissions,targetCount);assert.equal(s.result.roundFlow,'continuous');
 }
});
test('main preparation is compact and keeps session goals without exposing memory samples',()=>{
 for(const gameId of ['hunt','traffic','nback','stroop','search','ark','space']){
  const s=FACTORIES[gameId]({level:'hard',random:seededRandom(42)}),{document}=parseHTML(preparationView(s));
  assert.ok(document.querySelector('.compact-preparation'));assert.ok(document.querySelector('[data-action="listen-guide"]'));assert.equal(document.querySelector('.companion-guide,.memory-example,.memory-token,.lesson-token,.preview-target'),null);
  if(gameId==='hunt')assert.equal(document.querySelectorAll('.target-mini').length,1);
  if(['ark','space'].includes(gameId))assert.equal(document.querySelectorAll('.mission-need').length,6);
  assert.equal(parseHTML(preparationView({...s,practice:true})).document.querySelector('.compact-preparation'),null);
 }
});
test('reports separate experience versions while missing legacy values remain comparable with version one',()=>{
 const result={gameId:'traffic',level:'easy',variant:'standard',protocolVersion:2,stimulusVersion:8};
 const legacy={kind:'training',result},one={kind:'training',result:{...result,experienceVersion:1}},two={kind:'training',result:{...result,experienceVersion:2}};
 assert.deepEqual(comparableRecords([legacy,one,two],one),[legacy,one]);assert.deepEqual(comparableRecords([legacy,one,two],two),[two]);
});
