import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {symbol} from '../src/visuals.js';
import {huntScene,huntTargetCue,huntControls,syncHuntStage} from '../src/hunt-ui.js';
import {huntOutcomeArt} from '../src/hunt-art.js';
import {huntPosition,huntOnScreen} from '../src/games/hunt.js';

test('hunt presentation preserves exact symbols, original positions and moving paths without target hints',()=>{
 for(const theme of ['star','shape','fish','bird','butterfly'])for(const level of ['easy','medium','hard'])for(const targetCount of [1,2]){
  const session=FACTORIES.hunt({theme,level,targetCount,now:()=>0,random:seededRandom(42)}),before=JSON.stringify(session.trials);
  const html=huntScene(session),{document}=parseHTML(html),choices=[...document.querySelectorAll('.hunt-choice')];
  assert.equal(choices.length,session.current.choices.length);assert.equal(document.querySelectorAll('[data-target],.target,.correct').length,0);
  for(const [i,node] of choices.entries()){
   const choice=session.current.choices[i];assert.equal(node.querySelector('.symbol').outerHTML,parseHTML(symbol(choice.stimulus)).document.querySelector('.symbol').outerHTML);
   assert.ok(node.getAttribute('style').includes(`left:${choice.position.x}%;top:${choice.position.y}%`));
   const start=huntPosition(choice,0,session.visibleMs),later=huntPosition(choice,session.visibleMs/2,session.visibleMs);assert.equal(start.x,choice.position.x);
   if(session.moving){assert.ok(later.x>start.x);assert.equal(huntOnScreen(choice,session.visibleMs,session.visibleMs),false);}else assert.equal(later.x,start.x);
  }
  const cue=parseHTML(huntTargetCue(session)).document;assert.equal(cue.querySelectorAll('.target-mini').length,targetCount);
  session.current.target=!session.current.target;session.current.choices.forEach(choice=>choice.target=!choice.target);assert.equal(huntScene(session),html);session.current.target=!session.current.target;session.current.choices.forEach(choice=>choice.target=!choice.target);
  assert.equal(JSON.stringify(session.trials),before);
 }
});

test('hunt clocks freeze, static choices stop accepting input after exposure, and result trail uses actual decisions',()=>{
 let now=0;const session=FACTORIES.hunt({theme:'star',level:'hard',now:()=>now,random:seededRandom(9)});
 const panel=parseHTML(`<section>${huntScene(session)}${huntControls(session)}</section>`).document.querySelector('section');
 now=99;syncHuntStage(panel,session);assert.equal(panel.querySelectorAll('.hunt-choice:disabled').length,0);
 now=100;syncHuntStage(panel,session);assert.equal(panel.querySelectorAll('.hunt-choice:disabled').length,10);
 now=250;syncHuntStage(panel,session);assert.equal(panel.querySelector('.hunt-interval-track>span').style.width,'75%');session.pause();now+=20000;syncHuntStage(panel,session);assert.equal(panel.querySelector('.hunt-interval-track>span').style.width,'75%');session.resume();
 while(!session.done){if(session.gate)session.acknowledge();now+=150;if(session.current.target&&session.index%3!==0)session.respond();now+=850;session.tick();}
 const before=JSON.stringify(session.result),{document}=parseHTML(huntOutcomeArt(session)),stops=[...document.querySelectorAll('.hunt-result-stop')];assert.equal(stops.length,3);
 for(const [phase,node] of stops.entries()){const outcomes=session.outcomes.filter(outcome=>outcome.phase===phase);assert.equal(Number(node.dataset.total),outcomes.length);assert.equal(Number(node.dataset.correct),outcomes.filter(outcome=>outcome.correct).length);}
 assert.equal(JSON.stringify(session.result),before);
});
