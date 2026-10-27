import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { FACTORIES } from '../src/games/index.js';
import { GAMES } from '../src/config.js';
import { seededRandom } from '../src/core/random.js';
import { comparableRecords } from '../src/core/reports.js';
import { preparationView, reviewView, transitionView, missionChecklist } from '../src/play-ui.js';
import { generateNBack } from '../src/games/nback.js';
import { canonicalResult } from '../server/domain.js';
import { playSession } from './helpers/play-session.mjs';

for(const game of GAMES)test(`guided ${game.id}: five reviews freeze time and reject duplicate input`,()=>{
  let now=0,reviews=0;const s=FACTORIES[game.id]({gameId:game.id,level:'easy',practice:true,reviewEnabled:true,now:()=>now,random:seededRandom(42)});
  let guard=0;
  while(!s.done&&guard++<30){
    if(s.gate)s.acknowledge();
    if(game.kind==='reaction'){const warmup=s.current.scored===false;now+=150;if(s.current.scored!==false&&s.current.target)s.respond();now+=850;s.tick();if(warmup)continue;}
    else if(game.kind==='search'){now+=2150;for(const [i,c] of s.current.choices.entries())if(c.target)s.choose(i);}
    else {now+=150;const item=s.currentItem;if(item.blocked)s.choose(item.id);if(item.required)s.choose(item.id);else s.reject();}
    assert.ok(s.review,`missing review at decision ${reviews}`);reviews++;
    assert.equal(s.outcomes.length,reviews);
    const elapsed=s.clock.elapsed, review=s.review;
    now+=60000;s.tick();s.resume();
    assert.ok(s.paused);assert.equal(s.clock.elapsed,elapsed);assert.equal(s.review,review);
    if(game.kind==='reaction')assert.equal(s.respond(),null);
    else if(game.kind==='search')assert.equal(s.choose(0),null);
    else {assert.equal(s.choose(s.currentItem.id),null);assert.equal(s.reject(),null);}
    assert.equal(s.outcomes.length,reviews);
    const {document}=parseHTML(reviewView(s));assert.ok(document.querySelector('.practice-review'));assert.ok(document.querySelector('p').textContent.length>25);
    s.continueReview();s.continueReview();assert.equal(s.outcomes.length,reviews);
  }
  assert.ok(s.done);assert.equal(reviews,5);assert.equal(s.result.correctResponses,5);assert.equal(s.result.feedbackMode,'guided');
  assert.equal(s.result.durationMs,game.kind==='reaction'?(5+(s.n||0))*1000:game.kind==='search'?5*2150:5*150);
});

test('guided reviews apply only to practice; main reaction streams retain 150 trials and 30 targets',()=>{
  for(const gameId of ['hunt','traffic','nback','stroop']){
    let now=0;const s=FACTORIES[gameId]({level:'hard',practice:false,reviewEnabled:true,now:()=>now,random:seededRandom(2)});
    for(let i=0;!s.done&&i<155;i++){if(s.gate)s.acknowledge();now+=50;if(s.current.target)s.respond();now+=950;s.tick();assert.equal(s.review,null);}
    assert.ok(s.done);assert.equal(s.result.hits,30);assert.equal(s.outcomes.length,150);assert.equal(s.result.feedbackMode,'continuous');
  }
});
test('n-back review history identifies the exact reference across every level and material',()=>{
  for(const n of [1,2,3])for(const material of ['shapes','numbers','toys']){
    const trials=generateNBack(n,150,30,seededRandom(18),material);
    for(let i=n;i<trials.length;i++){
      assert.deepEqual(trials[i].history,trials.slice(i-n,i).map(t=>t.stimulus));
      assert.equal(trials[i].target,trials[i].history[0].shape===trials[i].stimulus.shape);
    }
  }
});
test('Stroop transitions contrast respond and withhold under each new rule',()=>{
  const s=FACTORIES.stroop({random:seededRandom(7)});
  for(const phase of [1,2,3]){
    s.index=s.trials.findIndex(t=>t.phase===phase);
    const {document}=parseHTML(transitionView(s)),samples=[...document.querySelectorAll('.rule-sample')];
    assert.equal(samples.length,2);assert.equal(samples[0].querySelector('b').textContent,'پاسخ بده');assert.equal(samples[1].querySelector('b').textContent,'صبر کن');
    assert.notEqual(samples[0].querySelector('.word-stimulus').outerHTML,samples[1].querySelector('.word-stimulus').outerHTML);
  }
});
test('mission preparation lists needs; packing equipment checks only the matching need',()=>{
  for(const id of ['ark','space']){
    const s=FACTORIES[id]({gameId:id,level:'hard',random:seededRandom(9)});
    assert.equal(parseHTML(missionChecklist(s)).document.querySelectorAll('.mission-need').length,6);
    const target=s.items.find(i=>i.required&&!i.blocked);s.choose(target.id);
    const {document}=parseHTML(missionChecklist(s));assert.equal(document.querySelectorAll('.packed').length,1);
    assert.ok(!document.querySelector('.packed').textContent.includes(target.name));
    assert.ok(preparationView(s).includes(s.mission.story));
  }
});
test('guided assessments and revised letter drawings are compared only with matching conditions',()=>{
  const base={gameId:'search',level:'hard',variant:'letters',protocolVersion:2};
  const records=[{kind:'baseline',result:base},{kind:'baseline',result:{...base,feedbackMode:'guided',stimulusVersion:1}},{kind:'baseline',result:{...base,feedbackMode:'guided',stimulusVersion:2}},{kind:'baseline',result:{...base,feedbackMode:'guided',stimulusVersion:2}}];
  assert.deepEqual(comparableRecords(records),records.slice(-2));
});
test('canonical results derive guidance and stimulus revision from the authoritative run settings',()=>{
  for(const gameId of ['hunt','ark','space','traffic','search','nback','stroop']){
    const run={id:'run-guided',kind:'baseline',settings:{gameId,level:'easy',seed:42,reviewEnabled:true,protocolVersion:gameId==='hunt'?3:2,material:gameId==='search'?'letters':'shapes',targetCount:1}};
    const payload=playSession(run);payload.feedbackMode='continuous';payload.stimulusVersion=999;
    const result=canonicalResult(run,payload);assert.equal(result.feedbackMode,'guided');assert.equal(result.stimulusVersion,4);assert.equal(result.correctResponses,5);
  }
});

test('hunt review compares the actually selected distractor with the goal',()=>{
  let now=0;const s=FACTORIES.hunt({level:'hard',practice:true,reviewEnabled:true,now:()=>now,random:seededRandom(17)});
  s.index=s.trials.findIndex(t=>t.target);const choice=s.current.choices.findIndex(c=>!c.target),selected=s.current.choices[choice].stimulus;
  now=50;assert.equal(s.respondToStimulus(s.index,choice),false);now=1000;s.tick();assert.ok(s.review);
  const {document}=parseHTML(reviewView(s));const chosen=document.querySelector('.review-comparison>div');assert.equal(chosen.querySelector('small').textContent,'انتخاب تو');
  assert.equal(chosen.querySelector('.symbol').outerHTML,parseHTML(preparationView({...s,targets:[selected]})).document.querySelector('.ready-token .symbol').outerHTML);
});
