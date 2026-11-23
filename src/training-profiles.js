import {t as uiText} from './i18n.js';
import {GAMES,GAME_PROTOCOLS,LEVELS} from './config.js';
import {TIMING_VARIANTS,defaultTiming,validateTiming} from './game-timing.js';

export const profileSettingKey=({gameId,variant})=>`${gameId}:${variant}`;
export const profileFamilies=gameId=>gameId==='hunt'?['static','moving']:['standard'];
export const profileCatalog=()=>GAMES.flatMap(game=>(TIMING_VARIANTS[game.id]||['standard']).map(variant=>({gameId:game.id,variant,protocolVersion:GAME_PROTOCOLS[game.id]})));
export function createProfileSettings(level='easy'){
 return profileCatalog().map(key=>({...key,level,timings:Object.fromEntries(profileFamilies(key.gameId).map(family=>[family,defaultTiming({...key,level,theme:family==='moving'?'fish':'star',experienceVersion:3})]))}));
}
export function validateProfileSettings(settings){
 const catalog=profileCatalog();
 if(!Array.isArray(settings)||settings.length!==catalog.length)throw Error(uiText('تنظیمات همهٔ بازی‌ها و حالت‌ها را کامل کنید.'));
 return catalog.map(key=>{
  const matches=settings.filter(entry=>entry&&entry.gameId===key.gameId&&entry.variant===key.variant);
  if(matches.length!==1)throw Error(uiText('بازی یا حالت تکراری یا ناقص است.'));
  const entry=matches[0],families=profileFamilies(key.gameId);
  if(entry.protocolVersion!==key.protocolVersion||!Object.hasOwn(LEVELS,entry.level)||!entry.timings||typeof entry.timings!=='object'||Object.keys(entry.timings).length!==families.length)throw Error(uiText('سطح، نسخهٔ بازی یا گروه زمان‌بندی معتبر نیست.'));
  return {...key,level:entry.level,timings:Object.fromEntries(families.map(family=>[family,validateTiming(key.gameId,entry.timings[family])]))};
 });
}
export function profileEntry(settings,gameId,variant='standard'){
 return settings.find(entry=>entry.gameId===gameId&&entry.variant===variant&&entry.protocolVersion===GAME_PROTOCOLS[gameId]);
}
