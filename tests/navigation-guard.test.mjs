import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {createNavigationGuard,handleTabKey} from '../src/navigation-guard.js';
import {createFormTracker} from '../src/pwa-forms.js';
function fixture(options={}){
 const {window,document}=parseHTML('<form id="edit-user-form" data-user="a" data-revision="1"><input name="school" value="old"><input type="password" name="password"></form>');
 const proto=window.HTMLElement.prototype;proto.showModal=function(){this.setAttribute('open','');};proto.close=function(){this.removeAttribute('open');};proto.focus=function(){this.wasFocused=true;};
 const tracker=createFormTracker(),guard=createNavigationGuard({document,tracker,identity:()=> 'admin:a',...options});guard.sync();
 const click=choice=>document.querySelector(`[data-guard="${choice}"]`).dispatchEvent(new window.Event('click',{bubbles:true}));
 return {document,guard,tracker,click,form:document.querySelector('form')};
}
test('navigation guard preserves dirty drafts and original revisions, never restores passwords, and clears on identity change',()=>{
 const {document,guard,form}=fixture();form.querySelector('[name=school]').value='draft';form.querySelector('[name=password]').value='secret';form.querySelector('[name=password]').type='text';guard.stash();
 document.body.innerHTML='<form id="edit-user-form" data-user="a" data-revision="2"><input name="school" value="new from server"><input type="password" name="password"></form>';guard.sync();
 assert.equal(document.querySelector('[name=school]').value,'draft');assert.equal(document.querySelector('form').dataset.revision,'1');assert.equal(document.querySelector('[name=password]').value,'');assert.equal(guard.hasChanges(),true);
 guard.clear();assert.equal(guard.hasChanges(),false);
});
test('navigation guard supports stay, discard and save, and does not block navigation after acknowledgement',async()=>{
 const {guard,form,click,tracker}=fixture();form.querySelector('[name=school]').value='edit';let pending=guard.allow(()=>{});click('stay');assert.equal(await pending,false);assert.equal(guard.hasChanges(),true);
 pending=guard.allow(()=>{});click('discard');assert.equal(await pending,true);assert.equal(guard.hasChanges(),false);
 form.querySelector('[name=school]').value='next edit';pending=guard.allow(async form=>guard.acknowledge(form,tracker.capture(form)));click('save');assert.equal(await pending,true);
 form.dataset.waiting='true';assert.equal(guard.hasChanges(),false);
});
test('manual RTL tabs move focus in physical arrow direction and do not activate before Enter or Space',()=>{
 const {document,window}=parseHTML('<div role="tablist"><button role="tab" aria-selected="true">A</button><button role="tab" aria-selected="false">B</button><button role="tab" aria-selected="false">C</button></div>'),tabs=[...document.querySelectorAll('[role=tab]')];window.HTMLElement.prototype.focus=function(){this.wasFocused=true;};
 const event={target:tabs[0],key:'ArrowLeft',preventDefault(){this.prevented=true;}};assert.equal(handleTabKey(event),true);assert.equal(event.prevented,true);assert.equal(tabs[1].wasFocused,true);assert.equal(tabs[0].getAttribute('aria-selected'),'true');assert.equal(tabs[1].getAttribute('tabindex'),'0');
});

test('cancelling save-and-continue stops later forms and cannot settle a newer confirmation',async()=>{
 const {document,guard,form,tracker,click}=fixture();document.body.insertAdjacentHTML('beforeend','<form id="admin-difficulty-form"><input name="level" value="easy"></form>');guard.sync();form.querySelector('[name=school]').value='saved first';document.querySelector('[name=level]').value='hard';
 let release;const gate=new Promise(resolve=>release=resolve),saved=[];
 const first=guard.allow(async target=>{saved.push(target.id);if(target===form)await gate;guard.acknowledge(target,tracker.capture(target));});click('save');document.querySelector('.navigation-confirm').dispatchEvent(new document.defaultView.Event('cancel'));assert.equal(await first,false);
 const second=guard.allow(()=>{});release();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(saved,['edit-user-form']);assert.equal(guard.hasChanges(),true);const third=guard.allow(()=>{});assert.equal(third,second);assert.equal(document.querySelectorAll('.navigation-confirm').length,1);click('stay');assert.equal(await second,false);
});

test('an open navigation question remains authoritative after its form is acknowledged',async()=>{
 const {guard,form,tracker,click}=fixture();form.querySelector('[name=school]').value='pending decision';const pending=guard.allow(()=>{});guard.acknowledge(form,tracker.capture(form));assert.equal(guard.hasChanges(),true);assert.equal(guard.allow(()=>{}),pending);click('stay');assert.equal(await pending,false);assert.equal(guard.hasChanges(),false);
});

test('a failed request still reports its error after the navigation question was cancelled',async()=>{
 const errors=[],{document,guard,form,click}=fixture({onSaveError:error=>errors.push(error.message)});form.querySelector('[name=school]').value='keep failed draft';let reject;const request=new Promise((_resolve,failure)=>reject=failure);const pending=guard.allow(()=>request);click('save');document.querySelector('.navigation-confirm').dispatchEvent(new document.defaultView.Event('cancel'));assert.equal(await pending,false);reject(new Error('save failed'));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(errors,['save failed']);assert.equal(guard.hasChanges(),true);assert.equal(document.querySelectorAll('.navigation-confirm').length,0);
});
