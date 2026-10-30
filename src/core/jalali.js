const DAY=86400000;
const formatter=new Intl.DateTimeFormat('en-US',{calendar:'persian',numberingSystem:'latn',timeZone:'UTC',year:'numeric',month:'numeric',day:'numeric'});
const parts=date=>Object.fromEntries(formatter.formatToParts(date).filter(part=>['year','month','day'].includes(part.type)).map(part=>[part.type,Number(part.value)]));
const validYear=year=>Number.isInteger(year)&&year>=1&&year<=9377;

export function gregorianToJalali(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?parts(date):null;
}

// Find Nowruz with the browser's Persian calendar so conversion and display
// use the same leap-year rules. Search whole UTC days to avoid timezone shifts.
function newYearDay(year){
  let first=Math.floor(Date.UTC(year+621,2,1)/DAY),last=Math.floor(Date.UTC(year+621,3,1)/DAY);
  while(first<last){
    const middle=Math.floor((first+last)/2);
    if(parts(new Date(middle*DAY+DAY/2)).year<year)first=middle+1;
    else last=middle;
  }
  return first;
}

export function daysInJalaliMonth(year,month){
  if(!validYear(year)||!Number.isInteger(month)||month<1||month>12)return 0;
  return month<=6?31:month<=11?30:newYearDay(year+1)-newYearDay(year)-336;
}

export function jalaliToGregorian(year,month,day){
  if(!Number.isInteger(day)||day<1||day>daysInJalaliMonth(year,month))return '';
  const offset=month<=6?(month-1)*31:186+(month-7)*30;
  return new Date((newYearDay(year)+offset+day-1)*DAY+DAY/2).toISOString().slice(0,10);
}
