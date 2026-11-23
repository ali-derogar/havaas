import {seededRandom,shuffle} from './core/random.js';

export const TARGET_COLORS=Object.freeze(['blue','green','red','yellow']);
export function validStimulusPlan(plan){
 return Boolean(plan&&Array.isArray(plan.colorsByPhase)&&plan.colorsByPhase.length>=1&&plan.colorsByPhase.length<=10&&plan.colorsByPhase.every(colors=>Array.isArray(colors)&&colors.length>=1&&colors.length<=2&&colors.every(color=>['blue','green','red','yellow','purple','pink'].includes(color))));
}
// This stream is independent of the scored trial stream, including old clients.
export function createStimulusPlan({gameId,seed=0,targetCount=1,practice=false}={}){
 const random=seededRandom((seed>>>0)^0x719ac4e3),colors=shuffle(TARGET_COLORS,random);
 if(gameId==='hunt')return {colorsByPhase:Array.from({length:practice?1:3},(_,i)=>targetCount===2?[colors[i*2%4],colors[(i*2+1)%4]]:[colors[i]])};
 if(gameId==='stroop')return {colorsByPhase:colors.map(color=>[color])};
 if(gameId==='nback')return {colorsByPhase:[[colors[0]]]};
 if(gameId==='search'){
  const palette=['blue','green','purple','pink'],colorsByPhase=[];
  for(let i=0;i<(practice?5:10);i++)colorsByPhase.push([shuffle(palette.filter(color=>color!==colorsByPhase.at(-1)?.[0]),random)[0]]);
  return {colorsByPhase};
 }
 return null;
}
export function stimulusPlanFor(options){return (options.experienceVersion??4)>=4&&(options.stimulusVersion??9)>=9?(options.stimulusPlan||createStimulusPlan(options)):null;}
export const colorAt=(session,phase=0,fallback='yellow')=>session.stimulusPlan?.colorsByPhase?.[phase]?.[0]||fallback;
export function compatibleBaseline(result,{gameId=result?.gameId,locale='fa',experienceVersion=4}={}){
 if(!result)return false;
 if(experienceVersion>=4&&['hunt','traffic','stroop'].includes(gameId)&&(result.experienceVersion??1)<4)return false;
 return gameId!=='stroop'||(result.locale||'fa')===locale;
}
