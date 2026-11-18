import {GAME_MAP,GAME_PROTOCOLS,LEVELS,PROTOCOL,reactionTiming,EXPERIENCE_VERSION} from './config.js';

export const TIMING_VARIANTS=Object.freeze({hunt:['standard','divided'],traffic:['standard','signs'],nback:['standard','numbers','toys'],search:['standard','scattered','letters','letters-scattered','dual','letters-dual','scattered-dual','letters-scattered-dual']});
export const TIMING_FIELDS=Object.freeze({
 visibleMs:{label:'مدت نمایش محرک',min:100,max:10000},intervalMs:{label:'کل زمان هر نوبت از آغاز نمایش',min:200,max:15000},
 previewMs:{label:'مدت حفظ نمونه',min:100,max:30000},searchMs:{label:'فرصت جست‌وجوی هر دور',min:1000,max:300000},limitMs:{label:'مهلت تکمیل مأموریت',min:5000,max:600000},
});
export const timingFields=gameId=>GAME_MAP[gameId]?.kind==='reaction'?['visibleMs','intervalMs']:gameId==='search'?['previewMs','searchMs']:['limitMs'];
export function timingIdentity(options={}){
 const {gameId,level='easy',variant='standard'}=options;
 if(!Object.hasOwn(GAME_MAP,gameId)||!Object.hasOwn(LEVELS,level)||!(TIMING_VARIANTS[gameId]||['standard']).includes(variant))throw Error('بازی، حالت یا سطح زمان‌بندی معتبر نیست.');
 const family=options.timingFamily||(gameId==='hunt'?(['fish','bird','butterfly'].includes(options.theme)?'moving':'static'):'standard');
 if(!(gameId==='hunt'?['static','moving']:['standard']).includes(family))throw Error('گروه زمان‌بندی معتبر نیست.');
 if(options.protocolVersion!==undefined&&options.protocolVersion!==GAME_PROTOCOLS[gameId])throw Error('نسخهٔ پروتکل معتبر نیست.');
 return {gameId,variant,timingFamily:family,protocolVersion:GAME_PROTOCOLS[gameId],level};
}
export function validateTiming(gameId,timing){
 if(!Object.hasOwn(GAME_MAP,gameId))throw Error('بازی معتبر نیست.');
 const fields=timingFields(gameId);
 if(!timing||typeof timing!=='object'||Array.isArray(timing)||Object.keys(timing).length!==fields.length||fields.some(key=>!Object.hasOwn(timing,key)||!Number.isSafeInteger(timing[key])||timing[key]<TIMING_FIELDS[key].min||timing[key]>TIMING_FIELDS[key].max||timing[key]%50!==0))throw Error('زمان‌ها باید در محدودهٔ مجاز و با گام ۰٫۰۵ ثانیه باشند.');
 if(fields.includes('intervalMs')&&timing.intervalMs<timing.visibleMs)throw Error('کل زمان نوبت نباید از مدت نمایش کمتر باشد.');
 return Object.fromEntries(fields.map(key=>[key,timing[key]]));
}
export function defaultTiming(options={}){
 const {gameId,level='easy',experienceVersion=EXPERIENCE_VERSION}=options;
 if(GAME_MAP[gameId]?.kind==='reaction')return reactionTiming({...options,timing:undefined,level,experienceVersion});
 if(gameId==='search')return {previewMs:PROTOCOL.previewMs,searchMs:LEVELS[level].searchSeconds*1000};
 return {limitMs:LEVELS[level].seconds*1000};
}
export function resolveTiming(options={}){
 return (options.experienceVersion??EXPERIENCE_VERSION)>=3&&options.timing?validateTiming(options.gameId,options.timing):defaultTiming(options);
}
export const timingKey=timing=>JSON.stringify(Object.fromEntries(Object.keys(timing).sort().map(key=>[key,timing[key]])));
