import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {moveFieldFocus,restorePlayFocus,syncHuntFocus} from '../src/play-input.js';

const bounds=(x,y,width=20,height=20)=>({x,y,width,height,left:x,right:x+width,top:y,bottom:y+height});
test('hunt arrow navigation and restored focus skip choices fully outside the clipped field',()=>{
 const {document}=parseHTML('<section><div class="hunt-surface"><button class="hunt-choice" data-action="stimulus-response" data-choice="0" id="current"></button><button class="hunt-choice" data-action="stimulus-response" data-choice="1" id="gone"></button><button class="hunt-choice" data-action="stimulus-response" data-choice="2" id="visible"></button></div><button data-action="respond" id="respond"></button></section>');
 const field=document.querySelector('.hunt-surface');field.getBoundingClientRect=()=>bounds(0,0,100,100);let focused=null;
 for(const [id,rect] of [['current',bounds(10,10)],['gone',bounds(105,10)],['visible',bounds(60,65)]]){const button=document.getElementById(id);button.getBoundingClientRect=()=>rect;button.focus=()=>{focused=id;};}
 document.getElementById('respond').focus=()=>{focused='respond';};
 assert.equal(moveFieldFocus(document.getElementById('current'),'ArrowRight'),true);assert.equal(focused,'visible');
 restorePlayFocus(document.querySelector('section'),{action:'stimulus-response',choice:'1'});assert.notEqual(focused,'gone');
 restorePlayFocus(document.querySelector('section'),{action:'stimulus-response',choice:'2'});assert.equal(focused,'visible');
});

test('moving hunt choices leave the Tab order when fully clipped and hand off existing focus without scrolling',()=>{
 const {document}=parseHTML('<section class="play-panel"><div class="hunt-surface"><button class="hunt-choice" id="gone"></button><button class="hunt-choice" id="partial"></button><button class="hunt-choice" id="disabled" disabled></button></div><button data-action="respond" id="respond"></button></section>');
 const field=document.querySelector('.hunt-surface'),gone=document.getElementById('gone'),partial=document.getElementById('partial'),disabled=document.getElementById('disabled');let focused=null,options=null,x=105;
 field.getBoundingClientRect=()=>bounds(0,0,100,100);gone.getBoundingClientRect=()=>bounds(x,10);partial.getBoundingClientRect=()=>bounds(95,40);disabled.getBoundingClientRect=()=>bounds(40,40);
 document.getElementById('respond').focus=value=>{focused='respond';options=value;};
 syncHuntFocus(field,gone);assert.equal(gone.getAttribute('tabindex'),'-1');assert.equal(gone.getAttribute('aria-hidden'),'true');assert.equal(partial.getAttribute('tabindex'),'0');assert.equal(partial.getAttribute('aria-hidden'),'false');assert.equal(disabled.getAttribute('tabindex'),'-1');assert.equal(focused,'respond');assert.deepEqual(options,{preventScroll:true});
 x=80;syncHuntFocus(field,null);assert.equal(gone.getAttribute('tabindex'),'0');assert.equal(gone.getAttribute('aria-hidden'),'false');
});
