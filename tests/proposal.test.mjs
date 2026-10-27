import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { canonicalResult, normalizeSettings, summaryResult } from '../server/domain.js';
import { PROTOCOL, GAME_MAP, LEVELS, THEMES } from '../src/config.js';
import { comparableRecords, parentNarrative } from '../src/core/reports.js';
import { reportsView } from '../src/client-ui.js';
import { playSession } from './helpers/play-session.mjs';

const settings=(gameId,extra={})=>({...normalizeSettings({gameId,...extra}),...extra,seed:42});
const runFor=(gameId,kind='training',extra={})=>({id:`proposal-${gameId}`,kind,settings:settings(gameId,{reviewEnabled:kind==='baseline',...extra})});
const variants=[
  ...Object.keys(THEMES).flatMap(theme=>[1,2].map(targetCount=>({gameId:'hunt',theme,targetCount}))),
  ...['circles','signs'].map(trafficMode=>({gameId:'traffic',trafficMode})),
  ...['shapes','letters'].flatMap(material=>['grid','scattered'].flatMap(layout=>[1,2].map(targetCount=>({gameId:'search',material,layout,targetCount})))),
  ...['shapes','numbers','toys'].map(material=>({gameId:'nback',material})),
  ...['ark','space','stroop'].map(gameId=>({gameId})),
];
for(const variant of variants)test(`proposal: ${JSON.stringify(variant)} baseline and every difficulty save valid complete results`,()=>{
  for(const [kind,level] of [['baseline','easy'],...Object.keys(LEVELS).map(level=>['training',level])]){
    const run=runFor(variant.gameId,kind,{...variant,level}),result=canonicalResult(run,playSession(run)),practice=kind==='baseline',game=GAME_MAP[variant.gameId];
    assert.equal(result.completed,true);assert.equal(result.score,result.maxScore);assert.equal(result.falseSelections,0);assert.equal(result.omissions,0);assert.equal(result.sessionId,run.id);assert.equal(result.level,level);
    assert.equal(result.feedbackMode,practice?'guided':'continuous');
    if(game.kind==='reaction'){assert.equal(result.outcomes.length,practice?5:150);assert.equal(result.hits,practice?2:30);assert.equal(result.durationMs,(practice?5:150)*1000+(game.id==='nback'?LEVELS[level].n*1000:0));}
    else if(game.kind==='search'){assert.equal(result.rounds,practice?5:10);assert.equal(result.hits,(practice?5:10)*run.settings.targetCount);}
    else if(practice)assert.equal(result.outcomes.length,5);
    else {assert.equal(result.departed,true);assert.equal(result.hits,LEVELS[level].required);if(game.id==='space')assert.equal(result.obstaclesCleared,LEVELS[level].obstacles);}
    if(game.id==='hunt')assert.equal(result.stimulusFamily,variant.theme);
  }
});

test('proposal: a reaction session cannot compress, skip, or duplicate timed trials',()=>{
  for(const id of ['hunt','traffic','nback','stroop']){
    const run=runFor(id),valid=playSession(run);
    const compressed=structuredClone(valid);compressed.durationMs=1;for(const o of compressed.outcomes){o.atMs=1;if(o.response)o.reactionMs=0;}assert.throws(()=>canonicalResult(run,compressed));
    const duplicate=structuredClone(valid);duplicate.outcomes[1].atMs=duplicate.outcomes[0].atMs;assert.throws(()=>canonicalResult(run,duplicate));
    const warmup=structuredClone(valid);for(const o of warmup.outcomes)o.atMs-=500;assert.throws(()=>canonicalResult(run,warmup));
    assert.equal(canonicalResult(run,valid).hits,PROTOCOL.targets);
  }
});
test('proposal: search enforces memorisation time, round deadlines and onset-based reaction times',()=>{
  const run=runFor('search','training',{targetCount:2}),valid=playSession(run);
  const early=structuredClone(valid);early.outcomes[0].atMs=1900;assert.throws(()=>canonicalResult(run,early));
  const fabricatedRT=structuredClone(valid);fabricatedRT.outcomes[0].reactionMs=0;assert.throws(()=>canonicalResult(run,fabricatedRT));
  const shortPreview=structuredClone(valid);for(const o of shortPreview.outcomes)if(o.round>1)o.atMs-=500;assert.throws(()=>canonicalResult(run,shortPreview));
  const late=structuredClone(valid);late.outcomes[0].atMs=32000;assert.throws(()=>canonicalResult(run,late));
  const timedOut=playSession(run,{omit:true});assert.equal(canonicalResult(run,timedOut).omissions,20);
  const prematureMiss=structuredClone(timedOut);prematureMiss.outcomes[0].atMs=3000;assert.throws(()=>canonicalResult(run,prematureMiss));
});
test('proposal: adventure recomputes decision times and rejects premature omissions and events after departure',()=>{
  for(const game of ['ark','space']){
    const run=runFor(game),valid=playSession(run);
    const falseRT=structuredClone(valid);for(const o of falseRT.outcomes)if(o.response)o.reactionMs=0;assert.equal(canonicalResult(run,falseRT).meanReactionMs,canonicalResult(run,valid).meanReactionMs);assert.ok(canonicalResult(run,falseRT).meanReactionMs>0);
    const timedOut=playSession(run,{timeout:true});assert.equal(canonicalResult(run,timedOut).completed,false);
    const earlyMiss=structuredClone(timedOut);earlyMiss.outcomes[0].atMs=0;assert.throws(()=>canonicalResult(run,earlyMiss));
  }
  const run=runFor('space'),payload=playSession(run),clear=payload.events.find(e=>e.kind==='clear');payload.events=payload.events.filter(e=>e!==clear);payload.events.push(clear);assert.throws(()=>canonicalResult(run,payload));
});

