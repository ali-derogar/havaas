import test from 'node:test';
import assert from 'node:assert/strict';
import { activeProfile, addRecord, CLIENTS_KEY, deleteProfile, escapeHTML, latestBaseline, profileRecords, readClients, validateProfile, writeClients } from '../src/core/clients.js';
import { comparableRecords, observations, performanceOf, progressText, recommendLevel } from '../src/core/reports.js';

const result = overrides => ({ gameId:'traffic',level:'easy',variant:'standard',score:30,maxScore:30,hits:30,correctResponses:150,correctRejections:120,omissions:0,falseSelections:0,meanReactionMs:320,longestStreak:150,durationMs:150000,completed:true,finishedAt:'2026-10-27T10:00:00Z',outcomes:[],...overrides });
const clients = () => ({version:1,activeId:'a',profiles:[{id:'a',firstName:'سارا',lastName:'الف'},{id:'b',firstName:'علی',lastName:'ب'}],records:[]});
test('profile validation requires proposal fields, rejects invalid dates, and preserves optional concerns',()=>{
  const input={firstName:' سارا ',lastName:'احمدی',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:''};
  assert.equal(validateProfile(input).profile.firstName,'سارا');
  for(const key of ['firstName','lastName','birthDate','grade','school']) assert.ok(validateProfile({...input,[key]:''}).error);
  for(const birthDate of ['2040-01-01','2016-02-31','not-date'])assert.ok(validateProfile({...input,birthDate}).error);
});
test('baseline, training, active child, and variants remain independent',()=>{
  const c=clients();addRecord(c,result({score:2,maxScore:2}),'baseline');addRecord(c,result(),'training');
  assert.equal(latestBaseline(c,'traffic').score,2);assert.equal(latestBaseline(c,'traffic','signs'),null);
  c.activeId='b';assert.equal(profileRecords(c).length,0);assert.equal(latestBaseline(c,'traffic'),null);
  addRecord(c,result({variant:'signs'}),'training');assert.equal(profileRecords(c).length,1);assert.equal(profileRecords(c,'a').length,2);
  deleteProfile(c,'a');assert.equal(c.profiles.length,1);assert.equal(c.records.length,1);assert.equal(activeProfile(c).id,'b');
  deleteProfile(c,'b');assert.equal(activeProfile(c),null);assert.equal(c.records.length,0);
});
test('client storage reloads history and isolates invalid data or denied storage',()=>{
  const c=clients(), values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  addRecord(c,result(),'training');assert.ok(writeClients(c,storage));assert.equal(readClients(storage).records.length,1);
  c.records.push({profileId:'missing',kind:'training',result:result()},{profileId:'a',kind:'training',result:{...result(),gameId:'unknown'}});writeClients(c,storage);assert.equal(readClients(storage).records.length,1);
  values.set(CLIENTS_KEY,'{bad');assert.equal(readClients(storage).profiles.length,0);
  assert.equal(writeClients(c,{setItem(){throw Error();}}),false);assert.equal(readClients({getItem(){throw Error();}}).activeId,null);
});

test('invalid legacy game identifiers are discarded without losing valid profiles and history',()=>{
 const c=clients();addRecord(c,result(),'training');
 for(const invalid of [{gameId:'constructor'},{gameId:'__proto__'},{level:'toString'},{gameId:{toString:null}},{level:{toString:null}}])c.records.push({profileId:'a',kind:'training',result:result(invalid)});
 const restored=readClients({getItem:()=>JSON.stringify(c)});
 assert.equal(restored.profiles.length,2);assert.equal(restored.records.length,1);assert.equal(restored.records[0].result.gameId,'traffic');
});
test('level recommendation uses recall, errors, speed, streak, and completion without skipping levels',()=>{
  assert.equal(recommendLevel(result()).level,'medium');assert.equal(recommendLevel(result({level:'hard'})).level,'hard');
  assert.equal(recommendLevel(result({level:'medium',hits:0,omissions:30,correctResponses:120,meanReactionMs:null})).level,'easy');
  assert.equal(recommendLevel(result({level:'medium',falseSelections:100})).level,'easy');
  assert.equal(recommendLevel(result({meanReactionMs:900})).level,'easy');assert.equal(recommendLevel(result({longestStreak:2})).level,'easy');
  assert.equal(recommendLevel(result({level:'hard',completed:false})).level,'medium');
  assert.equal(performanceOf(result({hits:0,omissions:30,correctResponses:120})).recall,0);
});
test('progress compares only matching game, level, variant and session kind',()=>{
  const records=[{kind:'training',result:result({correctResponses:120,omissions:30})},{kind:'training',result:result({level:'hard'})},{kind:'baseline',result:result()},{kind:'training',result:result({variant:'signs'})},{kind:'training',result:result()}];
  assert.equal(comparableRecords(records).length,2);assert.ok(progressText(records).includes('۲۰'));
  assert.ok(progressText(records.slice(0,1)).includes('دست‌کم دو'));
  assert.ok(observations(result({hits:0,omissions:30,correctResponses:120,falseSelections:5})).practice.length>=2);
});
test('profile text is escaped before rendering',()=>assert.equal(escapeHTML('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));

test('a wrong selection on a target scene reduces recall and is not an omission',()=>{
  const p=performanceOf(result({score:0,hits:0,maxScore:2,omissions:0,falseSelections:2,correctResponses:3}));
  assert.equal(p.recall,0);assert.equal(p.count,5);assert.equal(p.accuracy,.6);
});
test('changed game protocols do not reuse an old baseline or mix progress series',()=>{
  const c=clients();addRecord(c,result({gameId:'hunt',protocolVersion:2}),'baseline');assert.equal(latestBaseline(c,'hunt'),null);
  addRecord(c,result({gameId:'hunt',protocolVersion:3}),'baseline');assert.equal(latestBaseline(c,'hunt').protocolVersion,3);
  const records=[{kind:'training',result:result({protocolVersion:2})},{kind:'training',result:result({protocolVersion:3})}];
  assert.equal(comparableRecords(records).length,1);
});
