import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLegacy } from '../server/imports.js';
import { isValidText,validateProfile } from '../src/core/clients.js';

const profile={id:'source-case',firstName:'نام 😀',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',createdAt:'2026-01-01T10:00:00.000+03:30'};
const result={gameId:'traffic',level:'easy',protocolVersion:2,score:2,maxScore:2,hits:2,correctResponses:5,correctRejections:3,omissions:0,falseSelections:0,longestStreak:5,durationMs:5000,meanReactionMs:100,completed:true,finishedAt:'2026-10-27T12:34:56.123+03:30'};
const document=()=>({version:1,profile:{...profile},records:[{id:'source-run',kind:'baseline',result:{...result}}]});

test('valid Persian, emoji, offset timestamps and an omitted standard variant are preserved',()=>{
 const inspected=inspectLegacy(document());assert.deepEqual(inspected.errors,[]);assert.equal(inspected.document.records[0].profileId,profile.id);assert.equal(inspected.document.records[0].result.finishedAt,result.finishedAt);assert.equal(inspected.document.profiles[0].createdAt,profile.createdAt);assert.ok(!Object.hasOwn(inspected.document.records[0].result,'variant'));
 for(const value of ['نام فارسی','نیم‌فاصله','😀','𐍈',''])assert.equal(isValidText(value),true);
});
test('unsupported text in profile fields, nested metadata or object keys is rejected before storage',()=>{
 for(const invalid of ['a\0b','x\ud800','x\udc00','\ud800\ud800\udc00']){
  assert.equal(isValidText(invalid),false);assert.ok(validateProfile({...profile,firstName:invalid}).error);
  for(const alter of [d=>d.profile.firstName=invalid,d=>d.profile.metadata={note:invalid},d=>d.records[0].result.metadata={[invalid]:'value'}]){const d=document();alter(d);assert.ok(inspectLegacy(d).errors.length);}
 }
});
test('invalid dates are reported without normalizing them into a different calendar day',()=>{
 for(const date of ['1',1,'2026-02-30T12:00:00Z','2026-02-29T12:00:00Z','2026-01-01T24:00:00Z','2026-01-01T12:00:00','invalid']){
  const d=document();d.records[0].result.finishedAt=date;assert.ok(inspectLegacy(d).errors.length,String(date));const p=document();p.profile.createdAt=date;assert.ok(inspectLegacy(p).errors.length,String(date));
 }
 const leap=document();leap.records[0].result.finishedAt='2024-02-29T12:00:00Z';assert.deepEqual(inspectLegacy(leap).errors,[]);
});
test('duplicate records cannot bypass detection by omitting the profile ID once',()=>{
 const d=document();d.records.push({...d.records[0],profileId:profile.id});assert.ok(inspectLegacy(d).errors.length);
});
test('overly nested input yields validation errors without overflowing the call stack',()=>{
 const d=document();let metadata=d.profile.metadata={};for(let i=0;i<70;i++)metadata=metadata.next={};assert.ok(inspectLegacy(d).errors.length);
});