const result=(extra={})=>({gameId:'traffic',level:'easy',variant:'standard',protocolVersion:2,hits:30,maxScore:30,score:30,correctResponses:150,correctRejections:120,omissions:0,falseSelections:0,meanReactionMs:300,longestStreak:150,durationMs:150000,completed:true,finishedAt:'2026-10-27T10:00:00Z',outcomes:[],...extra});
const record=(id,extra={})=>({id,profileId:'child',kind:'training',result:result(extra)});
const client=(records)=>({activeId:'child',profiles:[{id:'child',firstName:'سارا',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:'private-note'}],records});
test('proposal: selecting an earlier record anchors its chart and progress narrative to that game and level',()=>{
  const first=record('traffic-1',{correctResponses:120,omissions:30,hits:0}),last=record('traffic-2'),other=record('search-1',{gameId:'search',hits:10,maxScore:10,score:10,correctResponses:10,correctRejections:0});const records=[first,last,other];
  const state={recordId:first.id,game:'',level:'',variant:'',kind:'training',tab:'parents'}, {document}=parseHTML(reportsView(client(records),state));
  const caption=document.querySelector('.progress-chart figcaption').textContent;assert.ok(caption.includes('چراغ راهنمایی'));assert.ok(!caption.includes('بگرد و پیدا کن'));assert.ok(caption.includes('۲'));
  assert.ok(document.querySelector('.parent-narrative p').textContent.includes('۳۰ هدف بدون پاسخ'));assert.ok(document.querySelector('.progress-chart>p').textContent.includes('۲۰'));
  assert.equal(document.querySelector('.outcome-details'),null);assert.ok(!document.toString().includes('private-note'));
  assert.deepEqual(comparableRecords(records,first),[first,last]);assert.ok(parentNarrative(first,records).includes('۲۰'));
});
test('proposal: hunting families, unknown legacy conditions, versions and feedback modes stay separate',()=>{
  const star=record('star',{gameId:'hunt',protocolVersion:3,stimulusFamily:'star'}),fish=record('fish',{gameId:'hunt',protocolVersion:3,stimulusFamily:'fish'}),legacy=record('legacy',{gameId:'hunt',protocolVersion:3,settingsSnapshot:{theme:'star',clinicalNote:'private'}}),unknown=record('unknown',{gameId:'hunt',protocolVersion:3}),guided={...star,id:'guided',kind:'baseline'};
  assert.deepEqual(comparableRecords([star,fish,legacy,unknown,guided],star),[star,legacy]);
  const parent=summaryResult(legacy.result);assert.equal(parent.stimulusFamily,'star');assert.equal(parent.settingsSnapshot,undefined);assert.ok(!JSON.stringify(parent).includes('private'));
});
test('proposal: displayed active duration rounds over a minute boundary correctly',()=>{
  const r=record('minute',{durationMs:59999});const {document}=parseHTML(reportsView(client([r]),{tab:'therapist',recordId:r.id}));
  const active=[...document.querySelectorAll('.report-metrics>div')].find(el=>el.querySelector('span').textContent==='زمان فعال');assert.equal(active.querySelector('b').textContent,'۱ دقیقه و ۰ ثانیه');
});
