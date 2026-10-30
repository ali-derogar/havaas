import test from 'node:test';
import assert from 'node:assert/strict';
import { publicReportDTO } from '../server/report-links.js';
import { reportsView,variantLabel } from '../src/client-ui.js';

test('shared report excludes account, clinical, raw and nested legacy data at the serialization boundary',()=>{
 const child={id:'private-child-id',owner_user_id:'private-user-id',profile:{firstName:'سارا',lastName:'آزمون',school:'private-school',concerns:'private-note'}};
 const result={version:{outcomes:'private-nested'},gameId:'traffic',level:'easy',variant:'standard',protocolVersion:2,stimulusVersion:4,score:2,maxScore:2,hits:2,correctResponses:5,correctRejections:3,omissions:0,falseSelections:0,longestStreak:5,durationMs:5000,meanReactionMs:200,completed:true,finishedAt:'2026-10-27T12:00:00.000Z',sessionId:'private-session-id',settingsSnapshot:{actorId:'private-actor'},outcomes:[{secret:'private-response'}],inventory:[{id:'private-item'}],feedbackMode:{secret:'private-feedback'}};
 const dto=publicReportDTO(child,[{id:'private-row',actor_id:'private-actor',kind:'baseline',result}]);assert.ok(!JSON.stringify(dto).includes('private-'));assert.equal(dto.sessions[0].result.score,2);assert.equal(dto.sessions[0].result.protocolVersion,2);
 const clients={activeId:'shared',profiles:[{id:'shared',firstName:dto.displayName,lastName:''}],records:dto.sessions.map(s=>({id:String(s.number),profileId:'shared',kind:s.kind,result:s.result}))};
 const html=reportsView(clients,{game:'',level:'',variant:'',kind:'',recordId:null},{role:'public'});assert.ok(html.includes('progress-chart'));assert.ok(html.includes('parent-narrative'));assert.ok(html.includes('print-report'));
 for(const action of ['export-profile','export-trials','profiles','report-links','home'])assert.ok(!html.includes(`data-action="${action}"`),action);
});

test('legacy report labels do not expose inherited JavaScript properties',()=>{
 for(const variant of ['constructor','__proto__','toString','hasOwnProperty'])assert.equal(variantLabel(variant),'معمولی');
});

test('legacy reports render safely when old stimulus-family metadata is malformed',()=>{
 const profile={id:'legacy-profile',firstName:'سارا',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'};
 const base={gameId:'hunt',level:'easy',protocolVersion:3,score:2,maxScore:2,hits:2,correctResponses:5,correctRejections:3,omissions:0,falseSelections:0,longestStreak:5,durationMs:5000,meanReactionMs:200,completed:true,finishedAt:'2026-10-30T12:00:00Z'};
 for(const metadata of [{variant:'standard',stimulusFamily:{toString:null}},{variant:'standard',settingsSnapshot:{theme:{toString:null}}},{variant:'constructor',stimulusFamily:'constructor'},{variant:'__proto__',stimulusFamily:'__proto__'}]){
  const clients={activeId:profile.id,profiles:[profile],records:[{id:'legacy-record',profileId:profile.id,kind:'baseline',result:{...base,...metadata}}]};
  let html;assert.doesNotThrow(()=>{html=reportsView(clients,{game:'',level:'',variant:'',kind:'',recordId:null},{role:'admin'});});
  assert.ok(html.includes('report-metrics'));assert.ok(!html.includes('[native code]'));assert.ok(!html.includes('[object Object]'));
 }
});

test('legacy trial metadata cannot break the report table or display internal object values',()=>{
 const profile={id:'trial-profile',firstName:'سارا',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'};
 const result={gameId:'traffic',level:'easy',protocolVersion:2,score:1,maxScore:1,hits:1,correctResponses:1,correctRejections:0,omissions:0,falseSelections:0,longestStreak:1,durationMs:1000,meanReactionMs:100,completed:true,finishedAt:'2026-10-30T12:00:00Z'};
 for(const extra of [{item:{toString:null}},{number:{toString:null},round:{toString:null},phase:{toString:null}},{stimulus:{shape:'circle',color:{toString:null}}},{stimulus:{shape:'word',word:{toString:null}}},{stimulus:{shape:'circle',detail:{toString:null}}}]){
  const outcome={number:1,target:true,response:true,correct:true,atMs:100,reactionMs:100,...extra};
  const clients={activeId:profile.id,profiles:[profile],records:[{id:'trial-record',profileId:profile.id,kind:'baseline',result:{...result,outcomes:[outcome]}}]};
  let html;assert.doesNotThrow(()=>{html=reportsView(clients,{game:'',level:'',variant:'',kind:'',recordId:null},{role:'admin'});});
  assert.ok(html.includes('outcome-details'));assert.ok(!html.includes('[object Object]'));assert.ok(!html.includes('[native code]'));
 }
});
