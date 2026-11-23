import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {FACTORIES} from '../src/games/index.js';
import {seededRandom} from '../src/core/random.js';
import {createStimulusPlan,compatibleBaseline} from '../src/stimulus-plan.js';
import {isStroopTarget} from '../src/games/stroop.js';
import {trafficJourney} from '../src/games/traffic.js';
import {canonicalResult,normalizeSettings,summaryResult} from '../server/domain.js';
import {reportResult} from '../server/report-data.js';
import {playSession} from './helpers/play-session.mjs';
import {getLocale,setLocale,t,lt} from '../src/i18n.js';
import {symbol} from '../src/visuals.js';
import {preparationView,transitionView} from '../src/play-ui.js';
import {comparableRecords,parentNarrative} from '../src/core/reports.js';
import {loginView} from '../src/account-ui.js';

test('v4 color plans change at section boundaries, balance targets and reconstruct on the server',()=>{
 for(let seed=0;seed<40;seed++)for(const targetCount of [1,2]){
  const options={gameId:'hunt',seed,targetCount,theme:'butterfly',level:'hard',locale:'en',experienceVersion:4};
  const session=FACTORIES.hunt({...options,random:seededRandom(seed)});
  assert.equal(session.trials.length,150);assert.equal(session.trials.filter(trial=>trial.target).length,30);
  for(const [phase,targets]of session.targetsByPhase.entries()){
   if(phase)assert.notDeepEqual(targets,session.targetsByPhase[phase-1]);
   const block=session.trials.filter(trial=>trial.phase===phase);
   for(const trial of block){const matches=trial.choices.filter(choice=>targets.some(target=>JSON.stringify(target)===JSON.stringify(choice.stimulus)));assert.equal(matches.length,trial.target?1:0);}
   if(targetCount===2)for(const target of targets)assert.equal(block.filter(trial=>JSON.stringify(trial.stimulus)===JSON.stringify(target)).length,[2,5,8][phase]);
  }
  const run={id:'v4',kind:'training',settings:options},payload=playSession(run),saved=canonicalResult(run,{...payload,locale:'fa',stimulusPlan:{colorsByPhase:[['forged']]}});
  assert.equal(saved.locale,'en');assert.deepEqual(saved.stimulusPlan,createStimulusPlan(options));assert.equal(saved.hits,30);
 }
});
test('v4 hunt notices exclude paused time and publish the next targets before accepting input',()=>{
 let now=0;const session=FACTORIES.hunt({seed:12,now:()=>now,random:seededRandom(12)}),first=session.targets;
 for(let i=0;i<20;i++){now+=session.intervalMs;session.tick();}
 assert.equal(session.gate,true);assert.notDeepEqual(session.targets,first);assert.match(transitionView(session),/رنگ هدف عوض شد/);
 const elapsed=session.clock.elapsed;session.pause();now+=30000;session.tick();assert.equal(session.clock.elapsed,elapsed);session.resume();now+=2999;session.tick();assert.equal(session.gate,true);now++;session.tick();assert.equal(session.gate,false);assert.equal(session.clock.elapsed,elapsed);
});
test('Stroop uses each phase color and pins the language of its scored words',()=>{
 for(let seed=0;seed<30;seed++)for(const locale of ['fa','en']){
  const session=FACTORIES.stroop({seed,locale,random:seededRandom(seed)});
  assert.equal(new Set(session.stimulusPlan.colorsByPhase.flat()).size,4);
  for(const trial of session.trials){assert.equal(trial.target,isStroopTarget(trial.phase,trial.stimulus,session.stimulusPlan.colorsByPhase[trial.phase][0]));if(trial.stimulus.word)assert.equal(trial.stimulus.locale,locale);}
 }
 setLocale('en');assert.match(symbol({shape:'word',word:'red',color:'blue',locale:'fa'}),/قرمز/);setLocale('fa');assert.match(symbol({shape:'word',word:'red',color:'blue',locale:'en'}),/>red</);
});
test('traffic has three mandatory stop windows without extra trials or automatic departures',()=>{
 for(let seed=0;seed<100;seed++){
  const settings={...normalizeSettings({gameId:'traffic'}),seed,level:'easy'},run={id:'traffic-v4',kind:'training',settings},payload=playSession(run),saved=canonicalResult(run,payload);
  assert.equal(saved.outcomes.length,150);assert.equal(saved.hits,30);assert.equal(saved.journey.progress,1);assert.equal(saved.journey.stops.length,3);assert.ok(saved.journey.stops.every(stop=>stop.correct));
 }
 const moves=Array.from({length:8},(_,i)=>({number:i+1,target:true,response:true}));
 const stopped=trafficJourney(moves);assert.equal(stopped.state,'waiting-stop');
 const red=[...moves,{target:false,response:false}];assert.equal(trafficJourney(red).state,'waiting-green');assert.equal(trafficJourney(red).progress,stopped.progress);
 assert.ok(trafficJourney([...red,{target:true,response:true}]).progress>stopped.progress);
 assert.equal(trafficJourney([...moves,{target:false,response:true}]).stops[0].correct,false);
});
test('legacy versions retain old stimuli and new snapshots survive safe report serializers',()=>{
 for(const experienceVersion of [1,2,3])for(const gameId of ['hunt','traffic','stroop','search']){
  const settings={...normalizeSettings({gameId},{experienceVersion}),seed:34,level:'easy'},run={id:'legacy',kind:'training',settings};
  const saved=canonicalResult(run,playSession(run));assert.equal(saved.experienceVersion,experienceVersion);assert.equal(saved.stimulusVersion,8);assert.equal(saved.stimulusPlan,undefined);
 }
 const run={id:'new',kind:'training',settings:{...normalizeSettings({gameId:'stroop',locale:'en'}),seed:34,level:'easy'}};
 const result=canonicalResult(run,playSession(run));for(const dto of [summaryResult(result),reportResult(result)]){assert.equal(dto.locale,'en');assert.deepEqual(dto.stimulusPlan,result.stimulusPlan);}
 const a={kind:'training',result},b={kind:'training',result:{...result,locale:'fa'}};assert.deepEqual(comparableRecords([a,b],a),[a]);assert.equal(compatibleBaseline({...result,experienceVersion:3}),false);
 assert.throws(()=>normalizeSettings({gameId:'hunt',locale:'unknown'}));
});
test('English views translate authored text while retaining personal data and physical butterfly orientation',()=>{
 setLocale('en');try{
  assert.equal(t('حواس'),'Havaas');assert.equal(t('رمز'),'Password');assert.match(lt`سلام ${'آبی'}`,/آبی/);
  assert.match(loginView(),/Password/);
  for(const [gameId,factory]of Object.entries(FACTORIES)){const doc=parseHTML(preparationView(factory({seed:7,locale:'en',practice:true}))).document;assert.doesNotMatch(doc.toString().replace(/<[^>]*>/g,''),/[\u0600-\u06ff]/,gameId);}
  assert.match(symbol({shape:'butterfly',color:'green'}),/class="butterfly-orientation" transform="rotate\(90 32 32\)"/);
  const record={kind:'training',result:{gameId:'traffic',hits:3,maxScore:30,correctResponses:120,omissions:27,falseSelections:3,longestStreak:5,meanReactionMs:500}};assert.doesNotMatch(parentNarrative(record,[record],'en'),/[\u0600-\u06ff]/);
 }finally{setLocale('fa');}assert.equal(getLocale(),'fa');
});
