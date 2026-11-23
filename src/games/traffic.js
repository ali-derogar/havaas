import { ReactionSession } from '../core/reaction.js';
import { targetMask } from '../core/random.js';
import { PROTOCOL } from '../config.js';
import {Session} from '../core/session.js';
export function trafficJourney(outcomes,{practice=false}={}){
 const checkpoints=practice?[.5]:[8/30,16/30,24/30],maximum=practice?2:30;
 let hits=0,progress=0,checkpoint=0,state='moving';const stops=[];
 for(const outcome of outcomes){
  if(outcome.target&&outcome.response&&outcome.selectedTarget!==false){
   hits++;
   if(state==='waiting-green'){checkpoint++;state='moving';}
   if(state!=='waiting-stop'){
    progress=Math.min(hits/maximum,checkpoints[checkpoint]??1);
    if(checkpoint<checkpoints.length&&progress>=checkpoints[checkpoint])state='waiting-stop';
   }
  }else if(!outcome.target&&state==='waiting-stop'){
   stops.push({checkpoint,correct:!outcome.response,number:outcome.number});state='waiting-green';
  }
 }
 return {version:1,progress:Math.min(1,progress),state:progress>=1?'arrived':state,checkpoint,stops};
}
export function createTraffic(options) {
  const modern=(options.experienceVersion??4)>=4;
  const mask=modern?(options.practice?[true,false,true,false,false]:[40,40,40,30].flatMap((length,index)=>{
    const targets=index===3?6:8,first=index>0?[true]:[],last=index<3?[false]:[];
    return [...first,...targetMask(length-first.length-last.length,targets-first.length,options.random),...last];
  })):targetMask(options.practice?5:PROTOCOL.trials,options.practice?2:PROTOCOL.targets,options.random);
  const trials=mask.map(target=>({target,stimulus:{shape:options.trafficMode==='signs'?(target?'oneway':'noentry'):'circle',color:target?'green':'red'},phase:0}));
  const session=new ReactionSession({...options,gameId:'traffic',variant:options.trafficMode==='signs'?'signs':'standard'},trials);
  if(modern){
   session.trafficRouteVersion=1;
   Object.defineProperty(session,'journey',{get(){const outcomes=[...this.outcomes];if(this.response&&this.current?.target)outcomes.push({target:true,response:true,selectedTarget:this.response.selectedTarget});return trafficJourney(outcomes,this);}});
   const resultGetter=Object.getOwnPropertyDescriptor(Session.prototype,'result').get;
   Object.defineProperty(session,'result',{get(){return {...resultGetter.call(this),trafficRouteVersion:1,journey:trafficJourney(this.outcomes,this)};}});
  }
  return session;
}
