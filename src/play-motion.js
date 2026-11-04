import {ActiveClock} from './core/session.js';
import {icon} from './visuals.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const easeOut=value=>1-(1-clamp(value))**3;
const center=rect=>({x:rect.x+rect.width/2,y:rect.y+rect.height/2});

// Decorative poses never change the engine's paths, response window or RNG.
export function animalPose(theme,elapsedMs,index=0){
  const phase=elapsedMs/(theme==='butterfly'?85:120)+index*1.7;
  return {flap:.58+.42*(Math.sin(phase)+1)/2,tail:Math.sin(phase)*16,tilt:Math.sin(phase/3)*(theme==='butterfly'?5:2)};
}
export function vehiclePose(gameId,elapsedMs,limitMs=60000){
  const elapsed=Math.max(0,elapsedMs),space=gameId==='space';
  return {left:space?6+60*clamp(elapsed/(Number.isFinite(limitMs)?limitMs:60000)):7,
    y:Math.sin(elapsed/(space?620:1000))*(space?5:3),angle:Math.sin(elapsed/(space?950:1400))*(space?3:1.5),
    thrust:.82+.18*Math.sin(elapsed/90),wave:Math.sin(elapsed/1700)*15};
}

export class ForwardMotion {
  constructor(){this.from=0;this.to=0;this.startedAt=0;}
  value(now){return this.from+(this.to-this.from)*easeOut((now-this.startedAt)/420);}
  sample(target,now,reduced=false){
    const next=Math.max(this.to,clamp(target));
    if(next!==this.to){this.from=this.value(now);this.to=next;this.startedAt=now;}
    if(reduced){this.from=this.to;return this.to;}
    return this.value(now);
  }
}

export function captureMotionSource(node){
  const rect=node?.getBoundingClientRect?.();
  if(!rect||!rect.width||!rect.height)return null;
  const picture=node.querySelector('.equipment,.symbol');
  return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},picture:picture?.cloneNode(true)};
}

export function sceneAtmosphere(gameId){
  if(gameId==='space')return `<div class="scene-atmosphere orbital-dust" aria-hidden="true">${[12,28,47,68,84,94].map((x,i)=>`<i style="left:${x}%;top:${8+i%3*9}%;--twinkle-delay:${-i*.7}s"></i>`).join('')}</div>`;
  if(gameId==='ark')return '<svg class="scene-atmosphere scene-tide" viewBox="0 0 1000 90" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M-40 22q65-16 130 0t130 0 130 0 130 0 130 0 130 0 130 0 130 0"/><path d="M-70 49q80-15 160 0t160 0 160 0 160 0 160 0 160 0 160 0"/></g></svg>';
  if(gameId==='fish')return '<div class="scene-atmosphere pond-bubbles" aria-hidden="true"><i></i><i></i><i></i></div>';
  return '';
}

/** One animation lifecycle per page. Flights use a separate, pausable UI clock;
 * practice reviews can animate while the scored game clock stays stopped. */
