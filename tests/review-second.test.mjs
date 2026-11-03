import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {createLesson} from '../src/lessons.js';
import {memoryLessonState,memoryLessonView,stroopRulePicture} from '../src/learning-ui.js';
import {GUIDANCE,GuidancePlayer,lessonGuidanceKey} from '../src/guidance.js';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {huntOnScreen} from '../src/games/hunt.js';
import {missionChecklist} from '../src/play-ui.js';
import {symbol} from '../src/visuals.js';
import {canonicalResult,normalizeSettings} from '../server/domain.js';
import {playSession} from './helpers/play-session.mjs';

test('N-back walkthrough reveals one stimulus at a time and keeps the reference hidden until help or review',()=>{
 for(const level of ['easy','medium','hard'])for(const material of ['shapes','numbers','toys'])for(const step of createLesson('nback',{level,material})){
  for(let index=0;index<step.stimuli.length;index++){
   const state={memoryIndex:index},model=memoryLessonState(step,state),{document}=parseHTML(memoryLessonView(step,state));
   assert.equal(document.querySelectorAll('.lesson-token').length,1);assert.equal(document.querySelector('.lesson-token.reference'),null);
   assert.equal(document.querySelector('.lesson-token .symbol').outerHTML,parseHTML(symbol(step.stimuli[index])).document.querySelector('.symbol').outerHTML);
   assert.equal(model.ready,index===step.stimuli.length-1);
   assert.equal(Boolean(document.querySelector('[data-action=lesson-memory-next]')),!model.ready);
  }
  for(const state of [{memoryHelp:true},{answered:true}]){
   const model=memoryLessonState(step,state),{document}=parseHTML(memoryLessonView(step,state));
   assert.equal(document.querySelectorAll('.lesson-token').length,step.n+1);assert.ok(document.querySelector('.lesson-token.reference'));
   assert.equal(model.ready,true);assert.equal(model.index,step.n);
  }
 }
});

test('every Stroop lesson uses the voice and pictorial cue for its own rule',()=>{
 for(const [index,step] of createLesson('stroop').entries()){
  const phase=Math.floor(index/2);assert.equal(step.phase,phase);assert.equal(lessonGuidanceKey('stroop',step),`stroop-${phase}`);
  const {document}=parseHTML(stroopRulePicture(phase));assert.equal(document.querySelector('[data-rule-phase]').dataset.rulePhase,String(phase));
  if(phase===0)assert.ok(document.querySelector('.rule-picture-target>.symbol'));
  if(phase===1||phase===3)assert.ok(document.querySelector('.rule-swatch'));
  if(phase===2||phase===3)assert.equal(document.querySelector('.rule-word').textContent,'زرد');
 }
});

test('mission needs have spoken controls before play and no interactive hints during the scored field',()=>{
 for(const gameId of ['ark','space']){
  const session=FACTORIES[gameId]({level:'hard',random:seededRandom(42)});
  const ready=parseHTML(missionChecklist(session,{interactive:true})).document,playing=parseHTML(missionChecklist(session)).document;
  assert.equal(ready.querySelectorAll('.need-art').length,6);assert.equal(ready.querySelectorAll('[data-action=listen-guide]').length,6);
  assert.equal(playing.querySelectorAll('.need-art').length,6);assert.equal(playing.querySelector('[data-action]'),null);
  assert.deepEqual([...ready.querySelectorAll('[data-guide]')].map(el=>el.dataset.guide),session.required.map(([name])=>name));
 }
});

test('hard search lessons teach the actual added attachments rather than only plain shapes',()=>{
 for(const step of createLesson('search',{level:'hard',targetCount:2})){
  assert.ok(step.samples.every(sample=>sample.detail>=4));
  for(const sample of step.samples)assert.match(symbol(sample),/shape-attachment/);
 }
});

test('departed moving targets lose direct-selection eligibility in revision seven while older runs retain their rules',()=>{
 for(const stimulusVersion of [6,7]){
  let now=0;const session=FACTORIES.hunt({level:'easy',theme:'bird',stimulusVersion,now:()=>now,random:seededRandom(42)});
  const index=session.current.choices.findIndex(choice=>choice.position.x>73);assert.ok(index>=0);
  now=1580;assert.equal(huntOnScreen(session.current.choices[index],now,session.visibleMs),false);
  const result=session.respondToStimulus(session.index,index);
  assert.equal(result===null,stimulusVersion===7);
  assert.equal(Boolean(session.response),stimulusVersion===6);
 }
});

test('spoken playback tracks only its own key and stopping removes the active key',async()=>{
 const states=[];
 class Audio{async play(){}pause(){}}
 const player=new GuidancePlayer({AudioClass:Audio,onState:(state,key)=>states.push({state,key})});
 await player.play('stroop-2');assert.equal(player.key,'stroop-2');assert.deepEqual(states.at(-1),{state:'playing',key:'stroop-2'});
 await player.play('water');assert.equal(player.key,'water');assert.deepEqual(states.at(-1),{state:'playing',key:'water'});
 player.stop();assert.equal(player.key,null);assert.deepEqual(states.at(-1),{state:'idle',key:null});
});

test('the shipped voice scripts match the rebuilt files and explain reviews without asking for unavailable actions',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../assets/audio/scripts.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest.scripts,GUIDANCE);
 assert.equal(manifest.voice,'fa-IR-DilaraNeural');assert.equal(manifest.rate,'-6%');
 for(const key of ['water','food','medkit','vest','flashlight','compass','oxygen','suit','fuel','helmet','map'])assert.ok(!GUIDANCE[key].includes('بردار'));
 assert.ok(!GUIDANCE['not-needed'].includes('دکمه'));
});

test('revision-six results still validate after the teaching revision and new sessions use revision seven',()=>{
 for(const gameId of ['hunt','ark','space','search','nback','stroop']){
  const settings={...normalizeSettings({gameId,theme:'bird'}),seed:42,level:'hard'};assert.equal(settings.stimulusVersion,7);
  const run={id:'previous-review',kind:'training',settings:{...settings,stimulusVersion:6}};
  const result=canonicalResult(run,playSession(run));assert.equal(result.stimulusVersion,6);assert.equal(result.completed,true);
 }
});
