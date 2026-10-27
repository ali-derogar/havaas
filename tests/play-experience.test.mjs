import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { FACTORIES } from '../src/games/index.js';
import { seededRandom } from '../src/core/random.js';
import { learningRecap,searchTargetStatus,searchRounds } from '../src/play-ui.js';
import { canonicalResult,normalizeSettings } from '../server/domain.js';
import { playSession } from './helpers/play-session.mjs';
import { missionOutcomeArt } from '../src/visuals.js';

test('search markers reveal only the target already found and leave other memory targets hidden',()=>{
 let now=0;const s=FACTORIES.search({level:'hard',targetCount:2,random:seededRandom(42),now:()=>now});
 let document=parseHTML(searchTargetStatus(s)).document;assert.equal(document.querySelectorAll('.symbol').length,0);
 now=2100;const index=s.current.choices.findIndex(c=>c.targetIndex===1);s.choose(index);
 document=parseHTML(searchTargetStatus(s)).document;const slots=[...document.querySelectorAll('.target-status')];
 assert.equal(slots[0].querySelector('.symbol'),null);assert.ok(slots[1].querySelector('.symbol'));assert.equal(document.querySelectorAll('.discovered').length,1);
 assert.equal(s.index,0);assert.equal(s.metrics.hits,1);
});
test('search recap explains an errored round once and preserves every outcome and elapsed time',()=>{
 let now=0;const s=FACTORIES.search({level:'easy',targetCount:2,random:seededRandom(11),now:()=>now});
 for(let round=0;round<10;round++){
  now+=2100;for(const [i,c] of s.current.choices.entries())if(!c.target)s.choose(i);
  const targets=s.current.choices.flatMap((c,i)=>c.target?[i]:[]);for(const i of targets)s.choose(i);
 }
 const before=JSON.stringify(s.result),markup=learningRecap(s),{document}=parseHTML(markup);
 assert.equal(document.querySelectorAll('.recap-step').length,4);assert.equal(JSON.stringify(s.result),before);
 assert.equal(s.roundTargets.length,10);assert.equal(s.metrics.hits,20);assert.ok(markup.includes('بازی پایان یافته'));
 assert.equal(document.querySelectorAll('.recap-step .review-targets').length,4);
});
test('post-game n-back recap shows the actual reference after playing without changing scoring',()=>{
 let now=0;const s=FACTORIES.nback({level:'hard',material:'toys',practice:true,random:seededRandom(7),now:()=>now});
 while(!s.done){now+=100;s.respond();now+=900;s.tick();}
 const before=JSON.stringify(s.result),{document}=parseHTML(learningRecap(s));
 assert.ok(document.querySelector('.memory-token.reference'));assert.equal(document.querySelectorAll('.recap-step').length,3);
 for(const step of document.querySelectorAll('.recap-step'))assert.equal(step.querySelectorAll('.memory-token').length,4);
 assert.equal(JSON.stringify(s.result),before);
});
test('successful rounds and missed rounds have distinct progress markers without additional points',()=>{
 let now=0;const s=FACTORIES.search({level:'easy',random:seededRandom(7),now:()=>now});
 now=2100;s.choose(s.current.choices.findIndex(c=>c.target));now+=32000;s.tick();
 const {document}=parseHTML(searchRounds(s));assert.equal(document.querySelectorAll('.round-done').length,1);assert.equal(document.querySelectorAll('.round-retry').length,1);assert.equal(document.querySelectorAll('[aria-current=step]').length,1);assert.equal(s.metrics.hits,1);assert.equal(s.metrics.misses,1);
});
test('mission visuals show departure only on a completed mission',()=>{
 for(const id of ['ark','space']){
  const won=parseHTML(missionOutcomeArt(id,true)).document,lost=parseHTML(missionOutcomeArt(id,false)).document;
  assert.ok(won.querySelector('.mission-outcome-art.departed'));assert.ok(won.querySelector('.arrival-check'));
  assert.ok(lost.querySelector('.mission-outcome-art.waiting'));assert.equal(lost.querySelector('.arrival-check'),null);
 }
});


test('the visual revision is frozen in the start settings and cannot be replaced by the submitted result',()=>{
 for(const gameId of ['hunt','ark','space']){
  const settings={...normalizeSettings({gameId}),seed:42};assert.equal(settings.stimulusVersion,4);
  const oldRun={id:'older-run',kind:'baseline',settings:{...settings,stimulusVersion:1,reviewEnabled:true}};
  const payload=playSession(oldRun);payload.stimulusVersion=999;
  const result=canonicalResult(oldRun,payload);assert.equal(result.stimulusVersion,1);assert.equal(result.settingsSnapshot.stimulusVersion,1);
 }
});
