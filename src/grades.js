import {numberLocale,lt,t as uiText} from './i18n.js';

// Option values do not depend on the display language. Older saved labels
// remain valid aliases, and custom imported grades are kept as entered.
export function schoolGrades(){
 return [{value:'پیش‌دبستانی',label:uiText('پیش‌دبستانی'),aliases:['Preschool']},...Array.from({length:12},(_,i)=>{
  const n=i+1;return {value:`پایهٔ ${n.toLocaleString('fa-IR')}`,label:lt`پایهٔ ${n.toLocaleString(numberLocale())}`,aliases:[`Base ${n}`,`Grade ${n}`,String(n)]};
 }),{value:'خارج از مدرسه',label:uiText('خارج از مدرسه'),aliases:['Out of school']}];
}

export function gradeLabel(value){
 return schoolGrades().find(grade=>grade.value===value||grade.aliases.includes(value))?.label??value;
}
