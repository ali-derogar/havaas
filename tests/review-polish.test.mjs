import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {generateSearch} from '../src/games/search.js';
import {symbol} from '../src/visuals.js';
import {describeStimulus} from '../src/stimuli.js';
import {stroopScorecard,trafficRulePicture} from '../src/play-ui.js';
import {canonicalResult,normalizeSettings} from '../server/domain.js';
import {comparableRecords} from '../src/core/reports.js';
import {playSession} from './helpers/play-session.mjs';
import {moveFieldFocus} from '../src/play-input.js';

test('revision seven seeded search and mission fields remain byte-for-byte reproducible',()=>{
 const fingerprints={
  'search-shapes':'af43a9de0d78a56d08bf09e76c0da22561a704f0ff7131e69db70d027c68da41',
  'search-letters':'d92834ee1dccce782114e98360086889521d688f2486097721329a23bedbd3a1',
  'ark-shapes':'9346a3e5b6b16a0225aa52db4693e3f400701d62029fb2760d0ade8949777804',
  'space-shapes':'1135f62a40344dd604704b824b837aceb7b4c2c4ab94fd1761103b3dad0e9fdf',
 };
 for(const [key,expected] of Object.entries(fingerprints)){
  const [gameId,material]=key.split('-'),session=FACTORIES[gameId]({level:'hard',targetCount:2,material,stimulusVersion:7,random:seededRandom(42),now:()=>0});
  const digest=createHash('sha256').update(JSON.stringify(session.current||session.items)).digest('hex');
  assert.equal(digest,expected);
 }
});

test('hard search covers every available detail before repeating and targets each new attachment',()=>{
 const targetDetails=new Set();
 for(const material of ['shapes','letters'])for(let seed=0;seed<60;seed++)for(const targetCount of [1,2]){
  const board=generateSearch('hard',seededRandom(seed),'scattered',material,targetCount,8);
  const distractors=board.choices.filter(choice=>!choice.target),available=(material==='letters'?7:12)-targetCount;
  assert.equal(new Set(distractors.map(choice=>choice.detail)).size,available);
  for(const target of board.targets){
   assert.equal(board.choices.filter(choice=>choice.shape===target.shape&&choice.color===target.color&&choice.detail===target.detail).length,1);
   if(material==='shapes'){targetDetails.add(target.detail);assert.match(symbol(target),/shape-attachment/);}
   else assert.equal(parseHTML(symbol(target)).document.querySelectorAll('.letter-mark').length,2);
  }
 }
 assert.deepEqual([...targetDetails].sort((a,b)=>a-b),[4,5,6,7,8,9,10,11]);
 for(const shape of ['star','circle','diamond','square','triangle']){
  assert.equal(new Set(Array.from({length:12},(_,detail)=>symbol({shape,color:'blue',detail}))).size,12);
  assert.equal(new Set(Array.from({length:12},(_,detail)=>describeStimulus({shape,color:'blue',detail}))).size,12);
 }
});

test('new and previous game revisions complete through authoritative validation without mixing reports',()=>{
 for(const gameId of ['search','ark','space','hunt','traffic','nback','stroop'])for(const stimulusVersion of [7,8]){
  const settings={...normalizeSettings({gameId}),seed:42,level:'hard',stimulusVersion};
  const run={id:'polish-validation',kind:'training',settings},result=canonicalResult(run,playSession(run));
  assert.equal(result.stimulusVersion,stimulusVersion);assert.equal(result.completed,true);
  const current={kind:'training',result},other={kind:'training',result:{...result,stimulusVersion:stimulusVersion===8?7:8}};
  assert.deepEqual(comparableRecords([other,current],current),[current]);
 }
});

test('per-rule Stroop summary counts correct responses and withheld responses without altering the result',()=>{
 let now=0;const session=FACTORIES.stroop({random:seededRandom(42),now:()=>now});
 while(!session.done){if(session.gate)session.acknowledge();now+=100;if(session.current.target)session.respond();now+=900;session.tick();}
 const before=JSON.stringify(session.result),{document}=parseHTML(stroopScorecard(session));
 assert.deepEqual([...document.querySelectorAll('meter')].map(meter=>[meter.getAttribute('value'),meter.getAttribute('max')]),[['40','40'],['40','40'],['40','40'],['30','30']]);
 assert.equal(JSON.stringify(session.result),before);
 for(const signs of [true,false])assert.equal(parseHTML(trafficRulePicture(signs)).document.querySelectorAll('.symbol').length,2);
});

test('arrow navigation follows spatial directions in RTL fields and skips unavailable choices',()=>{
 const {document}=parseHTML('<div class="search-grid"><button class="search-choice" id="left"></button><button class="search-choice" id="center"></button><button class="search-choice" id="right"></button><button class="search-choice" id="disabled" disabled></button></div>');
 let focused=null;
 for(const [id,x] of [['left',0],['center',70],['right',140],['disabled',100]]){
  const button=document.getElementById(id);button.getBoundingClientRect=()=>({x,y:0,width:50,height:50});button.focus=()=>{focused=id;};
 }
 const center=document.getElementById('center');
 assert.equal(moveFieldFocus(center,'ArrowRight'),true);assert.equal(focused,'right');
 moveFieldFocus(center,'ArrowLeft');assert.equal(focused,'left');
 assert.equal(moveFieldFocus(center,'Space'),false);assert.equal(moveFieldFocus(null,'ArrowLeft'),false);
});
