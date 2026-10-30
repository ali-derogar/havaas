import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {gregorianToJalali,jalaliToGregorian,daysInJalaliMonth} from '../src/core/jalali.js';
import {birthDateField} from '../src/birth-date.js';

test('Jalali birthdays convert known dates at Nowruz and leap-day boundaries',()=>{
  for(const [gregorian,year,month,day] of [
    ['2016-01-01',1394,10,11],
    ['2020-03-20',1399,1,1],
    ['2021-03-20',1399,12,30],
    ['2021-03-21',1400,1,1],
    ['2025-03-20',1403,12,30],
    ['2025-03-21',1404,1,1],
    ['2026-03-21',1405,1,1]
  ]){
    assert.deepEqual(gregorianToJalali(gregorian),{year,month,day});
    assert.equal(jalaliToGregorian(year,month,day),gregorian);
  }
  assert.equal(daysInJalaliMonth(1399,12),30);
  assert.equal(daysInJalaliMonth(1400,12),29);
  for(const date of [[1400,12,30],[1400,7,31],[1400,0,1],[1400,13,1],[1400,1,0],[1400,1,1.5],[0,1,1]])assert.equal(jalaliToGregorian(...date),'');
  for(const date of ['2016-02-30','2017-02-29','1399/12/30','',null])assert.equal(gregorianToJalali(date),null);
});

test('existing birthdays round-trip across a century without timezone-dependent day shifts',()=>{
  const original=process.env.TZ;
  try{
    for(const zone of ['UTC','Asia/Tehran','Pacific/Kiritimati','America/Los_Angeles']){
      process.env.TZ=zone;
      for(let year=1926;year<=2026;year+=5)for(const suffix of ['01-01','03-20','03-21','09-22','12-31']){
        const date=`${year}-${suffix}`,{year:jy,month,day}=gregorianToJalali(date);
        assert.equal(jalaliToGregorian(jy,month,day),date,`${zone}: ${date}`);
      }
    }
  }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});

test('birthday selection displays Persian months and existing dates while keeping the API date canonical',()=>{
  const {document}=parseHTML(birthDateField('2016-01-01',new Date(2026,9,30,12)));
  assert.equal(document.querySelector('[data-birth-part=year]').value,'1394');
  assert.equal(document.querySelector('[data-birth-part=month]').value,'10');
  assert.equal(document.querySelector('[data-birth-part=day]').value,'11');
  assert.equal(document.querySelector('[name=birthDate]').value,'2016-01-01');
  assert.equal(document.querySelector('[name=birthDate]').type,'hidden');
  assert.match(document.querySelector('legend').textContent,/شمسی/);
  assert.match(document.querySelector('[data-birth-part=month]').textContent,/فروردین/);
  assert.equal(document.querySelector('[data-birth-part=year] option[value="1406"]'),null);
});
