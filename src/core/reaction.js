import { Session } from './session.js';
import { LEVELS, PROTOCOL } from '../config.js';

export class ReactionSession extends Session {
  constructor(options, trials) {
    super(options); this.trials = trials; this.index = 0; this.onset = 0; this.response = null; this.gate = false;
    this.maxScore = trials.filter(t => t.scored !== false && t.target).length;
    this.total = trials.filter(t => t.scored !== false).length;
  }
  get current() { return this.trials[this.index]; }
  get position() { return this.trials.slice(0, this.index).filter(t => t.scored !== false).length; }
  get score() { return Math.max(0, this.metrics.hits - this.metrics.falseAlarms); }
  get visible() { return !this.done && !this.gate && !this.paused && this.clock.elapsed - this.onset < LEVELS[this.level].visibleMs; }
  get remainingMs() { return Math.max(0, PROTOCOL.intervalMs - (this.clock.elapsed - this.onset)); }
  tick() {
    if (this.done || this.paused || this.gate || this.clock.elapsed - this.onset < PROTOCOL.intervalMs) return;
    const old = this.current;
    if (old.scored !== false) this.record(old.target, !!this.response, this.response?.reactionMs ?? null, { phase: old.phase, stimulus: old.stimulus });
    this.index++; this.response = null;
    if (this.index >= this.trials.length) { this.finish(); return; }
    this.onset = this.clock.elapsed;
    if (old.phase !== this.current.phase) { this.gate = true; this.clock.pause(); }
  }
  respond() {
    if (this.done || this.paused || this.gate) return null;
    // Expired input belongs to the old display, never to an unseen next trial.
    if (this.clock.elapsed - this.onset >= PROTOCOL.intervalMs) { this.tick(); return null; }
    if (this.response || this.current.scored === false) return null;
    this.response = { reactionMs: this.clock.elapsed - this.onset };
    this.feedback = this.current.target ? 'آفرین، درست بود!' : 'این یکی هدف نبود؛ با دقت ادامه بده.';
    this.feedbackKind = this.current.target ? 'good' : 'wrong';
    return this.current.target;
  }
  respondToStimulus(index) {
    if (index !== this.index || !this.visible) return null;
    return this.respond();
  }
  resume() {
    if (this.gate) return;
    super.resume();
    // A replay is the same trial. Its previous response, if any, remains locked.
    if (!this.response) this.onset = this.clock.elapsed;
  }
  acknowledge() { if (!this.gate) return; this.gate = false; this.clock.resume(); this.onset = this.clock.elapsed; }
}
