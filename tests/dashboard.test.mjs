import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {clientWelcome,adminOverview,adminUsersView,userDetailsView,registrationView,createUserView} from '../src/dashboard-ui.js';
import {GAMES,GAME_PROTOCOLS} from '../src/config.js';
const profile={id:'client',ownerUserId:'user',firstName:'سارا',lastName:'آزمون',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'امید',concerns:'clinical-secret'};
const user={id:'user',name:'سارا آزمون',username:'sara',role:'user',active:true,sessionCount:0};
const baseline=game=>({id:game.id,profileId:profile.id,kind:'baseline',result:{gameId:game.id,level:'easy',variant:'standard',protocolVersion:GAME_PROTOCOLS[game.id],finishedAt:'2026-01-01T12:00:00Z',completed:true}});
const dom=html=>parseHTML(html).document;
test('client dashboard continues the first unfinished assessment and never renders clinical notes',()=>{
 const html=clientWelcome({activeId:profile.id,profiles:[profile],records:GAMES.slice(0,3).map(baseline)},user),document=dom(html);
 assert.ok(document.querySelector('[data-action=assessment-next]'));assert.match(document.querySelector('.growth-ring').textContent,/۳/);assert.ok(!html.includes('clinical-secret'));assert.ok(!html.includes('پرونده'));
});
test('after seven assessments the client is directed to the least practiced game with stable game-order ties',()=>{
 const records=GAMES.map(baseline);records.push({...baseline(GAMES[0]),id:'training',kind:'training'});
 const document=dom(clientWelcome({activeId:profile.id,profiles:[profile],records},user));assert.equal(document.querySelector('[data-action=open]').dataset.game,GAMES[1].id);assert.equal(document.querySelector('[data-action=assessment-next]'),null);
});
test('public registration exposes only initial personal fields and a personal password',()=>{
 const document=dom(registrationView());for(const field of ['firstName','lastName','birthDate','grade','school','username','password','email'])assert.ok(document.querySelector(`[name=${field}]`));assert.equal(document.querySelector('[name=concerns]'),null);assert.equal(document.querySelector('[name=role]'),null);assert.equal(document.querySelector('[name=password]').getAttribute('minlength'),'12');
});
test('unified client details have one editable identity form and four explicit panels',()=>{
 const document=dom(userDetailsView(user,profile,{steps:[]},'details','<p>report</p>'));assert.equal(document.querySelectorAll('[role=tab]').length,4);assert.equal(document.querySelectorAll('#user-details form').length,1);for(const field of ['username','firstName','lastName','concerns'])assert.ok(document.querySelector(`#edit-user-form [name=${field}]`));assert.equal(document.querySelector('#user-details').hasAttribute('hidden'),false);assert.equal(document.querySelector('#user-sessions').hasAttribute('hidden'),true);
});
test('admin totals and list names are escaped and empty activity is explained without invented data',()=>{
 const data={days:7,totals:{users:0,activeUsers:0,sessions:0,incompleteAssessments:0,openInvitations:0},daily:Array.from({length:7},(_,i)=>({day:`2026-01-0${i+1}`,baseline:0,training:0})),games:GAMES.map(g=>({id:g.id,count:0})),recent:[]};
 const html=adminOverview(data,{name:'<script>unsafe</script>'});assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('پس از اولین بازی'));assert.ok(!html.includes('پرونده'));const list=adminUsersView([{...user,name:'<img onerror=unsafe>'}],{search:'"/><script>bad</script>'},{page:1,pages:1,total:1});assert.ok(!dom(list).querySelector('script'));assert.ok(!dom(list).querySelector('img'));
 const form=dom(createUserView());assert.ok(form.querySelector('#new-profile-fields'));assert.equal(form.querySelector('[name=name]').hasAttribute('disabled'),true);
});
