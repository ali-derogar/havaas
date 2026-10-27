import { ReactionSession } from '../core/reaction.js';
import { targetMask } from '../core/random.js';
import { PROTOCOL } from '../config.js';
export function createTraffic(options) {
  const trials = targetMask(options.practice ? 5 : PROTOCOL.trials, options.practice ? 2 : PROTOCOL.targets, options.random).map(target => ({ target, stimulus: { shape: options.trafficMode === 'signs' ? (target ? 'oneway' : 'noentry') : 'circle', color: target ? 'green' : 'red' }, phase: 0 }));
  return new ReactionSession({ ...options, gameId: 'traffic', variant: options.trafficMode === 'signs' ? 'signs' : 'standard' }, trials);
}
