import { FACTORIES } from '../../src/games/index.js';
import { seededRandom } from '../../src/core/random.js';
import { GAME_MAP } from '../../src/config.js';
export function playSession(run,{wrong=false,omit=false,timeout=false}={}){
 let now=0;const s=FACTORIES[run.settings.gameId]({...run.settings,practice:run.kind==='baseline',now:()=>now,random:seededRandom(run.settings.seed)}),kind=GAME_MAP[s.gameId].kind;
 if(kind==='reaction')while(!s.done){if(s.gate)s.acknowledge();now+=100;if(!omit&&(s.current.target||wrong)&&s.current.scored!==false)s.respond();now+=900;s.tick();}
 else if(kind==='search')while(!s.done){now+=2100;if(omit){now+=30000;s.tick();continue;}const indices=s.current.choices.flatMap((c,i)=>c.target?[i]:[]);if(wrong)s.choose(s.current.choices.findIndex(c=>!c.target));for(const i of indices)s.choose(i);}
 else if(s.practice)while(!s.done){const item=s.currentItem;now+=100;if(item.blocked)s.choose(item.id);if(item.required&&!omit)s.choose(item.id);else s.reject();}
 else if(timeout){now+=60000;s.tick();}
 else {for(const item of s.items.filter(i=>i.required)){now+=100;if(item.blocked)s.choose(item.id);s.choose(item.id);}s.depart();}
 return s.result;
}
