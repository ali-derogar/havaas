import {EN} from './locales/en.js';

export const LOCALE_KEY='havaas:locale:v1';
const valid=value=>value==='en'||value==='fa';
let locale='fa';
try{const query=new URL(globalThis.location?.href||'http://localhost').searchParams.get('lang');const saved=globalThis.localStorage?.getItem(LOCALE_KEY);locale=valid(query)?query:valid(saved)?saved:'fa';}catch{}
let localeProvider=()=>null;
export const setLocaleProvider=provider=>{localeProvider=provider;};
export const getLocale=()=>localeProvider()||locale;
export const numberLocale=()=>getLocale()==='en'?'en-US':'fa-IR';
export const formatNumber=(value,options={})=>Number(value).toLocaleString(numberLocale(),options);
export const formatDate=(value,options={})=>new Intl.DateTimeFormat(numberLocale(),{timeZone:'Asia/Tehran',timeZone:'Asia/Tehran',...options}).format(new Date(value));
export function setLocale(value){
 if(!valid(value))return false;locale=value;
 try{globalThis.localStorage?.setItem(LOCALE_KEY,value);}catch{}
 const doc=globalThis.document;
 if(doc){doc.documentElement.lang=value;doc.documentElement.dir=value==='fa'?'rtl':'ltr';doc.title=value==='en'?'Havaas — Mind adventures':'حواس — ماجراجویی‌های ذهنی';const manifest=doc.querySelector('link[rel=manifest]');if(manifest)manifest.href=value==='en'?'/manifest.en.webmanifest':'/manifest.webmanifest';const description=doc.querySelector('meta[name=description]');if(description)description.content=value==='en'?'Havaas: seven games to practice attention, memory and reaction speed.':'حواس؛ هفت بازی برای تمرین توجه، حافظه و سرعت واکنش.';const title=doc.querySelector('meta[name=apple-mobile-web-app-title]');if(title)title.content=value==='en'?'Havaas':'حواس';}
 return true;
}
// Translate authored source fragments only. User input is never scanned or replaced.
const persian=/[\u0600-\u06ff][\u0600-\u06ff\u200c\u200f\s؛،؟«»…:.!()٬٫٪0-9\-–—+\/]*[\u0600-\u06ff؟.!…»)]?/gu;
export function fragment(text,language=getLocale()){
 if(language!=='en')return text;
 return text.replace(persian,value=>{const trimmed=value.trim();return value.replace(trimmed,EN[trimmed]??trimmed);});
}
export function translate(text,language=getLocale()){
 if(typeof text!=='string'||language!=='en')return text;
 return EN[text]??fragment(text,language);
}
export const t=text=>translate(text);
export function lt(strings,...values){
 const pattern=strings.reduce((text,part,i)=>text+part+(i<values.length?`{${i}}`:''),'');
 if(getLocale()==='en'&&EN[pattern])return EN[pattern].replace(/\{(\d+)\}/g,(_match,index)=>String(values[Number(index)]??''));
 return strings.reduce((text,part,i)=>text+fragment(part)+(i<values.length?String(values[i]??''):''),'');
}
const proxies=new WeakMap();
export function localized(value){
 if(!value||typeof value!=='object')return typeof value==='string'?t(value):value;
 if(proxies.has(value))return proxies.get(value);
 const proxy=new Proxy(value,{get(target,key,receiver){const item=Reflect.get(target,key,receiver);return typeof item==='string'?t(item):item&&typeof item==='object'?localized(item):item;}});proxies.set(value,proxy);return proxy;
}
export function languageSelector(selected=getLocale()){const language=getLocale();return `<label class="theme-switcher language-switcher"><span>${language==='en'?'Language':'زبان'}</span><select data-locale-select aria-label="${language==='en'?'Language':'زبان'}"><option value="fa"${selected==='fa'?' selected':''}>فارسی</option><option value="en"${selected==='en'?' selected':''}>English</option></select></label>`;}

export function colorName(color,language=getLocale()){const names={blue:'آبی',green:'سبز',red:'قرمز',yellow:'زرد',purple:'بنفش',pink:'صورتی'};return translate(names[color]||'',language);}
