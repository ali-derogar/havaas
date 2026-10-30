import {escapeHTML as esc} from './core/clients.js';
import {gregorianToJalali,jalaliToGregorian,daysInJalaliMonth} from './core/jalali.js';

const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const fa=value=>value.toLocaleString('fa-IR',{useGrouping:false});
const option=(value,label,selected)=>`<option value="${value}"${value===selected?' selected':''}>${label}</option>`;
const dayOptions=(count,selected)=>'<option value="">روز</option>'+Array.from({length:count},(_,i)=>option(i+1,fa(i+1),selected)).join('');

export function birthDateField(value='',today=new Date()){
  const max=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  const min=`${today.getFullYear()-100}-01-01`,firstYear=gregorianToJalali(min).year,lastYear=gregorianToJalali(max).year;
  const selected=gregorianToJalali(value)||{};
  const years=Array.from({length:lastYear-firstYear+1},(_,i)=>lastYear-i);
  return `<fieldset class="birth-date-field wide" data-birth-date data-min="${min}" data-max="${max}"><legend>تاریخ تولد (شمسی)</legend><div class="birth-date-controls"><label>روز<select data-birth-part="day" aria-label="روز تولد" autocomplete="off" required>${dayOptions(selected.month?daysInJalaliMonth(selected.year,selected.month):31,selected.day)}</select></label><label>ماه<select data-birth-part="month" aria-label="ماه تولد" autocomplete="off" required><option value="">ماه</option>${months.map((month,i)=>option(i+1,month,selected.month)).join('')}</select></label><label>سال<select data-birth-part="year" aria-label="سال تولد" autocomplete="off" required><option value="">سال</option>${years.map(year=>option(year,fa(year),selected.year)).join('')}</select></label></div><input type="hidden" name="birthDate" value="${esc(value)}"><p class="form-error birth-date-error" data-birth-error role="alert" hidden></p></fieldset>`;
}

export function syncBirthDate(field){
  const year=Number(field.querySelector('[data-birth-part=year]').value),month=Number(field.querySelector('[data-birth-part=month]').value),day=field.querySelector('[data-birth-part=day]');
  const selected=Number(day.value),count=month?(year?daysInJalaliMonth(year,month):month<=6?31:30):31;
  if(day.options.length!==count+1){day.innerHTML=dayOptions(count,selected);day.value=selected<=count&&selected>0?String(selected):'';}
  const value=jalaliToGregorian(year,month,Number(day.value));
  const error=value>field.dataset.max?'تاریخ تولد نمی‌تواند در آینده باشد.':value&&value<field.dataset.min?'تاریخ تولد باید در محدودهٔ صد سال اخیر باشد.':'';
  field.querySelector('[name=birthDate]').value=error?'':value;
  day.setCustomValidity(error);
  if(error)day.setAttribute('aria-invalid','true');else day.removeAttribute('aria-invalid');
  const message=field.querySelector('[data-birth-error]');message.textContent=error;message.hidden=!error;
}
