import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {auditView} from '../src/audit-ui.js';
import {setLocale} from '../src/i18n.js';

const data={events:[{createdAt:'2025-03-20T20:30:00Z',action:'users.updated',changedFields:['name']}],pagination:{page:1,pages:1,total:1}};

for(const embedded of [false,true])test(`audit dates are Persian and restored filters keep canonical API values (${embedded?'user':'global'})`,()=>{
 const {document}=parseHTML(auditView(data,{from:'2025-03-20',to:'2025-03-21'},embedded));
 assert.equal(document.querySelector('input[type=date]'),null);
 const [from,to]=document.querySelectorAll('[data-audit-date]');
 for(const [field,year,month,day] of [[from,'1403','12','30'],[to,'1404','1','1']]){
  assert.match(field.querySelector('legend').textContent,/شمسی/);
  assert.equal(field.querySelector('[data-audit-date-part=year]').value,year);
  assert.equal(field.querySelector('[data-audit-date-part=month]').value,month);
  assert.equal(field.querySelector('[data-audit-date-part=day]').value,day);
  assert.match(field.querySelector('[data-audit-date-part=month]').textContent,/فروردین/);
 }
 assert.equal(from.querySelector('[name=from]').value,'2025-03-20');
 assert.equal(to.querySelector('[name=to]').value,'2025-03-21');
 // Midnight in Tehran is already Nowruz even though the UTC date is March 20.
 assert.match(document.querySelector('tbody td').textContent,/۱ فروردین ۱۴۰۴/);
});

for(const embedded of [false,true])test(`English audit dates use the same Gregorian calendar as the filters (${embedded?'user':'global'})`,()=>{
 setLocale('en');
 try{
  const {document}=parseHTML(auditView(data,{from:'2025-03-20',to:'2025-03-21'},embedded));
  assert.equal(document.querySelector('[name=from]').type,'date');
  assert.equal(document.querySelector('[name=from]').value,'2025-03-20');
  const timestamp=document.querySelector('tbody td').textContent;
  assert.match(timestamp,/Mar 21, 2025/);
  assert.doesNotMatch(timestamp,/1404|Farvardin|[\u0600-\u06ff]/);
 }finally{setLocale('fa');}
});
