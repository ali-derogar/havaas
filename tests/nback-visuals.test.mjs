import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {memoryStage,memoryRule,memoryControls,syncMemoryStage} from '../src/nback-ui.js';
import {memoryOutcomeArt} from '../src/nback-art.js';
import {symbol} from '../src/visuals.js';

test('memory station presents only the current canonical stimulus and never reveals a match or history',()=>{
 for(const level of ['easy','medium','hard'])for(const material of ['shapes','numbers','toys']){
  let now=0;const session=FACTORIES.nback({level,material,now:()=>now,random:seededRandom(42)});
  for(let trial=0;trial<session.n+6;trial++){
   const before=JSON.stringify({trial:session.current,metrics:session.metrics,outcomes:session.outcomes});
   const html=memoryStage(session)+memoryRule(session)+memoryControls(session),{document}=parseHTML(html);
   assert.equal(document.querySelectorAll('.symbol').length,1);
   assert.equal(document.querySelector('.symbol').outerHTML,parseHTML(symbol(session.current.stimulus)).document.querySelector('.symbol').outerHTML);
   assert.equal(document.querySelectorAll('.memory-sealed-slot').length,session.n);
   assert.equal(document.querySelector('[data-target],.reference,.memory-token,.lesson-token'),null);
   assert.equal(document.querySelector('[data-action=respond]').hasAttribute('disabled'),session.current.scored===false);
   assert.equal(JSON.stringify({trial:session.current,metrics:session.metrics,outcomes:session.outcomes}),before);
   // Two trials with the same display must have identical presentation, even
   // when the engine's hidden match and earlier stimuli are completely different.
   const target=session.current.target,history=session.current.history;
   session.current.target=!target;session.current.history=[{shape:'heart',color:'red'}];
   assert.equal(memoryStage(session)+memoryRule(session)+memoryControls(session),html);
   session.current.target=target;session.current.history=history;
   now+=1000;session.tick();
  }
 }
});

test('memory ring follows the active clock and exposure; result album summarizes actual decisions',()=>{
 let now=0;const session=FACTORIES.nback({level:'hard',material:'numbers',now:()=>now,random:seededRandom(15)});
 const panel=parseHTML(`<div>${memoryStage(session)}</div>`).document.querySelector('div');
 now=99;syncMemoryStage(panel,session);assert.equal(panel.querySelector('.memory-stage').dataset.exposure,'shown');
 now=100;syncMemoryStage(panel,session);assert.equal(panel.querySelector('.memory-stage').dataset.exposure,'hidden');
 assert.equal(panel.querySelector('.memory-interval-arc').getAttribute('stroke-dashoffset'),'10');
 session.pause();now+=20000;syncMemoryStage(panel,session);assert.equal(panel.querySelector('.memory-interval-arc').getAttribute('stroke-dashoffset'),'10');
 session.resume();syncMemoryStage(panel,session);assert.equal(panel.querySelector('.memory-interval-arc').getAttribute('stroke-dashoffset'),'0');
 while(!session.done){now+=100;if(session.current.scored!==false&&(session.current.target||session.position%7===0))session.respond();now+=900;session.tick();}
 const snapshot=JSON.stringify(session.result),{document}=parseHTML(memoryOutcomeArt(session));
 const tiles=[...document.querySelectorAll('.memory-result-tile')];assert.equal(tiles.length,15);
 for(const [i,tile] of tiles.entries())assert.equal(Number(tile.dataset.correct),session.outcomes.slice(i*10,i*10+10).filter(outcome=>outcome.correct).length);
 assert.equal(tiles.reduce((sum,tile)=>sum+Number(tile.dataset.correct),0),session.result.correctResponses);
 assert.equal(JSON.stringify(session.result),snapshot);
});
