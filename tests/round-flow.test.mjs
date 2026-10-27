import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTORIES } from '../src/games/index.js';
import { seededRandom } from '../src/core/random.js';
import { canonicalResult,normalizeSettings,summaryResult } from '../server/domain.js';
import { comparableRecords } from '../src/core/reports.js';
import { playSession } from './helpers/play-session.mjs';

for(const targetCount of [1,2])test(`paced search: ${targetCount} targets, nine untimed breaks, ten exact rounds`,()=>{
 let now=0,breaks=0;const s=FACTORIES.search({level:'easy',targetCount,pacedRounds:true,now:()=>now,random:seededRandom(42)});
 for(let round=0;round<10;round++){
  assert.equal(s.preview,true);now+=2150;const targets=s.current.choices.flatMap((choice,i)=>choice.target?[i]:[]);
  for(const index of targets)s.choose(index);
  if(round===9){assert.equal(s.done,true);assert.equal(s.roundBreak,null);break;}
  breaks++;assert.deepEqual(s.roundBreak,{round:round+1,found:targetCount,total:targetCount});
  const elapsed=s.clock.elapsed,outcomes=s.outcomes.length,board=s.current;now+=90000;s.tick();s.resume();assert.equal(s.paused,true);assert.equal(s.clock.elapsed,elapsed);assert.equal(s.current,board);assert.equal(s.choose(0),null);assert.equal(s.outcomes.length,outcomes);
  assert.equal(s.continueRound(),true);assert.equal(s.continueRound(),false);assert.equal(s.index,round+1);assert.equal(s.preview,true);
 }
 assert.equal(breaks,9);assert.equal(s.metrics.hits,10*targetCount);assert.equal(s.result.durationMs,21500);assert.equal(s.result.meanReactionMs,150);assert.equal(s.result.roundFlow,'ready');
});
test('paced search timeouts resolve only unfound targets and wait for readiness before the next preview',()=>{
 let now=0;const s=FACTORIES.search({level:'easy',targetCount:2,pacedRounds:true,now:()=>now,random:seededRandom(42)});
 now=2100;s.choose(s.current.choices.findIndex(c=>c.target));now=32000;s.tick();assert.equal(s.metrics.hits,1);assert.equal(s.metrics.misses,1);assert.equal(s.roundBreak.found,1);
 now+=120000;s.tick();assert.equal(s.index,0);s.continueRound();assert.equal(s.index,1);assert.equal(s.preview,true);assert.equal(s.remainingMs,32000);
});
test('guided practice uses its existing five reviews and never adds round breaks',()=>{
 let now=0;const s=FACTORIES.search({level:'easy',practice:true,reviewEnabled:true,pacedRounds:true,now:()=>now,random:seededRandom(42)});
 for(let i=0;i<5;i++){now+=2150;s.choose(s.current.choices.findIndex(c=>c.target));assert.ok(s.review);assert.equal(s.roundBreak,null);s.continueReview();}
 assert.equal(s.done,true);assert.equal(s.result.roundFlow,'continuous');assert.equal(s.result.feedbackMode,'guided');
});
test('the server snapshots round pacing and computes the result label without trusting the payload',()=>{
 const settings={...normalizeSettings({gameId:'search',pacedRounds:false}),seed:42};assert.equal(settings.pacedRounds,true);
 const run={id:'paced-run',kind:'training',settings},payload=playSession(run);payload.roundFlow='continuous';const result=canonicalResult(run,payload);assert.equal(result.roundFlow,'ready');assert.equal(result.hits,10);assert.equal(summaryResult(result).roundFlow,'ready');
 const old={kind:'training',result:{...result,roundFlow:'continuous'}},current={kind:'training',result};assert.deepEqual(comparableRecords([old,current]),[current]);
});

test('generating a new search field excludes CPU work from preview, response time and active duration',()=>{
 let now=0;const seeded=seededRandom(17),random=()=>{now+=7;return seeded();},s=FACTORIES.search({level:'hard',targetCount:2,pacedRounds:true,now:()=>now,random});
 assert.equal(s.clock.elapsed,0);assert.equal(s.remainingMs,17000);
 for(let round=0;round<10;round++){
  now+=2150;const indices=s.current.choices.flatMap((c,i)=>c.target?[i]:[]);for(const i of indices)s.choose(i);
  if(s.roundBreak){now+=60000;s.continueRound();assert.equal(s.clock.elapsed,(round+1)*2150);assert.equal(s.preview,true);}
 }
 assert.equal(s.result.durationMs,21500);assert.equal(s.result.meanReactionMs,150);assert.equal(s.result.hits,20);
});
test('generating mission objects never takes time out of the departure deadline',()=>{
 for(const gameId of ['ark','space']){
  let now=0;const seeded=seededRandom(12),s=FACTORIES[gameId]({gameId,level:'hard',now:()=>now,random:()=>{now+=9;return seeded();}});
  assert.equal(s.clock.elapsed,0);assert.equal(s.remainingMs,30000);
  for(const item of s.items.filter(i=>i.required)){now+=100;if(item.blocked)s.choose(item.id);s.choose(item.id);}assert.equal(s.depart(),true);assert.equal(s.result.durationMs,600);
 }
});
