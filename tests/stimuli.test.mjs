import test from 'node:test';
import assert from 'node:assert/strict';
import {describeStimulus} from '../src/stimuli.js';

test('stimulus descriptions tolerate malformed legacy values and never resolve inherited object properties',()=>{
 for(const stimulus of [null,{},[],{shape:{}},{shape:'constructor'},{shape:'toy-constructor'},{shape:'word',word:'constructor',color:'__proto__'},{shape:'circle',color:{toString:null}},{shape:'word',word:{toString:null}},{shape:'circle',detail:{toString:null}}]){
  let label;assert.doesNotThrow(()=>{label=describeStimulus(stimulus);});assert.equal(typeof label,'string');assert.ok(!label.includes('[native code]'));assert.ok(!label.includes('[object Object]'));
 }
 assert.match(describeStimulus({shape:'circle',color:'blue',detail:1}),/دایره.*آبی.*یک نقطه/);
});
