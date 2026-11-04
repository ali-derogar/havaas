import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {searchChoices,searchPreview,searchMemoryNote} from '../src/search-ui.js';
import {searchTargetStatus} from '../src/play-ui.js';
import {searchOutcomeArt} from '../src/search-art.js';
import {symbol} from '../src/visuals.js';

test('search artwork preserves every symbol and seeded layout, and gives no hidden-target hint',()=>{
 for(const level of ['easy','medium','hard'])for(const material of ['shapes','letters'])for(const layout of ['grid','scattered'])for(const targetCount of [1,2]){
  const session=FACTORIES.search({level,material,layout,targetCount,now:()=>0,random:seededRandom(42)});
  const snapshot=()=>JSON.stringify({current:session.current,metrics:session.metrics,outcomes:session.outcomes}),before=snapshot();
  const preview=parseHTML(searchPreview(session)).document;
  assert.deepEqual([...preview.querySelectorAll('.preview-symbol>.symbol')].map(node=>node.outerHTML),session.current.targets.map(target=>parseHTML(symbol(target)).document.querySelector('.symbol').outerHTML));
  const {document}=parseHTML(searchChoices(session));
  assert.equal(document.querySelectorAll('.search-choice').length,session.current.choices.length);
  for(const [i,choice] of session.current.choices.entries()){
   const node=document.querySelector(`.search-choice[data-index="${i}"]`);
   assert.equal(node.querySelector('.symbol').outerHTML,parseHTML(symbol(choice)).document.querySelector('.symbol').outerHTML);
   assert.equal(node.classList.length,1);assert.ok(node.classList.contains('search-choice'));assert.equal(node.hasAttribute('data-target'),false);
   if(layout==='scattered'){assert.ok(node.getAttribute('style').includes(`left:${choice.position.x}%`));assert.ok(node.getAttribute('style').includes(`--scatter-angle:${choice.angle}deg`));}
  }
  assert.equal(parseHTML(searchTargetStatus(session)+searchMemoryNote()).document.querySelectorAll('.symbol').length,0);
  assert.equal(snapshot(),before);
 }
});

test('only an already discovered target appears in the tracker and result stamps reflect actual finds',()=>{
 let now=0;const session=FACTORIES.search({level:'hard',targetCount:2,now:()=>now,random:seededRandom(42)});
 now=2000;const first=session.current.choices.findIndex(choice=>choice.targetIndex===0);session.choose(first);
 const status=parseHTML(searchTargetStatus(session)).document;
 assert.equal(status.querySelectorAll('.symbol').length,1);assert.equal(status.querySelector('[data-target-index="1"] .symbol'),null);
 const remaining=session.current.choices.findIndex(choice=>choice.targetIndex===1);session.choose(remaining);
 now+=2000;for(const [i,choice] of session.current.choices.entries())if(choice.target)session.choose(i);
 while(!session.done){now+=32000;session.tick();}
 const before=JSON.stringify(session.result),result=parseHTML(searchOutcomeArt(session)).document;
 assert.equal(result.querySelectorAll('.search-result-stamp').length,10);
 assert.equal(result.querySelectorAll('.search-result-stamp.discovered').length,2);
 assert.equal(result.querySelectorAll('.search-result-stamp.unfinished').length,8);
 assert.equal(JSON.stringify(session.result),before);
});
