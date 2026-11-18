import test from 'node:test';
import assert from 'node:assert/strict';
import {GAMES,LEVELS} from '../src/config.js';
import {FACTORIES} from '../src/games/index.js';
import {defaultTiming,validateTiming,timingIdentity,timingKey,TIMING_VARIANTS} from '../src/game-timing.js';
import {normalizeSettings,canonicalResult} from '../server/domain.js';
import {reportResult} from '../server/report-data.js';
import {comparableRecords} from '../src/core/reports.js';
import {inspectLegacy} from '../server/imports.js';
import {reportsView} from '../src/client-ui.js';
import {playSession} from './helpers/play-session.mjs';

test('every supported mode and level has valid defaults, including separate moving hunt timings',()=>{
 for(const game of GAMES)for(const variant of TIMING_VARIANTS[game.id]||['standard'])for(const level of Object.keys(LEVELS))for(const timingFamily of game.id==='hunt'?['static','moving']:['standard']){
  const key=timingIdentity({gameId:game.id,variant,level,timingFamily});
  const timing=defaultTiming({...key,theme:timingFamily==='moving'?'fish':'star'});
  assert.deepEqual(validateTiming(game.id,timing),timing);
 }
 assert.notDeepEqual(defaultTiming({gameId:'hunt',theme:'fish'}),defaultTiming({gameId:'hunt',theme:'star'}));
});
test('invalid timing windows and unknown configuration identities are rejected',()=>{
 for(const timing of [{visibleMs:0,intervalMs:1000},{visibleMs:1000,intervalMs:500},{visibleMs:800.5,intervalMs:1000},{visibleMs:825,intervalMs:1000},{visibleMs:800,intervalMs:Infinity},{visibleMs:800,intervalMs:1000,extra:1}])assert.throws(()=>validateTiming('traffic',timing));
 assert.throws(()=>validateTiming('search',{previewMs:500,searchMs:300001}));
 for(const input of [{gameId:'missing'},{gameId:'traffic',variant:'numbers'},{gameId:'hunt',timingFamily:'missing'},{gameId:'traffic',timingFamily:'moving'},{gameId:'traffic',protocolVersion:999}])assert.throws(()=>timingIdentity(input));
});
for(const game of GAMES)for(const level of ['easy','hard'])test(`custom timing executes and validates on both sides: ${game.id}/${level}`,()=>{
 const timing=game.kind==='reaction'?{visibleMs:650,intervalMs:1950}:game.id==='search'?{previewMs:750,searchMs:1250}:{limitMs:5200};
 const settings={...normalizeSettings({gameId:game.id,theme:'fish'}),level,seed:42,timing},run={kind:'training',settings},payload=playSession(run);
 payload.timing={limitMs:600000};payload.timingKey='forged';
 const result=canonicalResult(run,payload);assert.equal(result.completed,true);assert.deepEqual(result.timing,timing);assert.equal(result.timingKey,timingKey(timing));assert.deepEqual(reportResult(result).timing,timing);
 if(game.kind==='reaction'){
  const bad=structuredClone(payload);bad.outcomes.find(outcome=>outcome.response).reactionMs=1950;assert.throws(()=>canonicalResult(run,bad));
 }else if(game.id==='search'){
  const bad=structuredClone(payload);bad.outcomes[0].atMs=700;assert.throws(()=>canonicalResult(run,bad));
 }else{
  const bad=structuredClone(payload);bad.events.at(-1).atMs=5203;bad.durationMs=5203;assert.throws(()=>canonicalResult(run,bad));
 }
});
test('custom exposure, search preview and mission expiry respect precise boundaries and pauses',()=>{
 let now=0;const traffic=FACTORIES.traffic({now:()=>now,timing:{visibleMs:650,intervalMs:1950}});
 now=649;assert.equal(traffic.visible,true);now=650;assert.equal(traffic.visible,false);assert.notEqual(traffic.respond(),null);
 traffic.pause();now+=60000;assert.equal(traffic.clock.elapsed,650);traffic.resume();now+=1299;traffic.tick();assert.equal(traffic.index,0);now++;traffic.tick();assert.equal(traffic.index,1);
 now=0;const search=FACTORIES.search({now:()=>now,timing:{previewMs:750,searchMs:1250}});now=749;assert.equal(search.preview,true);now=750;assert.equal(search.preview,false);now=2000;search.tick();assert.equal(search.index,1);assert.equal(search.metrics.misses,1);
 now=0;const mission=FACTORIES.ark({now:()=>now,timing:{limitMs:5200}});now=5199;mission.tick();assert.equal(mission.done,false);now++;mission.tick();assert.equal(mission.done,true);assert.equal(mission.completed,false);
});
test('versions one and two ignore custom timing metadata and retain their exact schedules',()=>{
 for(const experienceVersion of [1,2])for(const game of GAMES){
  const options={gameId:game.id,experienceVersion,timing:{visibleMs:10000,intervalMs:15000},seed:42};
  const engine=FACTORIES[game.id](options);assert.deepEqual(engine.timing,defaultTiming(options));assert.equal(engine.result.timing,undefined);
 }
});
test('reports group by actual timing values and exported version-three records retain validated timing',()=>{
 const run={kind:'training',settings:{...normalizeSettings({gameId:'traffic'}),seed:42,timing:{visibleMs:650,intervalMs:1950}}};
 const result=canonicalResult(run,playSession(run)),a={kind:'training',result},same={kind:'training',result:{...result,timing:{intervalMs:1950,visibleMs:650},timingKey:'different-revision'}},different={kind:'training',result:{...result,timing:{visibleMs:650,intervalMs:2000}}};
 assert.deepEqual(comparableRecords([a,same,different],a),[a,same]);
 const profile={id:'one',firstName:'آزمون',lastName:'زمان',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'},document={version:1,profile,records:[{id:'record',profileId:'one',kind:'training',result}]};
 const html=reportsView({activeId:profile.id,profiles:[profile],records:document.records},{game:'',level:'',variant:'',kind:'training'},{role:'admin'});assert.match(html,/class="report-timing"/);assert.match(html,/۰٫۶۵ ثانیه/);assert.match(html,/۱٫۹۵ ثانیه/);
 const invalid={kind:'training',result:{...result,timing:undefined}};assert.deepEqual(comparableRecords([invalid],invalid),[]);
 assert.deepEqual(inspectLegacy(document).errors,[]);document.records[0].result={...result,timing:{visibleMs:-1,intervalMs:1000}};assert.ok(inspectLegacy(document).errors.length);
});
