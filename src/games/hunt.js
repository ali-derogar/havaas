import { ReactionSession } from '../core/reaction.js';
import { pick, shuffle, targetMask } from '../core/random.js';
import { HUNT_SETTINGS, PROTOCOL } from '../config.js';

export function createHunt(options) {
  const random = options.random ?? Math.random, theme = options.theme || 'star';
  const count = options.practice ? 5 : PROTOCOL.trials;
  const targetCount = options.targetCount === 2 ? 2 : 1;
  const settings = HUNT_SETTINGS[options.level || 'easy'];
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
  }
  const session = new ReactionSession({ ...options, gameId:'hunt', protocolVersion:3, variant:targetCount===2?'divided':'standard' },trials);
  session.stimulusVersion=2;session.targets=targets;session.target=targets[0];session.theme=theme;session.background=settings.background;session.blockLengths=blockLengths;return session;
}
