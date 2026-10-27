import test from 'node:test';
import assert from 'node:assert/strict';
import { createLesson } from '../src/lessons.js';
import { isStroopTarget } from '../src/games/stroop.js';
import { LEVELS, GAMES } from '../src/config.js';
import { assessmentSteps, nextAssessmentGame } from '../src/core/assessment.js';
import { addRecord, readClients, writeClients } from '../src/core/clients.js';

const clients=()=>({version:1,activeId:'a',profiles:[{id:'a',firstName:'سارا',lastName:'الف'},{id:'b',firstName:'علی',lastName:'ب'}],records:[]});
const baseline=(id,overrides={})=>({gameId:id,level:'easy',variant:'standard',protocolVersion:id==='hunt'?3:2,score:2,maxScore:2,hits:2,correctResponses:5,correctRejections:3,omissions:0,falseSelections:0,meanReactionMs:300,longestStreak:5,completed:true,durationMs:5000,finishedAt:new Date().toISOString(),...overrides});
test('Stroop untimed examples teach both responding and withholding for all four rules',()=>{
  const lesson=createLesson('stroop');assert.equal(lesson.length,8);
  for(let phase=0;phase<4;phase++){
    const steps=lesson.slice(phase*2,phase*2+2);assert.deepEqual(steps.map(s=>s.expected),[true,false]);
    for(const step of steps){assert.equal(isStroopTarget(phase,step.stimuli[0]),step.expected);assert.ok(step.explanation.length>25);}
  }
});
test('n-back teaching sequences compare exactly one, two, or three steps back for every material',()=>{
  for(const [level,{n}] of Object.entries(LEVELS))for(const material of ['shapes','numbers','toys'])for(const step of createLesson('nback',{level,material})) {
    assert.equal(step.stimuli.length,n+1);assert.equal(step.reference,0);
    assert.equal(step.stimuli.at(-1).shape===step.stimuli.at(-1-n).shape,step.expected);
  }
});
test('the assessment path resumes the next missing standard easy baseline after reload',()=>{
  const c=clients();assert.equal(assessmentSteps(c).length,7);assert.equal(nextAssessmentGame(c),'hunt');
  addRecord(c,baseline('hunt',{level:'hard'}),'baseline');assert.equal(nextAssessmentGame(c),'hunt');
  addRecord(c,baseline('hunt',{protocolVersion:2}),'baseline');assert.equal(nextAssessmentGame(c),'hunt');
  addRecord(c,baseline('hunt'),'baseline');addRecord(c,baseline('ark'),'baseline');
  let value;writeClients(c,{setItem(_key,data){value=data;}});const reloaded=readClients({getItem(){return value;}});
  assert.equal(nextAssessmentGame(reloaded),'space');assert.equal(assessmentSteps(reloaded).filter(s=>s.baseline).length,2);
  reloaded.activeId='b';assert.equal(nextAssessmentGame(reloaded),'hunt');
});
test('completing all seven baseline tasks offers a recommendation per game',()=>{
  const c=clients();for(const game of GAMES)addRecord(c,baseline(game.id),'baseline');
  assert.equal(nextAssessmentGame(c),null);assert.ok(assessmentSteps(c).every(step=>step.baseline&&step.recommendation.level==='medium'));
});
