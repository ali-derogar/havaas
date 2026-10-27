import { ReactionSession } from '../core/reaction.js';
import { pick, targetMask } from '../core/random.js';

export const STROOP_RULES = [
  { title: 'فقط دایره‌های زرد', text: 'هر وقت دایرهٔ زرد دیدی، پاسخ بده. به بقیهٔ رنگ‌ها کاری نداشته باش.' },
  { title: 'به رنگ نوشته نگاه کن', text: 'فقط وقتی رنگ نوشته زرده پاسخ بده. مهم نیست چه کلمه‌ای نوشته شده.' },
  { title: 'خود کلمه رو بخون', text: 'فقط وقتی کلمهٔ «زرد» نوشته شده پاسخ بده. رنگ نوشته مهم نیست.' },
  { title: 'هم رنگ، هم کلمه', text: 'فقط به کلمهٔ «زرد» که با رنگ زرد نوشته شده پاسخ بده. هر دو شرط باید درست باشن.' },
];
export const isStroopTarget = (phase, stimulus) => phase <= 1 ? stimulus.color === 'yellow' : phase === 2 ? stimulus.word === 'yellow' : stimulus.color === 'yellow' && stimulus.word === 'yellow';
export function generateStroop(practice = false, random = Math.random) {
  const colors = ['green', 'red', 'yellow', 'blue'], counts = practice ? [2, 1, 1, 1] : [40, 40, 40, 30];
  return counts.flatMap((count, phase) => targetMask(count, practice ? (phase === 0 || phase === 3 ? 1 : 0) : count / 5, random).map(target => {
    const choices = phase === 0 ? colors.map(color => ({ shape: 'circle', color })) : colors.flatMap(color => colors.map(word => ({ shape: 'word', color, word })));
    return { phase, target, stimulus: pick(choices.filter(stimulus => isStroopTarget(phase, stimulus) === target), random) };
  }));
}
export function createStroop(options) { return new ReactionSession({ ...options, gameId: 'stroop' }, generateStroop(options.practice, options.random)); }
