import test from 'node:test';
import assert from 'node:assert/strict';
import {copyTextField} from '../src/clipboard.js';

test('copying links handles secure, unavailable and rejected Clipboard API access without claiming false success',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const field={value:'http://example.test/#register/token',focus(){},select(){},setSelectionRange(){},ownerDocument:{}};
  try{
    let copied='';
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async value=>{copied=value;}}}});
    assert.equal(await copyTextField(field),true);assert.equal(copied,field.value);
    for(const navigator of [{},{clipboard:{writeText:async()=>{throw Error('Permission denied');}}}]){
      Object.defineProperty(globalThis,'navigator',{configurable:true,value:navigator});
      for(const result of [true,false]){
        let command;
        field.ownerDocument.execCommand=value=>{command=value;return result;};
        assert.equal(await copyTextField(field),result);assert.equal(command,'copy');
      }
      field.ownerDocument.execCommand=()=>{throw Error('Copy blocked');};
      assert.equal(await copyTextField(field),false);
      delete field.ownerDocument.execCommand;
      assert.equal(await copyTextField(field),false);
    }
  }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
