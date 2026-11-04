import { exerciseEmblem } from './training-art.js';
import { arkCover } from './ark-art.js';
import { spaceCover } from './space-art.js';
import { trafficCover } from './traffic-art.js';
import { searchCover } from './search-art.js';
import { memoryCover } from './nback-art.js';

export const WORLD_ASSETS = Object.freeze({
  ark:'/assets/worlds/hope-shore.svg',birdShore:'/assets/worlds/shore-v2.jpg',space:'/assets/worlds/orbit-station.svg',search:'/assets/worlds/clue-workshop.svg',nback:'/assets/worlds/memory-station.svg',desk:'/assets/worlds/focus-v2.svg',street:'/assets/worlds/rainbow-town.svg',pond:'/assets/worlds/pond-v2.svg',meadow:'/assets/worlds/meadow-v2.jpg',
});
export function worldFor({gameId,level='easy',theme='star'}={}) {
  if(gameId==='ark'||gameId==='space')return WORLD_ASSETS[gameId];
  if(gameId==='search')return WORLD_ASSETS.search;
  if(gameId==='nback')return WORLD_ASSETS.nback;
  if(gameId==='stroop')return WORLD_ASSETS.desk;
  if(gameId==='traffic')return WORLD_ASSETS.street;
  if(gameId==='hunt'&&level!=='hard'&&theme!=='shape')return theme==='fish'?WORLD_ASSETS.pond:theme==='bird'?WORLD_ASSETS.birdShore:WORLD_ASSETS.meadow;
  return null;
}
const pending=new Map();
export function preloadWorld(options,{ImageClass=globalThis.Image,timeoutMs=6000}={}) {
  const url=worldFor(options);if(!url||typeof ImageClass!=='function')return Promise.resolve(null);
  if(pending.has(url))return pending.get(url);
  const task=new Promise(resolve=>{
    const img=new ImageClass();let settled=false;
    const finish=success=>{if(settled)return;settled=true;clearTimeout(timeout);resolve(success?url:null);};
    const timeout=setTimeout(()=>finish(false),timeoutMs);
    img.onload=()=>{if(typeof img.decode==='function')img.decode().then(()=>finish(true),()=>finish(false));else finish(true);};
    img.onerror=()=>finish(false);img.src=url;
  });
  pending.set(url,task);task.then(value=>{if(!value&&pending.get(url)===task)pending.delete(url);});return task;
}
export function worldBackground(options,loaded) {
  const url=worldFor(options);return loaded&&url===loaded?`<img class="world-backdrop" src="${url}" alt="" aria-hidden="true" decoding="async">`:'';
}
export function gameArtwork(gameId,{lazy=false,theme='star'}={}) {
  if(gameId==='ark')return arkCover({lazy});
  if(gameId==='space')return spaceCover({lazy});
  if(gameId==='traffic')return trafficCover({lazy});
  if(gameId==='search')return searchCover({lazy});
  if(gameId==='nback')return memoryCover({lazy});
  const url=worldFor({gameId,theme});
  return `<div class="illustrated-cover training-cover illustrated-${gameId}" data-game="${gameId}">${url?`<img src="${url}" alt="" aria-hidden="true" loading="${lazy?'lazy':'eager'}" decoding="async">`:''}<span class="cover-reticle" aria-hidden="true"></span>${exerciseEmblem(gameId)}<span class="cover-indicators" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>`;
}
