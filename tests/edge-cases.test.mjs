import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalResult,normalizeSettings } from '../server/domain.js';
import { FACTORIES } from '../src/games/index.js';
import { seededRandom } from '../src/core/random.js';
import { playSession } from './helpers/play-session.mjs';

const runFor=(gameId,level='hard')=>({id:'edge-run',kind:'training',settings:{...normalizeSettings({gameId}),level,seed:42}});
test('space result rejects obstacle removal after the mission deadline or a penalty-induced timeout',()=>{
 const run=runFor('space'),valid=playSession(run,{timeout:true}),blocked=FACTORIES.space({...run.settings,now:()=>0,random:seededRandom(42)}).items.find(item=>item.blocked);
 assert.equal(canonicalResult(run,valid).completed,false);
 assert.throws(()=>canonicalResult(run,{...valid,events:[{kind:'clear',itemId:blocked.id,atMs:valid.durationMs}]}),/مانع پس از پایان/);
 let now=0;const engine=FACTORIES.space({...run.settings,now:()=>now,random:seededRandom(42)});now=29000;engine.choose(engine.items.find(item=>!item.required).id);assert.equal(engine.done,true);
 const penalised=engine.result;assert.equal(canonicalResult(run,penalised).completed,false);
 assert.throws(()=>canonicalResult(run,{...penalised,durationMs:29500,events:[{kind:'clear',itemId:blocked.id,atMs:29500}]}),/مانع پس از پایان/);
});
test('valid mission traces with wrong selections and obstacles remain accepted across levels and seeds',()=>{
 for(const gameId of ['ark','space'])for(const level of ['easy','medium','hard'])for(let seed=1;seed<=15;seed++){
  let now=0;const run=runFor(gameId,level);run.settings.seed=seed;const engine=FACTORIES[gameId]({...run.settings,now:()=>now,random:seededRandom(seed)});
  for(const item of engine.items.filter(i=>!i.required).slice(0,2)){now+=100;engine.choose(item.id);}
  for(const item of engine.items.filter(i=>i.required)){now+=100;if(item.blocked)engine.choose(item.id);engine.choose(item.id);}
  assert.equal(engine.depart(),true);const result=canonicalResult(run,engine.result);assert.equal(result.completed,true);assert.equal(result.falseSelections,2);assert.equal(result.obstaclesCleared,engine.clearedObstacles);
 }
});
test('search results require numeric in-range choice indices and reject array prototype properties',()=>{
 const run=runFor('search'),valid=playSession(run);assert.equal(canonicalResult(run,valid).hits,10);
 const stringIndex=structuredClone(valid);stringIndex.outcomes[0].choiceIndex=String(stringIndex.outcomes[0].choiceIndex);assert.throws(()=>canonicalResult(run,stringIndex),/گزینهٔ جست/);
 for(const index of ['constructor','__proto__',1.5,-1,999]){
  const payload=structuredClone(valid);payload.outcomes.unshift({number:0,round:1,choiceIndex:index,response:true,reactionMs:50,atMs:2050});assert.throws(()=>canonicalResult(run,payload),/گزینهٔ جست/);
 }
});