export class PlayMotion {
  constructor({document,now=()=>performance.now()}){this.document=document;this.now=now;this.reset();}
  reset(){this.layer?.remove();this.layer=null;this.effects=[];this.clock=new ActiveClock(this.now);this.session=null;this.traffic=new ForwardMotion();this.reduced=false;}
  sync(panel,session,{paused=false,reduced=false}={}){
    this.reduced=reduced;if(paused)this.clock.pause();else this.clock.resume();
    panel.dataset.motion=paused?'paused':reduced?'reduced':'running';
    if(session!==this.session){this.session=session;this.traffic=new ForwardMotion();}
    if(reduced)this.clearEffects();
    const elapsed=session.clock.elapsed,vehicle=panel.querySelector('.adventure-scene .scene-vehicle');
    if(vehicle){
      const pose=vehiclePose(session.gameId,elapsed,session.limitMs);
      vehicle.style.left=`${reduced?(session.gameId==='space'?6:7):pose.left}%`;
      vehicle.style.transform=reduced?'none':`translateY(${pose.y}px) rotate(${pose.angle}deg)`;
      vehicle.style.setProperty('--thrust-scale',String(reduced?1:pose.thrust));
      panel.style.setProperty('--wave-shift',`${reduced?0:pose.wave}px`);
    }
    const road=panel.querySelector('.traffic-road');
    if(road){
      const target=Number(road.dataset.progress)||0,visual=this.traffic.sample(target,elapsed,reduced);
      road.dataset.visualProgress=String(visual);road.dataset.moving=String(target-visual>.00001);
      road.querySelector('.road-car')?.setAttribute('transform',`translate(${375*visual} 0)`);
      road.querySelectorAll('.car-wheel').forEach((wheel,i)=>wheel.setAttribute('transform',`rotate(${visual*3600} ${i?123:64} 79)`));
      const chassis=road.querySelector('.car-chassis');if(chassis)chassis.style.transform=`translateY(${reduced?0:-Math.sin(clamp((elapsed-this.traffic.startedAt)/420)*Math.PI)*2}px)`;
    }
    this.updateEffects();
  }
  ensureLayer(){
    if(!this.layer){this.layer=this.document.createElement('div');this.layer.className='play-effects';this.layer.setAttribute('aria-hidden','true');this.document.body.append(this.layer);}
    return this.layer;
  }
  addEffect(node,data){
    if(this.reduced)return;
    if(this.effects.length>=32)this.effects.shift().node.remove();
    this.ensureLayer().append(node);this.effects.push({node,start:this.clock.elapsed,...data});this.updateEffects();
  }
  burst(source,kind='good'){
    if(!source||this.reduced)return;
    const node=this.document.createElement('div');node.className=`choice-burst ${kind}`;
    node.innerHTML=`<span class="burst-ring"></span>${Array.from({length:kind==='wrong'?4:7},(_,i)=>`<i style="--spark-color:${['#ffca3a','#1bcba0','#53b8ff','#b16af0'][i%4]}"></i>`).join('')}<b>${icon(kind==='wrong'?'repeat':kind==='cleared'?'spark':'check')}</b>`;
    const point=center(source.rect);node.style.left=`${point.x}px`;node.style.top=`${point.y}px`;
    this.addEffect(node,{kind:'burst',duration:650,tone:kind});
  }
  fly(source,destination){
    const rect=destination?.getBoundingClientRect?.();if(!source?.picture||!rect?.width||this.reduced)return;
    const node=this.document.createElement('div');node.className='flying-equipment';node.append(source.picture);
    const size=Math.min(84,Math.max(72,source.rect.width));node.style.width=`${size}px`;node.style.height=`${size}px`;
    this.addEffect(node,{kind:'flight',duration:720,from:center(source.rect),to:center(rect),equipment:destination.dataset.equipment});
  }
  toast(node){
    if(!node)return;node.style.opacity='1';node.style.transform='none';
    if(!this.reduced){this.effects=this.effects.filter(effect=>effect.node!==node);this.effects.push({node,start:this.clock.elapsed,kind:'toast',duration:1100,retain:true});this.updateEffects();}
  }
  updateEffects(){
    const now=this.clock.elapsed;
    this.effects=this.effects.filter(effect=>{
      const {node,kind,duration}=effect,t=clamp((now-effect.start)/duration);
      if(t>=1){
        if(kind==='flight'&&effect.equipment)this.document.querySelector(`.inventory-slot[data-equipment="${effect.equipment}"]`)?.classList.add('just-packed');
        if(effect.retain)node.style.opacity='0';else node.remove();return false;
      }
      if(kind==='flight'){
        const p=easeOut(t),x=effect.from.x+(effect.to.x-effect.from.x)*p,y=effect.from.y+(effect.to.y-effect.from.y)*p-Math.sin(t*Math.PI)*80;
        node.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%) rotate(${Math.sin(t*Math.PI)*18}deg) scale(${1-.5*p})`;node.style.opacity=String(t<.85?1:(1-t)/.15);
      }else if(kind==='burst'){
        node.style.opacity=String(1-t);const radius=10+easeOut(t)*42;
        node.querySelector('.burst-ring').style.transform=`scale(${.35+easeOut(t)*1.4})`;
        const particles=[...node.querySelectorAll('i')];particles.forEach((particle,i)=>{const angle=i/particles.length*Math.PI*2;particle.style.transform=`translate(${Math.cos(angle)*radius}px,${Math.sin(angle)*radius}px) rotate(${t*120}deg)`;});
        node.querySelector('b').style.transform=`scale(${.7+Math.sin(t*Math.PI)*.5})`;
      }else if(kind==='toast'){node.style.opacity=String(t<.15?t/.15:t>.8?(1-t)/.2:1);node.style.transform=`translateY(${(1-Math.min(1,t/.15))*8}px)`;}
      return true;
    });
    if(this.layer&&!this.layer.childElementCount){this.layer.remove();this.layer=null;}
  }
  clearEffects(){for(const effect of this.effects)if(effect.retain){effect.node.style.opacity='1';}else effect.node.remove();this.effects=[];this.layer?.remove();this.layer=null;}
}
