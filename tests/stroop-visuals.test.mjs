import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {isStroopTarget} from '../src/games/stroop.js';
import {symbol} from '../src/visuals.js';
import {stroopScene,stroopControls,stroopTransition,syncStroopStage} from '../src/stroop-ui.js';
import {stroopOutcomeArt} from '../src/stroop-art.js';

test('studio displays the original ink and word for every trial without exposing the answer',()=>{
 for(const level of ['easy','medium','hard']){
  let now=0;const session=FACTORIES.stroop({level,now:()=>now,random:seededRandom(42)});
  while(!session.done){
   if(session.gate)session.acknowledge();
   const before=JSON.stringify(session.current),html=stroopScene(session)+stroopControls(session),{document}=parseHTML(html);
   const actual=document.querySelector('.studio-stimulus').innerHTML,expected=parseHTML(`<div>${symbol(session.current.stimulus)}</div>`).document.querySelector('div').innerHTML;
   assert.equal(actual,expected);assert.equal(document.querySelectorAll('.studio-stimulus>.symbol,.studio-stimulus>.word-stimulus').length,1);
   assert.equal(document.querySelector('[data-target],.target,.correct'),null);
   assert.equal(document.querySelector('.studio-phase-path [aria-current]').querySelector('b').textContent,String(session.current.phase+1).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]));
   session.current.target=!session.current.target;assert.equal(stroopScene(session)+stroopControls(session),html);session.current.target=!session.current.target;assert.equal(JSON.stringify(session.current),before);
   now+=1000;session.tick();
  }
 }
});

test('studio intervals, frozen rule changes and paint pots reflect actual time and decisions',()=>{
 let now=0;const session=FACTORIES.stroop({level:'hard',now:()=>now,random:seededRandom(19)});
 const panel=parseHTML(`<section>${stroopScene(session)}</section>`).document.querySelector('section');
 now=250;syncStroopStage(panel,session);assert.equal(panel.querySelector('.studio-interval-track>span').style.width,'75%');assert.equal(panel.querySelector('.studio-stimulus').disabled,true);
 session.pause();now+=20000;syncStroopStage(panel,session);assert.equal(panel.querySelector('.studio-interval-track>span').style.width,'75%');session.resume();
 let gates=0;
 while(!session.done){
  if(session.gate){
   gates++;const elapsed=session.clock.elapsed,phase=session.current.phase,{document}=parseHTML(stroopTransition(session,''));
   assert.equal(document.querySelectorAll('.rule-sample').length,2);assert.equal(document.querySelector('.stroop-rule-picture').dataset.rulePhase,String(phase));
   now+=20000;session.tick();assert.equal(session.clock.elapsed,elapsed);session.acknowledge();
  }
  now+=150;if(isStroopTarget(session.current.phase,session.current.stimulus)&&session.index%3!==0)session.respond();now+=850;session.tick();
 }
 assert.equal(gates,3);const before=JSON.stringify(session.result),{document}=parseHTML(stroopOutcomeArt(session));
 const pots=[...document.querySelectorAll('.studio-result-pot')];assert.equal(pots.length,4);
 for(const [phase,pot] of pots.entries()){const outcomes=session.outcomes.filter(outcome=>outcome.phase===phase);assert.equal(Number(pot.dataset.total),outcomes.length);assert.equal(Number(pot.dataset.correct),outcomes.filter(outcome=>outcome.correct).length);}
 assert.equal(JSON.stringify(session.result),before);
});
