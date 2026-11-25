import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {parseHTML} from 'linkedom';
import {setLocale} from '../src/i18n.js';
import {profileFields} from '../src/account-ui.js';
import {createLesson} from '../src/lessons.js';
import {preparationView} from '../src/play-ui.js';
import {FACTORIES} from '../src/games/index.js';
import {gradeLabel} from '../src/grades.js';
import {reportsView} from '../src/client-ui.js';

test('an explicit English URL takes precedence even when storage access or reads throw',()=>{
 for(const storage of ["Object.defineProperty(globalThis,'localStorage',{get(){throw Error('blocked');}});","globalThis.localStorage={getItem(){throw Error('blocked');}};"]){
  const source=`globalThis.location={href:'https://havaas.test/?lang=en'};${storage}console.log((await import('./src/i18n.js')).getLocale());`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',source],{cwd:new URL('..',import.meta.url),encoding:'utf8'}).trim(),'en');
 }
});

test('offline language switches update an explicit URL even when storage is blocked',()=>{
 const source=`
  import assert from 'node:assert/strict';
  import {parseHTML} from 'linkedom';
  const {document,window}=parseHTML('<html><body><main><h1>برای ادامه، دوباره وصل شو</h1></main></body></html>');
  const location=new URL('https://havaas.test/offline.html?lang=en&source=pwa#retry');
  Object.assign(globalThis,{document,window,location,history:{replaceState(_state,_title,url){location.href=String(url);}}});
  Object.defineProperty(globalThis,'localStorage',{get(){throw Error('blocked');}});
  await import('./src/offline.js');
  for(const locale of ['fa','en']){
   const select=document.querySelector('[data-locale-select]');
   Object.defineProperty(select,'value',{value:locale,configurable:true});
   select.dispatchEvent(new window.Event('change',{bubbles:true}));
   assert.equal(document.documentElement.lang,locale);
   assert.equal(location.searchParams.get('lang'),locale);
   assert.equal(location.searchParams.get('source'),'pwa');assert.equal(location.hash,'#retry');
  }
 `;
 execFileSync(process.execPath,['--input-type=module','-e',source],{cwd:new URL('..',import.meta.url),stdio:'pipe',timeout:10000});
});

test('school grade values stay stable across languages and retain legacy and custom values',()=>{
 try{
  const values=locale=>{setLocale(locale);return [...parseHTML('<form>'+profileFields()+'</form>').document.querySelectorAll('[name=grade] option')].map(option=>option.getAttribute('value'));};
  assert.deepEqual(values('en'),values('fa'));
  for(const [grade,englishLabel]of [['پایهٔ ۳','Grade 3'],['Base 3','Grade 3'],['Grade 3','Grade 3'],['3','Grade 3'],['Preschool','Preschool'],['خارج از مدرسه','Out of school'],['Custom <grade>','Custom <grade>']])for(const locale of ['fa','en']){
   setLocale(locale);const doc=parseHTML('<form>'+profileFields({grade})+'</form>').document,selected=doc.querySelector('[name=grade] option[selected]');
   assert.equal(selected.getAttribute('value'),grade);
   if(locale==='en'){assert.equal(selected.textContent,englishLabel);assert.equal(gradeLabel(grade),englishLabel);}
   assert.equal(doc.querySelector('[name=grade] grade'),null);
  }
 }finally{setLocale('fa');}
});

test('English lessons distinguish tapping, waiting, unmarked targets and exact memory references',()=>{
 setLocale('en');try{
  for(const level of ['easy','medium','hard']){
   const memory=createLesson('nback',{level});
   assert.match(memory[0].prompt,/current item.*required distance back/);
   assert.match(memory[0].explanation,/reference box\. Tap\./);
   assert.match(memory[1].explanation,/reference.*Wait|reference.*memory/);
  }
  const hunt=createLesson('hunt',{targetCount:2});
  assert.match(hunt[0].prompt,/unmarked samples/);assert.match(hunt[1].explanation,/distractor\. Wait\./);
  for(const trafficMode of ['circles','signs']){
   const traffic=createLesson('traffic',{trafficMode});
   assert.match(traffic[0].explanation,/go signal.*Tap/);assert.match(traffic[1].explanation,/stop signal.*Wait without tapping/);
  }
  const preparation=parseHTML(preparationView(FACTORIES.hunt({theme:'bird',practice:true,locale:'en'}))).document;
  assert.equal(preparation.querySelector('.hunt-preparation-note').textContent,'Find the moving match and tap it before it leaves.');
 }finally{setLocale('fa');}
});

test('report birth dates retain the year and calendar day in English across device time zones',()=>{
 const timezone=process.env.TZ;
 try{
  const profile={id:'birth',firstName:'آبی',lastName:'Test',birthDate:'2016-01-01',grade:'پایهٔ ۳',school:'School'};
  for(const zone of ['Asia/Tehran','Pacific/Kiritimati','America/Los_Angeles']){
   process.env.TZ=zone;setLocale('en');
   const doc=parseHTML(reportsView({activeId:profile.id,profiles:[profile],records:[]},{game:'',level:'',variant:'',kind:''},{role:'admin'})).document;
   assert.match(doc.querySelector('.report-profile p').textContent,/Grade 3.*Jan 1, 2016/);
  }
 }finally{setLocale('fa');if(timezone===undefined)delete process.env.TZ;else process.env.TZ=timezone;}
});
