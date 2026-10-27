import { art,vehicleArt } from './visuals.js';

export const WORLD_ASSETS = Object.freeze({
  ark:'/assets/worlds/shore-v1.png',space:'/assets/worlds/space-v1.png',desk:'/assets/worlds/desk-v1.png',street:'/assets/worlds/street-v1.png',pond:'/assets/worlds/pond-v1.png',meadow:'/assets/worlds/meadow-v1.png',
});
export function worldFor({gameId,level='easy',theme='star'}={}) {
  if(gameId==='ark'||gameId==='space')return WORLD_ASSETS[gameId];
  if(['search','nback','stroop'].includes(gameId))return WORLD_ASSETS.desk;
  if(gameId==='traffic')return WORLD_ASSETS.street;
  if(gameId==='hunt'&&level!=='hard'&&theme!=='shape')return theme==='fish'?WORLD_ASSETS.pond:WORLD_ASSETS.meadow;
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
  const url=worldFor({gameId,theme});
  if(!url)return `<div class="native-cover native-cover-${gameId}">${art(gameId)}</div>`;
  return `<div class="illustrated-cover illustrated-${gameId}"><img src="${url}" alt="" aria-hidden="true" loading="${lazy?'lazy':'eager'}" decoding="async"><div class="world-motif">${['ark','space'].includes(gameId)?vehicleArt(gameId):art(gameId)}</div></div>`;
}
