/** A monotonic clock which excludes every paused interval. */
export class ActiveClock {
  constructor(now = () => performance.now()) { this.now = now; this.startedAt = now(); this.pauseAt = null; this.pausedMs = 0; }
  get elapsed() { return Math.max(0, (this.pauseAt ?? this.now()) - this.startedAt - this.pausedMs); }
  pause() { if (this.pauseAt === null) this.pauseAt = this.now(); }
  resume() { if (this.pauseAt !== null) { this.pausedMs += this.now() - this.pauseAt; this.pauseAt = null; } }
  get paused() { return this.pauseAt !== null; }
}

export class Session {
  constructor({ gameId, level = 'easy', practice = false, variant = 'standard', protocolVersion = 2, now, random = Math.random }) {
    this.gameId = gameId; this.level = level; this.practice = practice; this.random = random;
    this.outcomes = []; this.finishedAt = null; this.protocolVersion = protocolVersion;
    this.variant = variant; this.reactionMeasure = 'stimulus-onset';
    this.clock = new ActiveClock(now); this.done = false; this.completed = false; this.feedback = ''; this.feedbackKind = '';
    this.metrics = { hits: 0, misses: 0, falseAlarms: 0, correctRejects: 0, streak: 0, maxStreak: 0, reactionTimes: [] };
  }
  get paused() { return this.clock.paused; }
  pause() { this.tick(); if (!this.done) this.clock.pause(); }
  resume() { this.clock.resume(); }
  record(target, response, reactionMs = null, context = {}) {
    const correct = target ? response && context.selectedTarget !== false : !response;
    this.outcomes.push({ number: this.outcomes.length + 1, target, response, correct, reactionMs, atMs: Math.round(this.clock.elapsed), ...context });
    const m = this.metrics;
    if (target && response && correct) { m.hits++; if (reactionMs !== null) m.reactionTimes.push(Math.max(0, reactionMs)); }
    else if (target && !response) m.misses++;
    else if (response) m.falseAlarms++;
    else m.correctRejects++;
    if (correct) { m.streak++; m.maxStreak = Math.max(m.maxStreak, m.streak); } else m.streak = 0;
  }
  finish(completed = true) { if (this.done) return; this.finishedAt = new Date().toISOString(); this.completed = completed; this.done = true; this.clock.pause(); }
  get result() {
    const m = this.metrics, times = m.reactionTimes;
    return {
      version: 1, protocolVersion: this.protocolVersion, gameId: this.gameId, level: this.level, variant: this.variant, score: this.score, maxScore: this.maxScore,
      hits: m.hits, correctResponses: m.hits + m.correctRejects, correctRejections: m.correctRejects, omissions: m.misses, falseSelections: m.falseAlarms,
      meanReactionMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, reactionMeasure: this.reactionMeasure,
      longestStreak: m.maxStreak, durationMs: Math.round(this.clock.elapsed), completed: this.completed, finishedAt: this.finishedAt || new Date().toISOString(), outcomes: this.outcomes.map(outcome => ({ ...outcome })),
    };
  }
}
