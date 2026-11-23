import { ReactionSession } from '../core/reaction.js';
import { pick, shuffle, targetMask,seededRandom } from '../core/random.js';
import { HUNT_SETTINGS, LEGACY_HUNT_SETTINGS, MOVING_THEMES, PRESENTATION_VERSION, PROTOCOL } from '../config.js';
import {stimulusPlanFor} from '../stimulus-plan.js';

export function createHunt(options) {
  const random = options.random ?? Math.random, theme = options.theme || 'star';
  const count = options.practice ? 5 : PROTOCOL.trials;
  const targetCount = options.targetCount === 2 ? 2 : 1;
  const revision=options.stimulusVersion??PRESENTATION_VERSION,level=options.level||'easy';
  const settings = (revision>=6?HUNT_SETTINGS:LEGACY_HUNT_SETTINGS)[level];
  const moving=revision>=6&&MOVING_THEMES.includes(theme);
  const targets = ['blue','red'].slice(0,targetCount).map(color=>({shape:theme==='shape'?'circle':theme,color,detail:0}));
  const targetTotal = options.practice ? 2 : PROTOCOL.targets;
  const targetOrder = shuffle(Array.from({length:targetTotal},(_,i)=>targets[i%targetCount]),random);
  const far = ['blue','green','yellow','red','purple'].filter(color=>!targets.some(t=>t.color===color)).map(color=>({shape:theme==='shape'?'triangle':theme,color,detail:0}));
  const near = targets.flatMap(target=>[1,2,3].map(detail=>({...target,detail})));
  const nearMask = targetMask(count-targetTotal,Math.round((count-targetTotal)*settings.nearRatio),random);
  let targetIndex=0,distractorIndex=0;
  const blockLengths=options.practice?[5]:PROTOCOL.huntBlocks;
  const trials=blockLengths.flatMap((length,phase)=>targetMask(length,options.practice?2:length/5,random).map(isTarget=>({
    target:isTarget, stimulus:isTarget?targetOrder[targetIndex++]:pick(nearMask[distractorIndex++]?near:far,random), phase,
    position:pick(settings.positions,random),size:settings.size,
  })));
  for (const trial of trials) {
    const positions = shuffle(settings.positions, random).slice(0, settings.sceneItems);
    const extra = Array.from({length: settings.sceneItems - 1}, () => ({
      stimulus: { ...pick(random() < settings.nearRatio ? near : far, random) }, target: false,
    }));
    trial.choices = shuffle([{ stimulus: trial.stimulus, target: trial.target }, ...extra], random).map((choice,index)=>({ ...choice, position: positions[index] }));
    if(revision>=6)for(const choice of trial.choices){
      choice.position={x:choice.position.x+(random()-.5)*4,y:choice.position.y+(random()-.5)*2};
      if(moving)choice.motion={distance:level==='easy'?40:28,phase:random()*Math.PI*2,amplitude:theme==='butterfly'?3:1.5};
    }
  }
  const session = new ReactionSession({ ...options, gameId:'hunt', protocolVersion:3, variant:targetCount===2?'divided':'standard' },trials);
  const plan=stimulusPlanFor({...options,gameId:'hunt'});
  if(plan){
    for(let phase=0;phase<blockLengths.length;phase++){const scored=trials.filter(trial=>trial.phase===phase&&trial.target),order=shuffle(Array.from({length:scored.length},(_,i)=>targets[i%targets.length]),seededRandom((options.seed||0)^phase^0x328ac));for(const [i,trial]of scored.entries()){trial.stimulus=order[i];for(const choice of trial.choices)if(choice.target)choice.stimulus=order[i];}}
    const base=['blue','red','green','yellow','purple'];
    const phaseMaps=plan.colorsByPhase.map(colors=>Object.fromEntries(base.map((color,i)=>[color,[...colors,...base.filter(value=>!colors.includes(value))][i]])));
    const recolor=(stimulus,phase)=>({...stimulus,color:phaseMaps[phase][stimulus.color]});
    for(const trial of trials){trial.stimulus=recolor(trial.stimulus,trial.phase);trial.choices=trial.choices.map(choice=>({...choice,stimulus:recolor(choice.stimulus,trial.phase)}));}
    session.targetsByPhase=phaseMaps.map((_map,phase)=>targets.map(target=>recolor(target,phase)));
    session.onPhaseChange=phase=>{session.targets=session.targetsByPhase[phase];session.target=session.targets[0];};
  }
  if(moving&&revision>=7)session.choiceSelectable=choice=>huntOnScreen(choice,session.clock.elapsed-session.onset,session.visibleMs);
  session.moving=moving;session.targets=session.targetsByPhase?.[0]||targets;session.target=session.targets[0];session.theme=theme;session.background=settings.background;session.blockLengths=blockLengths;return session;
}

export function huntPosition(choice,elapsedMs,visibleMs){
  if(!choice.motion)return {...choice.position};
  const t=Math.max(0,Math.min(1,elapsedMs/visibleMs));
  return {x:choice.position.x+choice.motion.distance*t,y:choice.position.y+Math.sin(t*Math.PI*2+choice.motion.phase)*choice.motion.amplitude};
}
export function huntOnScreen(choice,elapsedMs,visibleMs){
  const position=huntPosition(choice,elapsedMs,visibleMs);
  return elapsedMs>=0&&elapsedMs<visibleMs&&position.x>=-10&&position.x<=110&&position.y>=-10&&position.y<=110;
}
