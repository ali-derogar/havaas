import { ReactionSession } from '../core/reaction.js';
import { pick, targetMask } from '../core/random.js';
import { LEVELS, PROTOCOL } from '../config.js';

export function generateNBack(n, count, targets, random = Math.random) {
  const alphabet = ['star', 'circle', 'triangle', 'diamond', 'square', 'heart'];
  const values = Array.from({ length: n }, () => pick(alphabet, random));
  const trials = values.map(shape => ({ target: false, scored: false, phase: 0, stimulus: { shape, color: 'blue' } }));
  for (const target of targetMask(count, targets, random)) {
    const reference = values[values.length - n];
    const shape = target ? reference : pick(alphabet.filter(value => value !== reference), random);
    values.push(shape); trials.push({ target, phase: 0, stimulus: { shape, color: 'blue' } });
  }
  return trials;
}
export function createNBack(options) {
  const n = LEVELS[options.level || 'easy'].n;
  const trials = generateNBack(n, options.practice ? 5 : PROTOCOL.trials, options.practice ? 2 : PROTOCOL.targets, options.random);
  const session = new ReactionSession({ ...options, gameId: 'nback' }, trials); session.n = n; return session;
}
