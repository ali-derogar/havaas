import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile} from '../src/core/clients.js';
import {inspectLegacy} from '../server/imports.js';
import {usernameOf,emailOf,HttpError} from '../server/security.js';
const profile={id:'typed-input',firstName:'نام',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید'};
const result={gameId:'traffic',level:'easy',protocolVersion:2,score:2,maxScore:2,hits:2,correctResponses:5,correctRejections:3,omissions:0,falseSelections:0,longestStreak:5,durationMs:5000,meanReactionMs:100,completed:true,finishedAt:'2026-10-27T12:00:00Z'};
const bad={toString:null};
test('profile validation reports malformed containers and field types without coercing objects',()=>{
 for(const input of [null,undefined,[],false,123,{...profile,firstName:bad},{...profile,school:[]},{...profile,grade:3}]){let inspected;assert.doesNotThrow(()=>inspected=validateProfile(input));assert.ok(inspected.error);}
 assert.equal(validateProfile({...profile,concerns:null}).profile.concerns,'');
});
test('account text helpers return validation errors for non-string values',()=>{
 for(const validate of [usernameOf,emailOf])for(const value of [bad,{},[],true,123,null])assert.throws(()=>validate(value),error=>error instanceof HttpError&&error.status===400);
 assert.equal(usernameOf(' Test.USER '),'test.user');assert.equal(emailOf(' Test@Example.Test '),'test@example.test');
});
test('legacy preview rejects malformed identity keys instead of throwing while building keys',()=>{
 const document=()=>({version:1,profile:{...profile},records:[{id:'result',profileId:profile.id,kind:'baseline',result:{...result}}]});
 for(const alter of [d=>d.profile.firstName=bad,d=>d.records[0].id=bad,d=>d.records[0].profileId=bad,d=>d.records[0].result.gameId=bad,d=>d.records[0].result.level=bad]){const d=document();alter(d);let inspected;assert.doesNotThrow(()=>inspected=inspectLegacy(d));assert.ok(inspected.errors.length);assert.equal(inspected.document,null);}
});
