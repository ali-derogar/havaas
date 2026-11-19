import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {PlatformMotion,platformTheme} from '../src/platform-motion.js';
import {assessmentMap} from '../src/platform-art.js';

test('the platform skin never activates on game screens, even for an admin',()=>{
 for(const panel of ['guest','client','admin'])for(const screen of ['detail','play','result','unknown'])assert.equal(platformTheme(screen,panel),'');
 assert.equal(platformTheme('home','client'),'explorer');
 assert.equal(platformTheme('account','admin'),'calm');
 assert.equal(platformTheme('public-report','guest'),'calm');
});

test('navigation and motion-preference changes release observers and reveal all content',()=>{
 const {document,window}=parseHTML('<html><body data-platform-theme="explorer"><main><article data-reveal>Always readable</article></main></body></html>');
 const subscriptions=new Set();let observer,disconnects=0,observed=[];
 const media={matches:false,addEventListener(_name,fn){subscriptions.add(fn);},removeEventListener(_name,fn){subscriptions.delete(fn);}};
 window.matchMedia=()=>media;
 window.IntersectionObserver=class {constructor(callback){observer=callback;}observe(node){observed.push(node);}unobserve(node){observed=observed.filter(n=>n!==node);}disconnect(){disconnects++;observed=[];}};
 const motion=new PlatformMotion({document,window}),root=document.querySelector('main'),node=root.firstElementChild;
 motion.sync(root);assert.equal(observed.length,1);
 observer([{isIntersecting:true,target:node}]);assert.ok(node.classList.contains('platform-enter'));assert.equal(observed.length,0);
 media.matches=true;for(const callback of subscriptions)callback();
 assert.equal(node.classList.contains('platform-enter'),false);assert.equal(root.textContent,'Always readable');
 motion.reset();assert.equal(subscriptions.size,0);assert.ok(disconnects>=1);
 delete document.body.dataset.platformTheme;motion.sync(root);assert.equal(observed.length,0);assert.equal(subscriptions.size,0);
});

test('assessment map marks the actual completed stations without gating the others',()=>{
 const steps=Array.from({length:7},(_,i)=>({baseline:[0,3,6].includes(i)?{}:null}));
 const {document}=parseHTML(assessmentMap(steps));
 assert.equal(document.querySelectorAll('.map-stop').length,7);
 assert.equal(document.querySelectorAll('.map-done').length,3);
 assert.equal(document.querySelectorAll('[disabled]').length,0);
 assert.match(document.querySelector('svg').getAttribute('aria-label'),/کارت‌های پایین/);
});
