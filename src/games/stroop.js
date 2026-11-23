import {lt} from '../i18n.js';
import { ReactionSession } from '../core/reaction.js';
import { pick, targetMask } from '../core/random.js';
import {stimulusPlanFor,colorAt} from '../stimulus-plan.js';
import {COLOR_NAMES} from '../config.js';

export const STROOP_RULES = [
  { title: 'فقط دایره‌های زرد', text: 'هر وقت دایرهٔ زرد دیدی، پاسخ بده. به بقیهٔ رنگ‌ها کاری نداشته باش.' },
  { title: 'به رنگ نوشته نگاه کن', text: 'فقط وقتی رنگ نوشته زرده پاسخ بده. مهم نیست چه کلمه‌ای نوشته شده.' },
  { title: 'خود کلمه رو بخون', text: 'فقط وقتی کلمهٔ «زرد» نوشته شده پاسخ بده. رنگ نوشته مهم نیست.' },
  { title: 'هم رنگ، هم کلمه', text: 'فقط به کلمهٔ «زرد» که با رنگ زرد نوشته شده پاسخ بده. هر دو شرط باید درست باشن.' },
];
export const isStroopTarget = (phase, stimulus, targetColor='yellow') => phase <= 1 ? stimulus.color === targetColor : phase === 2 ? stimulus.word === targetColor : stimulus.color === targetColor && stimulus.word === targetColor;
export function stroopRules(session={}){
 return STROOP_RULES.map((_rule,phase)=>{const color=COLOR_NAMES[colorAt(session,phase)];
  const titles=[lt`فقط دایره‌های ${color}`,lt`فقط رنگ نوشتهٔ ${color}`,lt`فقط کلمهٔ ${color}`,lt`رنگ و کلمه، هر دو ${color}`];
  const texts=[lt`اگر دایره ${color} بود، پاسخ بده.`, lt`اگر رنگ نوشته ${color} بود، پاسخ بده؛ معنی کلمه مهم نیست.`, lt`اگر خود کلمه ${color} بود، پاسخ بده؛ رنگ نوشته مهم نیست.`, lt`فقط وقتی رنگ نوشته و معنی کلمه هر دو ${color} بودند، پاسخ بده.`];
  return {title:titles[phase],text:texts[phase]};
 });
}
export function generateStroop(practice = false, random = Math.random, plan=null) {
  const colors = ['green', 'red', 'yellow', 'blue'], counts = practice ? [2, 1, 1, 1] : [40, 40, 40, 30];
  return counts.flatMap((count, phase) => targetMask(count, practice ? (phase === 0 || phase === 3 ? 1 : 0) : count / 5, random).map(target => {
    const choices = phase === 0 ? colors.map(color => ({ shape: 'circle', color })) : colors.flatMap(color => colors.map(word => ({ shape: 'word', color, word })));
    return { phase, target, stimulus: pick(choices.filter(stimulus => isStroopTarget(phase, stimulus,plan?.colorsByPhase[phase][0]||'yellow') === target), random) };
  }));
}
export function createStroop(options) { const stimulusPlan=stimulusPlanFor({...options,gameId:'stroop'});const trials=generateStroop(options.practice,options.random,stimulusPlan);if((options.experienceVersion??4)>=4)for(const trial of trials)if(trial.stimulus.shape==='word')trial.stimulus.locale=options.locale==='en'?'en':'fa';return new ReactionSession({ ...options, gameId: 'stroop',stimulusPlan },trials); }
